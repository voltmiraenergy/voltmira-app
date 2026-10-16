// lib/tileWarm.js — the map tiles around a site, saved while there is a signal
// so the designers still show the satellite view and the names on a roof with
// none. The designers list the tiles here and hand them to the offline worker
// (public/app-sw.js, message "tiles"), which keeps them in their own cache and
// serves them when the network fails. Esri only: Google's tiles may not be
// stored, by its terms. Pure apart from postTiles().

const R = 6378137;

/** The tile x/y holding a point at zoom z. */
export function tileXY(lat, lon, z) {
  const n = 2 ** z;
  const r = (lat * Math.PI) / 180;
  return {
    x: Math.floor(((lon + 180) / 360) * n),
    y: Math.floor(((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * n),
  };
}

/**
 * Every tile URL covering a box around a point, for each zoom and template.
 * @param {{ lat:number, lon:number }} c
 * @param {number} radiusM  half the box's side, metres
 * @param {number[]} zooms
 * @param {string[]} templates  "…/{z}/{y}/{x}"
 * @param {number} [max]  a ceiling on the count, so a big plot never fetches thousands
 */
export function tilesAround(c, radiusM, zooms, templates, max = 600) {
  if (!Number.isFinite(c?.lat) || !Number.isFinite(c?.lon)) return [];
  const dLat = (radiusM / R) * (180 / Math.PI);
  const dLon = dLat / Math.cos((c.lat * Math.PI) / 180);
  const out = [];
  for (const z of zooms) {
    const a = tileXY(c.lat + dLat, c.lon - dLon, z), b = tileXY(c.lat - dLat, c.lon + dLon, z);
    for (let y = a.y; y <= b.y; y++) {
      for (let x = a.x; x <= b.x; x++) {
        for (const t of templates) {
          out.push(t.replace("{z}", z).replace("{y}", y).replace("{x}", x));
          if (out.length >= max) return out;
        }
      }
    }
  }
  return out;
}

/** Ask the offline worker to keep these tiles (best effort; production only, where the worker runs). */
export async function postTiles(urls) {
  try {
    if (!urls.length || !navigator.onLine || !("serviceWorker" in navigator)) return;
    const reg = await navigator.serviceWorker.getRegistration();
    reg?.active?.postMessage({ type: "tiles", urls });
  } catch { /* offline mode is optional */ }
}
