// lib/roofSiteServer.js - the place of an address, for a quote that was never pinned on the map (lib/roofSite.js).
// The geocoder gives the nearest match, which can be the street rather than the house, so the place it returns is
// marked approximate and the offer shows the area without pointing at a roof. The answer is kept in pvgis_cache (the
// geocoder asks for caching, and one lookup serves every view of the offer); a failed lookup is not asked again
// for ten minutes.
import { geocode } from "@voltmira/engine/pvgis";
import { siteOf } from "./roofSite.js";

const misses = new Map();
const MISS_MS = 10 * 60 * 1000;

const norm = (s) => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

/**
 * Whether the geocoder's answer is in the town the address names. It ignores the town and takes the best street match
 * anywhere ("Str. Ștefan cel Mare 20, Strășeni" came back from a village 17 km away), so a place counts only when
 * a part of the address after the street (the village, the town) is also a part of the name it found. An address
 * with no town in it cannot be checked and is not used.
 */
export function inTheTown(address, display) {
  const wanted = String(address || "").split(",").slice(1).map(norm).filter((s) => s.length > 2);
  const found = String(display || "").split(",").map(norm);
  return wanted.some((s) => found.includes(s));
}

/**
 * @param {string} address
 * @param {{lookup?: Function, cache?: {get:Function, set:Function}|null, wait?: number, now?: number}} [o]
 * @returns {Promise<{lat:number, lon:number, tileZoom:number, approx:true}|undefined>}
 */
export async function siteFromAddress(address, { lookup = geocode, cache = null, wait = 3500, now = Date.now() } = {}) {
  const a = String(address || "").trim().replace(/\s+/g, " ").slice(0, 200);
  if (a.length < 6) return undefined;
  const key = "geo:" + a.toLowerCase();
  const hit = cache ? await cache.get(key) : null;
  const fromCache = siteOf({ ...hit, approx: true });
  if (fromCache) return fromCache;
  const missed = misses.get(key);
  if (missed && now - missed < MISS_MS) return undefined;
  try {
    const g = await Promise.race([
      lookup(a, { email: process.env.GEOCODER_EMAIL }),
      new Promise((resolve) => setTimeout(() => resolve(null), wait)),
    ]);
    const site = g && inTheTown(a, g.display) ? siteOf({ lat: g.lat, lon: g.lon, approx: true }) : undefined;
    if (!site) { misses.set(key, now); return undefined; }
    if (cache) await cache.set(key, { lat: site.lat, lon: site.lon });
    return site;
  } catch {
    misses.set(key, now);
    return undefined;
  }
}
