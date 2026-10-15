// lib/debtSizing.js — the first number a lender asks for: how much debt the
// portfolio's cash flow supports. Pure; no I/O.
//
// THE RULE. A loan is sized so that, in every year it is being repaid, the
// cash flow available for debt service (CFADS) covers the debt service by a
// target ratio (the DSCR). Lenders test it twice: on the P50 cash flow at a
// higher ratio (1.30x is a common rule of thumb) and on the P90 cash flow at a
// lower one (1.20x). The capacity is the lowest of:
//   the debt the P50 test allows, the debt the P90 test allows, and
//   a gearing cap (a share of the capex after grant the lender will lend).
// Every threshold is an editable assumption: a lender sets its own.
//
// WHY IT IS EXACT, NOT SEARCHED. Under the terms the model uses (rate, rate
// steps, tenor, currency, the one-off state repayment) the debt service is
// proportional to the loan: a loan of L pays L x u(t), where u(t) is the
// service of a loan of 1 EUR (lib/projectFinance.js debtSchedule and
// serviceInEur). CFADS does not depend on the loan. So the DSCR test in year t
// is CFADS(t) >= target x L x u(t), and the largest loan passing every year is
//   L = min over the repayment years of CFADS(t) / (target x u(t)).
// The year that sets the minimum is the binding year.
//
// LEVEL REPAYMENT vs SCULPTED. The model repays in level instalments, re-set
// each year (an annuity, with the programme's stepped rate). Project-finance
// lenders often "sculpt" instead: each year's service is set to CFADS / target,
// and the loan is what those payments repay at the loan rate. Sculpting usually
// supports more debt; it is shown for information, and the recommended debt
// share is always the level-repayment figure, because that is what the rest of
// the model (and the Excel workbook) runs.
//
// CONSTRUCTION AND GRACE. The capacity is the debt at commissioning, the
// interest during construction included, and the debt share is measured on
// the cost after grant plus that interest (lib/projectFinance.js fundingAt):
// a share g allows g x cost / (1 - g x k), k the interest during construction
// on 1 EUR of debt. Interest-only years are tested like any other year: their
// service is the interest alone.
import { debtSchedule, serviceInEur, normalizeFinance, normalizeScenario, idcFactor } from "./projectFinance.js";

export const DEFAULT_SIZING = { p50Dscr: 1.3, p90Dscr: 1.2, maxGearingPct: 80 };

const num = (v, d = 0) => (v !== "" && v != null && Number.isFinite(Number(v)) ? Number(v) : d);
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

/** The targets, filled with the defaults and clamped: DSCR 1.00x to 3.00x, gearing cap 0 to 95%. */
export function normalizeSizing(s) {
  const x = s && typeof s === "object" ? s : {};
  return {
    p50Dscr: clamp(num(x.p50Dscr, DEFAULT_SIZING.p50Dscr), 1, 3),
    p90Dscr: clamp(num(x.p90Dscr, DEFAULT_SIZING.p90Dscr), 1, 3),
    maxGearingPct: clamp(num(x.maxGearingPct, DEFAULT_SIZING.maxGearingPct), 0, 95),
  };
}

/** u(t): the EUR debt service, year by year, of a loan of 1 EUR on these terms. */
export function unitDebtService(fin, scenario, years) {
  const H = Math.max(1, Math.round(num(years, 25)));
  return serviceInEur(debtSchedule(1, fin, H), fin, scenario);
}

/**
 * The largest level-repayment loan whose debt service the cash flow covers by
 * `target` in every repayment year.
 * @returns {{loanEur:number|null, bindingYear:number|null}} null when no year carries debt service
 */
export function capacityLevel(cfads, unit, target) {
  let best = Infinity, year = null;
  const n = Math.min(cfads.length, unit.length);
  for (let i = 0; i < n; i++) {
    // (the schedule pays exactly 0 once the loan is repaid, so > 0 is the test,
    // as the workbook's IF(service>0, ...) has it)
    if (!(unit[i] > 0)) continue;
    const cap = num(cfads[i]) / (target * unit[i]);
    if (cap < best) { best = cap; year = i + 1; }
  }
  return best === Infinity ? { loanEur: null, bindingYear: null } : { loanEur: Math.max(0, best), bindingYear: year };
}

