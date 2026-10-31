// lib/jobFees.js — VoltMira's one charge: a fee for each signed job (docs/features/job-fees.md). Free for every
// installer otherwise. Pure, no I/O: the server (lib/jobFeeServer.js) reads and writes the rows, this decides.
//
//   price      99 lei for each kW of the signed system, at most 2,990 lei a job: two constants, change them here only
//              (before 2026-10-30: 200 lei a kW, at most 8,000; a fee recorded at that price keeps its amount, below)
//   due        when the client signs online, or the installer marks the job signed: the same fee
//   free       the company's first 2 signed jobs, counted per company tax id (IDNO) across its workspaces
//   cancelled  the client gives up: nothing is owed for that job; if its month was already paid, the amount becomes
//              credit on the next statement
//   billing    the month's fees go on one statement at the start of the next month, paid by bank transfer within
//              14 days (by the 15th); a job whose statement is still unpaid after that has its paperwork locked
//   repricing  only upward while unpaid (a bigger system after the signature); never down; frozen once paid
//   from       only jobs signed on or after JOB_FEES_FROM (a Chișinău date) are ever billed: the jobs of the free beta
//              (fees recorded while billing was off) are never invoiced and never lock anything
// Off unless JOB_FEES=on: until then nothing is locked (fees are still recorded, so the switch has history to read).
import { atLocal, dayKeyOf } from "./tz.js";

export const FEE_PER_KW_MINOR = 9900;      // 99 lei
export const FEE_CAP_MINOR = 299000;       // 2,990 lei
export const FREE_JOBS = 2;
export const PAY_DAYS = 14;
const DAY = 864e5;

/** The paperwork a due fee locks once its statement is overdue. The offer, its sending and tracking, the client's
 *  page and the offer PDF are never locked. */
export const LOCKED_DOCS = ["contract", "invoice", "grid_file", "grid_submit", "commissioning", "handover", "annex", "performance", "diagram"];

export const feePaywallOn = (env = process.env) => String(env.JOB_FEES || "").toLowerCase() === "on";

/**
 * The first moment a signed job can be billed: midnight in Chișinău on JOB_FEES_FROM ("2026-12-01"), as ms. null
 * when it is not set or not a date: then NO fee is billable, so turning billing on without choosing the date never
 * invoices the jobs of the free beta.
 */
