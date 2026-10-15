// lib/sizingSettle.js: the debt capacity when the cash flow depends on the loan.
// With corporate income tax the loan's interest is deducted, so CFADS moves
// with the loan, and the capacity is the loan at which the two agree: size on
// the cash flow, run the assets again at that loan, size again; a few rounds
// settle it. Without tax one sizing is exact. Used by the portfolio model (the
// facility, each tenor, each asset alone) and the structure comparison.
import { evaluateAsset } from "./plantFinance.js";
import { aggregate } from "./portfolio.js";
import { sizeDebt } from "./debtSizing.js";
import { normalizeFinance } from "./projectFinance.js";

export const SETTLE_ROUNDS = 6;

/** Each asset run at the given terms, P50 and P90, with their pooled totals. */
export function runAt(assets, E, fin, scenario) {
  const p50 = assets.map((a) => ({ ...a, result: evaluateAsset(a, E, fin, scenario) }));
  const p90 = assets.map((a) => ({ ...a, result: evaluateAsset(a, E, fin, scenario, { exceed: "P90" }) }));
  return { p50, p90, agg: aggregate(p50), aggP90: aggregate(p90) };
}

/**
 * @param {object} a
 * @param {object[]} a.assets
 * @param {object} a.E, a.scenario
 * @param {object} a.fin        the terms, tax included
 * @param {object} [a.sizing]   the DSCR targets and the cap
 * @param {object} [a.start]    runs already made ({ p50, p90, agg, aggP90 }), to size on first
 * @param {number} [a.currentLoanEur]  the loan the terms set, for the headroom
 * @returns {{ sizing: object, at: { p50, p90, agg, aggP90 } }} the sizing and the runs it was found on
 */
export function settleSizing({ assets, E, fin, scenario, sizing, start = null, currentLoanEur = null }) {
  const f = normalizeFinance(fin);
  let at = start || runAt(assets, E, f, scenario);
  const capexNet = at.agg.capexEur - at.agg.grantEur;
  const loanNow = currentLoanEur ?? at.agg.loanEur;
  const size = (x) => sizeDebt({ cfadsP50: x.agg.cfads, cfadsP90: x.aggP90.cfads, capexNetEur: capexNet, fin: f, scenario, sizing, currentLoanEur: loanNow });
  let s = size(at);
  if (f.taxPct > 0 && assets.length) {
    for (let round = 0; round < SETTLE_ROUNDS && s.capacityPct != null; round++) {
      const next = runAt(assets, E, { ...f, gearingPct: s.capacityPct }, scenario);
      const n = size(next);
      const moved = Math.abs(n.capacityEur - s.capacityEur);
      s = n;
      at = next;
      if (moved < 1) break;
    }
  }
  return { sizing: s, at };
}
