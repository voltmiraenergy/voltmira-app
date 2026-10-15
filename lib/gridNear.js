// lib/gridNear.js — where the power grid is around a plant's site: the
// substations in Moldova at 35 kV and above and the high-voltage lines, from
// OpenStreetMap (lib/gridData.js fetches them through the Overpass API), with
// the straight-line distance to each and the lines' routes (simplified, so the
// map and the documents can draw them), and the plant's connection record:
// the point chosen, the routes the user drew, the user's costs and conductors
// per voltage, the option applied to the plant, the crossings found along the
// route. The options are compared in lib/gridOptions.js.
//
// A connection OPTION is a point at a voltage: a 400/110/10 kV substation is
// an option at 400 kV and another at 110 kV (a plant of tens of MW joins its
// 110 kV side); a line is an option at its own voltage, as a tap into it.
//
// What it is not: OpenStreetMap shows where the grid is, not whether it has
// spare capacity, and not where the operator will let a plant connect. Only
// Moldelectrica or the distribution operator answers that, in the connection
// approval. OSM data is © OpenStreetMap contributors, ODbL, and is credited
// wherever it shows. Pure; no I/O.
import { kmBetween } from "./sitePick.js";

export const GRID_SOURCE = "© OpenStreetMap contributors (ODbL), via the Overpass API";
export const GRID_CLASSES = ["hv", "110", "35"];
export const ROUTE_FACTOR = 1.2;
/** An unnamed point takes the name of a village or town within this distance, km. */
export const PLACE_KM = 6;
/** Most route points kept on a plant: about 15 kB of the portfolio record. */
export const MAX_PATH_POINTS = 1500;

const num = (v) => (v !== "" && v != null && Number.isFinite(Number(v)) ? Number(v) : null);
const r5 = (v) => Math.round(v * 1e5) / 1e5;
const clean = (s, n = 80) => String(s || "").replace(/\s+/g, " ").trim().slice(0, n);

/** OSM's voltage tag in kV, highest first: "110000;35000;10000" -> [110, 35, 10]. A bare "110" is read as kV. */
export function voltagesKv(tag) {
  const out = new Set();
  for (const part of String(tag || "").split(/[;,]/)) {
    const v = Number(part.trim());
    if (!Number.isFinite(v) || v <= 0) continue;
    out.add(Math.round(v >= 1000 ? v / 1000 : v));
  }
  return [...out].sort((a, b) => b - a);
}

/** The class a voltage falls in: 330 kV and above, 110 kV, 35 kV, or none (distribution below 35 kV). */
export function classOf(kv) {
  const k = Number(kv) || 0;
  return k >= 300 ? "hv" : k >= 100 ? "110" : k >= 30 ? "35" : null;
}

/** Every class a substation serves, from its voltages: 400/110/10 kV serves hv and 110. */
export function classesOf(kv, transmission = false) {
  const out = [...new Set((kv || []).map(classOf).filter(Boolean))];
  if (!out.length && transmission) out.push("hv");
  return GRID_CLASSES.filter((c) => out.includes(c));
}

/** The voltage, kV, of a substation's side in a class: the highest it has there. */
export function kvIn(kv, cls) {
  return (kv || []).find((k) => classOf(k) === cls) ?? (cls === "hv" ? 330 : cls === "110" ? 110 : 35);
}

/** A local flat projection around a point, km. */
const flat = (p) => { const kx = 111.32 * Math.cos((p.lat * Math.PI) / 180), ky = 110.574; return { kx, ky }; };

