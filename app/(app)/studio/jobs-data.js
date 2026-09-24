"use client";
// app/(app)/studio/jobs-data.js — the Studio "job" model.
//
// Studio used to hold exactly one shared "active client" object — switching
// the ClientBar's sample dropdown OVERWROTE it in place, so there was no way
// to see more than one job, and nothing tied survey/paperwork/install/
// monitoring progress together into "where does this job actually stand."
// This file turns that into a real list of jobs, each carrying a PIPELINE
// STAGE that is always DERIVED from what has actually happened in the other
// tools — never hand-set — so it can't drift stale the way a manually-picked
// status field would. Still localStorage-only: Studio never touches Supabase.
import { DEFAULT_IDS } from "./catalog-data.js";
import { simulate, effectiveYield } from "./_engine.js";
import { defaultEngineSettings } from "./_engine.js";

export function readJSON(key, fallback) {
  try {
    const s = localStorage.getItem(key);
    return s ? JSON.parse(s) : fallback;
  } catch {
    return fallback;
  }
}
export function writeJSON(key, val) {
  try { localStorage.setItem(key, JSON.stringify(val)); } catch { /* private mode */ }
}

/* --------------------------------------------------------------- seed jobs -- */
// Same four demo jobs Studio has always shipped — now doubling as the seed
// job list instead of four mutually-exclusive "load a sample" overwrites.
export const CLIENT_PRESETS = [
  { id: "rusu", name: "Familia Rusu", address: "str. Alexandru cel Bun 15, Ialoveni, MD-6801", lat: 46.9412, lng: 28.7770, contractNo: "PE-IAL-2026-03318", ref: "VM-2026-0331", market: "MD", kw: 6.5, cons: 6200, price: 0.185, batteryKwh: 9.6, phases: 3, atestat: "ANRE-MC nr. 2026/PV-0148",
    panelId: DEFAULT_IDS.panel, inverterId: DEFAULT_IDS.inverter, batteryId: DEFAULT_IDS.battery, mountId: DEFAULT_IDS.mount },
  { id: "popescu", name: "Familie Popescu", address: "str. Donath 128, Cluj-Napoca", lat: 46.7623, lng: 23.5558, contractNo: "DEER-CJ-2026-11832", ref: "VM-2026-1183", market: "RO", kw: 8.5, cons: 8000, price: 0.21, batteryKwh: 0, phases: 1, atestat: "ANRE tip B nr. 2026/24417",
    panelId: DEFAULT_IDS.panel, inverterId: "growatt-min6000tl-xh", batteryId: DEFAULT_IDS.battery, mountId: DEFAULT_IDS.mount },
  { id: "logipark", name: "Hala Chiajna — LogiPark SRL", address: "DN7 km 12, Chiajna, jud. Ilfov", lat: 44.4682, lng: 25.9760, contractNo: "EDMuntenia-2026-55901", ref: "VM-BNK-2026-0093", market: "RO", kw: 180, cons: 240000, price: 0.142, batteryKwh: 0, phases: 3, atestat: "ANRE tip B nr. 2026/24417",
    panelId: "jinko-tigerneo-615", inverterId: "sofar-hyd20ktl-3ph", batteryId: DEFAULT_IDS.battery, mountId: "k2-crossrail" },
  { id: "agronord", name: "Fabrica AgroNord SRL", address: "str. Uzinelor 210, Chișinău, MD-2036", lat: 47.0304, lng: 28.8912, contractNo: "PE-CHI-2026-09920", ref: "VM-CI-2026-0300", market: "MD", kw: 300, cons: 540000, price: 0.16, batteryKwh: 0, phases: 3, atestat: "ANRE-MC nr. 2026/PV-0300",
    panelId: "longi-hi-mo9-610", inverterId: "huawei-sun2000-100ktl", batteryId: DEFAULT_IDS.battery, mountId: "k2-crossrail" },
];

