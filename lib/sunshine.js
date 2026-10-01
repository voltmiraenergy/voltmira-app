// lib/sunshine.js — how sunny each month actually was at a site, compared
// with the same month in the ten years before it. Fleet health multiplies the
// quote's expected month by this factor (lib/fleetHealth.js), so a cloudy
// July is measured against what that July's sky could deliver instead of
// being flagged as a fault.
//
// Source: NASA POWER daily "All Sky Surface Shortwave Downward Irradiance"
// (ALLSKY_SFC_SW_DWN, kWh/m²/day), https://power.larc.nasa.gov. Free, no key,
// and open for commercial use, which the free tier of Open-Meteo is not. The
// last few days arrive with a delay, marked with the fill value -999: a month
// only counts once every one of its days is in.

const API = "https://power.larc.nasa.gov/api/temporal/daily/point";
export const REF_YEARS = 10;
const MIN_REF_YEARS = 5;
const CLAMP = [0.4, 1.6];

const pad = (n) => String(n).padStart(2, "0");
const daysIn = (y, m) => new Date(Date.UTC(y, m + 1, 0)).getUTCDate(); // m 0-based

/** Monthly totals from POWER's { "YYYYMMDD": kWh/m² } map. */
export function monthlyTotals(daily) {
  const out = new Map();
  for (const [k, v] of Object.entries(daily || {})) {
    if (!/^\d{8}$/.test(k)) continue;
    const key = `${k.slice(0, 4)}-${k.slice(4, 6)}`;
    const cur = out.get(key) || { sum: 0, days: 0 };
    if (Number.isFinite(v) && v >= 0) { cur.sum += v; cur.days += 1; }
    out.set(key, cur);
  }
  for (const [key, cur] of out) {
    const [y, m] = key.split("-").map(Number);
    cur.complete = cur.days === daysIn(y, m - 1);
  }
  return out;
}

/**
 * Twelve factors for `year` (null where the month isn't complete yet or has
 * too little history): that month's irradiance over the average of the same
 * month in the REF_YEARS years before it.
 */
export function sunFactors(totals, year) {
  return Array.from({ length: 12 }, (_, m) => {
    const now = totals.get(`${year}-${pad(m + 1)}`);
    if (!now?.complete || now.sum <= 0) return null;
    const ref = [];
    for (let y = year - REF_YEARS; y < year; y++) {
      const r = totals.get(`${y}-${pad(m + 1)}`);
      if (r?.complete && r.sum > 0) ref.push(r.sum);
    }
    if (ref.length < MIN_REF_YEARS) return null;
    const avg = ref.reduce((a, b) => a + b, 0) / ref.length;
    const f = now.sum / avg;
    return Math.round(Math.min(CLAMP[1], Math.max(CLAMP[0], f)) * 1000) / 1000;
  });
}

/**
 * Fetch and compute, with a cache that turns over when a new month completes.
 * @param {{ lat: number, lon: number, year: number, today?: Date,
 *           fetchImpl?: typeof fetch, cache?: { get(k): Promise<any>, set(k, v): Promise<void> } }} a
 * @returns {Promise<(number|null)[]>}
 */
export async function getSunFactors({ lat, lon, year, today = new Date(), fetchImpl = fetch, cache = null }) {
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) return Array(12).fill(null);
  const la = lat.toFixed(2), lo = lon.toFixed(2);
  const last = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 0)); // end of last month
  const key = `sun:v1:${la}:${lo}:${year}:${last.toISOString().slice(0, 7)}`;
  if (cache) {
    try { const hit = await cache.get(key); if (Array.isArray(hit) && hit.length === 12) return hit; } catch { /* cache is optional */ }
  }
  const end = new Date(Math.min(Date.UTC(year, 11, 31), today.getTime()));
  const url = `${API}?parameters=ALLSKY_SFC_SW_DWN&community=RE&latitude=${la}&longitude=${lo}`
    + `&start=${year - REF_YEARS}0101&end=${end.getUTCFullYear()}${pad(end.getUTCMonth() + 1)}${pad(end.getUTCDate())}&format=JSON`;
  const res = await fetchImpl(url, { signal: AbortSignal.timeout(25_000) });
  if (!res.ok) throw new Error(`power_${res.status}`);
  const json = await res.json();
  const daily = json?.properties?.parameter?.ALLSKY_SFC_SW_DWN;
  if (!daily) throw new Error("power_shape");
  const factors = sunFactors(monthlyTotals(daily), year);
  if (cache) { try { await cache.set(key, factors); } catch { /* ignore */ } }
  return factors;
}
