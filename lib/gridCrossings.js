// lib/gridCrossings.js — what a connection line's route crosses, from
// OpenStreetMap: rivers and canals, railways, main roads, other power lines,
// protected areas and nature reserves, forests, built-up areas, and the
// villages it passes near. Each crossing usually means an agreement or a
// permit of its own (a right of way, a crossing approval, an environmental
// assessment), so the list is what the developer has to plan for; protected
// areas also matter to the lender's environmental and social screening.
//
// "Crosses" means the route passes within 30 m of the feature (a village
// within 1 km), which is what OpenStreetMap can tell; a route lying wholly
// inside a protected area is caught by the area test on points along it.
// The query is built here and run by lib/gridData.js. Pure; no I/O.
import { kmBetween } from "./sitePick.js";

export const CROSS_KINDS = ["protected", "river", "rail", "road", "power", "forest", "built", "village"];

/** Points every `stepKm` along a route, for the "inside an area" test; at most `max`. */
export function sampleRoute(points, stepKm = 1, max = 25) {
  const out = [];
  if (!Array.isArray(points) || points.length < 2) return out;
  out.push(points[0]);
  let carry = 0;
  for (let i = 1; i < points.length; i++) {
    const a = { lat: points[i - 1][0], lon: points[i - 1][1] }, b = { lat: points[i][0], lon: points[i][1] };
    const seg = kmBetween(a, b);
    let d = stepKm - carry;
    while (d < seg) {
      const t = d / seg;
      out.push([a.lat + (b.lat - a.lat) * t, a.lon + (b.lon - a.lon) * t]);
      d += stepKm;
    }
    carry = seg - (d - stepKm);
  }
  out.push(points[points.length - 1]);
  if (out.length <= max) return out;
  const stride = (out.length - 1) / (max - 1);
  return Array.from({ length: max }, (_, i) => out[Math.round(i * stride)]);
}

/** The route as Overpass's around-a-line argument: "lat1,lon1,lat2,lon2,...". */
const line = (points) => points.map((q) => `${Number(q[0]).toFixed(5)},${Number(q[1]).toFixed(5)}`).join(",");

/** The Overpass query for a route. */
export function crossingsQuery(points) {
  const L = line(points);
  const inside = sampleRoute(points).map((q) => `is_in(${Number(q[0]).toFixed(5)},${Number(q[1]).toFixed(5)});`).join("\n  ");
  return `[out:json][timeout:30];
(
  way["waterway"~"^(river|canal|stream)$"](around:30,${L});
  way["railway"~"^(rail|light_rail|narrow_gauge)$"](around:30,${L});
  way["highway"~"^(motorway|trunk|primary|secondary|tertiary)$"](around:30,${L});
  way["power"="line"](around:30,${L});
  nwr["boundary"="protected_area"](around:30,${L});
  nwr["leisure"="nature_reserve"](around:30,${L});
  nwr["landuse"="forest"](around:30,${L});
  way["natural"="wood"](around:30,${L});
  nwr["landuse"="residential"](around:30,${L});
  node["place"~"^(city|town|village|hamlet)$"](around:1000,${L});
);
out tags center qt;
(
  ${inside}
)->.inside;
(
  area.inside["boundary"="protected_area"];
  area.inside["leisure"="nature_reserve"];
);
out tags qt;`;
}

/** The kind of crossing a feature is, or null. */
export function kindOf(tags) {
  const t = tags || {};
  if (t.boundary === "protected_area" || t.leisure === "nature_reserve") return "protected";
  if (/^(river|canal|stream)$/.test(t.waterway || "")) return "river";
  if (/^(rail|light_rail|narrow_gauge)$/.test(t.railway || "")) return "rail";
  if (/^(motorway|trunk|primary|secondary|tertiary)$/.test(t.highway || "")) return "road";
  if (t.power === "line") return "power";
  if (t.landuse === "forest" || t.natural === "wood") return "forest";
  if (t.landuse === "residential") return "built";
  if (/^(city|town|village|hamlet)$/.test(t.place || "")) return "village";
  return null;
}

/**
 * The Overpass answer as a list of crossings: one entry per feature, named
 * where OpenStreetMap names it (a road by its number), in the order a
 * developer would worry about them. An area is one entry however many of its
 * parts the route touches.
 */
export function parseCrossings(json) {
  const seen = new Map();
  for (const e of Array.isArray(json?.elements) ? json.elements : []) {
    const t = e.tags || {};
    const kind = kindOf(t);
    if (!kind) continue;
    // an area found by the inside test comes back as an "area" element
    const id = e.type === "area" ? `area/${e.id}` : `${e.type}/${e.id}`;
    const name = String(t.name || t["name:ro"] || "").replace(/\s+/g, " ").trim().slice(0, 80);
    const ref = String(t.ref || "").slice(0, 20);
    // the same river or road comes as many ways: keep one per road number, else per name
    const k = ref ? `${kind}:ref:${ref}` : name ? `${kind}:${name}` : `${kind}:${id}`;
    if (!seen.has(k)) seen.set(k, { kind, name, ref, id });
  }
  return [...seen.values()].sort((a, b) => CROSS_KINDS.indexOf(a.kind) - CROSS_KINDS.indexOf(b.kind) || a.name.localeCompare(b.name));
}

/** A key that changes when the route does, so a check on an older route shows as out of date. */
export function routeKey(points) {
  const s = (points || []).map((q) => `${Number(q[0]).toFixed(4)},${Number(q[1]).toFixed(4)}`).join(";");
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h * 33) ^ s.charCodeAt(i)) >>> 0;
  return `${(points || []).length}-${h.toString(36)}`;
}

/** The crossings counted by kind, for one line of text. */
export function crossingCounts(items) {
  const out = {};
  for (const x of items || []) out[x.kind] = (out[x.kind] || 0) + 1;
  return out;
}