export const JOBS_KEY = "voltmira_studio_jobs_v2";
export const ACTIVE_KEY = "voltmira_studio_active_job";
const OLD_CLIENT_KEY = "voltmira_studio_client";
export const WEEK_KEY = "voltmira_studio_week";
export const installKey = (jobId) => "voltmira_studio_install_" + jobId;
export const actualsKey = (jobId) => "voltmira_studio_actuals_" + jobId;
export const payKey = (jobId) => "voltmira_studio_pay_" + jobId;
export const ticketsKey = (jobId) => "voltmira_studio_tickets_" + jobId;

// Real per-job service tickets — replaces a hardcoded, job-agnostic list that
// used to show the same 3 fake tickets regardless of which job was open.
export function loadTickets(jobId) {
  return readJSON(ticketsKey(jobId), []);
}
// `tag` (optional) lets a caller recognise a ticket it raised itself — the
// Monitoring tab tags one per diagnosed cause so it can show "already logged".
export function addTicket(jobId, issue, tag) {
  const next = [{ id: newJobId(), issue, open: true, at: Date.now(), ...(tag ? { tag } : {}) }, ...loadTickets(jobId)];
  writeJSON(ticketsKey(jobId), next);
  return next;
}
export function toggleTicket(jobId, ticketId) {
  const next = loadTickets(jobId).map((t) => (t.id === ticketId ? { ...t, open: !t.open } : t));
  writeJSON(ticketsKey(jobId), next);
  return next;
}

