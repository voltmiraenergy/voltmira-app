// lib/jobFees.js — VoltMira's one charge: a fee per won project (docs/features/job-fees.md). Free for every
// installer otherwise. Pure, no I/O: the server (lib/jobFeeServer.js) reads and writes the rows, this decides.
//
//   tiers      by the system's size, in lei (minor units), one constant: change the prices here only
//   due        when the client signs online, or the installer marks the job won by hand: the same fee
//   free       the company's first 3 won projects, counted per company tax id (IDNO) across its workspaces
//   grace      14 days after the win; then the job's paperwork locks until the fee is paid. The client never sees it
//   lost       an unpaid fee becomes void and the paperwork stays locked (no fee, no paperwork); won again, the same
//              row is due again with a fresh grace period; a free slot used is not given back
//   repricing  only upward while unpaid (a bigger system after the win); never down; frozen once paid
//   cancelled  a paid job later cancelled leaves its fee paid and a credit of the same amount for the next fee
// Off unless JOB_FEES=on: until then nothing is locked (fees are still recorded, so the switch has history to read).

export const FEE_TIERS_MDL = [
  { maxKw: 10, minor: 39000 },
  { maxKw: 30, minor: 79000 },
  { maxKw: 100, minor: 159000 },
  { maxKw: Infinity, minor: 299000 },
];
export const FREE_JOBS = 3;
export const GRACE_DAYS = 14;
const DAY = 864e5;

/** The paperwork a due fee locks once the grace period is over. The offer, its sending and tracking, the client's
 *  page and the offer PDF are never locked. */
export const LOCKED_DOCS = ["contract", "invoice", "grid_file", "grid_submit", "commissioning", "handover", "annex", "performance", "diagram"];

export const feePaywallOn = (env = process.env) => String(env.JOB_FEES || "").toLowerCase() === "on";

/** The tier (0 to 3) for a system size in kW. A size not known yet counts as the smallest. */
export function tierFor(kw) {
  const k = Number(kw);
  const v = Number.isFinite(k) && k > 0 ? k : 0;
  return FEE_TIERS_MDL.findIndex((t) => v <= t.maxKw);
}

/** { tier, minorMdl } for a system size. */
export function feeFor(kw) {
  const tier = tierFor(kw);
  return { tier, minorMdl: FEE_TIERS_MDL[tier].minor };
}

const iso = (ms) => new Date(ms).toISOString();

/**
 * What a fee row becomes when its project is won (the first time, or again after being lost).
 * @param {object} a
 * @param {object|null} a.existing   the project's fee row, if any
 * @param {number} a.kw              the signed offer's size
 * @param {number} a.usedFree        free slots the company (IDNO) has already used
 * @param {number} a.creditMinor     credit the workspace holds from cancelled paid jobs
 * @param {"signed"|"manual"} a.trigger
 * @param {number} a.now             ms
 * @returns {{ row: object, creditUsed: number, changed: boolean }}  row: the fields to write
 */
export function feeOnWin({ existing = null, kw, usedFree = 0, creditMinor = 0, trigger = "manual", now = Date.now() }) {
  const { tier, minorMdl } = feeFor(kw);
  // already settled: nothing changes, whatever happened since
  if (existing && ["free", "paid", "waived"].includes(existing.status)) return { row: existing, creditUsed: 0, changed: false };
  // an unpaid fee keeps its price unless the system grew into a higher tier
  const keep = existing && Number(existing.amount_minor) >= minorMdl;
  const price = keep ? { tier: existing.tier, amount_minor: Number(existing.amount_minor) } : { tier, amount_minor: minorMdl };
  if (existing?.status === "due") {
    return { row: { ...existing, ...price, kw: keep ? existing.kw : kw }, creditUsed: 0, changed: !keep };
  }
  const base = { ...(existing || {}), ...price, kw: keep ? existing.kw : kw, trigger, won_at: iso(now), grace_ends_at: iso(now + GRACE_DAYS * DAY), currency: "MDL" };
  // a free slot only for a new fee: a job won again after being lost does not get one back
  if (!existing && usedFree < FREE_JOBS) {
    return { row: { ...base, status: "free", free_slot: usedFree + 1, amount_minor: 0 }, creditUsed: 0, changed: true };
  }
  if (creditMinor >= price.amount_minor && price.amount_minor > 0) {
    return { row: { ...base, status: "paid", payment_method: "credit", paid_at: iso(now) }, creditUsed: price.amount_minor, changed: true };
  }
  return { row: { ...base, status: "due" }, creditUsed: 0, changed: true };
}

/** What a fee becomes when its project is marked lost: an unpaid one is void; settled ones stay as they are. */
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
 * May this job's paperwork be opened?
 * @param {object} a
 * @param {object|null} a.fee   the project's fee row (null: not won, or no fee recorded)
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
  if (["free", "paid", "waived"].includes(fee.status)) return open(fee.status);
  if (fee.status === "void") return { locked: true, reason: "void", graceEndsAt, daysLeft: null };
  if (fee.status === "due" && left != null && left > 0) return open("grace");
  return { locked: true, reason: "due", graceEndsAt, daysLeft: left == null ? null : Math.max(0, left) };
}

/** A fee amount in lei, written the local way ("1.590 lei"). */
export function feeLei(minor, lang = "ro") {
  const v = Math.round(Number(minor) || 0) / 100;
  const loc = { en: "en-GB", ro: "ro-MD", ru: "ru-RU", uk: "uk-UA" }[lang] || "ro-MD";
  return `${v.toLocaleString(loc, { maximumFractionDigits: 0 })} lei`;
}
