/**
 * PVGIS integration — real location-based solar yield from the EU Joint
 * Research Centre (free, no API key, EU-hosted).
 *
 * Docs: https://joint-research-centre.ec.europa.eu/photovoltaic-geographical-information-system-pvgis_en
 * Endpoint: https://re.jrc.ec.europa.eu/api/v5_2/PVcalc
 *
 * Design:
 *  - `fetchImpl` is injectable → unit-testable without network.
 *  - `cache` is injectable (get/set) → back it with Supabase, Redis, or memory.
 *    PVGIS data changes ~never for a location, so cache aggressively (30 days).
 *  - Coordinates are rounded to 2 decimals (~1.1 km) for cache hits without
 *    leaking precise client addresses into cache keys.
 */

const PVGIS_BASE = "https://re.jrc.ec.europa.eu/api/v5_2/PVcalc";
const PVGIS_SERIES_BASE = "https://re.jrc.ec.europa.eu/api/v5_2/seriescalc";
const CACHE_TTL_MS = 30 * 24 * 3600 * 1000;

export function cacheKey(lat, lon, { angle = 35, aspect = 0 } = {}) {
  return `pvgis:${lat.toFixed(2)}:${lon.toFixed(2)}:${angle}:${aspect}`;
}

export function hourlyCacheKey(lat, lon, { angle = 35, aspect = 0, year = 2019 } = {}) {
  return `pvgis-hourly:${lat.toFixed(2)}:${lon.toFixed(2)}:${angle}:${aspect}:${year}`;
}

/** Simple in-memory cache for dev/tests. Swap for Supabase table in prod. */
export function memoryCache() {
  const m = new Map();
  return {
    async get(k) {
      const hit = m.get(k);
      if (!hit) return null;
      if (Date.now() - hit.t > CACHE_TTL_MS) { m.delete(k); return null; }
      return hit.v;
    },
    async set(k, v) { m.set(k, { v, t: Date.now() }); },
  };
}

/**
 * Fetch yearly + monthly yield for 1 kWp at a location.
 * @returns {Promise<{yieldPerKwp:number, monthlyShape:number[], source:string}>}
 *  - yieldPerKwp: kWh per kWp per year (plug into engine as `yieldOverride`)
 *  - monthlyShape: 12 fractions summing ~12 (relative month weights,
 *    plug into engine as `monthlyYieldShape`)
 */
export async function getSolarYield(lat, lon, opts = {}) {
  const {
    angle = 35,           // panel tilt (deg)
    aspect = 0,           // azimuth: 0 = south
    loss = 14,            // system losses %
    fetchImpl = globalThis.fetch,
    cache = null,
    timeoutMs = 8000,
  } = opts;

  if (typeof lat !== "number" || typeof lon !== "number" ||
      lat < -90 || lat > 90 || lon < -180 || lon > 180) {
    throw new Error("Invalid coordinates");
  }

  const key = cacheKey(lat, lon, { angle, aspect });
  if (cache) {
    const hit = await cache.get(key);
    if (hit) return { ...hit, source: "cache" };
  }

  const url = `${PVGIS_BASE}?lat=${lat.toFixed(4)}&lon=${lon.toFixed(4)}` +
    `&peakpower=1&loss=${loss}&angle=${angle}&aspect=${aspect}&outputformat=json`;

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  let json;
  try {
    const res = await fetchImpl(url, { signal: ctrl.signal });
    if (!res.ok) throw new Error(`PVGIS HTTP ${res.status}`);
    json = await res.json();
  } finally {
    clearTimeout(timer);
  }

  const totals = json?.outputs?.totals?.fixed;
  const monthly = json?.outputs?.monthly?.fixed;
  if (!totals || typeof totals.E_y !== "number" || !Array.isArray(monthly) || monthly.length !== 12) {
    throw new Error("Unexpected PVGIS response shape");
  }

  const yieldPerKwp = totals.E_y; // kWh/kWp/yr for this exact spot, tilt, azimuth
  const mSum = monthly.reduce((a, m) => a + m.E_m, 0);
  // Normalize to weights that sum to 12 (same scale as SOLAR_SEASON)
  const monthlyShape = monthly.map(m => (m.E_m / mSum) * 12);

  const value = { yieldPerKwp, monthlyShape };
  if (cache) await cache.set(key, value);
  return { ...value, source: "pvgis" };
}

/**
 * Real hourly PV output shape from PVGIS's own seriescalc endpoint (the same
 * JRC service getSolarYield() already uses for the monthly/yearly numbers,
 * a different endpoint of it — real reanalysis-derived irradiance, not a
 * modeled/invented daily curve). Fetches one full year of hourly output for
 * a 1 kWp system (8760 real records) and reduces it to TWO representative
 * daily shapes — cold season (Oct-Mar) and warm season (Apr-Sep), matching
 * the same season split lib/residentialLoadProfile.js's real consumption
 * data uses, so the two sides of a peak-shaving simulation line up. Each
 * hour is the real average output at that hour-of-day across every day in
 * that season (night hours average to ~0, as they really do); each 24-value
 * array is then normalized to sum to 1 — the fraction of a representative
 * day's total output falling in that hour, same units
 * lib/residentialLoadProfile.js's hourlyLoadShape() returns. coldKwhPerKwpDay/
 * warmKwhPerKwpDay are that same season's real average kWh/kWp for the whole
 * representative day (pre-normalization), so a caller can scale the shape by
 * the project's own real system size without a second lookup.
 * @returns {Promise<{cold:number[], warm:number[], coldKwhPerKwpDay:number, warmKwhPerKwpDay:number, year:number, source:string}>}
 */
