// lib/windData.js — the public wind data behind a screening estimate
// (lib/windScreen.js): NASA POWER's hourly wind speed at 50 m for one recent
// full year, and its 20-year mean for the same point (2001 to 2020). Server
// only. NASA's data is free to use, commercial use included; the screens and
// the report credit it as NASA asks ("NASA Langley Research Center POWER
// Project"). It is reanalysis on a grid of about 50 km, which is why the
// estimate is a screening and not a yield study.
import { histogram } from "./windScreen.js";

const BASE = "https://power.larc.nasa.gov/api/temporal";
export const WIND_SOURCE = "NASA POWER (MERRA-2), NASA Langley Research Center";

async function getJson(url) {
  const res = await fetch(url, { signal: AbortSignal.timeout(45000), cache: "no-store" });
  if (!res.ok) throw new Error(`nasa_${res.status}`);
  return res.json();
}

/**
 * @param {number} lat
 * @param {number} lon
 * @param {{ year?: number }} [opts]  the hourly year; the last full year by default, then the one before
 * @returns {Promise<{ hist: {counts:number[], hours:number}, climMean: number|null, year: number, source: string, lat: number, lon: number, at: string }>}
 */
export async function fetchWindScreening(lat, lon, opts = {}) {
  const la = Number(lat), lo = Number(lon);
  if (!Number.isFinite(la) || !Number.isFinite(lo) || Math.abs(la) > 85 || Math.abs(lo) > 180) throw new Error("bad_coordinates");
  const point = `longitude=${lo.toFixed(4)}&latitude=${la.toFixed(4)}`;
  const first = opts.year || new Date().getUTCFullYear() - 1;
  let hourly = null, year = first;
  for (const y of [first, first - 1]) {
    try {
      const j = await getJson(`${BASE}/hourly/point?parameters=WS50M&community=RE&${point}&start=${y}0101&end=${y}1231&format=JSON&time-standard=UTC`);
      const series = j?.properties?.parameter?.WS50M;
      if (series && Object.keys(series).length > 8000) { hourly = Object.values(series); year = y; break; }
    } catch { /* try the year before */ }
  }
  if (!hourly) throw new Error("wind_data_unavailable");
  let climMean = null;
  try {
    const c = await getJson(`${BASE}/climatology/point?parameters=WS50M&community=RE&${point}&format=JSON`);
    const ann = Number(c?.properties?.parameter?.WS50M?.ANN);
    if (ann > 0 && ann < 40) climMean = ann;
  } catch { /* the year stands on its own; the screen says so */ }
  const h = histogram(hourly);
  return { hist: { counts: h.counts, hours: h.hours }, climMean, year, source: WIND_SOURCE, lat: la, lon: lo, at: new Date().toISOString().slice(0, 10) };
}
