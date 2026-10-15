import { test } from "node:test";
import assert from "node:assert/strict";
import { weatherReplay, weakest } from "./weatherReplay.js";
import { evaluatePlant, normalizePlant } from "./plantFinance.js";
import { defaultEngineSettings } from "../engine/engine.js";

const E = { ...defaultEngineSettings(), horizon: 25 };
const FIN = { gearingPct: 60, ratePct: 6.5, tenorYears: 15 };
const YEARS = [[2010, 94.3], [2011, 100.6], [2012, 104.1], [2013, 97.2], [2014, 94.5], [2015, 103.1], [2016, 99.7], [2017, 100.4], [2018, 100.3], [2019, 102.3]].map(([y, pct]) => ({ y, pct }));
const plant = (extra = {}) => ({
  id: "s", name: "S", solar: { mwp: 10, yieldKwhKwp: 1300, yieldSource: "pvgis", degrPctYr: 0.5, variabilityDb: "PVGIS-SARAH2", weatherYears: YEARS, ...extra },
  revenue: { kind: "ppa", priceEurMwh: 70, years: 15 }, costs: { solarEurPerKw: 520, opexSolarEurPerKwYr: 10 },
});

test("the weakest year of the record leaves the lowest cover; each year is the plant run on that year's sun", () => {
  const r = weatherReplay(plant(), E, FIN, {});
  assert.equal(r.years.length, 10);
  assert.equal(r.worst.y, 2010);
  assert.equal(r.worst.pct, 94.3);
  assert.ok(r.worst.dscrMin < r.base, "worse than the average year");
  assert.ok(r.years.find((x) => x.y === 2012).dscrMin > r.base, "a sunnier year gives more cover");
  const alone = evaluatePlant(normalizePlant(plant()), E, FIN, {}, { solarFactor: 0.943 }).dscrMin;
  assert.equal(r.worst.dscrMin, alone);
  assert.equal(r.base, evaluatePlant(normalizePlant(plant()), E, FIN, {}).dscrMin);
  assert.equal(r.range, "2010-2019");
  assert.equal(r.db, "PVGIS-SARAH2");
  // cover moves with the sun: a ratio of the cash flow, so a year 5.7% duller costs more than 5.7% of the cover
  assert.ok(r.worst.dscrMin / r.base < 0.943 + 1e-9);
});

test("a heavily geared plant has years below 1.00x, a lightly geared one has none", () => {
  const weak = { ...plant(), revenue: { kind: "ppa", priceEurMwh: 40, years: 15 } };
  const heavy = weatherReplay(weak, E, { ...FIN, gearingPct: 60 }, {});
  assert.ok(heavy.below > 0 && heavy.below < heavy.total, `below ${heavy.below} of ${heavy.total}; base ${heavy.base}`);
  assert.ok(heavy.base > 1 && heavy.worst.dscrMin < 1, "the average year clears 1.00x, the worst does not");
  const light = weatherReplay(weak, E, { ...FIN, gearingPct: 30 }, {});
  assert.equal(light.below, 0);
  assert.equal(light.total, 10);
});

test("the five weakest years, weakest first", () => {
  const w = weakest(weatherReplay(plant(), E, FIN, {}), 3);
  assert.deepEqual(w.map((x) => x.y), [2010, 2014, 2013]);
});

test("no replay without solar, without weather years, or without a loan", () => {
  assert.equal(weatherReplay({ ...plant(), solar: null, wind: { mw: 10, study: { p50Mwh: 30000, p90Mwh: 26000 } } }, E, FIN, {}), null);
  assert.equal(weatherReplay(plant({ weatherYears: [] }), E, FIN, {}), null);
  assert.equal(weatherReplay(plant(), E, { gearingPct: 0 }, {}), null);
});

test("a sculpted loan keeps the base case's shape, so a duller year really lowers the cover", () => {
  const r = weatherReplay(plant(), E, { ...FIN, repayment: "sculpted" }, {});
  assert.ok(r.worst.dscrMin < r.base - 0.01, `${r.worst.dscrMin} vs ${r.base}`);
});

test("the plant model keeps only sensible weather years", () => {
  const s = normalizePlant(plant({ weatherYears: [{ y: 2010, pct: 94.33 }, { y: "x", pct: 100 }, { y: 2011, pct: 400 }, null, { y: 1900, pct: 100 }] })).solar;
  assert.deepEqual(s.weatherYears, [{ y: 2010, pct: 94.3 }]);
  assert.deepEqual(normalizePlant(plant({ weatherYears: "no" })).solar.weatherYears, []);
});