/** Distance in km from a point to a path of points (a line's route), and the nearest point on it. */
export function pointToPathKm(p, path) {
  if (!Array.isArray(path) || !path.length) return null;
  const { kx, ky } = flat(p);
  const xy = (q) => [((q.lon ?? q[1]) - p.lon) * kx, ((q.lat ?? q[0]) - p.lat) * ky];
  let best = Infinity, at = null;
  for (let i = 0; i < path.length; i++) {
    const a = xy(path[i]);
    const b = i + 1 < path.length ? xy(path[i + 1]) : a;
    const dx = b[0] - a[0], dy = b[1] - a[1];
    const len2 = dx * dx + dy * dy;
    const t = len2 > 0 ? Math.max(0, Math.min(1, -(a[0] * dx + a[1] * dy) / len2)) : 0;
    const x = a[0] + t * dx, y = a[1] + t * dy;
    const d = Math.hypot(x, y);
    if (d < best) { best = d; at = { lat: p.lat + y / ky, lon: p.lon + x / kx }; }
  }
  return { km: best, at };
}

/** A route made lighter: Douglas-Peucker on [lat, lon] points, keeping detail above `tolKm`. */
export function simplifyPath(points, tolKm = 0.03) {
  const pts = (points || []).filter((q) => Array.isArray(q) && q.length >= 2);
  if (pts.length <= 2) return pts.map((q) => [r5(q[0]), r5(q[1])]);
  const { kx, ky } = flat({ lat: pts[0][0] });
  const xy = pts.map((q) => [q[1] * kx, q[0] * ky]);
  const keep = new Uint8Array(pts.length);
  keep[0] = keep[pts.length - 1] = 1;
  const stack = [[0, pts.length - 1]];
  while (stack.length) {
    const [a, b] = stack.pop();
    const [x1, y1] = xy[a], [x2, y2] = xy[b];
    const dx = x2 - x1, dy = y2 - y1, len = Math.hypot(dx, dy) || 1e-12;
    let worst = -1, at = -1;
    for (let i = a + 1; i < b; i++) {
      const d = Math.abs(dy * xy[i][0] - dx * xy[i][1] + x2 * y1 - y2 * x1) / len;
      if (d > worst) { worst = d; at = i; }
    }
    if (worst > tolKm) { keep[at] = 1; stack.push([a, at], [at, b]); }
  }
  return pts.filter((_, i) => keep[i]).map((q) => [r5(q[0]), r5(q[1])]);
}

/** The length of a route of [lat, lon] points, km. */
export function routeKm(points) {
  let km = 0;
  for (let i = 1; i < (points || []).length; i++) km += kmBetween({ lat: points[i - 1][0], lon: points[i - 1][1] }, { lat: points[i][0], lon: points[i][1] });
  return km;
}

const center = (e) => (e.center ? e.center : e.lat != null ? { lat: e.lat, lon: e.lon } : null);

/**
 * The Overpass answer as the grid around a point: substations and lines with
 * their distance, nearest first. Substations below 35 kV, or of no stated
 * voltage and not marked transmission, are left out: a plant of megawatts does
 * not connect to a village transformer.
 * @param {{elements: object[]}} json
 * @param {{lat:number, lon:number}} at
 * @returns {{ substations: object[], lines: object[], paths: object[] }}
 */
