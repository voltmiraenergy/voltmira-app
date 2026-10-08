// lib/portfolioMap.js — where the assets are, for documents that cannot run a
// map library. The PDF is rendered with scripts blocked, so the report draws
// its map from plain positioned tile images (Web Mercator, 256 px tiles) and
// absolutely placed markers. Pure; no I/O. The on-screen page uses Leaflet
// (components/portfolio/AssetMap.jsx) with the same tiles.
//
// Tiles: Esri World Light Gray Base, the same Esri tile service family the site
// designer already uses, credited on the map ("Tiles © Esri").
// The base has no names; the reference layer (transparent PNG) adds the place
// names and borders on top.
const ESRI = "https://server.arcgisonline.com/ArcGIS/rest/services/Canvas";
export const TILES = {
  light: { base: `${ESRI}/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}`, ref: `${ESRI}/World_Light_Gray_Reference/MapServer/tile/{z}/{y}/{x}` },
  dark: { base: `${ESRI}/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}`, ref: `${ESRI}/World_Dark_Gray_Reference/MapServer/tile/{z}/{y}/{x}` },
};
export const TILE_ATTRIBUTION = "Tiles © Esri";
const tileSrc = (url, z, x, y) => url.replace("{z}", z).replace("{y}", y).replace("{x}", x);

const T = 256;
const given = (v) => v !== null && v !== undefined && v !== "" && Number.isFinite(Number(v));
const valid = (p) => p && given(p.lat) && given(p.lon)
  && Math.abs(Number(p.lat)) <= 85 && Math.abs(Number(p.lon)) <= 180 && !(Number(p.lat) === 0 && Number(p.lon) === 0);

/** World pixel coordinates at zoom z. */
export function project(lat, lon, z) {
  const s = T * Math.pow(2, z);
  const phi = (Math.max(-85, Math.min(85, lat)) * Math.PI) / 180;
  return { x: ((lon + 180) / 360) * s, y: ((1 - Math.log(Math.tan(phi) + 1 / Math.cos(phi)) / Math.PI) / 2) * s };
}

/** The assets that carry a usable position. */
export function located(points) {
  return (points || []).filter(valid).map((p) => ({ ...p, lat: Number(p.lat), lon: Number(p.lon) }));
}

/**
 * The view that fits every located point into width x height with a margin:
 * the zoom, the tiles to draw (with their pixel offsets) and each point's
 * pixel position. null when no point has a position.
 * @param {Array<{lat:number, lon:number}>} points
 */
export function staticView(points, { width = 640, height = 300, pad = 36, minZoom = 4, maxZoom = 11, tiles: set = TILES.light } = {}) {
  const pts = located(points);
  if (!pts.length) return null;
  let z = maxZoom;
  for (; z > minZoom; z--) {
    const ps = pts.map((p) => project(p.lat, p.lon, z));
    const w = Math.max(...ps.map((p) => p.x)) - Math.min(...ps.map((p) => p.x));
    const h = Math.max(...ps.map((p) => p.y)) - Math.min(...ps.map((p) => p.y));
    if (w <= width - 2 * pad && h <= height - 2 * pad) break;
  }
  const ps = pts.map((p) => project(p.lat, p.lon, z));
  const cx = (Math.max(...ps.map((p) => p.x)) + Math.min(...ps.map((p) => p.x))) / 2;
  const cy = (Math.max(...ps.map((p) => p.y)) + Math.min(...ps.map((p) => p.y))) / 2;
  const left = cx - width / 2, top = cy - height / 2;
  const n = Math.pow(2, z);
  const tiles = [];
  for (let ty = Math.floor(top / T); ty <= Math.floor((top + height) / T); ty++) {
    if (ty < 0 || ty >= n) continue;
    for (let tx = Math.floor(left / T); tx <= Math.floor((left + width) / T); tx++) {
      const wx = ((tx % n) + n) % n;
      tiles.push({ key: `${z}-${tx}-${ty}`, left: tx * T - left, top: ty * T - top, src: tileSrc(set.base, z, wx, ty), ref: tileSrc(set.ref, z, wx, ty) });
    }
  }
  return {
    z, width, height, tiles, left, top,
    points: pts.map((p, i) => ({ ...p, x: ps[i].x - left, y: ps[i].y - top })),
  };
}

/** A marker radius in px from capacity: area proportional to kWp, clamped. */
export function markerRadius(kw, maxKw, { min = 5, max = 16 } = {}) {
  const k = Math.max(0, Number(kw) || 0), m = Math.max(1, Number(maxKw) || 1);
  return min + (max - min) * Math.sqrt(Math.min(1, k / m));
}

/**
 * No two markers overlap: circles closer than their two radii plus a gap are
 * pushed apart a little at a time until each stands clear, kept inside the
 * frame. A marker moved off its true spot is flagged, so the map can draw a
 * thin line back to it.
 * @param {Array<{x:number, y:number, r:number}>} points  pixel positions and radii
 * @returns {Array<{x:number, y:number, r:number, x0:number, y0:number, moved:boolean}>}
 */
export function separate(points, { width, height, gap = 3, rounds = 300 } = {}) {
  const pts = points.map((p) => ({ ...p, x0: p.x, y0: p.y }));
  for (let round = 0; round < rounds; round++) {
    let moved = false;
    for (let a = 0; a < pts.length; a++) {
      for (let b = a + 1; b < pts.length; b++) {
        const A = pts[a], B = pts[b];
        let dx = B.x - A.x, dy = B.y - A.y;
        let d = Math.hypot(dx, dy);
        const need = A.r + B.r + gap;
        if (d >= need) continue;
        if (d < 1e-6) {
          // the same spot: split them in a direction set by their order
          const ang = (2 * Math.PI * (b % 8)) / 8 + a;
          dx = Math.cos(ang); dy = Math.sin(ang); d = 1;
        }
        const push = (need - d) / 2 + 0.01;
        const ux = dx / d, uy = dy / d;
        A.x -= ux * push; A.y -= uy * push;
        B.x += ux * push; B.y += uy * push;
        moved = true;
      }
    }
    for (const p of pts) {
      if (width) p.x = Math.min(width - p.r - 1, Math.max(p.r + 1, p.x));
      if (height) p.y = Math.min(height - p.r - 1, Math.max(p.r + 1, p.y));
    }
    if (!moved) break;
  }
  return pts.map((p) => ({ ...p, moved: Math.hypot(p.x - p.x0, p.y - p.y0) > p.r * 0.6 }));
}
