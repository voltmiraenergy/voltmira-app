// lib/portfolio.js — many projects as one investment: the totals a fund asks
// for (MW, capex, blended IRR, pooled debt cover), the same stress cases run
// across every asset, and a risk matrix whose every rating comes from a stated
// numeric rule. Pure; no I/O.
//
// BLENDED IRR is the IRR of the summed cash flows, not an average of IRRs, so a
// big weak asset weighs what it costs. POOLED DSCR is total CFADS over total
// debt service per year: it assumes the portfolio is financed as one facility;
// each asset's own minimum is kept beside it, because a lender to a single
// asset only sees that one.
import { evaluateProject, stressCases, irrOf, normalizeFinance, normalizeScenario, STRESS_DEFAULTS } from "./projectFinance.js";

const sum = (arr) => arr.reduce((a, b) => a + b, 0);
const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);

/** What a document register tracks per asset: the papers a lender asks for. */
export const DOC_KEYS = ["land", "grid", "permit", "design", "offtake", "es"];
export const DOC_STATES = ["missing", "draft", "done"];

/** 0..1: how much of the lender's paper trail exists (done = 1, draft = half). */
export function docReadiness(docs) {
  const d = docs && typeof docs === "object" ? docs : {};
  return sum(DOC_KEYS.map((k) => (d[k] === "done" ? 1 : d[k] === "draft" ? 0.5 : 0))) / DOC_KEYS.length;
}

/**
 * Totals and the pooled cash flow of evaluated assets.
 * @param {Array<{id:string,name?:string,market?:string,region?:string,kw:number,result:object}>} items
 */
export function aggregate(items) {
  const list = (items || []).filter((x) => x && x.result);
  if (!list.length) {
    return {
      count: 0, kwp: 0, capexEur: 0, grantEur: 0, loanEur: 0, equityEur: 0, year1Mwh: 0,
      npv: 0, irr: null, equityIrr: null, dscrMin: null, dscrAvg: null, dscrByYear: [], paybackYears: null,
      cfads: [], debtService: [], projectCf: [], weakest: null, largestSharePct: 0, byRegion: [], byMarket: [],
    };
  }
  const H = Math.min(...list.map((x) => x.result.years));
  const col = (key, i) => sum(list.map((x) => num(x.result[key][i])));
  const cfads = Array.from({ length: H }, (_, i) => col("cfads", i));
  const debtService = Array.from({ length: H }, (_, i) => col("debtService", i));
  const projectCf = [sum(list.map((x) => num(x.result.projectCf[0]))), ...cfads];
  const equity = sum(list.map((x) => x.result.equityEur));
  const equityCf = [-equity, ...cfads.map((c, i) => c - debtService[i])];
  const dscrByYear = debtService.map((d, i) => (d > 1e-9 ? cfads[i] / d : null));
  const live = dscrByYear.filter((v) => v != null);

  // discounting uses each asset's own NPV, so a single rate is not imposed here
  const npv = sum(list.map((x) => x.result.npv));
  let cum = projectCf[0], payback = null;
  for (let i = 0; i < H; i++) {
    const before = cum; cum += cfads[i];
    if (payback == null && cum >= 0) payback = i + (before === cum ? 0 : (0 - before) / (cum - before));
  }

  // the asset a lender to that asset alone would worry about
  const withCover = list.filter((x) => x.result.dscrMin != null);
  const weakest = withCover.length
    ? withCover.reduce((a, b) => (b.result.dscrMin < a.result.dscrMin ? b : a))
    : null;

  const capex = sum(list.map((x) => x.result.capexEur));
  const share = (key) => {
    const m = new Map();
    for (const x of list) m.set(x[key] || "", (m.get(x[key] || "") || 0) + x.result.capexEur);
    return [...m.entries()].map(([k, v]) => ({ key: k, capexEur: v, sharePct: capex > 0 ? (v / capex) * 100 : 0 }))
      .sort((a, b) => b.capexEur - a.capexEur);
  };
  const largest = Math.max(...list.map((x) => (capex > 0 ? (x.result.capexEur / capex) * 100 : 0)));

  return {
    count: list.length,
    kwp: sum(list.map((x) => num(x.kw))),
    capexEur: capex,
    grantEur: sum(list.map((x) => x.result.grantEur)),
    loanEur: sum(list.map((x) => x.result.loanEur)),
    equityEur: equity,
    year1Mwh: sum(list.map((x) => x.result.year1Kwh)) / 1000,
    npv,
    irr: irrOf(projectCf),
    equityIrr: equity > 1e-6 ? irrOf(equityCf) : null,
    dscrMin: live.length ? Math.min(...live) : null,
    dscrAvg: live.length ? sum(live) / live.length : null,
    dscrByYear,
    paybackYears: payback,
    cfads, debtService, projectCf,
    weakest: weakest ? { id: weakest.id, name: weakest.name, dscrMin: weakest.result.dscrMin } : null,
    largestSharePct: largest,
    byRegion: share("region"),
    byMarket: share("market"),
  };
}

