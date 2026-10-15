// lib/windLayout.js — indicative turbine positions for a wind (or hybrid)
// plant's site plan, and the collector cable that joins them to the grid
// connection point. Turbines are either set on a grid across a plot, spaced by
// the rotor diameter, or placed where the plan says (a sample's arrangement,
// or a turbine the user dragged). Each has a circular keep-out zone, the
// blade's sweep with a margin for the crane pad and the access road, that
// becomes an exclusion for the solar tables of a hybrid plant
// (lib/plantLayout.js joins the two). A setback from buildings and roads for
// fall-over or ice throw is wider and is the permit's to set. The rotor
// diameter is assumed from the turbine's rating at a generic specific power,
// since the plant does not always give it. Indicative only: the turbine
// supplier's layout and the micrositing study govern. Pure; no I/O.
import { pointInPoly, segmentsCross } from "./siteLayout.js";

const R_EARTH = 6371008.8;
const rad = (d) => (d * Math.PI) / 180;

/** A modern turbine's rated power per swept rotor area, assumed where the rotor diameter is not given. */
export const DEFAULT_SPECIFIC_POWER_W_M2 = 380;
/** Rows apart, and turbines along a row, in rotor diameters: the compact end of the usual range (5 to 10 along the wind, 3 to 5 across it); a wind study sets the real one. */
export const DOWNWIND_D = 5;
export const CROSSWIND_D = 3;
/** The keep-out circle: the rotor radius times this, and never under the minimum (crane pad and road). */
export const SWEEP_MULT = 1.5;
export const KEEPOUT_MIN_M = 60;
const CIRCLE_POINTS = 20;

/** A turbine's rotor diameter, m, from its rating at the assumed specific power. */
export function rotorDiameterM(mwPerTurbine, specificPower = DEFAULT_SPECIFIC_POWER_W_M2) {
  const p = Math.max(0.05, Number(mwPerTurbine) || 0) * 1e6;
  return 2 * Math.sqrt(p / (Math.PI * Math.max(50, Number(specificPower) || DEFAULT_SPECIFIC_POWER_W_M2)));
}

/** The keep-out radius around a turbine, m: the blade's sweep with a margin, at least the crane pad's. */
export function keepoutRadiusM(rotorM) {
  return Math.max(KEEPOUT_MIN_M, ((Number(rotorM) || 0) / 2) * SWEEP_MULT);
}

/** A flat metre frame around a point: to and from the globe. */
export function frameAt(lat0, lon0) {
  const ky = (R_EARTH * Math.PI) / 180, kx = ky * Math.cos(rad(lat0));
  return { toXY: (p) => [(p[1] - lon0) * kx, (p[0] - lat0) * ky], toLL: (p) => [lat0 + p[1] / ky, lon0 + p[0] / kx] };
}
function frameOf(ll) {
  return frameAt(ll.reduce((a, p) => a + p[0], 0) / ll.length, ll.reduce((a, p) => a + p[1], 0) / ll.length);
}
function distPointSeg(p, a, b) {
  const dx = b[0] - a[0], dy = b[1] - a[1], len2 = dx * dx + dy * dy;
  const t = len2 > 0 ? Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / len2)) : 0;
  return Math.hypot(p[0] - (a[0] + t * dx), p[1] - (a[1] + t * dy));
}
function distToPoly(p, poly) {
  let d = Infinity;
  for (let i = 0; i < poly.length; i++) d = Math.min(d, distPointSeg(p, poly[i], poly[(i + 1) % poly.length]));
  return d;
}
// the grid's first row and column sit exactly `r` from the boundary by construction; a hair of
// floating-point error must not throw them out, so the check tolerates a micrometre of it
const circleInside = (p, r, poly) => pointInPoly(p, poly) && distToPoly(p, poly) >= r - 1e-6;
const circleTouchesPoly = (p, r, poly) => pointInPoly(p, poly) || distToPoly(p, poly) <= r;

/**
 * One turbine where the plan puts it, with its keep-out ring.
 * @param {number} lat @param {number} lon @param {number} rotorM @param {number} n
 * @returns {{ n:number, lat:number, lon:number, exclusion:number[][] }}
 */
