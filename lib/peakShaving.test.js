import { test } from "node:test";
import assert from "node:assert/strict";
import { simulatePeakShaving } from "./peakShaving.js";

// Simple, hand-computable shapes: all production in hour 12, all
// consumption split evenly between hour 12 (midday) and hour 19 (evening).
const PROD_NOON_ONLY = Array(24).fill(0).map((_, h) => (h === 12 ? 1 : 0));
const LOAD_NOON_AND_EVENING = Array(24).fill(0).map((_, h) => (h === 12 || h === 19 ? 0.5 : 0));

test("returns null for a malformed shape instead of crashing", () => {
  assert.equal(simulatePeakShaving({ prodShape: [1], loadShape: LOAD_NOON_AND_EVENING, dailyProdKwh: 10, dailyConsKwh: 10, battKwh: 5 }), null);
  assert.equal(simulatePeakShaving({ prodShape: PROD_NOON_ONLY, loadShape: null, dailyProdKwh: 10, dailyConsKwh: 10, battKwh: 5 }), null);
});

test("with no battery, noon surplus is exported and the evening draw comes straight from the grid", () => {
  const r = simulatePeakShaving({ prodShape: PROD_NOON_ONLY, loadShape: LOAD_NOON_AND_EVENING, dailyProdKwh: 10, dailyConsKwh: 10, battKwh: 0 });
  // hour 12: prod=10, cons=5, direct solar covers the 5, 5 exported
  const noon = r.hours[12];
  assert.equal(noon.directSolarKwh, 5);
  assert.equal(noon.gridExportKwh, 5);
  assert.equal(noon.battChargeKwh, 0);
  // hour 19: prod=0, cons=5, all from the grid, nothing shifted
  const evening = r.hours[19];
  assert.equal(evening.gridImportKwh, 5);
  assert.equal(evening.battDischargeKwh, 0);
  assert.equal(r.shiftedKwh, 0);
  assert.equal(r.eveningCoverPct, 0);
});

test("a battery big enough for the noon surplus fully covers the evening draw", () => {
  // Noon surplus = 10-5 = 5 kWh; usable = battKwh*0.9. battKwh=6 -> usable 5.4, enough for the 5kWh evening need.
  const r = simulatePeakShaving({ prodShape: PROD_NOON_ONLY, loadShape: LOAD_NOON_AND_EVENING, dailyProdKwh: 10, dailyConsKwh: 10, battKwh: 6 });
  const noon = r.hours[12];
  assert.ok(Math.abs(noon.battChargeKwh - 5) < 1e-9); // all 5kWh surplus charges the battery
  assert.equal(noon.gridExportKwh, 0);
  const evening = r.hours[19];
  assert.ok(Math.abs(evening.battDischargeKwh - 5) < 1e-9);
  assert.equal(evening.gridImportKwh, 0);
  assert.ok(Math.abs(r.shiftedKwh - 5) < 1e-9);
  assert.ok(Math.abs(r.eveningCoverPct - 100) < 1e-6);
});

test("a battery smaller than the surplus caps charging at its usable (90% round-trip) capacity", () => {
  const r = simulatePeakShaving({ prodShape: PROD_NOON_ONLY, loadShape: LOAD_NOON_AND_EVENING, dailyProdKwh: 10, dailyConsKwh: 10, battKwh: 2 });
  const noon = r.hours[12];
  assert.ok(Math.abs(noon.battChargeKwh - 1.8) < 1e-9); // 2 * 0.9
  assert.ok(Math.abs(noon.gridExportKwh - 3.2) < 1e-9); // 5 - 1.8
  const evening = r.hours[19];
  assert.ok(Math.abs(evening.battDischargeKwh - 1.8) < 1e-9);
  assert.ok(Math.abs(evening.gridImportKwh - 3.2) < 1e-9);
  const expectedCoverPct = (1.8 / 5) * 100;
  assert.ok(Math.abs(r.eveningCoverPct - expectedCoverPct) < 1e-6);
});

test("a zero/negative battery capacity behaves exactly like no battery, never a crash", () => {
  const r = simulatePeakShaving({ prodShape: PROD_NOON_ONLY, loadShape: LOAD_NOON_AND_EVENING, dailyProdKwh: 10, dailyConsKwh: 10, battKwh: -5 });
  assert.equal(r.shiftedKwh, 0);
});

test("hourly production/consumption kWh always equal the shape fraction times the real daily total", () => {
  const r = simulatePeakShaving({ prodShape: PROD_NOON_ONLY, loadShape: LOAD_NOON_AND_EVENING, dailyProdKwh: 20, dailyConsKwh: 8, battKwh: 0 });
  assert.equal(r.hours[12].prodKwh, 20);
  assert.equal(r.hours[12].consKwh, 4);
  assert.equal(r.hours[19].consKwh, 4);
});
