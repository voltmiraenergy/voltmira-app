// lib/portfolioModel.js — one portfolio, computed once, read by everything
// that shows it: the page, the PDF report, the Excel workbook and the data
// room. They all call buildModel(), so no document can disagree with another.
// Pure; no I/O. The server loads the rows, this turns them into numbers.
import { evaluateProject, normalizeFinance, normalizeScenario } from "./projectFinance.js";
import { aggregate, runPortfolioStress, riskMatrix, docReadiness, DOC_KEYS } from "./portfolio.js";
import { rowToQuoteInput } from "./quoteInput.js";
import { gridFor } from "./gridFile.js";
import { esProgress, co2Avoided } from "./esScreening.js";
import { MARKETS } from "@voltmira/engine";

const PORTFOLIO_MARKETS = ["MD", "UA"];

/** A quote row (market MD or UA) as a portfolio asset: its name, area, documents and the engine input. */
export function buildAsset(row, assetState) {
  const st = assetState && typeof assetState === "object" ? assetState : {};
  const market = row.market;
  const grid = gridFor(market);
  const regionId = grid ? grid.suggest([row.address, row.title].filter(Boolean).join(", ")) : null;
  const input = rowToQuoteInput({ ...row, market });
  // the developer's own capex estimate replaces the engine's kW x rate figure
  const capexOverride = Number(st.capexEur) > 0 ? Number(st.capexEur) : 0;
  if (capexOverride > 0) input.costOverride = capexOverride;
  // a plant sized for export alone, when the developer says so
  if (st.consKwh != null && st.consKwh !== "" && Number(st.consKwh) >= 0) input.cons = Number(st.consKwh);
  return {
    id: row.id,
    name: row.title || row.client_name || "",
    client: row.client_name || "",
    address: row.address || "",
    market,
    kw: Math.max(0, Number(row.kw) || 0),
    status: row.status || "",
    region: regionId || "",
    regionName: regionId && grid.operators[regionId] ? grid.operators[regionId].short : "",
    docs: st.docs && typeof st.docs === "object" ? st.docs : {},
    capexOverrideEur: capexOverride || null,
    note: typeof st.note === "string" ? st.note : "",
    input,
  };
}

/**
 * @param {object} a
 * @param {{id,name,market,project_ids,finance,scenario,assets,es}} a.portfolio
 * @param {Array<object>} a.projects   quote rows (projects), any order; ids not in the portfolio are ignored
 * @param {object} a.E                 engine settings (with fx)
 * @param {Record<string,number>} [a.schemeLimitKw]  the kW above which a market's household or prosumer scheme no longer applies
 */
export function buildModel({ portfolio, projects, E, schemeLimitKw }) {
  const fin = normalizeFinance(portfolio?.finance);
  const scenario = normalizeScenario(portfolio?.scenario);
  const states = portfolio?.assets && typeof portfolio.assets === "object" ? portfolio.assets : {};
  const ids = Array.isArray(portfolio?.project_ids) ? portfolio.project_ids : [];
  const byId = new Map((projects || []).map((p) => [p.id, p]));
  // keep the portfolio's own order; skip a quote that was deleted since, and one
  // in a market this module has no model for (Romania), rather than price it
  // with another country's rules
  const rows = ids.map((id) => byId.get(id)).filter(Boolean);
  const supported = rows.filter((r) => PORTFOLIO_MARKETS.includes(r.market));
  const assets = supported.map((row) => buildAsset(row, states[row.id]));
  const missing = ids.filter((id) => !byId.has(id));
  const unsupported = rows.filter((r) => !PORTFOLIO_MARKETS.includes(r.market)).map((r) => r.id);

  const results = assets.map((a) => ({ ...a, result: evaluateProject(a.input, E, fin, scenario) }));
  const agg = aggregate(results);
  const p90 = aggregate(assets.map((a) => ({ ...a, result: evaluateProject(a.input, E, fin, scenario, { exceed: "P90" }) })));
  const suite = assets.length ? runPortfolioStress(assets, E, fin, scenario) : [];

  const limits = { UA: MARKETS.UA.maxKw, ...(schemeLimitKw || {}) };
  const risks = assets.length
    ? riskMatrix({ suite, fin, scenario, assets, schemeLimitKw: limits })
    : [];

  const markets = [...new Set(assets.map((a) => a.market))];
  const marketsForEs = markets.length ? markets : [PORTFOLIO_MARKETS.includes(portfolio?.market) ? portfolio.market : "MD"];
  const es = portfolio?.es && typeof portfolio.es === "object" ? portfolio.es : {};
  const progress = esProgress(es.answers, marketsForEs);

  // avoided CO2: each asset with its own market's factor
  const co2 = results.reduce((t, a) => {
    const c = co2Avoided({ year1Mwh: a.result.year1Kwh / 1000, market: a.market, years: a.result.years });
    return { tPerYear: t.tPerYear + c.tPerYear, tLifetime: t.tLifetime + c.tLifetime };
  }, { tPerYear: 0, tLifetime: 0 });

  const docsPct = assets.length ? (assets.reduce((s, a) => s + docReadiness(a.docs), 0) / assets.length) * 100 : 0;
  return {
    portfolio, fin, scenario, E,
    assets: results, missing, unsupported, agg, p90, suite, risks,
    markets: marketsForEs, es, esProgress: progress, co2,
    readiness: { docsPct, esPct: progress.pct },
    hasDebt: fin.gearingPct > 0,
  };
}

export { DOC_KEYS };
