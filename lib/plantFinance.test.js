import { test } from "node:test";
import assert from "node:assert/strict";
import { normalizePlant, plantEnergy, plantCapex, evaluatePlant, evaluateAsset, plantHeadroom, plantKw } from "./plantFinance.js";
import { histogram } from "./windScreen.js";
import { samplePortfolio, blankPlant } from "./plantSample.js";
import { buildModel } from "./portfolioModel.js";
import { defaultEngineSettings } from "../engine/engine.js";

const E = { ...defaultEngineSettings(), horizon: 25 };
const steadyHist = histogram(Array.from({ length: 8760 }, (_, i) => 4 + (i % 7)));
const PLANT = {
  id: "p1", name: "Test park", lat: 46, lon: 28.5,
  wind: { mw: 20, turbines: 4, hubM: 120, lossesPct: 15, study: { p50Mwh: 60000, p90Mwh: 52000 } },
  solar: { mwp: 10, yieldKwhKwp: 1250 },
  bess: { mw: 5, mwh: 10 },
  revenue: { kind: "auction", priceEurMwh: 62.04, years: 15, afterEurMwh: 50 },
  costs: { windEurPerKw: 1200, solarEurPerKw: 500, bessEurPerKwh: 250, gridEur: 1000000, devPct: 3, opexWindEurPerKwYr: 35, opexSolarEurPerKwYr: 10, opexBessEurPerKwhYr: 5, landEurYr: 30000, insurancePct: 0.35 },
};

test("a plant is normalised: sources without capacity drop out, numbers are clamped", () => {
  const p = normalizePlant({ id: "x", wind: { mw: 0 }, solar: { mwp: 5, yieldKwhKwp: "1300" }, revenue: { years: 99, kind: "odd" } });
  assert.equal(p.wind, null);
  assert.equal(p.solar.yieldKwhKwp, 1300);
  assert.equal(p.revenue.years, 30);
  assert.equal(p.revenue.kind, "auction");
  assert.equal(plantKw(p), 5000);
});

test("energy: the study wins over screening; the study's P90 sets the uncertainty", () => {
  const en = plantEnergy(PLANT);
  assert.equal(en.wind.source, "study");
  assert.equal(en.wind.p50Mwh, 60000);
  assert.ok(Math.abs(en.wind.sigmaPct - ((1 - 52000 / 60000) / 1.2816) * 100) < 1e-9);
  assert.equal(en.solar.p50Mwh, 12500);
  assert.equal(en.p50Mwh, 72500);
  const screened = plantEnergy({ ...PLANT, wind: { ...PLANT.wind, study: null, screening: { hist: steadyHist, climMean: null } } });
  assert.equal(screened.wind.source, "screening");
  assert.equal(screened.wind.sigmaPct, 15);
  assert.ok(screened.wind.p50Mwh > 0);
  assert.equal(plantEnergy({ ...PLANT, wind: { mw: 10 } }).wind.source, "none");
});

test("capex adds each technology, the grid and development", () => {
  const c = plantCapex(normalizePlant(PLANT));
  assert.equal(c.hard, 20000 * 1200 + 10000 * 500 + 10000 * 250 + 1000000);
  assert.ok(Math.abs(c.total - c.hard * 1.03) < 1e-6);
});

test("the plant's cash flow has the quote model's shape, and P90 produces less than P50", () => {
  const r = evaluatePlant(PLANT, E, { gearingPct: 65, ratePct: 6.5, tenorYears: 15 }, {});
  for (const k of ["capexEur", "loanEur", "cfads", "debtService", "dscr", "projectCf", "equityCf", "npv", "irr", "dscrMin", "year1Kwh", "lcoe"]) assert.ok(k in r, k);
  assert.equal(r.cfads.length, 25);
  assert.ok(Math.abs(r.year1Kwh - 72500 * 1000) < 1);
  assert.ok(Math.abs(r.revenue[0] - 72500 * 62.04) < 1);
  const p90 = evaluatePlant(PLANT, E, { gearingPct: 65 }, {}, { exceed: "P90" });
  assert.ok(p90.year1Kwh < r.year1Kwh);
});