export function turbineAt(lat, lon, rotorM, n) {
  const f = frameAt(lat, lon);
  const r = keepoutRadiusM(rotorM);
  const exclusion = Array.from({ length: CIRCLE_POINTS }, (_, i) => {
    const a = (2 * Math.PI * i) / CIRCLE_POINTS;
    return f.toLL([Math.cos(a) * r, Math.sin(a) * r]);
  });
  return { n, lat, lon, exclusion };
}

/**
 * @param {object} a
 * @param {number[][]} a.polygon        the plot, [lat, lon] points (3 or more)
 * @param {number} a.count              turbines wanted on this plot
 * @param {number} a.mwPerTurbine       one turbine's rating, used to assume its rotor diameter
 * @param {number} [a.hubM]             hub height, m (reported; the keep-out rests on the rotor)
 * @param {number} [a.setbackM]         distance kept from the boundary, at least the keep-out radius
 * @param {number} [a.azimuthDeg]       the row axis, 0 is east-west rows
 * @param {number[][][]} [a.exclusions]  areas no turbine's keep-out circle may touch, [lat, lon] rings
 * @returns {null | { turbines:{ n:number, lat:number, lon:number, exclusion:number[][] }[],
 *   stats:{ count:number, needCount:number, short:boolean, rotorM:number, hubM:number, keepoutRadiusM:number, rowStepM:number, colStepM:number, fitCount:number } }}
 *   null when the polygon is not a plot or count is not positive
 */
export function generateWindTurbines({ polygon, count, mwPerTurbine, hubM = 120, setbackM = 50, azimuthDeg = 0, exclusions = [] }) {
  if (!Array.isArray(polygon) || polygon.length < 3 || !(count > 0)) return null;
  const f = frameOf(polygon);
  const xy = polygon.map(f.toXY);
  const excl = (exclusions || []).filter((e) => Array.isArray(e) && e.length >= 3).map((e) => e.map(f.toXY));
  const D = rotorDiameterM(mwPerTurbine);
  const rowStep = DOWNWIND_D * D, colStep = CROSSWIND_D * D;
  const keepR = keepoutRadiusM(D);
  const margin = Math.max(Number(setbackM) || 0, keepR);
  const b = rad(azimuthDeg);
  const uv = [Math.cos(b), Math.sin(b)];   // along a row
  const fv = [-Math.sin(b), Math.cos(b)];  // rows apart
  const toST = (p) => [p[0] * uv[0] + p[1] * uv[1], p[0] * fv[0] + p[1] * fv[1]];
  const fromST = (q) => [q[0] * uv[0] + q[1] * fv[0], q[0] * uv[1] + q[1] * fv[1]];
  const poly = xy.map(toST);
  const exclST = excl.map((e) => e.map(toST));
  const smin = Math.min(...poly.map((p) => p[0])), smax = Math.max(...poly.map((p) => p[0]));
  const tmin = Math.min(...poly.map((p) => p[1])), tmax = Math.max(...poly.map((p) => p[1]));

  const candidates = [];
  for (let t = tmin + margin; t <= tmax - margin; t += rowStep) {
    for (let s = smin + margin; s <= smax - margin; s += colStep) {
      const pt = [s, t];
      if (!circleInside(pt, keepR, poly)) continue;
      if (exclST.some((e) => circleTouchesPoly(pt, keepR, e))) continue;
      candidates.push(pt);
    }
  }
  const placed = [];
  for (const c of candidates) {
    if (placed.length >= count) break;
    if (placed.every((p) => Math.hypot(p[0] - c[0], p[1] - c[1]) >= colStep * 0.98)) placed.push(c);
  }

  const turbines = placed.map((c, i) => { const [lat, lon] = f.toLL(fromST(c)); return turbineAt(lat, lon, D, i + 1); });
  return {
    turbines,
    stats: { count: turbines.length, needCount: count, short: turbines.length < count, rotorM: D, hubM, keepoutRadiusM: keepR, rowStepM: rowStep, colStepM: colStep, fitCount: candidates.length },
  };
}