export function feeBillingFrom(env = process.env) {
  const d = String(env.JOB_FEES_FROM || "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return null;
  const t = atLocal(d, "00:00").getTime();
  return Number.isFinite(t) ? t : null;
}

/** Is this fee's job billable at all: signed on or after the billing start (else a job of the free beta)? */
export function feeBillable(fee, from = feeBillingFrom()) {
  return from != null && !!fee?.won_at && Date.parse(fee.won_at) >= from;
}

/** Was this fee priced by the current rules (its amount is what feeFor gives for its kW)? A fee recorded under
 *  earlier prices is not, and keeps its own amount: it is never repriced with today's formula. */
export const pricedNow = (fee) => !!fee && Number(fee.amount_minor) === feeFor(fee.kw).minorMdl;

/**
 * The fee for a signed system of `kw`: 99 lei a kW, in whole lei, at most 2,990.
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
  // an unpaid fee recorded under earlier prices keeps its amount (prices are never applied backwards)
  if (existing?.status === "due" && !pricedNow(existing)) return { row: existing, creditUsed: 0, changed: false };
  // an unpaid fee keeps its price unless the system grew; a job signed again after the client gave up is priced as
  // signed now (an old void fee's earlier, higher price does not carry over)
  const keep = existing && pricedNow(existing) && Number(existing.amount_minor) >= minorMdl;
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

/**
 * A workspace gives its tax id after free jobs were already counted for it alone (no IDNO yet): the company's free
 * jobs are FREE_JOBS in all, across its workspaces, so the ones past that become due, the latest signed first. A
 * second workspace cannot get two more free jobs by signing them before it says whose company it is.
 * @param {object[]} own        this workspace's free fees
 * @param {number} otherFree    free fees already used by the company's other workspaces (same IDNO)
 * @returns {object[]}          the fees to turn due, each with its price and the next statement's date
 */
export function reclaimFreeSlots(own, otherFree, now = Date.now()) {
  const keep = Math.max(0, FREE_JOBS - (Number(otherFree) || 0));
  const list = (own || []).filter((f) => f.status === "free").sort((a, b) => Date.parse(a.won_at) - Date.parse(b.won_at));
  return list.slice(keep).map((f) => {
    const { minorMdl, tier } = feeFor(f.kw);
    return { ...f, status: "due", free_slot: null, amount_minor: minorMdl, tier, grace_ends_at: statementDue(feeMonth(iso(now))) };
  });
}

/**
 * The client gave up: an unpaid fee is void, nothing is owed, as long as no paperwork was made for the job yet (a
 * contract, an invoice, the grid file, the handover: `docs_at`). Once it was, the fee stays: a job cannot be signed,
 * its documents taken, then cancelled to skip the fee; the installer asks VoltMira to waive it instead. Settled
 * fees stay as they are.
 * @returns {{ row: object, changed: boolean, kept?: true }}  kept: the fee stays because paperwork was made
 */
export function feeOnLost(existing) {
  if (!existing || existing.status !== "due") return { row: existing, changed: false };
  if (existing.docs_at) return { row: existing, changed: false, kept: true };
  return { row: { ...existing, status: "void" }, changed: true };
}

/**
 * Is this a real Moldovan IDNO? 13 digits, the last one the check digit: the first twelve weighted 7, 3, 1 in turn,
 * summed, modulo 10 (checked on 1,144 IDNOs from the public register). An invented number fails 9 times in 10, so
 * a new workspace cannot make up a tax id for two more free jobs.
 */
export function idnoValid(idno) {
  const s = String(idno || "").replace(/\s+/g, "");
  if (!/^[0-9]{13}$/.test(s)) return false;
  const w = [7, 3, 1];
  let sum = 0;
  for (let i = 0; i < 12; i++) sum += Number(s[i]) * w[i % 3];
  return sum % 10 === Number(s[12]);
}

export const HOLD_OFFERS_DAYS = 30;   // a statement this many days late: no new offers can be sent
export const HOLD_READONLY_DAYS = 60; // this many: the workspace is read-only until it is paid

/**
 * How far a workspace is held for unpaid statements: 0 nothing; 1 the late statement's jobs' paperwork is locked
 * (from its date to pay); 2 no new offers either (30 days late); 3 read-only (60 days late). Only statements still
 * owing something count (a job whose client gave up is not owed).
 * @param {{ due_at: string, paid_at?: string|null, owed_minor: number }[]} statements
 * @returns {{ level: 0|1|2|3, daysLate: number }}
 */
export function holdLevel(statements, now = Date.now()) {
  let late = -1;
  for (const s of statements || []) {
    if (s.paid_at || !(Number(s.owed_minor) > 0) || !s.due_at) continue;
    const d = Math.floor((now - Date.parse(s.due_at)) / DAY);
    if (d >= 0 && d > late) late = d;
  }
  if (late < 0) return { level: 0, daysLate: 0 };
  return { level: late >= HOLD_READONLY_DAYS ? 3 : late >= HOLD_OFFERS_DAYS ? 2 : 1, daysLate: late };
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
export function jobAccess({ fee, admin = false, sample = false, signed = true, now = Date.now(), on = feePaywallOn(), from = feeBillingFrom() }) {
  const graceEndsAt = fee?.grace_ends_at || null;
  const left = graceEndsAt ? Math.ceil((Date.parse(graceEndsAt) - now) / DAY) : null;
  const open = (reason) => ({ locked: false, reason, graceEndsAt, daysLeft: left });
  if (!on) return open("off");
  if (sample) return open("sample");
  if (admin) return open("admin");
  // the paperwork is for a signed job only: a job kept "sent" (or marked lost) gets no contract, invoice, grid file
  // or handover, so it cannot be done through VoltMira without its fee
  if (!signed) return { locked: true, reason: "not_signed", graceEndsAt, daysLeft: left };
  // a job of the free beta (signed before billing started) is never locked for its fee
  if (fee && !feeBillable(fee, from)) return open("beta");
  // fail closed: with billing on, a signed job whose fee could not be read or made gets no paperwork (the gate
  // makes the fee first; reaching here without one means the billing tables could not be trusted)
  if (!fee) return { locked: true, reason: "no_fee", graceEndsAt, daysLeft: left };
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
