// lib/milestones.js — the client's payments for a signed job, in stages (docs/features/phase4.md): a schedule of
// percentages tied to the job's steps (50% at signing, 40% at installation, 10% at grid connection by default), each
// stage an invoice from the installer's own series once its step is reached, paid by bank transfer against a pay
// link, with reminders before and after its due day. Pure, no I/O: lib/milestoneServer.js reads and writes the rows.
import { mdDayKey } from "./tz.js";

/** What can trigger a stage: the client signing, or one of the install steps (lib/jobBoard.js JOB_STEPS). */
export const MILESTONE_TRIGGERS = ["signed", "order", "install", "grid", "commission"];
export const DEFAULT_SCHEDULE = { steps: [{ trigger: "signed", pct: 50 }, { trigger: "install", pct: 40 }, { trigger: "grid", pct: 10 }], termDays: 7 };
export const REMINDER_STEPS = ["issued", "before3", "due", "late3", "late10"];
const DAY = 864e5;

/**
 * A schedule as typed: 1 to 5 stages, each trigger once, whole percentages adding up to 100, in the steps' order;
 * days to pay 1 to 60.
 * @param {number} [mustSum]  what the stages must add up to (100, or what is left after the stages already issued)
 * @returns {{ ok: true, schedule: { steps, termDays } } | { ok: false, error: string }}
 */
export function cleanSchedule(raw, mustSum = 100) {
  const list = Array.isArray(raw?.steps) ? raw.steps : [];
  if (list.length < 1 || list.length > 5) return { ok: false, error: "steps" };
  const steps = [];
  for (const s of list) {
    const pct = Number(s?.pct);
    if (!MILESTONE_TRIGGERS.includes(s?.trigger)) return { ok: false, error: "trigger" };
    if (!Number.isInteger(pct) || pct < 1 || pct > 100) return { ok: false, error: "pct" };
    if (steps.some((x) => x.trigger === s.trigger)) return { ok: false, error: "twice" };
    steps.push({ trigger: s.trigger, pct });
  }
  if (steps.reduce((t, s) => t + s.pct, 0) !== mustSum) return { ok: false, error: "sum" };
  steps.sort((a, b) => MILESTONE_TRIGGERS.indexOf(a.trigger) - MILESTONE_TRIGGERS.indexOf(b.trigger));
  const term = Number(raw?.termDays ?? DEFAULT_SCHEDULE.termDays);
  if (!Number.isInteger(term) || term < 1 || term > 60) return { ok: false, error: "term" };
  return { ok: true, schedule: { steps, termDays: term } };
}

/** The schedule a job uses: its own, else the workspace's, else the default (whichever is valid first). */
export function scheduleOf(...candidates) {
  for (const c of candidates) {
    const r = c ? cleanSchedule(c) : null;
    if (r?.ok) return r.schedule;
  }
  return DEFAULT_SCHEDULE;
}

/**
 * Split an amount by percentages in whole units (lei, euro), the last stage taking what rounding leaves, so the
 * stages always add up to the amount exactly.
 * @returns {number[]} minor units
 */
export function splitAmounts(totalMinor, pcts) {
  const total = Math.max(0, Math.round(Number(totalMinor) || 0));
  const sum = pcts.reduce((t, p) => t + p, 0) || 1;
  const out = pcts.map((p) => Math.round((total * p) / sum / 100) * 100);
  out[out.length - 1] = total - out.slice(0, -1).reduce((t, v) => t + v, 0);
  return out;
}

/** The stages for a job just signed: one row each, planned, with its share of the price. */
export function planFor({ grossMinor, currency, schedule }) {
  const amounts = splitAmounts(grossMinor, schedule.steps.map((s) => s.pct));
  return schedule.steps.map((s, i) => ({ seq: i + 1, trigger: s.trigger, pct: s.pct, amount_minor: amounts[i], currency, status: "planned", term_days: schedule.termDays }));
}

/**
 * A new plan for the stages not issued yet: the price left after the issued ones, split by the new percentages,
 * which must add up to what the issued ones leave.
 * @returns {{ ok: true, rows: object[] } | { ok: false, error: string }}
 */
export function replan({ rows, steps, termDays, grossMinor, currency }) {
  const issued = rows.filter((r) => r.status !== "planned" && r.status !== "void");
  const usedPct = issued.reduce((t, r) => t + Number(r.pct), 0);
  const taken = new Set(issued.map((r) => r.trigger));
  if (steps.some((s) => taken.has(s.trigger))) return { ok: false, error: "issued" };
  const c = cleanSchedule({ steps, termDays }, 100 - usedPct);
  if (!c.ok) return c;
  const left = Math.max(0, grossMinor - issued.reduce((t, r) => t + Number(r.amount_minor), 0));
  const amounts = splitAmounts(left, c.schedule.steps.map((s) => s.pct));
  const start = issued.reduce((m, r) => Math.max(m, Number(r.seq)), 0);
  return {
    ok: true,
    rows: c.schedule.steps.map((s, i) => ({ seq: start + i + 1, trigger: s.trigger, pct: s.pct, amount_minor: amounts[i], currency, status: "planned", term_days: c.schedule.termDays })),
  };
}

