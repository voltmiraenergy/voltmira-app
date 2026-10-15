import { test } from "node:test";
import assert from "node:assert/strict";
import { clipLossPct, solarExport } from "./clipping.js";
import { normalizePlant, plantEnergy, evaluatePlant, plantExport } from "./plantFinance.js";
import { defaultEngineSettings } from "../engine/engine.js";

const RATIOS = Array.from({ length: 15 }, (_, i) => Math.round((0.3 + i * 0.05) * 100) / 100);
// a plausible curve: nothing above 0.85 kW per kWp, a few percent at 0.6, a lot at 0.3
const LOST = [24, 17.5, 12, 7.8, 4.6, 2.3, 0.9, 0.2, 0, 0, 0, 0, 0, 0, 0];
const CURVE = { year: 2019, db: "PVGIS-SARAH3", ratios: RATIOS, lostPct: LOST };
const E = { ...defaultEngineSettings(), horizon: 25 };
const plant = (solar = {}, top = {}) => ({
  id: "s", name: "S", ...top,
  solar: { mwp: 10, yieldKwhKwp: 1300, yieldSource: "pvgis", clipCurve: CURVE, ...solar },
  revenue: { kind: "ppa", priceEurMwh: 60, years: 15 }, costs: { solarEurPerKw: 520, opexSolarEurPerKwYr: 10 },
});

test("the curve is read between its points, flat above the last and a floor below the first", () => {
  assert.equal(clipLossPct(CURVE, 0.3).pct, 24);
  assert.equal(clipLossPct(CURVE, 0.4).pct, 12);
  assert.ok(Math.abs(clipLossPct(CURVE, 0.525).pct - 3.45) < 1e-9, "halfway between 0.50 and 0.55");
  assert.equal(clipLossPct(CURVE, 1).pct, 0);
  assert.equal(clipLossPct(CURVE, 1.4).pct, 0);
  const low = clipLossPct(CURVE, 0.2);
  assert.equal(low.pct, 24); assert.equal(low.below, true);
  assert.equal(clipLossPct(null, 0.7), null);
  assert.equal(clipLossPct(CURVE, 0), null);
});

test("DC/AC from the inverter rating, and the limit is the lower of the inverters and the grid", () => {
  const a = solarExport(normalizePlant(plant({ acMw: 8 })));
  assert.equal(a.dcAc, 1.25); assert.equal(a.limitMw, 8); assert.equal(a.bindsOn, "ac");
  assert.ok(Math.abs(a.clipPct - clipLossPct(CURVE, 0.8).pct) < 1e-9);
  const b = solarExport(normalizePlant(plant({ acMw: 8 }, { exportMw: 6 })));
  assert.equal(b.limitMw, 6); assert.equal(b.bindsOn, "grid");
  const c = solarExport(normalizePlant(plant({ acMw: 8 }, { exportMw: 9 })));
  assert.equal(c.limitMw, 8); assert.equal(c.bindsOn, "ac");
  assert.ok(Math.abs(b.clipMwh - 10 * 1300 * b.clipPct / 100) < 1e-6);
});

test("with wind on the same connection the solar part gets what the approved power leaves after the wind's average output", () => {
  // 26,280 MWh a year is 3 MW on average
  const wind = { mw: 10, turbines: 2, study: { p50Mwh: 26280, p90Mwh: 23000 } };
  const h = plantExport(normalizePlant({ ...plant({ acMw: 10 }, { exportMw: 11 }), wind }));
  assert.equal(h.limitMw, 8); assert.equal(h.bindsOn, "grid");
  // a generous approval leaves the inverters as the limit
  const g = plantExport(normalizePlant({ ...plant({ acMw: 10 }, { exportMw: 20 }), wind }));
  assert.equal(g.limitMw, 10); assert.equal(g.bindsOn, "ac");
  // the wind's average never takes the whole approval
  const t = plantExport(normalizePlant({ ...plant({ acMw: 10 }, { exportMw: 2 }), wind }));
  assert.equal(t.limitMw, 0.2);
  // and the energy follows
  const tight = normalizePlant({ ...plant({ acMw: 10 }, { exportMw: 8.5 }), wind });
  const e = plantEnergy(tight);
  assert.equal(plantExport(tight).limitMw, 5.5);
  assert.ok(e.solar.clipPct > 2 && Math.abs(e.solar.clipPct - plantExport(tight).clipPct) < 1e-9);
});

test("no limit set, or no curve, means no clipping figure rather than a guess", () => {
  const none = solarExport(normalizePlant(plant()));
  assert.equal(none.limitMw, null); assert.equal(none.clipPct, null); assert.equal(none.dcAc, null);
  const noCurve = solarExport(normalizePlant(plant({ acMw: 8, clipCurve: null })));
  assert.equal(noCurve.clipPct, null); assert.equal(noCurve.limitMw, 8);
  assert.equal(solarExport(normalizePlant({ id: "w", wind: { mw: 5 } })), null);
});

test("clipping takes energy off a PVGIS-based P50 and leaves a study's P50 alone", () => {
  const base = plantEnergy(normalizePlant(plant())).solar.p50Mwh;
  const clipped = plantEnergy(normalizePlant(plant({ acMw: 5 })));
  const loss = solarExport(normalizePlant(plant({ acMw: 5 }))).clipPct;
  assert.ok(loss > 0);
  assert.ok(Math.abs(clipped.solar.p50Mwh - base * (1 - loss / 100)) < 1e-6);
  assert.equal(clipped.solar.clipPct, loss);
  const study = plantEnergy(normalizePlant(plant({ acMw: 5, study: { p50Mwh: 12000, p90Mwh: 11000 } })));
  assert.equal(study.solar.p50Mwh, 12000);
  assert.equal(solarExport(normalizePlant(plant({ acMw: 5, study: { p50Mwh: 12000, p90Mwh: 11000 } }))).inStudy, true);
});

test("a plant with no limit is unchanged, and a tighter limit lowers the revenue and the cover", () => {
  const FIN = { gearingPct: 60, ratePct: 6.5, tenorYears: 15 };
  const a = evaluatePlant(normalizePlant(plant()), E, FIN, {});
  const b = evaluatePlant(normalizePlant(plant({ acMw: 6 })), E, FIN, {});
  const c = evaluatePlant(normalizePlant(plant({ acMw: 5 })), E, FIN, {});
  assert.ok(b.revenue[0] < a.revenue[0] && c.revenue[0] < b.revenue[0]);
  assert.ok(Math.min(...c.dscr.filter((d) => d != null)) < Math.min(...a.dscr.filter((d) => d != null)));
});

test("the plant model keeps a curve only when it is increasing ratios with shares between 0 and 100", () => {
  assert.ok(normalizePlant(plant()).solar.clipCurve);
  assert.equal(normalizePlant(plant({ clipCurve: { ratios: [1, 0.5], lostPct: [0, 5] } })).solar.clipCurve, null);
  assert.equal(normalizePlant(plant({ clipCurve: { ratios: [0.5, 1], lostPct: [0, 150] } })).solar.clipCurve, null);
  assert.equal(normalizePlant(plant({ clipCurve: { ratios: [0.5, 1], lostPct: [1] } })).solar.clipCurve, null);
  assert.equal(normalizePlant(plant({ clipCurve: "x" })).solar.clipCurve, null);
  assert.equal(normalizePlant(plant({ acMw: -3 }, { exportMw: "x" })).exportMw, 0);
});