export function newJobId() {
  return "job-" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

// Loads the job list, migrating the old single-client key in as an extra job
// (so a returning demo session doesn't lose whatever it had open) the first
// time this runs after the redesign, then never again.
export function loadJobsState() {
  const saved = readJSON(JOBS_KEY, null);
  if (Array.isArray(saved) && saved.length) {
    return { jobs: saved, activeId: readJSON(ACTIVE_KEY, saved[0].id) };
  }
  const jobs = CLIENT_PRESETS.map((p) => ({ ...p }));
  const legacy = readJSON(OLD_CLIENT_KEY, null);
  if (legacy && legacy.name && !jobs.some((j) => j.name === legacy.name && j.address === legacy.address)) {
    jobs.push({ ...legacy, id: legacy.id && !CLIENT_PRESETS.some((p) => p.id === legacy.id) ? legacy.id : newJobId() });
  }
  writeJSON(JOBS_KEY, jobs);
  return { jobs, activeId: jobs[0].id };
}
export function saveJobsState(jobs, activeId) {
  writeJSON(JOBS_KEY, jobs);
  if (activeId) writeJSON(ACTIVE_KEY, activeId);
}

/* -------------------------------------------------------------- pipeline --- */
// Five stages, each gated on a signal that already exists in one of the
// other tools — nothing here is a field the installer sets by hand.
// `step` is the Configuration Workspace tab index each stage's "fix this"
// link jumps to (0 Site&Roof, 1 Equipment, 2 Financials, 3 Grid Connection,
// 4 Installation, 5 Monitoring, 6 Documents) — the Workspace absorbed the
// standalone survey/annex/schedule/monitoring pages these used to link to.
export const STAGES = [
  { key: "survey", step: 0, chip: "blue",
    label: { en: "Survey", ro: "Vizită", ru: "Осмотр" },
    todo: { en: "Site survey not done yet", ro: "Vizita tehnică nu a fost făcută încă", ru: "Техосмотр ещё не проведён" } },
  { key: "paperwork", step: 3, chip: "amber",
    label: { en: "Paperwork", ro: "Documentație", ru: "Документы" },
    todo: { en: "Grid-connection paperwork not filed yet", ro: "Dosarul de racordare nu a fost depus", ru: "Заявка на подключение не подана" } },
  { key: "install", step: 4, chip: "amber",
    label: { en: "Install", ro: "Montaj", ru: "Монтаж" },
    todo: { en: "Not scheduled for install yet", ro: "Nu e programată la montaj", ru: "Монтаж не запланирован" } },
  { key: "handover", step: 4, chip: "green-soft",
    label: { en: "Handover", ro: "Predare", ru: "Передача" },
    todo: { en: "Handover certificate not signed yet", ro: "Certificatul de predare nu a fost semnat", ru: "Акт передачи не подписан" } },
  { key: "monitoring", step: 5, chip: "green",
    label: { en: "Monitoring", ro: "Monitorizare", ru: "Мониторинг" },
    todo: { en: "No production data logged yet", ro: "Nicio producție înregistrată încă", ru: "Данные о выработке не внесены" } },
];
export const stageIndex = (key) => Math.max(0, STAGES.findIndex((s) => s.key === key));

// The three real signals a job's stage depends on, read straight from the
// same localStorage keys the survey/schedule/monitoring tools already use.
export function jobStageContext(jobId) {
  const week = readJSON(WEEK_KEY, []);
  const scheduled = Array.isArray(week) && week.some((w) => w.jobId === jobId);
  const install = readJSON(installKey(jobId), null);
  const signed = !!(install && install.signed);
  const actuals = readJSON(actualsKey(jobId), null);
  const hasActuals = Array.isArray(actuals) && actuals.some((v) => v !== "" && v != null && !Number.isNaN(+v));
  return { scheduled, signed, hasActuals };
}

export function deriveStage(job, ctx) {
  if (!job.roofFactor) return "survey";
  if (!job.paperworkFiled) return "paperwork";
  if (!ctx.signed) return "install";
  if (!ctx.hasActuals) return "handover";
  return "monitoring";
}

// Real per-tab completion for the Workspace stepper — same signals
// jobStageContext/deriveStage already use, just addressed by Workspace tab
// index instead of pipeline stage key (the two orderings differ: paperwork
// is tab 3 but a later pipeline stage than install's tab 4). Documents (6)
// has no "done" state of its own — it's a summary, not a task.
export function isStepDone(stepIdx, job, ctx) {
  switch (stepIdx) {
    case 0: return job.roofFactor != null;
    case 1: return !!job.panelId && !!job.inverterId;
    case 2: return job.financing != null;
    case 3: return !!job.paperworkFiled;
    case 4: return !!ctx.signed;
    case 5: return !!ctx.hasActuals;
    default: return false;
  }
}

// One-call convenience: stage key + the raw signals + the metadata row, for
// a single job. Cheap enough to call once per job per render (a handful of
// localStorage reads, no engine math).
export function jobProgress(job) {
  const ctx = jobStageContext(job.id);
  const key = deriveStage(job, ctx);
  const meta = STAGES[stageIndex(key)];
  return { key, ctx, meta, index: stageIndex(key) };
}

/* ---------------------------------------------------------------- money ---- */
// Per-job payment state (deposit paid? balance settled?) — the same record
// the payments tool edits and the job hub's money badge reads, so they can
// never show two different answers for the same job.
export function payRecord(jobId) {
  return readJSON(payKey(jobId), { depPct: 30, depPaid: false, done: false });
}
export function setPayRecord(jobId, patch) {
  const next = { ...payRecord(jobId), ...patch };
  writeJSON(payKey(jobId), next);
  return next;
}

// Deposit/balance + paid/settled, in one call — the same shape the job hub's
// money badge and the payments tool both render from, so they can't disagree.
export function jobMoneySummary(job) {
  const eur = jobCostEur(job);
  const pay = payRecord(job.id);
  const dep = (eur * pay.depPct) / 100;
  const bal = eur - dep;
  return { eur, dep, bal, depPaid: pay.depPaid, done: pay.done };
}

// The engine's own honest-quote cost for a job, in EUR — the same
// computation annex/bankability/payments already each did independently.
export function jobCostEur(job) {
  const E = defaultEngineSettings();
  const sim = simulate({
    market: job.market, kw: +job.kw || 0, price: +job.price || 0.185,
    cons: +job.cons || 0, batt: (+job.batteryKwh || 0) > 0, battKwh: +job.batteryKwh || 0,
    yieldOverride: effectiveYield(job),
  }, E, "expc");
  return sim.grossCost;
}
