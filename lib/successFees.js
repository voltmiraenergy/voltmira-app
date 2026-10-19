// lib/successFees.js — VoltMira's pay-per-signed-job model: an installer uses
// everything for free, and pays when a client signs a job.
//
// THE RULES (decided 2026-10-19; a local preview until the model launches)
//   200 lei per kW of a signed job, at most 8,000 lei a job
//   the first 2 signed jobs that go ahead are free
//   a job the client cancels (signed, then lost) has no fee
//   monitoring stays 1.50 EUR a system a month after the first 10
//   (lib/monitoringPricing.js), on the same monthly statement
// Banks pay their own commission on funded loans (lib/commission.js); the
// installer never sees it. No credits, no offer limit, no paid plan.
//
// WHAT COUNTS AS SIGNED. Nothing new is stored. A job is signed when the
// client signed its offer online (proposals.accepted_at), when the installer
// marked it won (its "won" activity row) or, failing both, when its status is
// won (the date is then its last change, and says so). A signed job that is
// now lost was cancelled. Sample rows never count. A job belongs to the month
// it was signed in, Chisinau time.
//
// THE SWITCH. NEXT_PUBLIC_SUCCESS_FEES=on in .env.local, in a development
// build only: a production build ignores it, so nothing changes for anyone
// until the model launches. Read by literal name so Next.js inlines it in the
// browser too. Pure; no I/O.
import { mdMonthKey } from "./tz.js";
import { csvEsc } from "./csv.js";

export const LEI_PER_KW = 200;
export const MAX_LEI_PER_JOB = 8000;
export const FREE_JOBS = 2;
export const RULES = { leiPerKw: LEI_PER_KW, maxLeiPerJob: MAX_LEI_PER_JOB, freeJobs: FREE_JOBS };

/** Whether the model is on, from an environment (testable). */
export const feesOnFor = (flag, nodeEnv) => nodeEnv !== "production" && String(flag || "").toLowerCase() === "on";

/** Whether the model is on in this build. */
export const successFeesOn = () => feesOnFor(process.env.NEXT_PUBLIC_SUCCESS_FEES, process.env.NODE_ENV);

/** Under the model an invoice is for a signed job: true when this status may not be invoiced. */
export const invoiceBlocked = (status) => successFeesOn() && status !== "won";

/** The fee on a job of `kw`, in lei: 200 lei a kW, at most 8,000. */
export function feeForKw(kw) {
  const k = Number(kw);
  if (!(k > 0)) return 0;
  return Math.min(MAX_LEI_PER_JOB, Math.round(k * LEI_PER_KW));
}

