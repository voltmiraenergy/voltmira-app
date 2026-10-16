import { test } from "node:test";
import assert from "node:assert/strict";
import { cashflowEvents } from "./cashflowEvents.js";
import { buildModel } from "./portfolioModel.js";
import { samplePortfolio } from "./plantSample.js";
import { defaultEngineSettings } from "../engine/engine.js";

const flat = (n, v) => Array.from({ length: n }, () => v);

test("each step in the cash flow or the service has its reason, in year order", () => {
  const agg = {
    cfads: flat(25, 100),
    debtService: [40, ...flat(14, 80), ...flat(10, 0)],
    repays: [false, ...flat(14, true), ...flat(10, false)],
    sustaining: Object.assign(flat(25, 0), { 11: 5000 }),
  };
  const assets = [{ kind: "plant", name: "Parc A", plant: { revenue: { kind: "auction", years: 15, priceEurMwh: 62.04, indexPct: 0, afterEurMwh: 50, bessYears: 10, bessEurPerMwYr: 0 } } }];
  const ev = cashflowEvents({ agg, fin: { gearingPct: 70, tenorYears: 15, graceYears: 1, taxPct: 12, taxLifeYears: 20 }, scenario: {}, assets });
  assert.deepEqual(ev.map((e) => [e.from, e.key]), [[1, "ev_grace"], [12, "ev_repl"], [15, "ev_repaid"], [16, "ev_contract"], [17, "ev_drift"], [21, "ev_dep"]]);
  const c = ev.find((e) => e.key === "ev_contract");
  assert.equal(c.vars.from, 62.04);
  assert.equal(c.vars.to, 50);
  assert.equal(c.vars.name, "Parc A");
  assert.equal(ev.find((e) => e.key === "ev_repl").vars.eur, 5000);
});

test("nothing is marked that does not happen inside the life", () => {
  const agg = { cfads: flat(10, 100), debtService: flat(10, 50), repays: flat(10, true), sustaining: flat(10, 0) };
  assert.deepEqual(cashflowEvents({ agg, fin: { tenorYears: 10, taxPct: 0 }, assets: [] }), []);
  assert.deepEqual(cashflowEvents({ agg: { cfads: [] }, fin: {} }), []);
});

test("the sample portfolio's chart explains its own steps", () => {
  const E = { ...defaultEngineSettings(), horizon: 25 };
  const pf = samplePortfolio();
  const plants = pf.plants.map((p) => ({ ...p, wind: { ...p.wind, study: { p50Mwh: 110000, p90Mwh: 96000 } }, solar: { ...p.solar, yieldKwhKwp: 1290 } }));
  const model = buildModel({ portfolio: { name: pf.name, project_ids: [], assets: { __plants: plants }, finance: { ...pf.finance, graceYears: 1, taxPct: 12, taxLifeYears: 20 } }, projects: [], E });
  assert.ok(model.agg.cfads.length === 25 && model.agg.cfads[0] > 0);
  const ev = cashflowEvents({ agg: model.agg, fin: model.fin, scenario: model.scenario, assets: model.assets, E });
  assert.ok(ev.some((e) => e.key === "ev_contract") && ev.some((e) => e.key === "ev_grace") && ev.some((e) => e.key === "ev_drift" && e.from === 17 && e.to === 25));
  // every year CFADS falls by more than 3% is named by some event that year
  const cf = model.agg.cfads;
  for (let i = 1; i < cf.length; i++) {
    if (cf[i] < cf[i - 1] * 0.97) assert.ok(ev.some((e) => i + 1 >= e.from && i + 1 <= e.to), `year ${i + 1} falls without a reason`);
  }
});
