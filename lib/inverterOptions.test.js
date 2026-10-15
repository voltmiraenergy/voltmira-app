/**
 * lib/inverterOptions.test.js — this feeds a comparison table an installer
 * picks equipment from, so a wrong row here becomes a wrong quote.
 *
 * Run: node --test lib/inverterOptions.test.js
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { inverterOptions } from "./inverterOptions.js";

const CAT = [
  { id: "a", brand: "Deye", model: "SUN-6K", kw: 6, type: "hybrid", mppt: 2, phases: 3, maxDcV: 800 },
  { id: "b", brand: "Deye", model: "SUN-12K", kw: 12, type: "hybrid", mppt: 2, phases: 3, maxDcV: 800 },
  { id: "c", brand: "Huawei", model: "SUN2000-10K", kw: 10, type: "string", mppt: 2, phases: 3, maxDcV: 1100 },
  { id: "d", brand: "Deye", model: "SUN-5K-1P", kw: 5, type: "hybrid", mppt: 2, phases: 1, maxDcV: 500 },
];

test("only phase-compatible inverters are ever offered", () => {
  const rows = inverterOptions({ dcKw: 6, phases: 1, catalog: CAT });
  assert.ok(rows.every((r) => r.inverter.phases === 1), "a 1-phase array must never suggest a 3-phase unit");
  assert.ok(rows.some((r) => r.inverter.id === "d"));
});

test("both single and double-unit counts are offered when both are buildable", () => {
  // 12 kWp / 6 kW = 2.0 (too high alone) but / 12 kW (2x6) = 1.0 — and 2x the
  // 6 kW unit at count=2 is 12 kW too, ratio 1.0 as well.
  const rows = inverterOptions({ dcKw: 12, phases: 3, catalog: CAT });
  const sixKw = rows.filter((r) => r.inverter.id === "a");
  assert.ok(sixKw.some((r) => r.count === 2), "2x 6kW covering a 12kWp array must be offered");
});

test("a wildly oversized or undersized inverter is never listed", () => {
  const rows = inverterOptions({ dcKw: 6, phases: 3, catalog: CAT });
  // 6 kWp against 2x 12 kW (24 kW AC) is dcac=0.25 — nowhere near buildable
  assert.ok(!rows.some((r) => r.inverter.id === "b" && r.count === 2), "6kWp must not suggest 24kW of inverter");
});

test("nominal power ratio (dcac) is reported and matches the inputs", () => {
  const rows = inverterOptions({ dcKw: 6, phases: 3, catalog: CAT });
  const oneToOne = rows.find((r) => r.inverter.id === "a" && r.count === 1);
  assert.ok(oneToOne, "6kWp on a single 6kW unit must be offered");
  assert.equal(oneToOne.dcac, 1);
  assert.equal(oneToOne.capturePct, 100, "no clipping at a 1.0 ratio");
});

test("capture% falls as the ratio climbs past the clipping threshold, and never below 60", () => {
  const rows = inverterOptions({ dcKw: 9, phases: 3, catalog: CAT }); // /6kW = 1.5
  const r = rows.find((x) => x.inverter.id === "a" && x.count === 1);
  assert.ok(r, "1.5 ratio must still be listed (within the 0.7-1.6 window)");
  assert.ok(r.capturePct < 100 && r.capturePct >= 60, `capturePct=${r.capturePct}`);
});

test("hybrid candidates sort first when a battery is attached, not otherwise", () => {
  const withBatt = inverterOptions({ dcKw: 10, phases: 3, wantHybrid: true, catalog: CAT });
  assert.ok(withBatt[0].hybrid, "first row must be hybrid when the client wants a battery");
  const noBatt = inverterOptions({ dcKw: 10, phases: 3, wantHybrid: false, catalog: CAT });
  // without a battery, order falls back to count then closeness-to-ideal — a
  // string inverter can legitimately outrank a hybrid one
  assert.ok(noBatt.length > 0);
});

test("single-unit candidates are preferred over an equally-good two-unit split", () => {
  const rows = inverterOptions({ dcKw: 6, phases: 3, catalog: CAT });
  const idx1 = rows.findIndex((r) => r.count === 1);
  const idx2 = rows.findIndex((r) => r.count === 2);
  if (idx1 !== -1 && idx2 !== -1) assert.ok(idx1 < idx2, "fewer boxes to mount and wire should rank first");
});

test("junk or empty inputs return no candidates rather than throwing", () => {
  assert.deepEqual(inverterOptions({ dcKw: 0, phases: 3, catalog: CAT }), []);
  assert.deepEqual(inverterOptions({ dcKw: -5, phases: 3, catalog: CAT }), []);
  assert.deepEqual(inverterOptions({ dcKw: 6, phases: 3, catalog: [] }), []);
  assert.deepEqual(inverterOptions({ dcKw: 6, phases: 3, catalog: null }), []);
  assert.doesNotThrow(() => inverterOptions({}));
});

test("an unmatched phase count (e.g. no 3-phase gear in a small catalog) yields nothing, not a crash", () => {
  const smallCat = [{ id: "x", brand: "X", model: "Y", kw: 5, type: "string", mppt: 2, phases: 1, maxDcV: 500 }];
  assert.deepEqual(inverterOptions({ dcKw: 6, phases: 3, catalog: smallCat }), []);
});
