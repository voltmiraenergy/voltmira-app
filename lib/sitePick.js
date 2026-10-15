// lib/sitePick.js — choosing a plant's site on a map
// (components/portfolio/SitePicker.jsx): distances, coordinates typed or
// pasted into the search box, the locality an OpenStreetMap reverse lookup
// names, and whether the wind screening or the PVGIS yield was looked up for
// another point than the one the plant now stands on. Pure; no I/O.

const R_KM = 6371;
const rad = (d) => (d * Math.PI) / 180;

/** Great-circle distance in km. */
export function kmBetween(a, b) {
  const dLat = rad(b.lat - a.lat), dLon = rad(b.lon - a.lon);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * R_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** A position stored at five decimals: about a metre, plenty for a plant's site. */
export const roundPos = (v) => Math.round(Number(v) * 1e5) / 1e5;

/**
 * Coordinates typed or pasted: "46.95, 28.85", "46,95 28,85", "46.95 N 28.85 E",
 * or a link holding "@46.95,28.85". Null when the text is a place name.
 */
export function parseCoords(s) {
  const t = String(s || "").trim();
  const at = t.match(/@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/);
  let lat, lon;
  if (at) { lat = Number(at[1]); lon = Number(at[2]); }
  else {
    // decimal points: "46.95, 28.85" or "46.95 28.85"; decimal commas: "46,95 28,85" or "46,95; 28,85"
    const dot = t.match(/^(-?\d{1,2}(?:\.\d+)?)\s*°?\s*([NS])?\s*[,;\s]\s*(-?\d{1,3}(?:\.\d+)?)\s*°?\s*([EW])?$/i);
    const comma = t.match(/^(-?\d{1,2}(?:,\d+)?)\s*°?\s*([NS])?\s*[;\s]\s*(-?\d{1,3}(?:,\d+)?)\s*°?\s*([EW])?$/i);
    const m = dot || comma;
    if (!m) return null;
    lat = Number(m[1].replace(",", ".")) * (/s/i.test(m[2] || "") ? -1 : 1);
    lon = Number(m[3].replace(",", ".")) * (/w/i.test(m[4] || "") ? -1 : 1);
  }
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) return null;
  return { lat: roundPos(lat), lon: roundPos(lon) };
}

/**
 * The place a reverse lookup names: the village, town or city, and the district.
 * @param {object} addr  Nominatim's "address" object
 */
export function placeFromAddress(addr) {
  const a = addr && typeof addr === "object" ? addr : {};
  const locality = a.village || a.town || a.city || a.hamlet || a.municipality || a.suburb || a.city_district || "";
  const district = a.county || a.state_district || a.state || "";
  return { locality: String(locality).slice(0, 80), district: String(district).slice(0, 80), country: String(a.country_code || "").toLowerCase() };
}

/** Beyond this the public figures were looked up for another site. */
export const DRIFT_KM = 1;

/**
 * Whether the wind screening, the PVGIS yield and the grid lookup are for the
 * point the plant now stands on: the distance in km for each one looked up elsewhere, null
 * when it matches or cannot be told (no position recorded, a study instead).
 * @param {object} pl  a normalised plant (lib/plantFinance.js normalizePlant)
 */
export function siteDrift(pl) {
  const out = { wind: null, solar: null, grid: null };
  if (!pl || pl.lat == null || pl.lon == null) return out;
  const here = { lat: pl.lat, lon: pl.lon };
  const far = (p) => {
    if (!p || !Number.isFinite(Number(p.lat)) || !Number.isFinite(Number(p.lon))) return null;
    const km = kmBetween(here, { lat: Number(p.lat), lon: Number(p.lon) });
    return km > DRIFT_KM ? km : null;
  };
  if (pl.wind && pl.wind.screening && !(pl.wind.study && pl.wind.study.p50Mwh > 0)) out.wind = far(pl.wind.screening);
  if (pl.solar && pl.solar.yieldSource === "pvgis" && !(pl.solar.study && pl.solar.study.p50Mwh > 0)) out.solar = far(pl.solar.yieldAt);
  if (pl.grid) out.grid = far(pl.grid.at);
  return out;
}
