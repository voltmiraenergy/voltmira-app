/** Site and climate module tests, network fully mocked. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { getSiteClimate, summarizeHorizon, summarizeDaily } from "./siteClimate.js";

const horizonJson = (extra = {}) => ({
  inputs: { location: { latitude: 46, longitude: 28.5, elevation: 198.4 }, horizon_db: "DEM-calculated" },
  outputs: { horizon_profile: Array.from({ length: 48 }, (_, i) => { const A = -180 + i * 7.5; return { A, H_hor: A === 30 ? 6.2 : A === 150 ? 9.5 : 1.1, ...extra }; }) },
});

/** twenty years of days: a mild year with one hot day, one cold day, one windy day and one snowy stretch per year */
function dailyJson({ missing = false } = {}) {
  const T2M_MAX = {}, T2M_MIN = {}, WS10M_MAX = {}, SNODP = {};
  for (let y = 2001; y <= 2020; y++) {
    for (let d = 0; d < 365; d++) {
      const dt = new Date(Date.UTC(y, 0, 1 + d));
      const k = `${dt.getUTCFullYear()}${String(dt.getUTCMonth() + 1).padStart(2, "0")}${String(dt.getUTCDate()).padStart(2, "0")}`;
      if (k.slice(0, 4) !== String(y)) continue;
      T2M_MAX[k] = d === 200 ? (y === 2012 ? 41.2 : 36) : 20;
      T2M_MIN[k] = d === 20 ? (y === 2006 ? -24.6 : -5) : 8;
      WS10M_MAX[k] = d === 100 ? (y === 2009 ? 17.4 : 12) : 4;
      SNODP[k] = d >= 10 && d < 14 ? (y === 2010 ? 30 : 8) : 0;
      if (missing) { T2M_MAX[k] = -999; }
    }
  }
  return { properties: { parameter: { T2M_MAX, T2M_MIN, WS10M_MAX, SNODP } } };
}

const router = (map) => async (url) => {
  const hit = Object.entries(map).find(([k]) => url.includes(k));
  if (!hit || hit[1] === "fail") return { ok: false, status: 503, json: async () => ({}) };
  return { ok: true, status: 200, json: async () => hit[1] };
};

test("the horizon: elevation, the highest angle, and the highest in the southern sector, east to west", () => {
  const h = summarizeHorizon(horizonJson());
  assert.equal(h.elevationM, 198);
  assert.equal(h.horizonDb, "DEM-calculated");
  assert.equal(h.horizonMaxDeg, 9.5);
  assert.equal(h.horizonSouthMaxDeg, 6.2, "the 9.5 degree hill is in the north-west, outside the southern sector");
  assert.ok(h.horizon.length >= 24 && h.horizon.length <= 25, "east to west through south only");
  assert.equal(summarizeHorizon({ outputs: { horizon_profile: [] } }), null);
});

test("the daily series: extremes, hot days, frost days, strongest wind, deepest snow", () => {
  const d = summarizeDaily(dailyJson());
  assert.equal(d.period, "2001-2020"); assert.equal(d.years, 20);
  assert.equal(d.tMaxC, 41.2); assert.equal(d.tMinC, -24.6);
  assert.equal(d.hotDays, 1, "one day a year at or above 35 degrees");
  assert.equal(d.frostDays, 1);
  assert.equal(d.wind10MaxMs, 17.4);
  assert.ok(d.wind10AnnualMaxMs > 12 && d.wind10AnnualMaxMs < 12.5, `${d.wind10AnnualMaxMs}`);
  assert.equal(d.snowDepthMaxCm, 30);
  assert.ok(d.snowDepthAnnualMaxCm > 9 && d.snowDepthAnnualMaxCm < 9.2, `${d.snowDepthAnnualMaxCm}`);
});

test("a figure with too many days missing is left out, not guessed", () => {
  const d = summarizeDaily(dailyJson({ missing: true }));
  assert.equal(d.tMaxC, null); assert.equal(d.hotDays, null);
  assert.equal(d.tMinC, -24.6);
  assert.equal(summarizeDaily({ properties: { parameter: {} } }), null);
  assert.equal(summarizeDaily(null), null);
});

test("getSiteClimate joins the two services, and one failing leaves the other's facts", async () => {
  const both = await getSiteClimate(46, 28.5, { fetchImpl: router({ printhorizon: horizonJson(), "temporal/daily": dailyJson() }) });
  assert.equal(both.elevationM, 198); assert.equal(both.tMinC, -24.6); assert.equal(both.db, "NASA POWER (MERRA-2)");
  const onlyHorizon = await getSiteClimate(46, 28.5, { fetchImpl: router({ printhorizon: horizonJson(), "temporal/daily": "fail" }) });
  assert.equal(onlyHorizon.elevationM, 198); assert.equal(onlyHorizon.tMinC, null); assert.equal(onlyHorizon.db, "");
  const onlyDaily = await getSiteClimate(46, 28.5, { fetchImpl: router({ printhorizon: "fail", "temporal/daily": dailyJson() }) });
  assert.equal(onlyDaily.elevationM, null); assert.equal(onlyDaily.snowDepthMaxCm, 30);
  await assert.rejects(() => getSiteClimate(46, 28.5, { fetchImpl: router({ printhorizon: "fail", "temporal/daily": "fail" }) }), /Neither/);
  await assert.rejects(() => getSiteClimate(99, 28.5, {}), /coordinates/);
});

test("the request asks for the right place and the twenty years", async () => {
  const urls = [];
  const f = async (url) => { urls.push(url); return { ok: true, status: 200, json: async () => (url.includes("printhorizon") ? horizonJson() : dailyJson()) }; };
  await getSiteClimate(46.0123, 28.5, { fetchImpl: f });
  const daily = urls.find((u) => u.includes("temporal/daily"));
  assert.match(daily, /latitude=46\.0123/); assert.match(daily, /longitude=28\.5000/); assert.match(daily, /start=20010101&end=20201231/);
  assert.match(daily, /T2M_MAX,T2M_MIN,WS10M_MAX,SNODP/);
});
