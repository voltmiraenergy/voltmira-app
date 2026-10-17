import { test } from "node:test";
import assert from "node:assert/strict";
import { journeySteps, nextStep, productionSeries, firstName, localityOf } from "./clientJourney.js";

test("the client's steps follow the installer's records, the grid file first", () => {
  const s = journeySteps({ signedAt: "2026-08-01T10:00:00Z", progress: { deposit: "2026-08-03", install: "2026-09-10", gridFile: { stages: { applied: "2026-08-05", approval: "2026-08-20" } } } });
  assert.deepEqual(s.map((x) => [x.id, x.at]), [["signed", "2026-08-01"], ["deposit", "2026-08-03"], ["approval", "2026-08-20"], ["install", "2026-09-10"], ["connected", null], ["live", null]]);
  assert.equal(nextStep(s), "connected");
  assert.equal(nextStep(journeySteps({ signedAt: "x", progress: { deposit: 1, permit: 1, install: 1, grid: 1, commission: 1 } })), null);
});

test("each reading stands against the offer's own month", () => {
  const shape = [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1];
  const s = productionSeries([{ month: "2026-07-01", kwh: 700 }, { month: "2026-06-01", kwh: 600 }], 7200, shape);
  assert.deepEqual(s.rows.map((r) => [r.month, r.kwh, r.expected]), [["2026-06", 600, 600], ["2026-07", 700, 600]]);
  assert.equal(s.total, 1300);
  assert.ok(Math.abs(s.pct - (1300 / 1200) * 100) < 1e-9);
  assert.equal(productionSeries([{ month: "2026-07-01", kwh: 5 }], 0, shape).pct, null, "no offer figure, no percentage");
});

test("a recommendation shows only a first name and a locality", () => {
  assert.equal(firstName("  Ion  Rusu "), "Ion");
  assert.equal(localityOf("Str. Cartușa 45, Durlești, Chișinău"), "Chișinău");
  assert.equal(localityOf("str. Mare 3, s. Costești, MD-6801"), "s. Costești");
  assert.equal(localityOf("Bălți"), "Bălți");
});
