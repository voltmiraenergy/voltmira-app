// lib/loanMath.js — a homeowner's loan on the client's offer, in integer
// minor units (docs/FINANCING.md). Pure. Rates are basis points (9.5 % = 950).
//
// The amount borrowed is the system's price less the support the client is
// sure to receive (lib/eligibility.js supportTotals.sureMinor) and any down
// payment; the server recomputes it from the offer's own frozen price, never
// from what the browser sends.

/**
 * The monthly payment of an annuity loan, rounded UP to the next minor unit
 * so the schedule never falls short of the principal.
 */
export function monthlyPaymentMinor(principalMinor, rateBps, months) {
  const P = Math.max(0, Math.round(Number(principalMinor) || 0));
  const n = Math.max(1, Math.round(Number(months) || 0));
  const r = Math.max(0, Number(rateBps) || 0) / 10000 / 12;
  if (P === 0) return 0;
  if (r === 0) return Math.ceil(P / n);
  return Math.ceil((P * r) / (1 - Math.pow(1 + r, -n)));
}

/** The offer's up-front fee on an amount: a percentage plus a flat part. */
export function feeMinor(offer, principalMinor) {
  return Math.round((Math.max(0, Math.round(principalMinor)) * (Number(offer?.fee_bps) || 0)) / 10000) + Math.max(0, Math.round(Number(offer?.fee_flat_minor) || 0));
}

/** Does an offer apply to this quote? (market, client type, battery) */
export function offerApplies(offer, { market = "MD", clientKind = null, battery = false } = {}) {
  if (!offer || offer.active === false) return false;
  const e = offer.eligibility || {};
  if (Array.isArray(e.markets) && !e.markets.includes(market)) return false;
  // a client type the offer names is required only once the installer has set one
  if (Array.isArray(e.clientKinds) && clientKind && !e.clientKinds.includes(clientKind)) return false;
  if (e.requiresBattery && !battery) return false;
  return true;
}

/** The terms a homeowner can pick: the usual ones inside the offer's range, and its ends. */
export function termOptions(offer) {
  const lo = Number(offer?.term_min_months) || 12, hi = Number(offer?.term_max_months) || lo;
  const set = new Set([lo, hi, ...[12, 24, 36, 48, 60, 72, 84, 96, 120, 180, 240].filter((m) => m >= lo && m <= hi)]);
  return [...set].sort((a, b) => a - b);
}

/**
 * The loan for one offer and term.
 * @returns {{ ok: true, amountMinor, monthlyMinor, feeMinor, totalMinor, termMonths, rateBps } | { ok: false, error }}
 */
export function quoteLoan({ offer, priceMinor, supportMinor = 0, downMinor = 0, termMonths }) {
  if (!offer) return { ok: false, error: "no_offer" };
  const n = Math.round(Number(termMonths) || 0);
  if (!(n >= offer.term_min_months && n <= offer.term_max_months)) return { ok: false, error: "term" };
  const amount = Math.round(Number(priceMinor) || 0) - Math.max(0, Math.round(Number(supportMinor) || 0)) - Math.max(0, Math.round(Number(downMinor) || 0));
  if (amount <= 0) return { ok: false, error: "amount" };
  if (amount < Number(offer.min_amount_minor)) return { ok: false, error: "below_min" };
  if (amount > Number(offer.max_amount_minor)) return { ok: false, error: "above_max" };
  const monthly = monthlyPaymentMinor(amount, offer.rate_bps, n);
  const fee = feeMinor(offer, amount);
  return { ok: true, amountMinor: amount, monthlyMinor: monthly, feeMinor: fee, totalMinor: monthly * n + fee, termMonths: n, rateBps: Number(offer.rate_bps) };
}

/** The client's net monthly cost: the payment less what the system saves a month (negative = it pays for itself). */
export function netMonthlyMinor(monthlyMinor, savingsMonthlyMinor) {
  return Math.round(Number(monthlyMinor) || 0) - Math.round(Number(savingsMonthlyMinor) || 0);
}