/** The project id in an activity link such as "/projects/<id>". */
export function projectIdOf(link) {
  const m = String(link || "").match(/\/projects\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})(?:[/?#]|$)/i);
  return m ? m[1].toLowerCase() : null;
}

/** The month an ISO time falls in, Chisinau time: "2026-10". */
export const periodOf = (iso) => (iso ? mdMonthKey(iso) : null);

/**
 * A workspace's signed jobs, oldest first.
 * @param {object} d
 * @param {object[]} d.projects   { id, title, client_name, kw, status, updated_at, sample }
 * @param {object[]} [d.proposals] { project_id, accepted_at }
 * @param {object[]} [d.wonActs]   activity rows of kind "won": { link, created_at }
 * @returns {{ id, title, client, kw, signedAt, period, how: "online"|"marked"|"status", cancelled: boolean }[]}
 */
export function signedJobs({ projects = [], proposals = [], wonActs = [] }) {
  const earliest = (map, id, at) => { if (id && at && (!map.has(id) || at < map.get(id))) map.set(id, at); };
  const online = new Map(), marked = new Map();
  for (const p of proposals || []) earliest(online, p.project_id, p.accepted_at);
  for (const a of wonActs || []) earliest(marked, projectIdOf(a.link), a.created_at);
  const out = [];
  for (const p of projects || []) {
    if (p.sample) continue;
    if (p.status !== "won" && p.status !== "lost") continue;
    const at = online.get(p.id) || marked.get(p.id) || (p.status === "won" ? p.updated_at : null);
    if (!at) continue;   // lost and never signed: not a job
    out.push({
      id: p.id, title: p.title || "", client: p.client_name || "", kw: Number(p.kw) || 0,
      signedAt: at, period: periodOf(at),
      how: online.has(p.id) ? "online" : marked.has(p.id) ? "marked" : "status",
      cancelled: p.status === "lost",
    });
  }
  return out.sort((a, b) => String(a.signedAt).localeCompare(String(b.signedAt)));
}

/**
 * The fee on each signed job, in signing order. `from` ("YYYY-MM-DD") leaves
 * out jobs signed before the model started for this workspace.
 * status: "free" (one of the first 2, freeN says which), "due", "cancelled",
 * "no_size" (no kW on the quote), "before" (signed before `from`).
 */
export function assignFees(jobs, { from = null } = {}) {
  let free = 0;
  return (jobs || []).map((j) => {
    const full = feeForKw(j.kw);
    if (from && String(j.signedAt).slice(0, 10) < from) return { ...j, full, fee: 0, status: "before" };
    if (j.cancelled) return { ...j, full, fee: 0, status: "cancelled" };
    if (free < FREE_JOBS) { free += 1; return { ...j, full, fee: 0, status: "free", freeN: free }; }
    return { ...j, full, fee: full, status: full > 0 ? "due" : "no_size" };
  });
}

/** How many of the free jobs are left, and what the next signed job would cost. */
export function nextJob(rows, kw) {
  const used = (rows || []).filter((r) => r.status === "free").length;
  const left = Math.max(0, FREE_JOBS - used);
  return left > 0 ? { left, fee: 0, free: true, freeN: used + 1 } : { left: 0, fee: feeForKw(kw), free: false };
}

/** One month of a workspace's jobs and their total. */
export function monthOf(rows, period) {
  const jobs = (rows || []).filter((r) => r.period === period && r.status !== "before");
  const live = jobs.filter((r) => r.status !== "cancelled");
  return {
    period, jobs,
    signed: live.length,
    free: jobs.filter((r) => r.status === "free").length,
    cancelled: jobs.length - live.length,
    due: jobs.filter((r) => r.status === "due").length,
    kw: Math.round(live.reduce((s, r) => s + r.kw, 0) * 10) / 10,
    feeLei: jobs.reduce((s, r) => s + r.fee, 0),
  };
}

/** Every month with a signed job, newest first, plus the current one even when empty. */
export function months(rows, current) {
  const set = new Set((rows || []).filter((r) => r.status !== "before").map((r) => r.period));
  if (current) set.add(current);
  return [...set].filter(Boolean).sort().reverse().map((p) => monthOf(rows, p));
}

/**
 * A month's statement for one workspace: the job fees and the monitoring bill
 * (lib/monitoringPricing.js monitoringBill()), monitoring in lei at the rate
 * of the day.
 */
export function statement(month, monitoring = null, eurMdl = null) {
  const monEur = monitoring?.monthlyEur || 0;
  const monLei = eurMdl ? Math.round(monEur * eurMdl) : null;
  return {
    ...month,
    monitoring: monitoring ? { ...monitoring, monthlyLei: monLei } : null,
    totalLei: month.feeLei + (monLei || 0),
  };
}

/** The admin's monthly CSV: one row per workspace; "internal" marks the team's own, never to invoice. */
export function revenueCsv(rows, period) {
  const head = ["month", "workspace", "workspace_id", "signed_jobs", "free_jobs", "cancelled_jobs", "kw_signed", "job_fees_lei",
    "monitored_systems", "billable_systems", "monitoring_eur", "monitoring_lei", "total_lei", "internal"];
  const lines = [head.join(",")];
  for (const r of rows || []) {
    lines.push([period, r.name, r.companyId, r.signed, r.free, r.cancelled, r.kw, r.feeLei,
      r.monitoring?.systems ?? 0, r.monitoring?.billable ?? 0, r.monitoring?.monthlyEur ?? 0, r.monitoring?.monthlyLei ?? "", r.totalLei, r.internal ? "yes" : "no"].map(csvEsc).join(","));
  }
  return lines.join("\n") + "\n";
}
