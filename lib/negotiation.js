// lib/negotiation.js — what the proposal assistant may concede on the
// installer's behalf, and the checks every concession passes before it is
// recorded. Pure. The model never decides a limit: it asks for a concession
// through a tool, and these functions say yes or no (lib/proposalAgent.js).
//
// The installer sets the policy per workspace (companies.negotiation):
//   enabled         may the assistant negotiate at all (off by default)
//   maxDiscountPct  the most it may take off the proposal total, in all (0-15)
//   allowOptions    may the client switch to one of the alternatives the
//                   installer attached to this proposal
// Anything outside it goes to a person (escalate_to_human).

export const HARD_MAX_DISCOUNT_PCT = 15;   // a typo in settings can't give away a system
export const OFFER_VALID_DAYS = 14;

export function normalizePolicy(raw) {
  const r = raw && typeof raw === "object" ? raw : {};
  const pct = Number(r.maxDiscountPct);
  return {
    enabled: r.enabled === true,
    maxDiscountPct: Number.isFinite(pct) ? Math.min(HARD_MAX_DISCOUNT_PCT, Math.max(0, Math.round(pct * 10) / 10)) : 0,
    allowOptions: r.allowOptions !== false,
  };
}

const round2 = (n) => Math.round(n * 100) / 100;

/**
 * May the assistant offer `requestedPct` off `totalEur`?
 * One discount per proposal: a new offer replaces the open one, and never
 * goes below it (a client can't be offered less than they were already told).
 * @returns {{ ok: true, pct, discountEur, newTotalEur, replaces: boolean }
 *         | { ok: false, reason: "disabled"|"invalid"|"above_limit"|"not_higher", maxPct?, currentPct? }}
 */
export function evaluateDiscount({ policy, requestedPct, totalEur, currentPct = 0 }) {
  const p = normalizePolicy(policy);
  if (!p.enabled || p.maxDiscountPct <= 0) return { ok: false, reason: "disabled" };
  const pct = Number(requestedPct);
  if (!Number.isFinite(pct) || pct <= 0 || !(Number(totalEur) > 0)) return { ok: false, reason: "invalid" };
  const want = Math.round(pct * 10) / 10;
  if (want > p.maxDiscountPct) return { ok: false, reason: "above_limit", maxPct: p.maxDiscountPct, currentPct };
  if (currentPct && want <= currentPct) return { ok: false, reason: "not_higher", currentPct };
  const discountEur = round2(totalEur * want / 100);
  return { ok: true, pct: want, discountEur, newTotalEur: round2(totalEur - discountEur), replaces: currentPct > 0 };
}

/** May the client switch to attached option `index` (0-based)? */
export function evaluateOption({ policy, index, options }) {
  const p = normalizePolicy(policy);
  if (!p.allowOptions) return { ok: false, reason: "disabled" };
  const list = Array.isArray(options) ? options : [];
  if (!Number.isInteger(index) || index < 0 || index >= list.length) return { ok: false, reason: "no_such_option", count: list.length };
  return { ok: true, option: list[index] };
}

/** The price after an open discount, for the page and the acceptance record. */
export function priceWithOffer(totalEur, offer) {
  const pct = Number(offer?.pct) || 0;
  if (pct <= 0) return { totalEur, discountEur: 0, pct: 0 };
  const discountEur = round2(totalEur * pct / 100);
  return { totalEur: round2(totalEur - discountEur), discountEur, pct };
}

/** Is an offer made at `createdAt` still standing at `now`? */
export const offerStanding = (createdAt, now = Date.now()) =>
  !!createdAt && now - new Date(createdAt).getTime() <= OFFER_VALID_DAYS * 864e5;
