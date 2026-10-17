// lib/satZoom.js — how sharp the aerial imagery really is over one roof.
// Esri World Imagery stops at different zoom levels by place: zoom 19 over
// Chișinău, zoom 18 over most of the rest of Moldova. Asked for a level it does
// not have, it answers with a grey "no data" tile, which a picture stretched to
// zoom 20 would show as blur. With blankTile=false it answers 404 instead, so
// the offer (lib/actions.js buildProposalSnapshot) asks once at the roof and
// stores the deepest real level; components/RoofSatellite.jsx frames the roof
// at most one level past it.

export const SAT_TILES = "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}";

/** The slippy-map tile holding a point, at zoom z. */
export function tileAt(lat, lon, z) {
  const n = 2 ** z;
  const r = (lat * Math.PI) / 180;
  return {
    x: Math.floor(((lon + 180) / 360) * n),
    y: Math.floor(((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * n),
  };
}

/**
 * The deepest zoom with real imagery at a point: 18 (everywhere in Moldova),
 * else 19 or 20 when Esri has them. Any network failure keeps 18, the level
 * every place has, so a slow server never breaks sending an offer.
 * @param {number} lat
 * @param {number} lon
 * @param {{ fetchImpl?: typeof fetch, timeoutMs?: number }} [o]
 * @returns {Promise<number>}
 */
export async function deepestImageryZoom(lat, lon, { fetchImpl = globalThis.fetch, timeoutMs = 2500 } = {}) {
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || typeof fetchImpl !== "function") return 18;
  let best = 18;
  for (const z of [19, 20]) {
    const { x, y } = tileAt(lat, lon, z);
    const url = SAT_TILES.replace("{z}", z).replace("{y}", y).replace("{x}", x) + "?blankTile=false";
    try {
      const res = await fetchImpl(url, { method: "HEAD", signal: AbortSignal.timeout(timeoutMs), cache: "no-store" });
      if (!res.ok) break;
      best = z;
    } catch { break; }
  }
  return best;
}