/**
 * The loan a sculpted repayment supports: each year's service is CFADS / target
 * (never negative), the loan is the present value of those payments at the
 * loan's own rate, plus what the state's one-off repayment after year 1 adds:
 *   L = PV(payments) + c x L x DF(1)   =>   L = PV / (1 - c x DF(1))
 * For a loan in the local currency, the EUR service is turned back into the
 * local payment the loan schedule would carry.
 */
/**
 * What a sculpted loan's capacity is built from, year by year: the discount
 * factor at the loan's rate (and rate steps) for each repayment year, with a
 * loan in local currency carried back through the expected drift, and the
 * multiplier the one-off state repayment of principal adds. The Excel model
 * writes these as its weights, so the workbook and the page agree.
 * @returns {{ weights: number[], multiplier: number }}
 */
export function sculptWeights(fin, scenario, years) {
  const f = normalizeFinance(fin);
  const dep = normalizeScenario(scenario).localDepreciationPctYr / 100;
  const H = Math.max(1, Math.round(num(years, 25)));
  const g = f.graceYears;
  const weights = [];
  let df = 1, df1 = 1;
  for (let y = 1; y <= H; y++) {
    // the grace years pay interest only: the sculpted payments start after them,
    // discounted from the start of the first repayment year
    if (y > f.tenorYears || y <= g) { weights.push(0); continue; }
    const r = (f.rateSteps && f.rateSteps[y - 1] != null ? f.rateSteps[y - 1] : f.ratePct) / 100;
    df /= 1 + r;
    if (y === 1) df1 = df;
    weights.push(f.debtCurrency === "local" ? df / Math.pow(1 - dep, y - 1) : df);
  }
  const c = f.principalCompensationPct / 100;
  // the state's one-off repayment after year 1: inside a grace period it simply
  // lowers the balance the sculpted payments repay (L x (1 - c) = PV)
  const multiplier = c >= 1 ? 1 : g >= 1 ? 1 / (1 - c) : 1 / (1 - c * df1);
  return { weights, multiplier };
}

export function capacitySculpted(cfads, fin, scenario, target) {
  const n = cfads.length;
  if (!n) return 0;
  const { weights, multiplier } = sculptWeights(fin, scenario, n);
  let pv = 0;
  for (let y = 1; y <= n; y++) if (weights[y - 1] > 0) pv += (Math.max(0, num(cfads[y - 1])) / target) * weights[y - 1];
  // an interest-only year is tested on its interest, like a level year
  const g = normalizeFinance(fin).graceYears;
  const grace = g > 0 ? capacityLevel(cfads.slice(0, g), unitDebtService(fin, scenario, n).slice(0, g), target).loanEur : null;
  return grace != null ? Math.min(pv * multiplier, grace) : pv * multiplier;
}

/** The interest-only years' own test, for the workbook: the debt each one allows. */
export function graceCapacity(cfads, fin, scenario, target) {
  const g = normalizeFinance(fin).graceYears;
  if (!g) return null;
  return capacityLevel(cfads.slice(0, g), unitDebtService(fin, scenario, cfads.length).slice(0, g), target).loanEur;
}

/**
 * Size the debt of a portfolio (or one asset).
 * @param {object} a
 * @param {number[]} a.cfadsP50   pooled CFADS by year, P50
 * @param {number[]} a.cfadsP90   pooled CFADS by year, P90
 * @param {number}   a.capexNetEur capex after grant (what the debt share applies to)
 * @param {object}   a.fin        finance terms (DEFAULT_FINANCE shape)
 * @param {object}   [a.scenario] the base case (only the currency loss matters here)
 * @param {object}   [a.sizing]   targets (DEFAULT_SIZING shape)
 */
