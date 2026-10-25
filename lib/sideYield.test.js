import { test } from "node:test";
import assert from "node:assert/strict";
import { blendYields, sideSummaries, sideKey, fetchSideYield } from "./sideYield.js";

test("the building's yield is the sides' yields weighted by what each holds", () => {
  const b = blendYields([{ count: 10, yieldPerKwp: 1300 }, { count: 10, yieldPerKwp: 1100 }]);
  assert.equal(b.yieldOverride, 1200);
  assert.equal(b.used, 2);
  assert.equal(b.failed, 0);
  assert.equal(blendYields([{ count: 30, yieldPerKwp: 1300 }, { count: 10, yieldPerKwp: 900 }]).yieldOverride, 1200);
});

test("a side whose lookup failed is counted, not silently dropped; with none left there is no yield to use", () => {
  const b = blendYields([{ count: 10, yieldPerKwp: 1250 }, { count: 4, yieldPerKwp: null }, { count: 0, yieldPerKwp: null }]);
  assert.deepEqual([b.yieldOverride, b.used, b.failed], [1250, 1, 1]);
  assert.deepEqual(blendYields([{ count: 5, yieldPerKwp: null }]), { yieldOverride: null, monthlyYieldShape: null, used: 0, failed: 1 });
  assert.deepEqual(blendYields([]), { yieldOverride: null, monthlyYieldShape: null, used: 0, failed: 0 });
});

test("the months blend by each side's energy, and a side without months drops the shape rather than guess it", () => {
  const summer = [0, 0, 0, 0, 0, 0.5, 0.5, 0, 0, 0, 0, 0];
  const winter = [0.5, 0.5, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
  const b = blendYields([{ count: 3, yieldPerKwp: 1000, monthlyShape: summer }, { count: 1, yieldPerKwp: 1000, monthlyShape: winter }]);
  assert.ok(Math.abs(b.monthlyYieldShape[5] - 0.375) < 1e-9 && Math.abs(b.monthlyYieldShape[0] - 0.125) < 1e-9);
  assert.ok(Math.abs(b.monthlyYieldShape.reduce((a, c) => a + c, 0) - 1) < 1e-9);
  assert.equal(blendYields([{ count: 3, yieldPerKwp: 1000, monthlyShape: summer }, { count: 1, yieldPerKwp: 1000 }]).monthlyYieldShape, null);
});

test("each side reports its panels, kWp, yield and kWh", () => {
  const rows = sideSummaries([{ id: "a", count: 12, tiltDeg: 35.2, azimuthDeg: -9.6, yieldPerKwp: 1301.4 }, { id: "b", count: 0 }, { id: "c", count: 6, tiltDeg: 20, azimuthDeg: 90, yieldPerKwp: null }], 460);
  assert.deepEqual(rows, [
    { id: "a", tiltDeg: 35, azimuthDeg: -10, count: 12, kwp: 5.52, yieldPerKwp: 1301, kwh: 7182, tiltSource: "typed" },
    { id: "c", tiltDeg: 20, azimuthDeg: 90, count: 6, kwp: 2.76, yieldPerKwp: null, kwh: null, tiltSource: "typed" },
  ]);
});

test("a lookup is keyed by place, pitch and facing; a failed fetch answers null, never throws", async () => {
  assert.equal(sideKey({ lat: 47.01234, lon: 28.5, tiltDeg: 34.6, azimuthDeg: -0.4 }), "47.012,28.500|35|0");
  const ok = await fetchSideYield({ lat: 47, lon: 28, tiltDeg: 35, azimuthDeg: 0 }, async (url) => { assert.match(url, /angle=35&aspect=0/); return { json: async () => ({ yieldPerKwp: 1234, monthlyShape: new Array(12).fill(1 / 12) }) }; });
  assert.equal(ok.yieldPerKwp, 1234);
  assert.equal((await fetchSideYield({ lat: 47, lon: 28, tiltDeg: 35, azimuthDeg: 0 }, async () => { throw new Error("down"); })).yieldPerKwp, null);
  assert.equal((await fetchSideYield({ lat: 47, lon: 28, tiltDeg: 35, azimuthDeg: 0 }, async () => ({ json: async () => ({ error: "rate" }) }))).yieldPerKwp, null);
});
