/**
 * PVGIS module tests — network fully mocked.
 * Run: node --test engine/
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { getSolarYield, cacheKey, memoryCache, getHourlySolarShape, hourlyCacheKey } from "./pvgis.js";
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

/** A full synthetic 8760-record seriescalc year: `pAt(month, hour)` decides
 *  each record's power, so a test can bake in whatever pattern it needs
 *  while still satisfying getHourlySolarShape()'s real-shape length guard. */
function seriesResponse(pAt) {
  const hourly = [];
  const daysInMonth = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  for (let month = 1; month <= 12; month++) {
    for (let day = 1; day <= daysInMonth[month - 1]; day++) {
      for (let hour = 0; hour < 24; hour++) {
        const mm = String(month).padStart(2, "0"), dd = String(day).padStart(2, "0"), hh = String(hour).padStart(2, "0");
        hourly.push({ time: `2019${mm}${dd}:${hh}10`, P: pAt(month, hour) });
      }
    }
  }
  return { outputs: { hourly } };
}

test("getHourlySolarShape reduces a real-shaped year into two 24h arrays that each sum to 1", async () => {
  // Noon-only output, every day of every month alike: both seasons should
  // reduce to "all output at hour 12", trivially checkable by hand.
  const payload = seriesResponse((month, hour) => (hour === 12 ? 100 : 0));
  const r = await getHourlySolarShape(44.43, 26.10, { fetchImpl: mockFetch(payload) });
  assert.equal(r.cold.length, 24);
  assert.equal(r.warm.length, 24);
  assert.ok(Math.abs(r.cold.reduce((a, b) => a + b, 0) - 1) < 1e-9);
  assert.ok(Math.abs(r.warm.reduce((a, b) => a + b, 0) - 1) < 1e-9);
  assert.equal(r.cold[12], 1);
  assert.equal(r.warm[12], 1);
  assert.equal(r.cold[0], 0);
  assert.equal(r.source, "pvgis");
});

test("getHourlySolarShape reports the real kWh/kWp/day each season's shape was normalized from", async () => {
  // 4 W for 1 hour every single day of the year = 4 Wh = 0.004 kWh/kWp/day, in both seasons alike.
  const payload = seriesResponse((month, hour) => (hour === 12 ? 4 : 0));
  const r = await getHourlySolarShape(44.43, 26.10, { fetchImpl: mockFetch(payload) });
  assert.ok(Math.abs(r.coldKwhPerKwpDay - 0.004) < 1e-9, r.coldKwhPerKwpDay);
  assert.ok(Math.abs(r.warmKwhPerKwpDay - 0.004) < 1e-9, r.warmKwhPerKwpDay);
});

test("getHourlySolarShape splits cold (Oct-Mar) from warm (Apr-Sep) correctly", () => {
  return (async () => {
    // Output only in July (month 7, a warm month) — the cold array must come
    // back all-zero (no data that season), the warm array must carry it all.
    const payload = seriesResponse((month, hour) => (month === 7 && hour === 12 ? 500 : 0));
    const r = await getHourlySolarShape(44.43, 26.10, { fetchImpl: mockFetch(payload) });
    assert.equal(r.cold.reduce((a, b) => a + b, 0), 0);
    assert.ok(Math.abs(r.warm.reduce((a, b) => a + b, 0) - 1) < 1e-9);
    assert.equal(r.warm[12], 1);
  })();
});

test("getHourlySolarShape caches by coordinates/angle/aspect/year", async () => {
  const urls = [];
  const cache = memoryCache();
  const payload = seriesResponse((month, hour) => (hour === 12 ? 1 : 0));
  const opts = { fetchImpl: mockFetch(payload, { capture: urls }), cache };
  const a = await getHourlySolarShape(44.43, 26.10, opts);
  const b = await getHourlySolarShape(44.43, 26.10, opts);
  assert.equal(urls.length, 1, "fetch called once");
  assert.equal(a.cold[12], b.cold[12]);
  assert.equal(b.source, "cache");
});

test("getHourlySolarShape request URL carries seriescalc params", async () => {
  const urls = [];
  const payload = seriesResponse(() => 0);
  await getHourlySolarShape(47.01, 28.86, { year: 2019, fetchImpl: mockFetch(payload, { capture: urls }) });
  const u = urls[0];
  assert.ok(u.includes("seriescalc"));
  assert.ok(u.includes("lat=47.0100") && u.includes("lon=28.8600"));
  assert.ok(u.includes("startyear=2019") && u.includes("endyear=2019"));
  assert.ok(u.includes("pvcalculation=1"));
});

test("getHourlySolarShape rejects invalid coordinates and malformed/short responses", async () => {
  await assert.rejects(() => getHourlySolarShape(999, 0, { fetchImpl: mockFetch(seriesResponse(() => 0)) }));
  await assert.rejects(() => getHourlySolarShape(44, 26, { fetchImpl: mockFetch({ outputs: { hourly: [{ time: "20190101:0010", P: 0 }] } }) }), /shape/);
  await assert.rejects(() => getHourlySolarShape(44, 26, { fetchImpl: mockFetch({}, { status: 500 }) }), /HTTP 500/);
});

test("hourlyCacheKey rounds coordinates and includes the requested year", () => {
  assert.equal(hourlyCacheKey(44.4321, 26.1049, { year: 2019 }), hourlyCacheKey(44.4299, 26.0951, { year: 2019 }));
  assert.notEqual(hourlyCacheKey(44.43, 26.10, { year: 2019 }), hourlyCacheKey(44.43, 26.10, { year: 2020 }));
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
