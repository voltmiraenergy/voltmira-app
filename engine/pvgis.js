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
const CACHE_TTL_MS = 30 * 24 * 3600 * 1000;

export function cacheKey(lat, lon, { angle = 35, aspect = 0 } = {}) {
  return `pvgis:${lat.toFixed(2)}:${lon.toFixed(2)}:${angle}:${aspect}`;
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