export function parseGrid(json, at) {
  const els = Array.isArray(json?.elements) ? json.elements : [];
  const substations = [], lines = [], paths = [];
  // the villages and towns around, to name a point OpenStreetMap leaves unnamed
  const places = els.filter((e) => e.type === "node" && e.tags?.place && e.lat != null)
    .map((e) => ({ name: clean(e.tags["name:ro"] || e.tags.name), lat: e.lat, lon: e.lon })).filter((p) => p.name);
  const placeNear = (q) => {
    let best = null, d = PLACE_KM;
    for (const p of places) { const k = kmBetween(q, p); if (k < d) { d = k; best = p.name; } }
    return best || "";
  };
  for (const e of els) {
    const t = e.tags || {};
    if (t.power === "substation") {
      const c = center(e);
      if (!c) continue;
      const kv = voltagesKv(t.voltage);
      const classes = classesOf(kv, t.substation === "transmission");
      if (!classes.length) continue;
      const name = clean(t.name);
      substations.push({ id: `${e.type}/${e.id}`, name, place: name ? "" : placeNear(c), operator: clean(t.operator, 60), kv, cls: classes[0], classes,
        lat: r5(c.lat), lon: r5(c.lon), km: kmBetween(at, c) });
    } else if (t.power === "line" && Array.isArray(e.geometry)) {
      const kv = voltagesKv(t.voltage);
      const cls = classOf(kv[0]);
      if (!cls) continue;
      const near = pointToPathKm(at, e.geometry);
      if (!near) continue;
      const name = clean(t.name);
      lines.push({ id: `${e.type}/${e.id}`, name, place: name ? "" : placeNear(near.at), kv, cls, km: near.km, near: { lat: r5(near.at.lat), lon: r5(near.at.lon) } });
      paths.push({ id: `${e.type}/${e.id}`, cls, km: near.km, path: e.geometry.map((g) => [g.lat, g.lon]) });
    }
  }
  substations.sort((a, b) => a.km - b.km);
  lines.sort((a, b) => a.km - b.km);
  return { substations, lines, paths };
}

const servesClass = (s, c) => (s.classes && s.classes.length ? s.classes : [s.cls]).includes(c);

/** The nearest substation and the nearest line of each class. */
export function gridSummary(grid) {
  const subs = Array.isArray(grid?.substations) ? grid.substations : [];
  const lines = Array.isArray(grid?.lines) ? grid.lines : [];
  const out = { sub: {}, line: {} };
  for (const c of GRID_CLASSES) {
    out.sub[c] = subs.filter((s) => servesClass(s, c)).sort((a, b) => a.km - b.km)[0] || null;
    out.line[c] = lines.filter((l) => l.cls === c).sort((a, b) => a.km - b.km)[0] || null;
  }
  return out;
}

/**
 * What is kept on the plant: the nearest few substations of each class, the
 * nearest lines, and the lines' routes, simplified and capped (the nearest
 * lines keep theirs first).
 */
export function keepGrid(parsed, at, fetched) {
  const round = (x) => ({ ...x, km: Math.round(x.km * 100) / 100 });
  const subs = new Map();
  for (const c of GRID_CLASSES) parsed.substations.filter((s) => servesClass(s, c)).slice(0, 4).forEach((s) => subs.set(s.id, s));
  const lines = GRID_CLASSES.flatMap((c) => parsed.lines.filter((l) => l.cls === c).slice(0, 2));
  const paths = [];
  let used = 0;
  for (const p of [...parsed.paths].sort((a, b) => a.km - b.km)) {
    const s = simplifyPath(p.path);
    if (used + s.length > MAX_PATH_POINTS) continue;
    used += s.length;
    paths.push({ id: p.id, cls: p.cls, path: s });
  }
  return {
    at: { lat: at.lat, lon: at.lon }, fetched,
    substations: [...subs.values()].map(round).sort((a, b) => a.km - b.km),
    lines: lines.map(round).sort((a, b) => a.km - b.km),
    paths,
  };
}

/** An option's key: the point and the voltage class, "way/12@110". */
export const optionKey = (o) => `${o.id}@${o.cls}`;

const pos = (v) => (num(v) != null && num(v) > 0 ? num(v) : null);
const okPoint = (q) => Array.isArray(q) && num(q[0]) != null && num(q[1]) != null && Math.abs(q[0]) <= 90 && Math.abs(q[1]) <= 180;

/** The user's figures for one voltage class: cost per km of line, works at a substation bay, works for a tap into a line. */
function costsOf(x) {
  const c = x && typeof x === "object" ? x : {};
  return { perKm: pos(c.perKm), sub: pos(c.sub), tap: pos(c.tap) };
}

