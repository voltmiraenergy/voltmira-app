// lib/portfolioModel.js — one portfolio, computed once, read by everything
// that shows it: the page, the PDF report, the investor teaser, the Excel
// workbook and the data room. They all call buildModel(), so no document can
// disagree with another. Pure; no I/O. The server loads the rows, this turns
// them into numbers.
import { normalizeFinance, normalizeScenario, withTaxDefault } from "./projectFinance.js";
import { evaluateAsset, normalizePlant, plantKw, plantEnergy } from "./plantFinance.js";
import { plantDocs } from "./plantPermits.js";
import { aggregate, runPortfolioStress, riskMatrix, docReadiness, DOC_KEYS } from "./portfolio.js";
import { normalizeSizing } from "./debtSizing.js";
import { settleSizing } from "./sizingSettle.js";
import { tornado, compareStructures } from "./portfolioSensitivity.js";
import { readiness } from "./portfolioReadiness.js";
import { termsSourced } from "./financingPresets.js";
import { rowToQuoteInput } from "./quoteInput.js";
import { gridFor } from "./gridFile.js";
import { esProgress, co2Avoided } from "./esScreening.js";
import { MARKETS } from "@voltmira/engine";
import { savedPos } from "./geoPlace.js";

const PORTFOLIO_MARKETS = ["MD", "UA"];
export const MAX_STRUCTURES = 4;          // the current one and three to compare

const coord = (v) => (v !== "" && v != null && Number.isFinite(Number(v)) ? Number(v) : null);

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
  let lat = coord(row.lat), lon = coord(row.lon);
  if (lat == null || lon == null || (lat === 0 && lon === 0)) { lat = null; lon = null; }
  // pinned in the quote: exact. Otherwise the position the portfolio looked up
  // from the address or the town (lib/geoPlace.js), while it still matches.
  let loc = lat != null ? "exact" : null;
  if (lat == null) {
    const pos = savedPos(st.pos, { address: row.address, title: row.title, market });
    if (pos) { lat = pos.lat; lon = pos.lon; loc = pos.precision; }
  }
  return {
    id: row.id,
    name: row.title || row.client_name || "",
    client: row.client_name || "",
    address: row.address || "",
    market,
    kw: Math.max(0, Number(row.kw) || 0),
    status: row.status || "",
    signed: !!row.signed,
    region: regionId || "",
    regionName: regionId && grid.operators[regionId] ? grid.operators[regionId].short : "",
    docs: st.docs && typeof st.docs === "object" ? st.docs : {},
    capexOverrideEur: capexOverride || null,
    // a yield looked up for this site (PVGIS) rather than the engine's default
    hasSiteYield: Number(row.yield_per_kwp) > 0,
    lat, lon, loc,
    note: typeof st.note === "string" ? st.note : "",
    input,
  };
}

/** Where a portfolio keeps its plants: its assets record, under a key no quote id can take. */
export const PLANTS_KEY = "__plants";

/**
 * A utility plant stored on the portfolio (portfolios.assets.__plants[]) as an asset:
 * one row of the asset table, with its own energy model (lib/plantFinance.js)
 * and the lender's documents read from its permit checklist
 * (lib/plantPermits.js). Moldova only, like the market it is modelled for.
 */
export function buildPlantAsset(raw) {
  const plant = normalizePlant(raw);
  const en = plantEnergy(plant);
  return {
    id: plant.id, kind: "plant", plant,
    name: plant.name || "", client: "", address: plant.locality,
    market: "MD",
    kw: plantKw(plant),
    status: "", signed: false,
    region: plant.operator || "", regionName: plant.operator || "",
    docs: plantDocs(plant.permits),
    capexOverrideEur: null,
    // a measured study, or at least a public-data screening for each source
    hasSiteYield: (!en.wind || en.wind.source !== "none") && (!en.solar || en.solar.source !== "none"),
    lat: plant.lat, lon: plant.lon, loc: plant.lat != null ? "exact" : null,
    note: "",
    input: null,
  };
}

/** The structures to compare: the current terms first, then the saved alternatives. */
export function structuresOf(finance) {
  const f = finance && typeof finance === "object" ? finance : {};
  const alts = Array.isArray(f.compare) ? f.compare.filter((s) => s && typeof s === "object" && s.fin) : [];
  return [{ id: "current", preset: f.preset || null, fin: f }, ...alts.slice(0, MAX_STRUCTURES - 1)
    .map((s, i) => ({ id: String(s.id || "s" + i), label: typeof s.label === "string" ? s.label : "", preset: s.preset || null, fin: s.fin }))];
}

/**
 * @param {object} a
 * @param {{id,name,market,project_ids,finance,scenario,assets,es}} a.portfolio
 * @param {Array<object>} a.projects   quote rows (projects), any order; ids not in the portfolio are ignored
 * @param {object} a.E                 engine settings (with fx)
 * @param {Record<string,number>} [a.schemeLimitKw]  the kW above which a market's household or prosumer scheme no longer applies
 * @param {{sensitivity?:boolean, structures?:boolean}} [a.include]  skip the heavier extras (both on by default)
 */
