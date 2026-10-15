import { test } from "node:test";
import assert from "node:assert/strict";
import { monthlyCover } from "./monthlyCover.js";
import { evaluatePlant, normalizePlant } from "./plantFinance.js";
import { defaultEngineSettings } from "../engine/engine.js";

const E = { ...defaultEngineSettings(), horizon: 25 };
const FIN = { gearingPct: 60, ratePct: 6.5, tenorYears: 15 };
// a Moldovan-looking year: winter about a third of summer
const SHAPE = [0.35, 0.55, 0.9, 1.2, 1.5, 1.6, 1.65, 1.5, 1.1, 0.75, 0.4, 0.3].map((x, _, a) => x * 12 / a.reduce((p, q) => p + q, 0));
const plant = (extra = {}, rev = {}) => ({
  id: "s", name: "S", solar: { mwp: 10, yieldKwhKwp: 1300, yieldSource: "pvgis", degrPctYr: 0.5, monthShape: SHAPE, ...extra },
  revenue: { kind: "ppa", priceEurMwh: 60, years: 15, ...rev }, costs: { solarEurPerKw: 520, opexSolarEurPerKwYr: 10 },
});
const sum = (xs) => xs.reduce((a, b) => a + b, 0);

test("the twelve months add up to the year: cash flow available and debt service", () => {
  const r = evaluatePlant(normalizePlant(plant()), E, FIN, {});
  const mc = monthlyCover(plant(), E, FIN, {});
  assert.equal(mc.months.length, 12);
  const k = mc.year - 1;
  assert.ok(Math.abs(sum(mc.months.map((x) => x.cfads)) - r.cfads[k]) < 1e-6 * Math.abs(r.cfads[k]), "CFADS");
  assert.ok(Math.abs(sum(mc.months.map((x) => x.ds)) - r.debtService[k]) < 1e-6 * r.debtService[k], "debt service");
  assert.equal(mc.annualCover, Math.min(...r.dscr.filter((d) => d != null)));
});

test("winter is the lean stretch: the lowest month is December or January, the best is summer", () => {
  const mc = monthlyCover(plant(), E, FIN, {});
  assert.ok([12, 1].includes(mc.lowMonth.m), `lowest month ${mc.lowMonth.m}`);
  const best = mc.months.reduce((a, b) => (b.cover > a.cover ? b : a));
  assert.ok([6, 7].includes(best.m));
  assert.ok(mc.lowMonth.cover < mc.annualCover && best.cover > mc.annualCover);
  assert.equal(mc.lowQuarter.q, 4, "October to December is the lowest quarter");
  assert.ok(mc.lowQuarter.cover > mc.lowMonth.cover, "a quarter smooths what a month shows");
});

test("a loan sized to a thin yearly cover leaves winter months short, and the cash to bridge them is the deepest dip", () => {
  const thin = monthlyCover(plant({}, { priceEurMwh: 40 }), E, { ...FIN, gearingPct: 60 }, {});
  assert.ok(thin.annualCover > 1 && thin.lowMonth.cover < 1, `${thin.annualCover} / ${thin.lowMonth.cover}`);
  assert.ok(thin.monthsBelow >= 2);
  assert.ok(thin.bridgeEur > 0);
  // the bridge is at least the shortfall of the single worst month and at most the whole winter's shortfalls
  const short = thin.months.filter((x) => x.cover < 1).map((x) => x.ds - x.cfads);
  assert.ok(thin.bridgeEur >= Math.max(...short) - 1e-6 && thin.bridgeEur <= sum(short) + 1e-6);
  assert.equal(thin.covered, false, "no reserve set aside");
  // a reserve of six months of service covers it
  const withReserve = monthlyCover(plant({}, { priceEurMwh: 40 }), E, { ...FIN, dsraMonths: 6 }, {});
  assert.ok(withReserve.reserveEur > 0);
  assert.equal(withReserve.covered, withReserve.bridgeEur <= withReserve.reserveEur + 1e-6);
});

test("a lightly geared plant has no short month and nothing to bridge, though a moderately geared one with a good yearly cover can still have a short December", () => {
  const mc = monthlyCover(plant({}, { priceEurMwh: 90 }), E, { ...FIN, gearingPct: 20 }, {});
  assert.equal(mc.monthsBelow, 0);
  assert.equal(mc.bridgeEur, 0);
  assert.equal(mc.covered, true);
  const mid = monthlyCover(plant({}, { priceEurMwh: 90 }), E, { ...FIN, gearingPct: 40 }, {});
  assert.ok(mid.annualCover > 1.5 && mid.lowMonth.cover < 1, `${mid.annualCover} / ${mid.lowMonth.cover}`);
});

test("wind is spread evenly and a storage contract runs evenly, so a hybrid is less seasonal than solar alone", () => {
  const hybrid = { ...plant(), wind: { mw: 10, study: { p50Mwh: 30000, p90Mwh: 26000 } } };
  const a = monthlyCover(plant(), E, FIN, {}), b = monthlyCover(hybrid, E, FIN, {});
  const spread = (mc) => Math.max(...mc.months.map((x) => x.cfads)) / Math.min(...mc.months.map((x) => x.cfads));
  assert.ok(spread(b) < spread(a));
});

test("nothing without a stored monthly shape, without solar, or without a loan", () => {
  assert.equal(monthlyCover(plant({ monthShape: null }), E, FIN, {}), null);
  assert.equal(monthlyCover({ ...plant(), solar: null, wind: { mw: 10, study: { p50Mwh: 30000, p90Mwh: 26000 } } }, E, FIN, {}), null);
  assert.equal(monthlyCover(plant(), E, { gearingPct: 0 }, {}), null);
});

test("the plant model keeps a monthly shape only when it is twelve sensible numbers, scaled to sum 12", () => {
  const ok = normalizePlant(plant({ monthShape: [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1].map((x) => x * 2) })).solar.monthShape;
  assert.ok(Math.abs(sum(ok) - 12) < 1e-9 && ok.every((x) => Math.abs(x - 1) < 1e-9));
  assert.equal(normalizePlant(plant({ monthShape: [1, 2, 3] })).solar.monthShape, null);
  assert.equal(normalizePlant(plant({ monthShape: Array(12).fill(-1) })).solar.monthShape, null);
  assert.equal(normalizePlant(plant({ monthShape: "x" })).solar.monthShape, null);
});