/** Has this stage's step been reached? Signing: the job is won; the others: that install step is ticked. */
export function reached(trigger, { won, progress }) {
  if (!won) return false;
  return trigger === "signed" ? true : !!(progress || {})[trigger];
}

/** The day a stage is due: its days to pay after the day it was issued (Chișinău days). */
export function dueOn(issuedAt, termDays) {
  return mdDayKey(Date.parse(issuedAt) + (Number(termDays) || DEFAULT_SCHEDULE.termDays) * DAY);
}

const days = (a, b) => Math.round((Date.parse(b + "T12:00:00Z") - Date.parse(a + "T12:00:00Z")) / DAY);

/**
 * Where a stage stands today: planned (its step not reached), paid, void (the client gave up), or, once issued,
 * overdue, due soon (3 days or fewer) or open.
 */
export function stateOf(m, today = mdDayKey(Date.now())) {
  if (m.status === "planned" || m.status === "void") return m.status;
  if (m.status === "paid" || Number(m.paid_minor) >= Number(m.amount_minor)) return "paid";
  if (!m.due_on) return "open";
  const left = days(today, m.due_on);
  return left < 0 ? "overdue" : left <= 3 ? "due_soon" : "open";
}

/** The reminder an unpaid issued stage is at today: issued, 3 days before, the day, 3 and 10 days late. */
export function reminderStep(m, today = mdDayKey(Date.now())) {
  if (m.status !== "issued" || !m.due_on || Number(m.paid_minor) >= Number(m.amount_minor)) return null;
  const d = days(m.due_on, today);   // days past the due day
  if (d >= 10) return "late10";
  if (d >= 3) return "late3";
  if (d >= 0) return "due";
  if (d >= -3) return "before3";
  return "issued";
}

/** The reference the client's transfer carries: the invoice number without its dashes. */
export const payRef = (invoiceNo) => String(invoiceNo || "").replace(/[^0-9A-Z]/gi, "").toUpperCase();

/**
 * The "Încasări" tiles for one currency: overdue, due within 7 days, due within 30 days (and the stages still to
 * come), received this month.
 * @param {object[]} ms        the workspace's stages
 * @param {object[]} payments  its payments ({ amount_minor, currency, paid_at })
 */
export function cashTiles(ms, payments, currency, today = mdDayKey(Date.now())) {
  const t = { overdue: { n: 0, minor: 0 }, week: { n: 0, minor: 0 }, month: { n: 0, minor: 0 }, planned: { n: 0, minor: 0 }, received: { n: 0, minor: 0 } };
  for (const m of ms) {
    if (m.currency !== currency) continue;
    const st = stateOf(m, today);
    const owed = Math.max(0, Number(m.amount_minor) - (Number(m.paid_minor) || 0));
    if (st === "planned") { t.planned.n++; t.planned.minor += owed; continue; }
    if (st === "paid" || st === "void" || !owed) continue;
    const left = days(today, m.due_on);
    if (left < 0) { t.overdue.n++; t.overdue.minor += owed; }
    else {
      if (left <= 7) { t.week.n++; t.week.minor += owed; }
      if (left <= 30) { t.month.n++; t.month.minor += owed; }
    }
  }
  const thisMonth = today.slice(0, 7);
  for (const p of payments) {
    if (p.currency === currency && String(p.paid_at || "").slice(0, 7) === thisMonth) { t.received.n++; t.received.minor += Number(p.amount_minor) || 0; }
  }
  return t;
}

/** Month by month, the last `n` months: what was invoiced (stages issued) and what was received, in one currency. */
export function cashHistory(ms, payments, currency, n = 6, today = mdDayKey(Date.now())) {
  const [y, mo] = today.slice(0, 7).split("-").map(Number);
  const keys = [];
  for (let k = n - 1; k >= 0; k--) keys.push(new Date(Date.UTC(y, mo - 1 - k, 15)).toISOString().slice(0, 7));
  const row = new Map(keys.map((k) => [k, { month: k, invoicedMinor: 0, receivedMinor: 0 }]));
  for (const m of ms) {
    if (m.currency !== currency || !m.issued_at || m.status === "void") continue;
    const r = row.get(mdDayKey(Date.parse(m.issued_at)).slice(0, 7));
    if (r) r.invoicedMinor += Number(m.amount_minor) || 0;
  }
  for (const p of payments) {
    const r = p.currency === currency ? row.get(String(p.paid_at || "").slice(0, 7)) : null;
    if (r) r.receivedMinor += Number(p.amount_minor) || 0;
  }
  return keys.map((k) => row.get(k)).reverse();
}