/** The grid record of a plant, every field checked: what lib/plantFinance.js normalizePlant keeps. */
export function normalizeGrid(g) {
  if (!g || typeof g !== "object" || !g.at) return null;
  const at = { lat: num(g.at.lat), lon: num(g.at.lon) };
  if (at.lat == null || at.lon == null) return null;
  const sub = (s) => {
    if (!s || num(s.lat) == null || num(s.lon) == null) return null;
    const kv = voltagesKv((Array.isArray(s.kv) ? s.kv : []).join(";"));
    const classes = Array.isArray(s.classes) && s.classes.length ? GRID_CLASSES.filter((c) => s.classes.includes(c)) : GRID_CLASSES.includes(s.cls) ? [s.cls] : classesOf(kv);
    if (!classes.length) return null;
    return { id: clean(s.id, 40), name: clean(s.name), place: clean(s.place), operator: clean(s.operator, 60), kv, cls: classes[0], classes, lat: num(s.lat), lon: num(s.lon), km: Math.max(0, num(s.km) || 0) };
  };
  const line = (l) => l && GRID_CLASSES.includes(l.cls) && num(l.km) != null ? {
    id: clean(l.id, 40), name: clean(l.name), place: clean(l.place), kv: voltagesKv((Array.isArray(l.kv) ? l.kv : []).join(";")), cls: l.cls, km: Math.max(0, num(l.km)),
    near: l.near && num(l.near.lat) != null ? { lat: num(l.near.lat), lon: num(l.near.lon) } : null,
  } : null;
  const substations = (Array.isArray(g.substations) ? g.substations : []).slice(0, 16).map(sub).filter(Boolean);
  const lines = (Array.isArray(g.lines) ? g.lines : []).slice(0, 8).map(line).filter(Boolean);
  let points = 0;
  const paths = (Array.isArray(g.paths) ? g.paths : []).map((p) => {
    if (!p || !GRID_CLASSES.includes(p.cls) || !Array.isArray(p.path)) return null;
    const path = p.path.filter(okPoint).map((q) => [num(q[0]), num(q[1])]);
    if (path.length < 2 || points + path.length > MAX_PATH_POINTS) return null;
    points += path.length;
    return { id: clean(p.id, 40), cls: p.cls, path };
  }).filter(Boolean);

  // the point chosen; an older record has no class on it: the point's highest
  let choice = null;
  if (g.choice && typeof g.choice === "object" && ["sub", "line"].includes(g.choice.kind)) {
    const id = clean(g.choice.id, 40);
    const hit = g.choice.kind === "sub" ? substations.find((s) => s.id === id) : lines.find((l) => l.id === id);
    const cls = GRID_CLASSES.includes(g.choice.cls) ? g.choice.cls : hit ? hit.cls : null;
    if (cls) choice = { kind: g.choice.kind, id, cls };
  }
  // routes the user drew, one per option, each from the site to the point
  const routes = {};
  if (g.routes && typeof g.routes === "object") {
    for (const [k, v] of Object.entries(g.routes).slice(0, 12)) {
      if (!/^[\w/]+@(hv|110|35)$/.test(k) || !Array.isArray(v)) continue;
      const pts = v.filter(okPoint).slice(0, 200).map((q) => [r5(num(q[0])), r5(num(q[1]))]);
      if (pts.length >= 2) routes[k] = pts;
    }
  }
  const costs = {};
  for (const c of GRID_CLASSES) costs[c] = costsOf(g.costs?.[c]);
  // the first version kept one cost per km and one works figure: they belong to the chosen class
  if (choice && !g.costs && (pos(g.eurPerKm) || pos(g.worksEur))) {
    costs[choice.cls] = { perKm: pos(g.eurPerKm), sub: choice.kind === "sub" ? pos(g.worksEur) : null, tap: choice.kind === "line" ? pos(g.worksEur) : null };
  }
  const conductors = {};
  for (const c of GRID_CLASSES) if (typeof g.conductors?.[c] === "string") conductors[c] = clean(g.conductors[c], 16);
  const applied = g.applied && typeof g.applied === "object" && typeof g.applied.key === "string" ? {
    key: clean(g.applied.key, 60), costEur: pos(g.applied.costEur) || 0, lossPct: Math.min(20, Math.max(0, num(g.applied.lossPct) || 0)),
    on: /^\d{4}-\d{2}-\d{2}$/.test(String(g.applied.on || "")) ? g.applied.on : "",
  } : null;
  const crossings = g.crossings && typeof g.crossings === "object" && Array.isArray(g.crossings.items) ? {
    key: clean(g.crossings.key, 60), fetched: /^\d{4}-\d{2}-\d{2}$/.test(String(g.crossings.fetched || "")) ? g.crossings.fetched : "",
    items: g.crossings.items.slice(0, 60).filter((x) => x && typeof x.kind === "string").map((x) => ({ kind: clean(x.kind, 20), name: clean(x.name), ref: clean(x.ref, 20), id: clean(x.id, 40) })),
  } : null;
  return {
    at, fetched: /^\d{4}-\d{2}-\d{2}$/.test(String(g.fetched || "")) ? g.fetched : "",
    substations, lines, paths, choice, routes, costs, conductors, applied, crossings,
    routeFactor: pos(g.routeFactor) != null ? Math.min(3, Math.max(1, pos(g.routeFactor))) : ROUTE_FACTOR,
    shared: !!g.shared,
  };
}