test("after the contract, the merchant price applies; a tariff shock touches only that part", () => {
  const r = evaluatePlant(PLANT, E, {}, {});
  const shock = evaluatePlant(PLANT, E, {}, { tariffMultiplier: 0.8 });
  // contracted years are untouched
  assert.ok(Math.abs(shock.revenue[0] - r.revenue[0]) < 1e-6);
  assert.ok(Math.abs(shock.revenue[14] - r.revenue[14]) < 1e-6);
  // year 16 onwards is merchant: 50 EUR/MWh, then 40 under the shock
  const e16 = r.energyKwh[15] / 1000;
  assert.ok(Math.abs(r.revenue[15] - e16 * 50) < 1e-6);
  assert.ok(Math.abs(shock.revenue[15] - e16 * 40) < 1e-6);
});

test("a battery earns only what a contract gives it", () => {
  const base = evaluatePlant(PLANT, E, {}, {});
  const paid = evaluatePlant({ ...PLANT, revenue: { ...PLANT.revenue, bessEurPerMwYr: 40000 } }, E, {}, {});
  assert.ok(Math.abs(paid.revenue[0] - base.revenue[0] - 5 * 40000) < 1e-6);
});

test("evaluateAsset sends a plant to the plant model and a quote to the engine", () => {
  const plantRes = evaluateAsset({ kind: "plant", plant: PLANT }, E, {}, {});
  assert.ok(plantRes.plant);
  const quoteRes = evaluateAsset({ input: { kw: 6, price: 0.15, cons: 5000, market: "MD" } }, E, {}, {});
  assert.equal(quoteRes.plant, undefined);
  assert.ok(quoteRes.year1Kwh > 0);
});

test("headroom: how far energy may fall, or capex rise, before cover reaches the target", () => {
  const fin = { gearingPct: 60, ratePct: 6, tenorYears: 15 };
  const h = plantHeadroom(PLANT, E, fin, {}, 1.3);
  assert.ok(h.dscrMin > 0);
  if (h.dscrMin > 1.3) {
    assert.ok(h.energyHeadroomPct > 0 && h.capexHeadroomPct > 0);
    // at the found energy level, cover is at the target
    const at = evaluatePlant(PLANT, E, fin, { yieldMultiplier: 1 - h.energyHeadroomPct / 100 });
    assert.ok(Math.abs(at.dscrMin - 1.3) < 0.01);
  } else {
    assert.ok(h.energyHeadroomPct < 0);
  }
  assert.deepEqual(plantHeadroom(PLANT, E, { gearingPct: 0 }, {}), { dscrMin: null, energyHeadroomPct: null, capexHeadroomPct: null });
});

test("the samples are complete plants, marked as samples, with the auction's published price", () => {
  const h = samplePortfolio("hybrid", "ro");
  assert.match(h.name, /^Exemplu/);
  assert.equal(h.plants.length, 1);
  const p = normalizePlant(h.plants[0]);
  assert.ok(p.sample && p.wind && p.solar && p.bess);
  assert.equal(p.revenue.priceEurMwh, 62.04);
  assert.equal(h.plants[0].permits.land.by, "Dezvoltator");
  const r = samplePortfolio("rooftops", "en");
  assert.equal(r.plants.length, 5);
  assert.ok(r.plants.every((x) => x.sample && x.solar && x.lat != null));
  const b = blankPlant("New");
  assert.equal(b.name, "New");
  assert.equal(normalizePlant(b).wind, null);
});

test("a portfolio of plants builds into the same model, with the plants' documents from their permits", () => {
  const s = samplePortfolio("rooftops", "en");
  const plants = s.plants.map((p) => ({ ...p, solar: { ...p.solar, yieldKwhKwp: 1250 } }));
  const m = buildModel({ portfolio: { market: "MD", project_ids: [], assets: { __plants: plants }, finance: s.finance, scenario: {} }, projects: [], E, include: { sensitivity: false, structures: false } });
  assert.equal(m.assets.length, 5);
  assert.ok(m.assets.every((a) => a.kind === "plant" && a.lat != null));
  assert.ok(Math.abs(m.agg.kwp - 5100) < 1e-6);
  assert.ok(m.agg.year1Mwh > 0);
  assert.equal(m.assets[0].docs.land, "done");
  // contracted plants make the revenue basis the low-risk case
  assert.equal(m.risks.find((x) => x.id === "revenue").level, "low");
});
