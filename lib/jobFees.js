// lib/jobFees.js — VoltMira's one charge: a fee for each signed job (docs/features/job-fees.md). Free for every
// installer otherwise. Pure, no I/O: the server (lib/jobFeeServer.js) reads and writes the rows, this decides.
//
//   price      200 lei for each kW of the signed system, at most 8,000 lei a job: two constants, change them here only
//   due        when the client signs online, or the installer marks the job signed: the same fee
//   free       the company's first 2 signed jobs, counted per company tax id (IDNO) across its workspaces
//   cancelled  the client gives up: nothing is owed for that job; if its month was already paid, the amount becomes
//              credit on the next statement
//   billing    the month's fees go on one statement at the start of the next month, paid by bank transfer within
//              14 days (by the 15th); a job whose statement is still unpaid after that has its paperwork locked
//   repricing  only upward while unpaid (a bigger system after the signature); never down; frozen once paid
// Off unless JOB_FEES=on: until then nothing is locked (fees are still recorded, so the switch has history to read).
import { atLocal, dayKeyOf } from "./tz.js";

export const FEE_PER_KW_MINOR = 20000;     // 200 lei
export const FEE_CAP_MINOR = 800000;       // 8,000 lei
export const FREE_JOBS = 2;
export const PAY_DAYS = 14;
const DAY = 864e5;

/** The paperwork a due fee locks once its statement is overdue. The offer, its sending and tracking, the client's
 *  page and the offer PDF are never locked. */
export const LOCKED_DOCS = ["contract", "invoice", "grid_file", "grid_submit", "commissioning", "handover", "annex", "performance", "diagram"];

export const feePaywallOn = (env = process.env) => String(env.JOB_FEES || "").toLowerCase() === "on";

/**
 * The fee for a signed system of `kw`: 200 lei a kW, in whole lei, at most 8,000.
 * @returns {{ minorMdl: number, capped: boolean, tier: 0|1 }}  tier 1 marks a capped fee (the table's tier column)
 */
export function feeFor(kw) {
  const k = Number(kw);
  const v = Number.isFinite(k) && k > 0 ? k : 0;
  const raw = Math.round((v * FEE_PER_KW_MINOR) / 100) * 100;
  const capped = raw > FEE_CAP_MINOR;
  return { minorMdl: capped ? FEE_CAP_MINOR : raw, capped, tier: capped ? 1 : 0 };
}

/** The month a fee belongs to (the Chișinău month it was signed in): "2026-10". */
export const feeMonth = (wonAt) => dayKeyOf(wonAt).slice(0, 7);

