/**
 * Site and climate facts for a plant, from two public services: PVGIS's
 * terrain model (elevation and the horizon seen from the site) and NASA POWER's
 * daily series (temperature extremes, strongest wind, snow cover), here the
 * twenty years 2001 to 2020. Both are reanalysis or terrain data on a grid, so
 * they are screening values for design loads, insurance and a climate-risk
 * screening, not design values: the design standard and the design report
 * govern. The wind figure is the strongest hourly mean at 10 m, not a gust.
 *
 *  - `fetchImpl` is injectable, so this is testable without the network.
 *  - Each service may fail on its own; the other's facts still come back.
 */

const PVGIS_HORIZON = "https://re.jrc.ec.europa.eu/api/v5_2/printhorizon";
const POWER_DAILY = "https://power.larc.nasa.gov/api/temporal/daily/point";
/** Daily maximum (deg C) a day counts as a hot day at. */
export const HOT_DAY_C = 35;

async function getJson(url, fetchImpl, timeoutMs) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetchImpl(url, { signal: ctrl.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

const r1 = (v) => Math.round(v * 10) / 10;

/**
 * The terrain model's answer as elevation and the horizon.
 * @returns {{ elevationM:number|null, horizonDb:string, horizon:number[], horizonMaxDeg:number, horizonSouthMaxDeg:number }|null}
 */
export function summarizeHorizon(json) {
  const prof = json?.outputs?.horizon_profile;
  if (!Array.isArray(prof) || prof.length < 8) return null;
  const pts = prof.map((p) => ({ a: Number(p?.A), h: Number(p?.H_hor) })).filter((p) => Number.isFinite(p.a) && Number.isFinite(p.h));
  if (pts.length < 8) return null;
  const elev = Number(json?.inputs?.location?.elevation);
  return {
    elevationM: Number.isFinite(elev) ? Math.round(elev) : null,
    horizonDb: String(json?.inputs?.horizon_db || "").slice(0, 40),
    // from east to west through south: PVGIS's azimuth 0 is south, -90 east, 90 west
    horizon: pts.filter((p) => p.a >= -90 && p.a <= 90).sort((x, y) => x.a - y.a).map((p) => r1(p.h)),
    horizonMaxDeg: r1(Math.max(...pts.map((p) => p.h))),
    // the sun's daily path crosses the southern sector: that is where a hill or a tree line costs energy
    horizonSouthMaxDeg: r1(Math.max(...pts.filter((p) => Math.abs(p.a) <= 60).map((p) => p.h), 0)),
  };
}

/**
 * NASA POWER's daily answer as the extremes and the days that matter.
 * A figure with under 90% of its days present is left out rather than guessed.
 * @returns {null | { period:string, years:number, tMaxC:number|null, tMinC:number|null, hotDays:number|null, frostDays:number|null,
 *   wind10MaxMs:number|null, wind10AnnualMaxMs:number|null, snowDepthMaxCm:number|null, snowDepthAnnualMaxCm:number|null }}
 */
export function summarizeDaily(json) {
  const p = json?.properties?.parameter;
  if (!p || typeof p !== "object") return null;
  // a series as [year, value] pairs, the fill value (-999) dropped
  const series = (name) => Object.entries(p[name] || {}).map(([k, v]) => [Number(String(k).slice(0, 4)), Number(v)]).filter(([y, v]) => Number.isInteger(y) && Number.isFinite(v) && v > -900);
  const tmax = series("T2M_MAX"), tmin = series("T2M_MIN"), ws = series("WS10M_MAX"), snow = series("SNODP");
  const years = [...new Set([...tmax, ...tmin, ...ws, ...snow].map(([y]) => y))].sort((a, b) => a - b);
  if (years.length < 5) return null;
  const nYears = years.length;
  const expected = Math.max(...["T2M_MAX", "T2M_MIN", "WS10M_MAX", "SNODP"].map((k) => Object.keys(p[k] || {}).length), 1);
  const enough = (s) => s.length >= 0.9 * expected;
  const perYear = (s, test) => s.filter(([, v]) => test(v)).length / nYears;
  const annualMaxMean = (s) => { const m = new Map(); for (const [y, v] of s) m.set(y, Math.max(m.get(y) ?? -Infinity, v)); return [...m.values()].reduce((a, b) => a + b, 0) / m.size; };
  return {
    period: `${years[0]}-${years[years.length - 1]}`, years: nYears,
    tMaxC: enough(tmax) ? r1(Math.max(...tmax.map(([, v]) => v))) : null,
    tMinC: enough(tmin) ? r1(Math.min(...tmin.map(([, v]) => v))) : null,
    hotDays: enough(tmax) ? r1(perYear(tmax, (v) => v >= HOT_DAY_C)) : null,
    frostDays: enough(tmin) ? r1(perYear(tmin, (v) => v < 0)) : null,
    wind10MaxMs: enough(ws) ? r1(Math.max(...ws.map(([, v]) => v))) : null,
    wind10AnnualMaxMs: enough(ws) ? r1(annualMaxMean(ws)) : null,
    snowDepthMaxCm: enough(snow) ? r1(Math.max(...snow.map(([, v]) => v))) : null,
    snowDepthAnnualMaxCm: enough(snow) ? r1(annualMaxMean(snow)) : null,
  };
}

/**
 * @param {number} lat @param {number} lon
 * @param {{ fetchImpl?: typeof fetch, timeoutMs?: number, startYear?: number, endYear?: number }} [opts]
 * @returns {Promise<{ elevationM:number|null, horizonDb:string, horizon:number[], horizonMaxDeg:number|null, horizonSouthMaxDeg:number|null,
 *   period:string, db:string, tMaxC:number|null, tMinC:number|null, hotDays:number|null, frostDays:number|null,
 *   wind10MaxMs:number|null, wind10AnnualMaxMs:number|null, snowDepthMaxCm:number|null, snowDepthAnnualMaxCm:number|null }>} throws when neither service answers
 */
export async function getSiteClimate(lat, lon, opts = {}) {
  const { fetchImpl = globalThis.fetch, timeoutMs = 20000, startYear = 2001, endYear = 2020 } = opts;
  if (typeof lat !== "number" || typeof lon !== "number" || lat < -90 || lat > 90 || lon < -180 || lon > 180) throw new Error("Invalid coordinates");
  const horizonUrl = `${PVGIS_HORIZON}?lat=${lat.toFixed(4)}&lon=${lon.toFixed(4)}&outputformat=json`;
  const dailyUrl = `${POWER_DAILY}?parameters=T2M_MAX,T2M_MIN,WS10M_MAX,SNODP&community=RE&longitude=${lon.toFixed(4)}&latitude=${lat.toFixed(4)}` +
    `&start=${startYear}0101&end=${endYear}1231&format=JSON`;
  const [h, d] = await Promise.all([
    getJson(horizonUrl, fetchImpl, timeoutMs).then(summarizeHorizon).catch(() => null),
    getJson(dailyUrl, fetchImpl, timeoutMs).then(summarizeDaily).catch(() => null),
  ]);
  if (!h && !d) throw new Error("Neither the terrain model nor the weather series answered");
  return {
    elevationM: h ? h.elevationM : null, horizonDb: h ? h.horizonDb : "", horizon: h ? h.horizon : [],
    horizonMaxDeg: h ? h.horizonMaxDeg : null, horizonSouthMaxDeg: h ? h.horizonSouthMaxDeg : null,
    period: d ? d.period : "", db: d ? "NASA POWER (MERRA-2)" : "",
    tMaxC: d ? d.tMaxC : null, tMinC: d ? d.tMinC : null, hotDays: d ? d.hotDays : null, frostDays: d ? d.frostDays : null,
    wind10MaxMs: d ? d.wind10MaxMs : null, wind10AnnualMaxMs: d ? d.wind10AnnualMaxMs : null,
    snowDepthMaxCm: d ? d.snowDepthMaxCm : null, snowDepthAnnualMaxCm: d ? d.snowDepthAnnualMaxCm : null,
  };
}