/** Every option the record holds: each substation at each class it serves, each line at its own. */
export function allOptions(grid) {
  if (!grid) return [];
  const out = [];
  for (const s of grid.substations) for (const c of (s.classes || [s.cls])) {
    out.push({ kind: "sub", id: s.id, cls: c, kvAt: kvIn(s.kv, c), name: s.name, place: s.place || "", operator: s.operator, kv: s.kv, km: s.km, to: { lat: s.lat, lon: s.lon } });
  }
  for (const l of grid.lines) out.push({ kind: "line", id: l.id, cls: l.cls, kvAt: l.kv[0] || kvIn([], l.cls), name: l.name, place: l.place || "", kv: l.kv, km: l.km, to: l.near });
  return out.map((o) => ({ ...o, key: optionKey(o) }));
}

/** The connection point the user chose, or the nearest 110 kV substation when none is chosen. */
export function chosenPoint(grid) {
  if (!grid) return null;
  const opts = allOptions(grid);
  const c = grid.choice;
  if (c) {
    const hit = opts.find((o) => o.kind === c.kind && o.id === c.id && o.cls === c.cls) || opts.find((o) => o.kind === c.kind && o.id === c.id);
    if (hit) return hit;
  }
  return opts.filter((o) => o.kind === "sub" && o.cls === "110").sort((a, b) => a.km - b.km)[0] || null;
}

/**
 * The route of an option, km: the one the user drew, or the straight line
 * times the route factor.
 */
export function optionRoute(grid, o) {
  const drawn = grid?.routes?.[o.key];
  if (drawn && drawn.length >= 2) return { km: routeKm(drawn), drawn: true, points: drawn };
  return { km: o.km * (grid?.routeFactor || ROUTE_FACTOR), drawn: false, points: o.to ? [[grid.at.lat, grid.at.lon], [o.to.lat, o.to.lon]] : null };
}

/**
 * A rough connection cost for the chosen point: its route, times the user's
 * cost per km for that voltage, plus the works there (a bay at a substation, a
 * new station for a tap into a line). Null until the user has given a cost per km.
 */
export function connectionEstimate(grid) {
  const p = chosenPoint(grid);
  const c = p ? grid.costs?.[p.cls] : null;
  if (!p || !c?.perKm) return null;
  const r = optionRoute(grid, p);
  const works = (p.kind === "sub" ? c.sub : c.tap) || 0;
  return { point: p, routeKm: r.km, drawn: r.drawn, lineEur: r.km * c.perKm, worksEur: works, totalEur: r.km * c.perKm + works };
}