/**
 * Evaluate every asset under each standard case and aggregate. Cases are
 * defined per market (only Ukraine has a war-risk case); an asset whose market
 * has no such case keeps the base scenario for it.
 * @param {Array<{id,name,market,region,input,kw}>} assets
 * @returns {Array<{id:string, exceed:string, agg:object}>}
 */
export function runPortfolioStress(assets, E, fin, baseScenario) {
  const f = normalizeFinance(fin);
  const base = normalizeScenario(baseScenario);
  const ids = [];
  for (const a of assets) for (const c of stressCases(a.market, base)) if (!ids.includes(c.id)) ids.push(c.id);
  // keep base first and combined last whatever the markets contribute
  ids.sort((a, b) => (a === "base" ? -1 : b === "base" ? 1 : a === "combined" ? 1 : b === "combined" ? -1 : 0));
  return ids.map((id) => {
    let exceed = "P50";
    const items = assets.map((a) => {
      const cs = stressCases(a.market, base);
      const c = cs.find((x) => x.id === id) || cs[0];
      exceed = c.exceed;
      return { id: a.id, name: a.name, market: a.market, region: a.region, kw: a.kw, result: evaluateProject(a.input, E, f, c.scenario, { exceed: c.exceed }) };
    });
    return { id, exceed, agg: aggregate(items) };
  });
}

// Rule-of-thumb DSCR levels. Lenders set their own; these only sort a screen.
export const DSCR_GOOD = 1.3;
export const DSCR_OK = 1.15;
const level3 = (v, good, ok) => (v == null ? "unknown" : v >= good ? "low" : v >= ok ? "medium" : "high");

/**
 * The risk matrix: one row per risk, a level (low / medium / high / unknown)
 * and the number it was rated on. Rules, in order:
 *   debt cover      P50 minimum DSCR  >= 1.30 low, >= 1.15 medium, else high
 *   resource        P90 minimum DSCR  >= 1.15 low, >= 1.00 medium, else high
 *   tariff          DSCR at -20% tariff   >= 1.15 low, >= 1.00 medium, else high
 *   curtailment     DSCR with curtailment >= 1.15 low, >= 1.00 medium, else high
 *   currency        DSCR with depreciation >= 1.15 low, >= 1.00 medium, else high
 *                   (debt in the project's own currency counts as hedged: low)
 *   construction    DSCR with a 6-month delay >= 1.00 low, >= 0.60 medium, else high
 *   revenue basis   a PPA on the output: low; every asset inside its market's
 *                   scheme limit: medium; any asset above it: high
 *   concentration   largest asset or area share  <= 33% low, <= 50% medium, else high
 *   documents       readiness >= 80% low, >= 50% medium, else high
 *
 * @param {{suite:Array, fin:object, scenario:object, assets:Array, schemeLimitKw?:Record<string,number>}} a
 */
export function riskMatrix({ suite, fin, scenario, assets, schemeLimitKw = {} }) {
  const f = normalizeFinance(fin);
  const sc = normalizeScenario(scenario);
  const get = (id) => suite.find((s) => s.id === id)?.agg;
  const m = (id) => get(id)?.dscrMin ?? null;
  const rows = [];
  const push = (id, level, value, extra = {}) => rows.push({ id, level, value, ...extra });

  push("cover", level3(m("base"), DSCR_GOOD, DSCR_OK), m("base"));
  push("resource", level3(m("p90"), DSCR_OK, 1.0), m("p90"));
  push("tariff", level3(m("tariff"), DSCR_OK, 1.0), m("tariff"));
  push("curtailment", level3(m("curtailment"), DSCR_OK, 1.0), m("curtailment"));
  const cur = m("currency");
  push("currency", f.debtCurrency === "local" ? "low" : level3(cur, DSCR_OK, 1.0), cur, { hedged: f.debtCurrency === "local" });
  const del = m("delay");
  push("construction", del == null ? "unknown" : del >= 1.0 ? "low" : del >= 0.6 ? "medium" : "high", del);

  // revenue basis
  const over = assets.filter((a) => schemeLimitKw[a.market] != null && num(a.kw) > schemeLimitKw[a.market]);
  push("revenue", sc.ppa ? "low" : over.length ? "high" : "medium", sc.ppa ? sc.ppa.sharePct : over.length, { ppa: !!sc.ppa, over: over.map((a) => a.id) });

  const agg = get("base");
  const conc = agg ? Math.max(agg.largestSharePct, agg.byRegion.filter((r) => r.key).length ? Math.max(...agg.byRegion.filter((r) => r.key).map((r) => r.sharePct)) : 0) : null;
  push("concentration", conc == null ? "unknown" : conc <= 33 ? "low" : conc <= 50 ? "medium" : "high", conc);

  const ready = assets.length ? (sum(assets.map((a) => docReadiness(a.docs))) / assets.length) * 100 : null;
  push("documents", ready == null ? "unknown" : ready >= 80 ? "low" : ready >= 50 ? "medium" : "high", ready);
  return rows;
}

export { STRESS_DEFAULTS };
