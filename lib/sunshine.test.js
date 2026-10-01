import { test } from "node:test";
import assert from "node:assert/strict";
import { monthlyTotals, sunFactors, getSunFactors } from "./sunshine.js";

// A fake POWER year: every day of every month at `perDay`, with one month overridden.
function days(year, perDay, over = {}) {
  const out = {};
  for (let m = 0; m < 12; m++) {
    const n = new Date(Date.UTC(year, m + 1, 0)).getUTCDate();
    for (let d = 1; d <= n; d++) {
      const k = `${year}${String(m + 1).padStart(2, "0")}${String(d).padStart(2, "0")}`;
      out[k] = over[m] ?? perDay;
    }
  }
  return out;
}
const history = (upTo, perDay = 4) => Object.assign({}, ...Array.from({ length: 10 }, (_, i) => days(upTo - 10 + i, perDay)));

test("a cloudier July than usual gets a factor below one; a normal month gets one", () => {
  const daily = { ...history(2026), ...days(2026, 4, { 6: 3 }) };
  const f = sunFactors(monthlyTotals(daily), 2026);
  assert.equal(f[6], 0.75);
  assert.equal(f[0], 1);
});

test("a month still missing days (the fill value -999) is not judged yet", () => {
  const cur = days(2026, 4);
  cur["20260930"] = -999;
  const f = sunFactors(monthlyTotals({ ...history(2026), ...cur }), 2026);
  assert.equal(f[8], null);
  assert.equal(f[7], 1);
});

test("too little history, or a wild value, is handled rather than trusted", () => {
  const thin = { ...days(2024, 4), ...days(2025, 4), ...days(2026, 4) };
  assert.equal(sunFactors(monthlyTotals(thin), 2026)[5], null);
  const wild = { ...history(2026), ...days(2026, 4, { 3: 40 }) };
  assert.equal(sunFactors(monthlyTotals(wild), 2026)[3], 1.6);
});

test("fetched once, then served from the cache until a new month completes", async () => {
  let calls = 0;
  const store = new Map();
  const cache = { get: async (k) => store.get(k), set: async (k, v) => { store.set(k, v); } };
  const fetchImpl = async (url) => {
    calls++;
    assert.match(url, /ALLSKY_SFC_SW_DWN/);
    assert.match(url, /start=20160101/);
    return { ok: true, json: async () => ({ properties: { parameter: { ALLSKY_SFC_SW_DWN: { ...history(2026), ...days(2026, 4) } } } }) };
  };
  const today = new Date("2026-09-27T10:00:00Z");
  const a = await getSunFactors({ lat: 47.01, lon: 28.86, year: 2026, today, fetchImpl, cache });
  const b = await getSunFactors({ lat: 47.012, lon: 28.861, year: 2026, today, fetchImpl, cache });
  assert.equal(calls, 1);
  assert.deepEqual(a, b);
  assert.deepEqual(await getSunFactors({ lat: NaN, lon: 1, year: 2026 }), Array(12).fill(null));
});