/** The month after "2026-10": "2026-11". */
export function nextMonth(month) {
  const [y, m] = month.split("-").map(Number);
  return m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, "0")}`;
}

/** When a month's statement must be paid: the 15th of the next month at midnight, Chișinău (14 days after the 1st). */
export const statementDue = (month) => atLocal(`${nextMonth(month)}-${String(PAY_DAYS + 1).padStart(2, "0")}`, "00:00").toISOString();

const iso = (ms) => new Date(ms).toISOString();

/**
 * What a fee row becomes when its job is signed (the first time, or again after the client gave up).
 * @param {object} a
 * @param {object|null} a.existing   the job's fee row, if any
 * @param {number} a.kw              the signed offer's size
 * @param {number} a.usedFree        free jobs the company (IDNO) has already had
 * @param {number} a.creditMinor     credit from a paid job later cancelled
 * @param {"signed"|"manual"} a.trigger
 * @param {number} a.now             ms
 * @returns {{ row: object, creditUsed: number, changed: boolean }}  row: the fields to write
 */
export function feeOnWin({ existing = null, kw, usedFree = 0, creditMinor = 0, trigger = "manual", now = Date.now() }) {
  const { minorMdl, tier } = feeFor(kw);
  // already settled: nothing changes, whatever happened since
  if (existing && ["free", "paid", "waived"].includes(existing.status)) return { row: existing, creditUsed: 0, changed: false };
  // an unpaid fee keeps its price unless the system grew
  const keep = existing && Number(existing.amount_minor) >= minorMdl;
  const price = keep ? { tier: existing.tier ?? 0, amount_minor: Number(existing.amount_minor) } : { tier, amount_minor: minorMdl };
  if (existing?.status === "due") {
    return { row: { ...existing, ...price, kw: keep ? existing.kw : kw }, creditUsed: 0, changed: !keep };
  }
  const wonAt = iso(now);
  const base = { ...(existing || {}), ...price, kw: keep ? existing.kw : kw, trigger, won_at: wonAt, grace_ends_at: statementDue(feeMonth(wonAt)), currency: "MDL", invoice_id: null };
  // a free job only for a new fee: a job signed again after the client gave up does not get one back
  if (!existing && usedFree < FREE_JOBS) {
    return { row: { ...base, status: "free", free_slot: usedFree + 1, amount_minor: 0 }, creditUsed: 0, changed: true };
  }
  if (creditMinor >= price.amount_minor && price.amount_minor > 0) {
    return { row: { ...base, status: "paid", payment_method: "credit", paid_at: wonAt }, creditUsed: price.amount_minor, changed: true };
  }
  return { row: { ...base, status: "due" }, creditUsed: 0, changed: true };
}

/** The client gave up: an unpaid fee is void, nothing is owed. Settled ones stay as they are. */
export function feeOnLost(existing) {
  if (!existing || existing.status !== "due") return { row: existing, changed: false };
  return { row: { ...existing, status: "void" }, changed: true };
}

/** A paid job cancelled: the fee stays paid, the workspace gets the amount as credit (once per fee: the table's
 *  unique source_fee_id). A free or unpaid fee gives nothing. */
export function creditOnCancel(existing) {
  if (!existing || existing.status !== "paid" || !(Number(existing.amount_minor) > 0)) return null;
  return { amount_minor: Number(existing.amount_minor), source_fee_id: existing.id };
}

/**
 * May this job's paperwork be opened? Locked only for a fee still due after its statement's date to pay.
 * @param {object} a
 * @param {object|null} a.fee   the job's fee row (null: not signed, or no fee recorded)
 * @param {boolean} [a.admin]   a platform admin
 * @param {boolean} [a.sample]  a demo or sample project
 * @param {number} [a.now]
 * @param {boolean} [a.on]      the switch (feePaywallOn())
 * @returns {{ locked: boolean, reason: string, graceEndsAt: string|null, daysLeft: number|null }}
 */
export function jobAccess({ fee, admin = false, sample = false, now = Date.now(), on = feePaywallOn() }) {
  const graceEndsAt = fee?.grace_ends_at || null;
  const left = graceEndsAt ? Math.ceil((Date.parse(graceEndsAt) - now) / DAY) : null;
  const open = (reason) => ({ locked: false, reason, graceEndsAt, daysLeft: left });
  if (!on) return open("off");
  if (sample) return open("sample");
  if (admin) return open("admin");
  if (!fee) return open("no_fee");
  if (fee.status !== "due") return open(fee.status);
  if (left != null && left > 0) return open("grace");
  return { locked: true, reason: "due", graceEndsAt, daysLeft: left == null ? null : Math.max(0, left) };
}

/** A fee amount in lei, written the local way ("1.590 lei"). */
export function feeLei(minor, lang = "ro") {
  const v = Math.round(Number(minor) || 0) / 100;
  const loc = { en: "en-GB", ro: "ro-MD", ru: "ru-RU", uk: "uk-UA" }[lang] || "ro-MD";
  return `${v.toLocaleString(loc, { maximumFractionDigits: 0 })} lei`;
}

/**
 * A month's statement for one workspace, from its fees: what was signed, free, cancelled, the kW, and the lei due.
 * @param {object[]} fees  that month's fees
 */
export function monthSummary(fees) {
  const s = { signed: 0, free: 0, cancelled: 0, kw: 0, feesMinor: 0, paidMinor: 0, dueMinor: 0 };
  for (const f of fees || []) {
    // a job the client gave up is listed, but not counted as signed (as the statement shows it)
    if (f.status === "void") { s.cancelled++; continue; }
    s.signed++;
    s.kw += Number(f.kw) || 0;
    if (f.status === "free") s.free++;
    else if (f.status === "paid" || f.status === "due") {
      const a = Number(f.amount_minor) || 0;
      if (f.payment_method !== "credit") s.feesMinor += a;
      if (f.status === "paid" && f.payment_method !== "credit") s.paidMinor += a;
      if (f.status === "due") s.dueMinor += a;
    }
  }
  s.kw = Math.round(s.kw * 10) / 10;
  return s;
}