/**
 * The collector cable: the shortest network joining every turbine to the
 * connection point (a minimum spanning tree), each run straight unless it
 * would cross an obstacle (the solar field), in which case it goes round the
 * obstacle's nearest corner. Indicative: the real route follows the access
 * roads.
 * @param {{lat:number, lon:number}[]} turbines
 * @param {{lat:number, lon:number}} connection
 * @param {number[][][]} [obstacles]  [lat, lon] rings no cable may cross
 * @returns {{ lines: number[][][], lengthM: number }}
 */
export function collectorCables(turbines, connection, obstacles = []) {
  if (!turbines?.length || !connection) return { lines: [], lengthM: 0 };
  const f = frameAt(connection.lat, connection.lon);
  const nodes = [[connection.lat, connection.lon], ...turbines.map((t) => [t.lat, t.lon])].map(f.toXY);
  const obs = (obstacles || []).filter((o) => Array.isArray(o) && o.length >= 3).map((o) => o.map(f.toXY));
  // each obstacle's corners, pushed 8 m outward from its centre, as the way round it
  const corners = obs.flatMap((o) => {
    const cx = o.reduce((s, p) => s + p[0], 0) / o.length, cy = o.reduce((s, p) => s + p[1], 0) / o.length;
    return o.map((p) => { const dx = p[0] - cx, dy = p[1] - cy, d = Math.hypot(dx, dy) || 1; return [p[0] + (dx / d) * 8, p[1] + (dy / d) * 8]; });
  });
  const crosses = (a, b) => obs.some((o) => {
    if (pointInPoly([(a[0] + b[0]) / 2, (a[1] + b[1]) / 2], o)) return true;
    for (let i = 0; i < o.length; i++) if (segmentsCross(a, b, o[i], o[(i + 1) % o.length])) return true;
    return false;
  });
  const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
  // the run between two nodes: straight, or the shortest way round the obstacles' corners (Dijkstra),
  // as many corners as it takes; a run from a point on an obstacle's edge to its far side needs two
  const run = (a, b) => {
    if (!crosses(a, b)) return { len: dist(a, b), path: [a, b] };
    const pts = [a, ...corners, b];
    const N = pts.length, d = new Array(N).fill(Infinity), prev = new Array(N).fill(-1), done = new Array(N).fill(false);
    d[0] = 0;
    for (;;) {
      let u = -1;
      for (let i = 0; i < N; i++) if (!done[i] && d[i] < Infinity && (u < 0 || d[i] < d[u])) u = i;
      if (u < 0 || u === N - 1) break;
      done[u] = true;
      for (let v = 0; v < N; v++) {
        if (done[v]) continue;
        const nd = d[u] + dist(pts[u], pts[v]);
        if (nd < d[v] && !crosses(pts[u], pts[v])) { d[v] = nd; prev[v] = u; }
      }
    }
    if (!(d[N - 1] < Infinity)) return { len: dist(a, b), path: [a, b] };
    const path = [];
    for (let v = N - 1; v >= 0; v = prev[v]) path.unshift(pts[v]);
    return { len: d[N - 1], path };
  };
  // Prim's algorithm from the connection point
  const n = nodes.length;
  const inTree = new Array(n).fill(false);
  const bestRun = new Array(n).fill(null);
  inTree[0] = true;
  for (let i = 1; i < n; i++) bestRun[i] = { from: 0, ...run(nodes[0], nodes[i]) };
  const lines = [];
  let lengthM = 0;
  for (let k = 1; k < n; k++) {
    let pick = -1;
    for (let i = 1; i < n; i++) if (!inTree[i] && (pick < 0 || bestRun[i].len < bestRun[pick].len)) pick = i;
    inTree[pick] = true;
    lines.push(bestRun[pick].path.map(f.toLL));
    lengthM += bestRun[pick].len;
    for (let i = 1; i < n; i++) {
      if (inTree[i]) continue;
      const r = run(nodes[pick], nodes[i]);
      if (r.len < bestRun[i].len) bestRun[i] = { from: pick, ...r };
    }
  }
  return { lines, lengthM };
}
