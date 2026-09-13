// lib/leadSizing.js — "a bill and an address" → a system size worth quoting.
//
// Two callers need exactly this derivation and used to each write their own
// copy: the public widget's live estimate (app/api/estimate/route.js) and, now,
// converting a lead into a real project (lib/actions.js). Two copies of a
// clamp-and-divide formula drift the instant one gets tuned and the other
// doesn't — a widget that promises one size and an offer that lands on another
// is exactly the kind of inconsistency this product is built to not have.
// Pure, no I/O, so both call sites size a household the same way.

/**
 * Annual consumption implied by a monthly bill.
 *
 * @param {number} monthlyBillLocal  the bill as entered, in the market's own
 *   currency (RON, MDL) — not EUR.
 * @param {number} priceEurPerKwh    the market's retail price, EUR/kWh
 *   (MARKETS[market].defaultPrice from @voltmira/engine).
 * @param {number} fxRate            local-currency units per EUR (FX[currency]).
 * @returns {number} kWh/yr, clamped to a sane residential band. Falls back to a
 *   typical household figure when no usable bill was given, so a lead with only
 *   an address can still be sized rather than sized at zero.
 */
export function annualConsFromBill(monthlyBillLocal, priceEurPerKwh, fxRate) {
  const bill = Number(monthlyBillLocal);
  const price = Number(priceEurPerKwh);
  if (!(bill > 0) || !(price > 0)) return 4200;
  const billEur = bill / (Number(fxRate) || 1);
  return Math.min(30000, Math.max(800, (billEur * 12) / price));
}

/**
 * A residential system size that roughly covers that consumption, rounded to
 * the nearest 0.5 kW and clamped to a band a household actually fits (2–15 kW)
 * — the same range and rounding the widget's estimate has always used.
 */
export function sizeSystemKw(annualConsKwh, yieldPerKwp) {
  const cons = Number(annualConsKwh), yieldV = Number(yieldPerKwp);
  if (!(cons > 0) || !(yieldV > 0)) return 3;
  return Math.min(15, Math.max(2, Math.round((cons / yieldV) * 2) / 2));
}