export function buildModel({ portfolio, projects, E, schemeLimitKw, include = {} }) {
  // the market's corporate income tax when the portfolio sets none (lib/projectFinance.js)
  const market = PORTFOLIO_MARKETS.includes(portfolio?.market) ? portfolio.market : "MD";
  const fin = normalizeFinance(withTaxDefault(portfolio?.finance, market));
  const scenario = normalizeScenario(portfolio?.scenario);
  const sizingIn = normalizeSizing(portfolio?.finance?.sizing);
  const states = portfolio?.assets && typeof portfolio.assets === "object" ? portfolio.assets : {};
  const ids = Array.isArray(portfolio?.project_ids) ? portfolio.project_ids : [];
  const byId = new Map((projects || []).map((p) => [p.id, p]));
  // keep the portfolio's own order; skip a quote that was deleted since, and one
  // in a market this module has no model for (Romania), rather than price it
  // with another country's rules
  const rows = ids.map((id) => byId.get(id)).filter(Boolean);
  const supported = rows.filter((r) => PORTFOLIO_MARKETS.includes(r.market));
  const plantRows = Array.isArray(states[PLANTS_KEY]) ? states[PLANTS_KEY].filter((x) => x && typeof x === "object" && x.id) : [];
  const assets = [...supported.map((row) => buildAsset(row, states[row.id])), ...plantRows.map(buildPlantAsset)];
  const missing = ids.filter((id) => !byId.has(id));
  const unsupported = rows.filter((r) => !PORTFOLIO_MARKETS.includes(r.market)).map((r) => r.id);

  const results = assets.map((a) => ({ ...a, result: evaluateAsset(a, E, fin, scenario) }));
  const p90Results = assets.map((a) => ({ ...a, result: evaluateAsset(a, E, fin, scenario, { exceed: "P90" }) }));
  const agg = aggregate(results);
  const p90 = aggregate(p90Results);
  const suite = assets.length ? runPortfolioStress(assets, E, fin, scenario) : [];

  // ---- debt sizing: the portfolio as one facility, and each asset on its own.
  // With tax, the cash flow depends on the loan (its interest is deducted), so
  // each capacity is settled where the loan the cash flow supports and the loan
  // the cash flow was worked out for agree (lib/sizingSettle.js). Without tax
  // one sizing is exact.
  const settled = settleSizing({ assets, E, fin, scenario, sizing: sizingIn, start: { p50: results, p90: p90Results, agg, aggP90: p90 }, currentLoanEur: agg.loanEur });
  const sizing = settled.sizing;
  const at = settled.at;
  // the same at each tenor, from the facility's settled runs
  const tenors = [...new Set([5, 7, 10, 12, 15, fin.tenorYears])].sort((a, b) => a - b);
  const byTenor = assets.length ? tenors.map((t) => {
    const r = t === fin.tenorYears ? sizing
      : settleSizing({ assets, E, fin: { ...fin, tenorYears: t }, scenario, sizing: sizingIn, start: at, currentLoanEur: agg.loanEur }).sizing;
    return { tenorYears: t, capacityEur: r.capacityEur, binding: r.binding, pct: r.capacityPct };
  }) : [];
  results.forEach((a, i) => {
    const r = a.result, r90 = p90Results[i].result;
    // each asset's stand-alone capacity, settled at its own loan
    const one = { p50: [at.p50[i]], p90: [at.p90[i]], agg: aggregate([at.p50[i]]), aggP90: aggregate([at.p90[i]]) };
    a.capacityEur = settleSizing({ assets: [assets[i]], E, fin, scenario, sizing: sizingIn, start: one, currentLoanEur: r.loanEur }).sizing.capacityEur;
    a.dscrMinP90 = r90.dscrMin;
    // a plant's P90 follows its own sources' uncertainty, so it is kept per asset
    a.p90Year1Kwh = r90.year1Kwh;
  });

  // ---- sources and uses up to commissioning: the plants, the interest during
  // construction (lent with the debt), the arrangement fee and the reserve
  // (both paid by the sponsor)
  const sourcesUses = {
    uses: { capexEur: agg.capexEur, idcEur: agg.idcEur, feeEur: agg.feeEur, dsraEur: agg.dsraEur, totalEur: agg.capexEur + agg.idcEur + agg.feeEur + agg.dsraEur },
    sources: { grantEur: agg.grantEur, debtEur: agg.loanEur, equityEur: agg.equityEur + agg.feeEur + agg.dsraEur, totalEur: agg.grantEur + agg.loanEur + agg.equityEur + agg.feeEur + agg.dsraEur },
  };

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

  // ---- what moves the result, and the other structures
  const sens = include.sensitivity === false ? { base: null, rows: [] } : tornado(assets, E, fin, scenario);
  const structures = include.structures === false ? []
    : compareStructures({
      assets, E, scenario, sizing: sizingIn, current: { agg, p90, sizing },
      // the structures differ in the lender's terms; the project's own facts (tax, construction) are the same in all
      structures: structuresOf(portfolio?.finance).map((s) => ({ ...s, fin: { ...s.fin, taxPct: fin.taxPct, taxLifeYears: fin.taxLifeYears, taxLossYears: fin.taxLossYears, constructionMonths: fin.constructionMonths } })),
    });

  const ready = readiness({
    assets: results, fin, scenario,
    dscr: { p50: agg.dscrMin, p90: p90.dscrMin },
    sizing, screening: progress, termsSourced: termsSourced(portfolio?.finance),
  });

  const docsPct = assets.length ? (assets.reduce((s, a) => s + docReadiness(a.docs), 0) / assets.length) * 100 : 0;
  return {
    portfolio, fin, scenario, E,
    assets: results, missing, unsupported, agg, p90, suite, risks,
    // the CFADS the capacity was found on: at the sized loan when tax makes them differ
    sizing: { ...sizing, byTenor, cfadsP50: at.agg.cfads, cfadsP90: at.aggP90.cfads }, sourcesUses, sensitivity: sens, structures,
    markets: marketsForEs, es, esProgress: progress, co2,
    readiness: { docsPct, esPct: progress.pct, ...ready },
    hasDebt: fin.gearingPct > 0,
  };
}

export { DOC_KEYS };
