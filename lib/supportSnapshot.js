// lib/supportSnapshot.js — the support programmes an offer is issued with,
// frozen into its snapshot (lib/actions.js buildProposalSnapshot) so the
// client's page shows what applied on the day it was sent, however the
// programmes change later. Amounts in MDL minor units (bani), converted from
// the engine's EUR at the offer's own frozen exchange rate, exactly as the
// installer's support card converts them. Pure.
import { quote, FX } from "@voltmira/engine";
import { checkEligibility, supportTotals } from "./eligibility.js";
import { batteryEur } from "./greenSupport.js";

/**
 * @param {object} a
 * @param {object[]} a.programs     subsidy_programs rows
 * @param {object} a.input          the offer's engine input (lib/offerInput.js)
 * @param {object} a.E              the offer's engine settings (snapshotEngine)
 * @param {string|null} a.clientKind
 * @param {object} [a.profile]      projects.client_profile
 * @param {number} [a.vatRatePct]   the installer's VAT rate
 * @param {string} a.date           YYYY-MM-DD
 * @returns {object|null}  { asOf, currency, results, totals }, null outside Moldova
 */
export function supportSnapshot({ programs, input, E, clientKind = null, profile = {}, vatRatePct = 0, date }) {
  if (input?.market !== "MD") return null;
  const e = quote(input, E).e;
  const rate = Number(E?.fx?.MDL) || FX.MDL;
  const bani = (eur) => Math.max(0, Math.round((Number(eur) || 0) * rate * 100));
  const results = checkEligibility(programs, {
    market: "MD", clientKind: clientKind || null, kw: Number(input.kw) || 0,
    systemMinor: bani(e.grossCost),
    batteryMinor: bani(batteryEur({ batt: input.batt, battKwh: input.battKwh, batteryCostPerKwh: E?.batteryCostPerKwh })),
    loanMinor: Math.max(0, Math.round((Number(profile?.loanMdl) || 0) * 100)),
    vatRatePct: Number(vatRatePct) || 0, currency: "MDL", date,
  }, profile || {});
  return {
    asOf: date, currency: "MDL",
    // what the client's page lists: what applies, or may once a condition is confirmed
    results: results.filter((r) => r.status !== "not_eligible"),
    totals: supportTotals(results),
  };
}
