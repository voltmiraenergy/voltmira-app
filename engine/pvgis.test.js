/**
 * PVGIS module tests — network fully mocked.
 * Run: node --test engine/
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { getSolarYield, cacheKey, memoryCache } from "./pvgis.js";
import { simulate, defaultEngineSettings } from "./engine.js";

/** Realistic PVGIS v5.2 response shape (values ≈ Bucharest, south-facing 35°). */
function pvgisResponse(E_y = 1287) {
  const months = [55, 72, 105, 123, 141, 143, 149, 142, 116, 92, 58, 48]; // ≈1244; scaled below
  const scale = E_y / months.reduce((a, b) => a + b, 0);
  return {
    outputs: {
      totals: { fixed: { E_y } },
      monthly: { fixed: months.map((m, i) => ({ month: i + 1, E_m: m * scale })) },
    },
  };
}

function mockFetch(payload, { status = 200, capture } = {}) {
  return async (url) => {
    if (capture) capture.push(url);
    return {
      ok: status >= 200 && status < 300,
      status,
      json: async () => payload,
    };
  };
}

test("parses yearly yield and normalizes monthly shape to sum 12", async () => {
  const r = await getSolarYield(44.43, 26.10, { fetchImpl: mockFetch(pvgisResponse(1287)) });
  assert.equal(r.yieldPerKwp, 1287);
  assert.equal(r.monthlyShape.length, 12);
  const sum = r.monthlyShape.reduce((a, b) => a + b, 0);
  assert.ok(Math.abs(sum - 12) < 1e-9, `shape sums to ${sum}`);
  assert.equal(r.source, "pvgis");
  // Summer months must outweigh winter
  assert.ok(r.monthlyShape[6] > r.monthlyShape[0] * 2);
});

test("request URL carries coordinates, tilt, azimuth, json format", async () => {
  const urls = [];
  await getSolarYield(47.01, 28.86, {
    angle: 30, aspect: -10,
    fetchImpl: mockFetch(pvgisResponse(), { capture: urls }),
  });
  const u = urls[0];
  assert.ok(u.includes("lat=47.0100") && u.includes("lon=28.8600"));
  assert.ok(u.includes("angle=30") && u.includes("aspect=-10"));
  assert.ok(u.includes("outputformat=json") && u.includes("peakpower=1"));
});

test("cache: second call is served from cache without hitting fetch", async () => {
  const urls = [];
  const cache = memoryCache();
  const opts = { fetchImpl: mockFetch(pvgisResponse(1300), { capture: urls }), cache };
  const a = await getSolarYield(44.43, 26.10, opts);
  const b = await getSolarYield(44.43, 26.10, opts);
  assert.equal(urls.length, 1, "fetch called once");
  assert.equal(a.yieldPerKwp, b.yieldPerKwp);
  assert.equal(b.source, "cache");
});

test("cache key rounds coordinates to ~1km so nearby addresses share entries", () => {
  assert.equal(cacheKey(44.4321, 26.1049), cacheKey(44.4299, 26.0951));
});

test("rejects invalid coordinates", async () => {
  await assert.rejects(() => getSolarYield(999, 0, { fetchImpl: mockFetch(pvgisResponse()) }));
});

test("throws on non-200 and on malformed body", async () => {
  await assert.rejects(() => getSolarYield(44, 26, { fetchImpl: mockFetch({}, { status: 500 }) }), /HTTP 500/);
  await assert.rejects(() => getSolarYield(44, 26, { fetchImpl: mockFetch({ nope: 1 }) }), /shape/);
});

test("end-to-end: PVGIS yield flows into the engine as yieldOverride", async () => {
  const { yieldPerKwp, monthlyShape } = await getSolarYield(44.43, 26.10, { fetchImpl: mockFetch(pvgisResponse(1287)) });
  const E = defaultEngineSettings();
  const r = simulate({
    kw: 6, price: 0.21, cons: 5000, market: "RO",
    batt: false, wind: false, useMonthly: false, afmSubsidy: false,
    yieldOverride: yieldPerKwp, monthlyYieldShape: monthlyShape,
  }, E, "expc");
  assert.equal(r.prod0, 6 * 1287); // real Bucharest yield, not the 1100 default
  assert.ok(r.payback > 4 && r.payback < 6);
});
