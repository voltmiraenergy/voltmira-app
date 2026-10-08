// lib/portfolioSensitivity.js — what moves the result most: each driver is
// flexed down and up by a stated amount, everything else held at the base
// case, and the whole portfolio is re-run (a "tornado"). And the same
// portfolio under other financing structures, side by side. Pure; no I/O.
//
// The flexes are ILLUSTRATIVE ranges chosen to compare drivers on a like-for-
// like footing, not forecasts. Yield, price and capex move by 10%, O&M by 20%,
// the interest rate and the price escalation by 2 percentage points. Curtailment
// and construction delay only have a downside, so they are flexed one way.
import { normalizeFinance, normalizeScenario } from "./projectFinance.js";
import { evaluateAsset } from "./plantFinance.js";
import { aggregate } from "./portfolio.js";
import { settleSizing } from "./sizingSettle.js";

/** The metrics a row reports, read off a P50 aggregate. */
export const SENS_METRICS = ["dscrMin", "equityIrr", "irr", "npv"];

const pick = (agg) => ({ npv: agg.npv, irr: agg.irr, equityIrr: agg.equityIrr, dscrMin: agg.dscrMin });

/**
 * Each driver: its id, the size of the flex for labels, and how it changes the
 * finance terms or the scenario. `lo`/`hi` are the input moving down and up;
 * a one-sided driver has only `hi` (the adverse move).
 * @param {object} E engine settings (the escalation default comes from its band)
 */
export function tornadoDrivers(fin, scenario, E) {
  const f = normalizeFinance(fin);
  const sc = normalizeScenario(scenario);
  const esc0 = sc.tariffEscalationPct != null ? sc.tariffEscalationPct : Number(E?.bands?.expc?.infl ?? 3);
  const mul = (k, x) => ({ scenario: { ...sc, [k]: sc[k] * x } });
  const shiftRate = (d) => ({
    fin: { ...f, ratePct: Math.max(0, f.ratePct + d), rateSteps: f.rateSteps ? f.rateSteps.map((r) => Math.max(0, r + d)) : null },
  });
  const list = [
    { id: "yield", size: 10, unit: "%", lo: mul("yieldMultiplier", 0.9), hi: mul("yieldMultiplier", 1.1) },
    { id: "price", size: 10, unit: "%", lo: mul("tariffMultiplier", 0.9), hi: mul("tariffMultiplier", 1.1) },
    { id: "capex", size: 10, unit: "%", lo: mul("capexMultiplier", 0.9), hi: mul("capexMultiplier", 1.1) },
    { id: "opex", size: 20, unit: "%", lo: mul("opexMultiplier", 0.8), hi: mul("opexMultiplier", 1.2) },
    { id: "escalation", size: 2, unit: "pp", lo: { scenario: { ...sc, tariffEscalationPct: esc0 - 2 } }, hi: { scenario: { ...sc, tariffEscalationPct: esc0 + 2 } } },
    { id: "curtailment", size: 10, unit: "pp", hi: { scenario: { ...sc, curtailmentPct: Math.min(100, sc.curtailmentPct + 10) } } },
    { id: "delay", size: 6, unit: "mo", hi: { scenario: { ...sc, delayMonths: Math.min(60, sc.delayMonths + 6) } } },
  ];
  // the rate only matters when there is debt
  if (f.gearingPct > 0) list.splice(4, 0, { id: "rate", size: 2, unit: "pp", lo: shiftRate(-2), hi: shiftRate(2) });
  return list;
}

function runAll(assets, E, fin, scenario, baseScenario = null) {
  return aggregate(assets.map((a) => ({ ...a, result: evaluateAsset(a, E, fin, scenario, baseScenario ? { baseScenario } : {}) })));
}

/**
 * The tornado: the base metrics, and per driver the metrics at the low and
 * high input. Rows are in the drivers' order; sort them for a chart with
 * sortTornado().
 * @param {Array<{id,input,kw,market,region,name}>} assets
 * @returns {{base:object, rows:Array<{id,size,unit,lo:object|null,hi:object}>}}
 */
export function tornado(assets, E, fin, scenario) {
  const f = normalizeFinance(fin);
  const sc = normalizeScenario(scenario);
  if (!assets.length) return { base: null, rows: [] };
  const base = pick(runAll(assets, E, f, sc));
  const rows = tornadoDrivers(f, sc, E).map((d) => {
    // a sculpted loan stays shaped on the base case while a driver moves
    const run = (side) => (side ? pick(runAll(assets, E, side.fin || f, side.scenario || sc, sc)) : null);
    return { id: d.id, size: d.size, unit: d.unit, lo: run(d.lo), hi: run(d.hi) };
  });
  return { base, rows };
}

/**
 * Rows for one metric, widest swing first, with each side's change from the
 * base. A metric that is null at the base (no debt, no IRR) gives no rows.
 */
export function sortTornado(t, metric) {
  if (!t?.base || t.base[metric] == null) return [];
  const b = t.base[metric];
  return t.rows
    .map((r) => {
      const lo = r.lo && r.lo[metric] != null ? r.lo[metric] : null;
      const hi = r.hi && r.hi[metric] != null ? r.hi[metric] : null;
      const vals = [lo, hi].filter((v) => v != null);
      const span = vals.length ? Math.max(...vals, b) - Math.min(...vals, b) : 0;
      return { id: r.id, size: r.size, unit: r.unit, lo, hi, dLo: lo == null ? null : lo - b, dHi: hi == null ? null : hi - b, span };
    })
    .filter((r) => r.span > 1e-9)
    .sort((a, c) => c.span - a.span);
}

/**
 * The same portfolio under several financing structures. The first entry is
 * the current one (reusing its already-computed aggregates when given).
 * @param {object} a
 * @param {Array} a.assets
 * @param {object} a.E
 * @param {object} a.scenario
 * @param {Array<{id:string,label?:string,preset?:string,fin:object}>} a.structures
 * @param {object} [a.sizing]
 * @param {{agg:object,p90:object}} [a.current]  the current structure's results, to skip re-running it
 */
export function compareStructures({ assets, E, scenario, structures, sizing, current }) {
  if (!assets.length) return [];
  const sc = normalizeScenario(scenario);
  return structures.map((s, i) => {
    const f = normalizeFinance(s.fin);
    const useCurrent = i === 0 && current;
    const agg = useCurrent ? current.agg : runAll(assets, E, f, sc);
    const p90 = useCurrent ? current.p90
      : aggregate(assets.map((a) => ({ ...a, result: evaluateAsset(a, E, f, sc, { exceed: "P90" }) })));
    // the current structure keeps the model's own sizing; another is sized the
    // same way (with tax, settled where its loan and its cash flow agree)
    const size = useCurrent && current.sizing ? current.sizing
      : settleSizing({ assets, E, fin: f, scenario: sc, sizing, start: { p90: [], p50: [], agg, aggP90: p90 }, currentLoanEur: agg.loanEur }).sizing;
    return {
      id: s.id, label: s.label || "", preset: s.preset || null, fin: f,
      // the sponsor's money at commissioning: equity, the arrangement fee and the reserve account
      capexEur: agg.capexEur, grantEur: agg.grantEur, loanEur: agg.loanEur, equityEur: agg.equityEur + agg.feeEur + agg.dsraEur,
      dscrMin: agg.dscrMin, dscrMinP90: p90.dscrMin, irr: agg.irr, equityIrr: agg.equityIrr, npv: agg.npv,
      capacityEur: size.capacityEur, withinCapacity: size.withinCapacity, recommendedGearingPct: size.recommendedGearingPct,
    };
  });
}
