// lib/roofSite.js - where the property is, for the satellite picture on the client's offer. An offer whose roof was
// never drawn still shows the house from above (components/RoofSatellite.jsx, with a pin in place of the outline):
// the client recognises their own roof, and the installer has not had to draw anything first.
const num = (v) => (v == null || v === "" ? NaN : Number(v));

/** A clean {lat, lon, tileZoom[, approx]} or undefined when the place cannot be used. `approx`: found from the address, not pinned. */
export function siteOf(raw) {
  const lat = num(raw?.lat), lon = num(raw?.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) return undefined;
  if (lat === 0 && lon === 0) return undefined;
  // how sharp the imagery is over this place (lib/satZoom.js): 18 when it is not known
  const z = Number(raw?.tileZoom);
  return { lat: Math.round(lat * 1e7) / 1e7, lon: Math.round(lon * 1e7) / 1e7, tileZoom: [18, 19, 20].includes(z) ? z : 18, ...(raw?.approx ? { approx: true } : {}) };
}
