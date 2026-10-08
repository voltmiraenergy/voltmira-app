import { test } from "node:test";
import assert from "node:assert/strict";
import { solarBudget, SOLAR_PARTS, p90Share } from "./p90Budget.js";
import { normalizePlant, plantEnergy, evaluatePlant } from "./plantFinance.js";
import { defaultEngineSettings } from "../engine/engine.js";

const E = { ...defaultEngineSettings(), horizon: 25 };
const close = (a, b, tol = 1e-9) => assert.ok(Math.abs(a - b) <= tol * Math.max(1, Math.abs(b)), `${a} vs ${b}`);
const solar = (extra = {}) => ({ id: "s", name: "S", solar: { mwp: 10.3048, yieldKwhKwp: 2124, yieldSource: "pvgis", degrPctYr: 0.5, ...extra }, revenue: { kind: "ppa", priceEurMwh: 60, years: 15 }, costs: { solarEurPerKw: 500 } });

test("the generic budget is the seven parts Studio uses, about 7.1%", () => {
  const b = solarBudget({});
  assert.equal(b.parts.length, SOLAR_PARTS.length);
  assert.ok(b.parts.every((p) => p.source === "assumed"));
  assert.ok(Math.abs(b.totalPct - 7.1) < 0.01);
  assert.equal(b.siteWeather, false);
});

test("the site's weather variability replaces only the weather guess, and is marked as the site's", () => {
  const b = solarBudget({ variabilityPct: 3.7, variabilityDb: "PVGIS-SARAH2", variabilityYears: "2005-2020" });
  const w = b.parts.find((p) => p.id === "weather");
  assert.deepEqual([w.pct, w.source, w.db, w.years], [3.7, "site", "PVGIS-SARAH2", "2005-2020"]);
  assert.equal(b.parts.filter((p) => p.source === "assumed").length, 6);
  close(b.totalPct, Math.sqrt(3.5 ** 2 + 3.7 ** 2 + 2.6 ** 2 + 1.8 ** 2 + 1.5 ** 2 + 1.4 ** 2 + 1 ** 2));
  assert.ok(b.totalPct < 7.1);
  // nonsense is ignored
  assert.equal(solarBudget({ variabilityPct: 40 }).siteWeather, false);
  assert.equal(solarBudget({ variabilityPct: -1 }).siteWeather, false);
  close(p90Share(7.1), 1 - 1.2816 * 0.071);
});

test("a plant's P90 spread comes from a study's own P50 and P90, else from the budget with the site's weather", () => {
  const site = plantEnergy(solar({ variabilityPct: 3.7, variabilityDb: "PVGIS-SARAH2", variabilityYears: "2005-2020" }));
  assert.equal(site.solar.sigmaBasis, "site");
  close(site.solar.sigmaPct, solarBudget({ variabilityPct: 3.7 }).totalPct);
  assert.equal(plantEnergy(solar()).solar.sigmaBasis, "assumed");
  const withP90 = plantEnergy(solar({ study: { p50Mwh: 21480, p90Mwh: 19800 } }));
  assert.equal(withP90.solar.sigmaBasis, "study");
  assert.equal(withP90.solar.budget, null);
  const noP90 = plantEnergy(solar({ variabilityPct: 3.7, study: { p50Mwh: 21480 } }));
  assert.equal(noP90.solar.sigmaBasis, "assumed");
  assert.ok(noP90.solar.budget.siteWeather);
});

test("first-year degradation: year 1 is 98% of the P50, then 0.5% a year, as in a Solargis table", () => {
  const r = evaluatePlant(solar({ degrFirstPct: 2 }), E, { gearingPct: 0 }, {});
  const p50 = 10.3048 * 2124;
  close(r.energyKwh[0] / 1000, p50 * 0.98, 1e-9);
  close(r.energyKwh[1] / r.energyKwh[0], 0.995, 1e-9);
  const avg = r.energyKwh.slice(0, 25).reduce((a, b) => a + b, 0) / 25 / 1000;
  assert.ok(Math.abs(avg / (1961 * 10.3048) - 1) < 0.002, `25-year average ${avg}`);
  // unset, nothing changes
  const none = evaluatePlant(solar(), E, { gearingPct: 0 }, {});
  close(none.energyKwh[0] / 1000, p50, 1e-9);
});

test("availability lowers a PVGIS-based yield, but not a study's net P50", () => {
  close(plantEnergy(solar({ availabilityPct: 1 })).solar.p50Mwh, 10.3048 * 2124 * 0.99);
  assert.equal(plantEnergy(solar({ availabilityPct: 1, study: { p50Mwh: 21480 } })).solar.p50Mwh, 21480);
});

test("the new solar fields are normalised and clamped", () => {
  const s = normalizePlant(solar({ degrFirstPct: 99, availabilityPct: -3, variabilityPct: 3.74, variabilityYears: "2005-2020", variabilityDb: "PVGIS-SARAH2", yieldLosses: { aoi: -2.79, spectral: "1.19", tempIrr: -6.98, total: -21.31, system: 14, junk: 1 } })).solar;
  assert.equal(s.degrFirstPct, 10);
  assert.equal(s.availabilityPct, 0);
  assert.equal(s.variabilityPct, 3.74);
  assert.equal(s.variabilityYears, "2005-2020");
  assert.deepEqual(s.yieldLosses, { aoi: -2.79, spectral: 1.19, tempIrr: -6.98, total: -21.31, system: 14 });
  const bad = normalizePlant(solar({ variabilityPct: 80, variabilityYears: "recent", yieldLosses: "x" })).solar;
  assert.equal(bad.variabilityPct, null);
  assert.equal(bad.variabilityYears, "");
  assert.equal(bad.yieldLosses, null);
});

import { basisLine } from "./energyBasis.js";

test("the one-line basis names where each source's spread comes from", () => {
  const site = solar({ variabilityPct: 3.7, variabilityDb: "PVGIS-SARAH2", variabilityYears: "2005-2020" });
  const line = basisLine(plantEnergy(site), "en", normalizePlant(site).solar);
  assert.match(line, /^Solar: 1 sigma 6\.4%: weather 3\.7% measured at the site \(PVGIS-SARAH2, 2005-2020\); the other parts are assumptions$/);
  assert.match(basisLine(plantEnergy(solar()), "ro", normalizePlant(solar()).solar), /1 sigma 7,1%: fiecare componentă este o ipoteză/);
  assert.match(basisLine(plantEnergy(solar({ study: { p50Mwh: 21480, p90Mwh: 19800 } })), "en"), /from the study's own P50 and P90/);
  const wind = { id: "w", wind: { mw: 10, study: { p50Mwh: 30000, p90Mwh: 26000 } } };
  assert.match(basisLine(plantEnergy(wind), "en"), /Wind: 1 sigma 10\.\d%, from the study's own P50 and P90/);
  assert.match(basisLine(plantEnergy({ id: "w", wind: { mw: 10, screening: { hist: { counts: Array(40).fill(100), hours: 4000 }, climMean: null } } }), "en"), /Wind: 1 sigma 15%, assumed for a screening estimate/);
  assert.equal(basisLine({ wind: null, solar: null }, "en"), "");
});
