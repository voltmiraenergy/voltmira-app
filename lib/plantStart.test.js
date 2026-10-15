import { test } from "node:test";
import assert from "node:assert/strict";
import { parsePlantStart } from "./plantStart.js";
import { normalizePlant } from "./plantFinance.js";

const OK = {
  name: "Parc Cahul", locality: "Cahul", lat: "45.95", lon: "28.33",
  hasSolar: "on", solarMwp: "20", solarCapex: "520", solarOpex: "11",
  revKind: "auction", revPrice: "62,04", revYears: "15", revAfter: "50",
  gearingPct: "60", ratePct: "7", tenorYears: "12",
};

test("a complete form becomes a plant with the developer's own figures, and the loan terms", () => {
  const r = parsePlantStart(OK);
  assert.deepEqual(r.errors, []);
  const pl = normalizePlant(r.plant);
  assert.equal(pl.name, "Parc Cahul");
  assert.equal(pl.lat, 45.95);
  assert.equal(pl.solar.mwp, 20);
  assert.equal(pl.wind, null);
  assert.equal(pl.costs.solarEurPerKw, 520);
  assert.equal(pl.revenue.priceEurMwh, 62.04, "a decimal comma is read");
  assert.equal(pl.sample, false, "never a sample: it is paid for like any real plant");
  assert.deepEqual(r.finance, { gearingPct: 60, ratePct: 7, tenorYears: 12 });
});

test("nothing is invented: every missing figure is named, in the form's order", () => {
  const r = parsePlantStart({ name: "", hasWind: "on" });
  assert.equal(r.plant, null);
  assert.deepEqual(r.errors.slice(0, 4), ["st_err_name", "st_err_site", "st_err_wind_mw", "st_err_wind_turbines"]);
  assert.ok(r.errors.includes("st_err_price"));
  assert.ok(r.errors.includes("st_err_gearing"));
});

test("a plant needs solar or wind; storage alone does not make one", () => {
  const r = parsePlantStart({ ...OK, hasSolar: "", hasBess: "on", bessMw: "5", bessMwh: "10", bessCapex: "250" });
  assert.ok(r.errors.includes("st_err_parts"));
});

test("a wind and storage plant, sold on the market: no contract years asked", () => {
  const r = parsePlantStart({
    ...OK, hasSolar: "", hasWind: "on", windMw: "40", windTurbines: "8", windHub: "150", windCapex: "1250", windOpex: "36",
    hasBess: "on", bessMw: "10", bessMwh: "20", bessCapex: "240", revKind: "merchant", revYears: "", gridEur: "1 500 000",
  });
  assert.deepEqual(r.errors, []);
  assert.equal(r.plant.wind.turbines, 8);
  assert.equal(r.plant.revenue.years, 0);
  assert.equal(r.plant.costs.gridEur, 1500000);
});

test("impossible figures are refused, not clamped", () => {
  assert.ok(parsePlantStart({ ...OK, solarMwp: "-5" }).errors.includes("st_err_solar_mwp"));
  assert.ok(parsePlantStart({ ...OK, lat: "0", lon: "0" }).errors.includes("st_err_site"));
  assert.ok(parsePlantStart({ ...OK, gearingPct: "120" }).errors.includes("st_err_gearing"));
  assert.ok(parsePlantStart({ ...OK, tenorYears: "7.5" }).errors.includes("st_err_tenor"));
  assert.ok(parsePlantStart({ ...OK, gridEur: "abc" }).errors.includes("st_err_grid"));
});
