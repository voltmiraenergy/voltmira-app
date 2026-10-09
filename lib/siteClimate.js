// lib/siteClimate.js — a plant's stored site and climate facts, cleaned: the
// elevation and horizon from PVGIS's terrain model, and the temperature,
// wind and snow figures from NASA POWER's daily series (engine/siteClimate.js
// fetches them). They are screening values, never design values. Pure.

const num = (v, lo, hi) => (v === "" || v == null || !Number.isFinite(Number(v)) || Number(v) < lo || Number(v) > hi ? null : Number(v));

/**
 * @param {any} x
 * @returns {null | { at:{lat:number,lon:number}|null, fetched:string, elevationM:number|null, horizonDb:string, horizon:number[], horizonMaxDeg:number|null, horizonSouthMaxDeg:number|null,
 *   period:string, db:string, tMaxC:number|null, tMinC:number|null, hotDays:number|null, frostDays:number|null,
 *   wind10MaxMs:number|null, wind10AnnualMaxMs:number|null, snowDepthMaxCm:number|null, snowDepthAnnualMaxCm:number|null }}
 */
export function normalizeClimate(x) {
  if (!x || typeof x !== "object") return null;
  const c = {
    at: x.at && Number.isFinite(Number(x.at.lat)) && Number.isFinite(Number(x.at.lon)) ? { lat: Number(x.at.lat), lon: Number(x.at.lon) } : null,
    fetched: /^\d{4}-\d{2}-\d{2}$/.test(String(x.fetched || "")) ? x.fetched : "",
    elevationM: num(x.elevationM, -500, 9000),
    horizonDb: String(x.horizonDb || "").slice(0, 40),
    horizon: Array.isArray(x.horizon) ? x.horizon.slice(0, 120).map((v) => num(v, 0, 90)).filter((v) => v != null) : [],
    horizonMaxDeg: num(x.horizonMaxDeg, 0, 90), horizonSouthMaxDeg: num(x.horizonSouthMaxDeg, 0, 90),
    period: /^\d{4}-\d{4}$/.test(String(x.period || "")) ? x.period : "",
    db: String(x.db || "").slice(0, 40),
    tMaxC: num(x.tMaxC, -20, 70), tMinC: num(x.tMinC, -80, 40),
    hotDays: num(x.hotDays, 0, 366), frostDays: num(x.frostDays, 0, 366),
    wind10MaxMs: num(x.wind10MaxMs, 0, 120), wind10AnnualMaxMs: num(x.wind10AnnualMaxMs, 0, 120),
    snowDepthMaxCm: num(x.snowDepthMaxCm, 0, 2000), snowDepthAnnualMaxCm: num(x.snowDepthAnnualMaxCm, 0, 2000),
  };
  const any = c.elevationM != null || c.horizonMaxDeg != null || c.tMaxC != null || c.tMinC != null || c.wind10MaxMs != null || c.snowDepthMaxCm != null;
  return any ? c : null;
}

/** The climate was fetched for a point more than this far from the plant's site (km): it is flagged as another site's. */
export const MOVED_KM = 2;

/** Great-circle distance in km between two points; null when either is missing. */
export function kmBetween(a, b) {
  if (!a || !b) return null;
  const R = 6371, rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad, dLon = (b.lon - a.lon) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/** How far the plant's site now is from the point its climate was loaded for, in km; null when it cannot be told. @param {object} pl  a normalised plant */
export function climateDriftKm(pl) {
  const c = pl?.climate;
  if (!c || !c.at || pl.lat == null || pl.lon == null) return null;
  const d = kmBetween(c.at, { lat: pl.lat, lon: pl.lon });
  return d != null && d > MOVED_KM ? d : null;
}
