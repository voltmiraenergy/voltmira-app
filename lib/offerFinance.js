// lib/offerFinance.js — the three numbers a loan on a client's offer is built
// from, all from the offer's frozen snapshot (never from the browser), in MDL
// minor units at the offer's frozen exchange rate:
//   priceMinor           what the client pays for the system
//   supportMinor         the support they are sure to receive (lib/eligibility.js)
//   savingsMonthlyMinor  what the system saves a month, the first year's average
// Used by the offer page (to show the calculator) and the application route
// (to recompute the amount). Pure.
import { quote, FX } from "@voltmira/engine";
import { offerQuoteInput } from "./offerInput.js";

export function offerFinanceBasis(snapshot, E) {
  const q = quote(offerQuoteInput(snapshot), E).e;
  const rate = Number(E?.fx?.MDL) || FX.MDL;
  const bani = (eur) => Math.max(0, Math.round((Number(eur) || 0) * rate * 100));
  return {
    priceMinor: bani(q.cost),
    supportMinor: Math.max(0, Math.round(Number(snapshot?.support?.totals?.sureMinor) || 0)),
    savingsMonthlyMinor: bani((Number(q.year1) || 0) / 12),
    currency: "MDL",
  };
}
