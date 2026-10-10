/**
 * Buy-back price tests. Reference values are computed BY HAND in the comments
 * from the published table, not by running the module — so a regression cannot
 * quietly rewrite its own expectations.
 *
 * Run: node --test lib/prosumerPrice.test.js
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  PROSUMER_BUYBACK_MDL, latestSeasonalMdl, flatAverageMdl,
  weightedExportPriceMdl, weightedExportPriceEur, exportRevenue,
  storageSpreadMdl, annualAverages,
} from "./prosumerPrice.js";

// The engine's monthly production shape, repeated here so the test doesn't
// depend on the engine — if either moves, the numbers below must be re-derived.
const SEASON = [0.30, 0.40, 0.60, 0.80, 1.00, 1.10, 1.10, 1.00, 0.80, 0.60, 0.40, 0.25];

test("latest seasonal curve takes the freshest published month, not the newest year", () => {
  const c = latestSeasonalMdl();
  // 2026 publishes Jan–Jul, so those come from 2026 and Aug–Dec fall back to 2025.
  assert.deepEqual(c.slice(0, 7), PROSUMER_BUYBACK_MDL[2026].slice(0, 7));
  assert.deepEqual(c.slice(7), PROSUMER_BUYBACK_MDL[2025].slice(7));
  assert.equal(c.filter((v) => v == null).length, 0, "every month must resolve");
});

test("weighted price differs from the flat average, and is lower here", () => {
  // Curve: 3.06 2.74 2.63 2.30 2.39 2.72 2.58 2.23 2.13 2.65 2.72 2.66
  // Flat  = 30.81 / 12 = 2.5675
  // Σ(w·p) = .30*3.06 + .40*2.74 + .60*2.63 + .80*2.30 + 1.00*2.39 + 1.10*2.72
  //        + 1.10*2.58 + 1.00*2.23 + .80*2.13 + .60*2.65 + .40*2.72 + .25*2.66
  //        = 20.929 ; Σw = 8.35 → 2.50646…
  assert.ok(Math.abs(flatAverageMdl() - 2.5675) < 0.0005, `flat=${flatAverageMdl()}`);
  const w = weightedExportPriceMdl(SEASON);
  assert.ok(Math.abs(w - 2.50646) < 0.0005, `weighted=${w}`);
  // The direction is the whole point: the price bottoms out in the months that
  // carry most of the export, so the honest figure is BELOW the calendar mean.
  assert.ok(w < flatAverageMdl(), "weighted must sit under the flat average");
});

test("weighted price in EUR divides by the given rate", () => {
  // 2.50646 / 19.8 = 0.126589…
  assert.ok(Math.abs(weightedExportPriceEur(SEASON, 19.8) - 0.126589) < 0.00005);
  // A zero or missing rate must not produce Infinity in a proposal.
  assert.ok(Number.isFinite(weightedExportPriceEur(SEASON, 0)));
  assert.ok(Number.isFinite(weightedExportPriceEur(SEASON)));
});

test("weights that are empty, zero or junk fall back to the flat average", () => {
  for (const bad of [undefined, null, [], new Array(12).fill(0), "nope", [NaN, NaN]]) {
    assert.equal(weightedExportPriceMdl(bad), flatAverageMdl(), `weights=${String(bad)}`);
  }
});

test("export revenue prices each month at its own price", () => {
  // 100 kWh in January (3.06) + 100 kWh in April (2.30) = 306 + 230 = 536 lei
  // effective = 536 / 200 = 2.68 lei/kWh — neither month's price on its own.
  const m = new Array(12).fill(0); m[0] = 100; m[3] = 100;
  const r = exportRevenue(m, 19.8);
  assert.ok(Math.abs(r.mdl - 536) < 0.001, `mdl=${r.mdl}`);
  assert.equal(r.totalKwh, 200);
  assert.ok(Math.abs(r.effectiveMdlPerKwh - 2.68) < 0.001, `eff=${r.effectiveMdlPerKwh}`);
  assert.ok(Math.abs(r.eur - 536 / 19.8) < 0.001);
});

test("export revenue clamps negatives and survives a missing array", () => {
  const r = exportRevenue([-500, null, undefined, "x"], 19.8);
  assert.equal(r.mdl, 0);
  assert.equal(r.totalKwh, 0);
  assert.equal(r.effectiveMdlPerKwh, 0, "no division by zero");
  assert.equal(exportRevenue(undefined).mdl, 0);
});

test("storage spread is retail minus buy-back, not the retail tariff", () => {
  // retail 3.663 lei (€0.185 × 19.8) − 2.50646 weighted = 1.15653 lei
  // share = 1.15653 / 3.663 = 31.573%
  const s = storageSpreadMdl(0.185 * 19.8, SEASON);
  assert.ok(Math.abs(s.spreadMdl - 1.15653) < 0.0005, `spread=${s.spreadMdl}`);
  assert.ok(Math.abs(s.sharePct - 31.573) < 0.01, `share=${s.sharePct}`);
  assert.ok(s.spreadMdl < s.retailMdl, "a battery cannot earn the whole tariff");
  // A junk retail price must not invent a spread.
  assert.equal(storageSpreadMdl(null, SEASON).retailMdl, 0);
  assert.equal(storageSpreadMdl(-5, SEASON).sharePct, 0);
});

test("year-over-year compares only the months both years published", () => {
  const rows = annualAverages();
  assert.deepEqual(rows.map((r) => r.year), [2024, 2025, 2026], "oldest first");
  assert.equal(rows[0].yoyPct, undefined, "the first year has nothing to compare to");
  // 2024 avg = 17.46/12 = 1.455 ; 2025 avg = 27.57/12 = 2.2975
  assert.ok(Math.abs(rows[0].avg - 1.455) < 0.0005, `2024=${rows[0].avg}`);
  assert.ok(Math.abs(rows[1].avg - 2.2975) < 0.0005, `2025=${rows[1].avg}`);
  // 2026 publishes 7 months: (3.06+2.74+2.63+2.30+2.39+2.72+2.58)/7 = 18.42/7 = 2.6314…
  assert.equal(rows[2].months, 7);
  assert.ok(Math.abs(rows[2].avg - 2.63143) < 0.0005, `2026=${rows[2].avg}`);
  // Like-for-like: Jan–Jul 2025 = 15.18/7 = 2.16857 vs 2.63143 → +21.34%
  assert.equal(rows[2].yoyMonths, 7, "only the 7 common months");
  assert.ok(Math.abs(rows[2].yoyPct - 21.343) < 0.01, `yoy=${rows[2].yoyPct}`);
});

test("the published table itself stays well-formed", () => {
  for (const [year, months] of Object.entries(PROSUMER_BUYBACK_MDL)) {
    assert.equal(months.length, 12, `${year} must have 12 slots`);
    for (const v of months) {
      assert.ok(v === null || (typeof v === "number" && v > 0 && v < 20), `${year}: ${v} out of range`);
    }
    // Once a year stops publishing it must not resume mid-array — a hole would
    // silently shift a month's price onto the wrong month.
    const firstNull = months.indexOf(null);
    if (firstNull !== -1) assert.ok(months.slice(firstNull).every((v) => v === null), `${year} has a gap`);
  }
});
