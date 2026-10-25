import { test } from "node:test";
import assert from "node:assert/strict";
import { cleanSides, roofStatusOf } from "./roofSides.js";

const sides = [
  { id: "a", tiltDeg: 35.2, azimuthDeg: -9.6, count: 12, kwp: 5.52, yieldPerKwp: 1301.4, kwh: 7182, tiltSource: "measured" },
  { id: "b", tiltDeg: 20, azimuthDeg: 90, count: 8, kwp: 3.68, yieldPerKwp: null, kwh: null, tiltSource: "estimated" },
];

test("the sides printed on an offer are only those that add up to the panels sold", () => {
  const ok = cleanSides(sides, 20);
  assert.equal(ok.length, 2);
  assert.deepEqual(ok[0], { tiltDeg: 35, azimuthDeg: -10, count: 12, kwp: 5.52, yieldPerKwp: 1301, kwh: 7182, tiltEstimated: false });
  assert.equal(ok[1].tiltEstimated, true);
  assert.equal(ok[1].kwh, null);
  assert.equal(cleanSides(sides, 24), undefined, "the kW was changed by hand since: the list is stale and is left off");
  assert.equal(cleanSides([], 20), undefined);
  assert.equal(cleanSides(null, 20), undefined);
});

test("only the fields printed come through, and nothing odd breaks it", () => {
  const r = cleanSides([{ count: 4, tiltDeg: "x", secret: "no", kwp: -3 }], 4);
  assert.deepEqual(Object.keys(r[0]).sort(), ["azimuthDeg", "count", "kwh", "kwp", "tiltDeg", "tiltEstimated", "yieldPerKwp"]);
  assert.equal(r[0].kwp, 0);
});

test("the mark says satellite until the roof is verified on site, with the day", () => {
  assert.equal(roofStatusOf(null), undefined);
  assert.equal(roofStatusOf({ planes: [] }), undefined);
  assert.deepEqual(roofStatusOf({ planes: [{}] }), { kind: "satellite", at: null });
  assert.deepEqual(roofStatusOf({ planes: [{}], status: "verified", verifiedAt: "2026-10-22" }), { kind: "verified", at: "2026-10-22" });
  assert.deepEqual(roofStatusOf({ planes: [{}], status: "verified", verifiedAt: "soon" }), { kind: "verified", at: null });
  assert.deepEqual(roofStatusOf({ planes: [{}], status: "nonsense" }), { kind: "satellite", at: null });
});