export async function getHourlySolarShape(lat, lon, opts = {}) {
  const {
    angle = 35, aspect = 0, loss = 14, year = 2019,
    fetchImpl = globalThis.fetch, cache = null, timeoutMs = 15000,
  } = opts;

  if (typeof lat !== "number" || typeof lon !== "number" ||
      lat < -90 || lat > 90 || lon < -180 || lon > 180) {
    throw new Error("Invalid coordinates");
  }

  const key = hourlyCacheKey(lat, lon, { angle, aspect, year });
  if (cache) {
    const hit = await cache.get(key);
    if (hit) return { ...hit, source: "cache" };
  }

  const url = `${PVGIS_SERIES_BASE}?lat=${lat.toFixed(4)}&lon=${lon.toFixed(4)}` +
    `&startyear=${year}&endyear=${year}&pvcalculation=1&peakpower=1&loss=${loss}` +
    `&angle=${angle}&aspect=${aspect}&outputformat=json`;

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  let json;
  try {
    const res = await fetchImpl(url, { signal: ctrl.signal });
    if (!res.ok) throw new Error(`PVGIS HTTP ${res.status}`);
    json = await res.json();
  } finally {
    clearTimeout(timer);
  }

  const hourly = json?.outputs?.hourly;
  if (!Array.isArray(hourly) || hourly.length < 8000) {
    throw new Error("Unexpected PVGIS seriescalc response shape");
  }

  // time is "YYYYMMDD:HHMM" — month at [4,6), hour at [9,11).
  const sums = { cold: Array(24).fill(0), warm: Array(24).fill(0) };
  const counts = { cold: Array(24).fill(0), warm: Array(24).fill(0) };
  for (const rec of hourly) {
    const t = rec?.time;
    if (typeof t !== "string" || t.length < 13) continue;
    const month = Number(t.slice(4, 6));
    const hour = Number(t.slice(9, 11));
    if (!(month >= 1 && month <= 12) || !(hour >= 0 && hour <= 23)) continue;
    const season = (month <= 3 || month >= 10) ? "cold" : "warm";
    sums[season][hour] += Number(rec.P) || 0;
    counts[season][hour]++;
  }

  // avgHourlyW: the real average W-at-that-hour across every day in the
  // season, for a 1 kWp system. Summing 24 of those (W, one per hour) is
  // that representative day's real total Wh/kWp, i.e. kWh/kWp/1000 — the
  // SAME hourly dataset the shape itself comes from, not a second estimate
  // pulled from the separate monthly PVcalc endpoint.
  const reduce = (season) => {
    const avgHourlyW = sums[season].map((s, h) => (counts[season][h] > 0 ? s / counts[season][h] : 0));
    const kwhPerKwpDay = avgHourlyW.reduce((a, b) => a + b, 0) / 1000;
    const shape = kwhPerKwpDay > 0 ? avgHourlyW.map((v) => v / (kwhPerKwpDay * 1000)) : avgHourlyW;
    return { shape, kwhPerKwpDay };
  };

  const coldR = reduce("cold"), warmR = reduce("warm");
  const value = { cold: coldR.shape, warm: warmR.shape, coldKwhPerKwpDay: coldR.kwhPerKwpDay, warmKwhPerKwpDay: warmR.kwhPerKwpDay, year };
  if (cache) await cache.set(key, value);
  return { ...value, source: "pvgis" };
}

/**
 * Geocode an address → coordinates using OpenStreetMap Nominatim (free).
 * Production note: respect the usage policy (1 req/s, set a User-Agent
 * identifying your app, cache results). For volume, switch to a paid
 * geocoder (Google/Mapbox) — the interface stays the same.
 */
export async function geocode(address, { fetchImpl = globalThis.fetch, email = "contact@voltmira.com" } = {}) {
  const url = "https://nominatim.openstreetmap.org/search?format=json&limit=1" +
    `&q=${encodeURIComponent(address)}&email=${encodeURIComponent(email)}`;
  const res = await fetchImpl(url, { headers: { "User-Agent": "VoltMira/1.0 (" + email + ")" } });
  if (!res.ok) throw new Error(`Geocoder HTTP ${res.status}`);
  const arr = await res.json();
  if (!Array.isArray(arr) || !arr.length) return null;
  return { lat: parseFloat(arr[0].lat), lon: parseFloat(arr[0].lon), display: arr[0].display_name };
}