export function sizeDebt({ cfadsP50 = [], cfadsP90 = [], capexNetEur = 0, fin, scenario, sizing, currentLoanEur: loanNow }) {
  const f = normalizeFinance(fin);
  const s = normalizeSizing(sizing);
  const H = Math.max(cfadsP50.length, cfadsP90.length, 1);
  const unit = unitDebtService(f, scenario, H);
  const capexNet = Math.max(0, num(capexNetEur));
  const sculpted = f.repayment === "sculpted";
  // level repayments: the weakest year binds; sculpted: every year is at the
  // target, so the capacity is the present value of CFADS / target
  const p50 = sculpted ? { loanEur: capacitySculpted(cfadsP50, f, scenario, s.p50Dscr), bindingYear: null } : capacityLevel(cfadsP50, unit, s.p50Dscr);
  const p90 = sculpted ? { loanEur: capacitySculpted(cfadsP90, f, scenario, s.p90Dscr), bindingYear: null } : capacityLevel(cfadsP90, unit, s.p90Dscr);
  // written in the workbook's own order of operations (B5*B4/100/(1-B4/100*B6)),
  // so the two round identically; without a construction period k is 0
  const k = idcFactor(f);
  const gearingCapEur = capexNet * s.maxGearingPct / 100 / (1 - s.maxGearingPct / 100 * k);
  const limits = [["p50", p50.loanEur], ["p90", p90.loanEur], ["gearing", gearingCapEur]].filter(([, v]) => v != null);
  const [binding, capacityEur] = limits.reduce((a, b) => (b[1] < a[1] ? b : a));
  // the share of the capex after grant that capacity is, floored to 0.5%, so the
  // model at that share passes both tests. The workbook writes the same:
  // INT(capacity / capex * 200 + 1E-9) / 2; the 1E-9 keeps a share that is
  // exactly on a half percent from flooring one step down through float noise.
  // (the share of the cost after grant plus the interest during construction:
  // capacity / (capex after grant + capacity x k), k = 0 without construction)
  const recommendedGearingPct = capexNet > 0 ? Math.floor(capacityEur / (capexNet + capacityEur * k) * 200 + 1e-9) / 2 : null;
  // the debt the model carries (the sum of the assets' loans when the caller has it)
  const currentLoanEur = loanNow != null ? num(loanNow) : capexNet * (f.gearingPct / 100) / (1 - f.gearingPct / 100 * k);
  const sculptP50 = capacitySculpted(cfadsP50, f, scenario, s.p50Dscr);
  const sculptP90 = capacitySculpted(cfadsP90, f, scenario, s.p90Dscr);
  // the other profile, for comparison: level repayments when sculpted, and back
  const levelP50 = capacityLevel(cfadsP50, unit, s.p50Dscr).loanEur, levelP90 = capacityLevel(cfadsP90, unit, s.p90Dscr).loanEur;
  const levelEur = Math.min(...[levelP50, levelP90, gearingCapEur].filter((v) => v != null));
  return {
    ...s,
    repayment: f.repayment,
    levelEur,
    unit,
    p50, p90,
    gearingCapEur,
    capacityEur,
    binding,
    capacityPct: capexNet > 0 ? (capacityEur / (capexNet + capacityEur * k)) * 100 : null,
    idcFactor: k,
    recommendedGearingPct,
    currentLoanEur,
    currentGearingPct: f.gearingPct,
    headroomEur: capacityEur - currentLoanEur,
    withinCapacity: currentLoanEur <= capacityEur * (1 + 1e-9) + 1e-6,
    sculptedEur: Math.min(sculptP50, sculptP90, gearingCapEur),
  };
}

/** How the capacity moves with the loan's term: the same test at other tenors. */
export function capacityByTenor({ cfadsP50, cfadsP90, capexNetEur, fin, scenario, sizing, tenors = [5, 7, 10, 12, 15] }) {
  return tenors.map((t) => {
    const r = sizeDebt({ cfadsP50, cfadsP90, capexNetEur, fin: { ...normalizeFinance(fin), tenorYears: t }, scenario, sizing });
    return { tenorYears: t, capacityEur: r.capacityEur, binding: r.binding, pct: r.capacityPct };
  });
}
