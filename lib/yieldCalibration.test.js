/**
 * Yield-calibration tests. This feeds a number a client is shown, so the guards
 * matter as much as the maths: thin samples must refuse to answer, and bad
 * readings must not be able to move a quote.
 *
 * Run: node --test lib/yieldCalibration.test.js
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  expectedMonthKwh, systemRatio, calibrateYield, applyCalibration,
  MIN_SYSTEMS, MIN_MONTHS,
} from "./yieldCalibration.js";

const SEASON = [0.30, 0.40, 0.60, 0.80, 1.00, 1.10, 1.10, 1.00, 0.80, 0.60, 0.40, 0.25]; // sum 8.35

/** A full year of readings that hit `ratio` × the promise exactly. */
function year(kw, y, ratio, yr = 2025) {
  return Array.from({ length: 12 }, (_, m) => ({
    month: `${yr}-${String(m + 1).padStart(2, "0")}`,
    kwh: (kw * y * SEASON[m] / 8.35) * ratio,
  }));
}

test("expected month follows the seasonal shape and sums to the annual yield", () => {
  // 6 kW × 1100 = 6600 kWh/yr, split by SOLAR_SEASON
  let total = 0;
  for (let m = 0; m < 12; m++) total += expectedMonthKwh(6, 1100, null, m, 0, 0);
  assert.ok(Math.abs(total - 6600) < 0.5, `annual=${total}`);
  // June (index 5, weight 1.10) = 6600 × 1.10/8.35 = 869.4
  assert.ok(Math.abs(expectedMonthKwh(6, 1100, null, 5, 0, 0) - 869.46) < 0.5);
});

test("degradation lowers the expectation as a system ages", () => {
  const y0 = expectedMonthKwh(6, 1100, null, 5, 0, 0.5);
  const y10 = expectedMonthKwh(6, 1100, null, 5, 10, 0.5);
  assert.ok(y10 < y0, "a 10-year-old system must be expected to produce less");
  // 0.995^10 = 0.9511
  assert.ok(Math.abs(y10 / y0 - 0.9511) < 0.001, `ratio=${y10 / y0}`);
});

test("a system producing exactly its promise scores 1.00", () => {
  const r = systemRatio({ kw: 6, yieldPerKwp: 1100, readings: year(6, 1100, 1) }, 0);
  assert.ok(Math.abs(r.ratio - 1) < 1e-9, `ratio=${r.ratio}`);
  assert.equal(r.months, 12);
});

test("a partial year is measured against those months only, not a full year", () => {
  // Winter alone would look catastrophic against an annual expectation.
  const winter = year(6, 1100, 0.95).slice(0, 3);   // Jan–Mar at 95%
  const r = systemRatio({ kw: 6, yieldPerKwp: 1100, readings: winter }, 0);
  assert.equal(r.months, 3);
  assert.ok(Math.abs(r.ratio - 0.95) < 1e-9, `ratio=${r.ratio} — must be 0.95, not a fraction of the year`);
});

test("the commissioning month is skipped, and earlier months ignored", () => {
  const rows = year(6, 1100, 1);
  // switched on mid-March: March is partial and would read as underperformance
  const r = systemRatio({ kw: 6, yieldPerKwp: 1100, commissionedAt: "2025-03-14", readings: rows }, 0);
  assert.equal(r.months, 9, "Jan, Feb (before) and Mar (partial) must all be excluded");
  assert.ok(Math.abs(r.ratio - 1) < 1e-9);
});

test("unmeasurable systems return null rather than a fake ratio", () => {
  assert.equal(systemRatio(null), null);
  assert.equal(systemRatio({ kw: 0, yieldPerKwp: 1100, readings: year(6, 1100, 1) }), null);
  assert.equal(systemRatio({ kw: 6, yieldPerKwp: 0, readings: year(6, 1100, 1) }), null);
  assert.equal(systemRatio({ kw: 6, yieldPerKwp: 1100, readings: [] }), null);
  // junk rows are dropped, not counted as zero production
  assert.equal(systemRatio({ kw: 6, yieldPerKwp: 1100, readings: [{ month: "nope", kwh: 5 }, { month: "2025-01", kwh: -3 }] }), null);
});

test("the calibration is the median, so one dead inverter can't drag it down", () => {
  const good = { kw: 6, yieldPerKwp: 1100, readings: year(6, 1100, 1.02) };
  const outlier = { kw: 6, yieldPerKwp: 1100, readings: year(6, 1100, 0.10) }; // offline most of the year
  const cal = calibrateYield([good, { ...good }, { ...good }, outlier], 0);
  assert.ok(Math.abs(cal.factor - 1.02) < 1e-9, `median=${cal.factor} — an outlier moved it`);
  assert.equal(cal.systems, 4);
});

test("thin evidence refuses to be confident", () => {
  const one = { kw: 6, yieldPerKwp: 1100, readings: year(6, 1100, 0.9) };
  assert.equal(calibrateYield([one], 0).confident, false, `one system is below MIN_SYSTEMS=${MIN_SYSTEMS}`);

  // three systems but one month each — three readings of the same sunny month
  const march = { kw: 6, yieldPerKwp: 1100, readings: year(6, 1100, 0.9).slice(2, 3) };
  const thin = calibrateYield([march, { ...march }, { ...march }], 0);
  assert.equal(thin.months, 3);
  assert.equal(thin.confident, false, `3 months is below MIN_MONTHS=${MIN_MONTHS}`);

  // four full years across four systems clears both bars
  const full = { kw: 6, yieldPerKwp: 1100, readings: year(6, 1100, 0.94) };
  const ok = calibrateYield([full, { ...full }, { ...full }, { ...full }], 0);
  assert.equal(ok.confident, true);
  assert.ok(Math.abs(ok.factor - 0.94) < 1e-9);
});

test("no data at all is a neutral, non-confident answer", () => {
  const cal = calibrateYield([]);
  assert.equal(cal.factor, 1);
  assert.equal(cal.systems, 0);
  assert.equal(cal.confident, false);
  assert.equal(applyCalibration(1100, cal), 1100, "an empty calibration must not move the yield");
});

test("applyCalibration only moves the yield on confident evidence", () => {
  const weak = { factor: 0.8, confident: false };
  assert.equal(applyCalibration(1100, weak), 1100, "must ignore a non-confident factor");
  const strong = { factor: 0.94, confident: true };
  assert.ok(Math.abs(applyCalibration(1100, strong) - 1034) < 0.5);
  assert.equal(applyCalibration(1100, null), 1100);
  assert.equal(applyCalibration(1100, { factor: 0, confident: true }), 1100);
});

test("an implausible factor is clamped — bad readings must not reach a client", () => {
  // a kWh/MWh mix-up reads as 1000× and would otherwise quote an absurd yield
  assert.equal(applyCalibration(1100, { factor: 1000, confident: true }), 1100 * 1.25);
  assert.equal(applyCalibration(1100, { factor: 0.01, confident: true }), 1100 * 0.75);
});
