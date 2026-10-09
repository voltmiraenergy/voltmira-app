// lib/windLayout.js — indicative turbine positions for a wind (or hybrid)
// plant's site plan: turbines set on a grid across the plot, spaced by the
// rotor diameter, each with a circular keep-out zone (the crane pad and the
// tip's fall-over distance) that becomes an exclusion for the solar table
// layout of a hybrid plant (lib/plantLayout.js joins the two). The rotor
// diameter is assumed from the turbine's rating at a generic specific-power
// figure, since the plant does not always give it. Indicative only: the
// turbine supplier's own layout and micrositing study govern. Pure; no I/O.
import { pointInPoly } from "./siteLayout.js";

const R_EARTH = 6371008.8;
const rad = (d) => (d * Math.PI) / 180;

/** A modern turbine's rated power per swept rotor area, assumed where the rotor diameter is not given. */
export const DEFAULT_SPECIFIC_POWER_W_M2 = 380;
/** Rows apart, and turbines along a row, in rotor diameters (a conventional wind-farm array spacing). */
export const DOWNWIND_D = 8;
export const CROSSWIND_D = 4;
/** The keep-out circle's margin over hub height plus rotor radius (a fall-over allowance). */
export const FALLOVER_MULT = 1.15;
const CIRCLE_POINTS = 16;

/** A turbine's rotor diameter, m, from its rating at the assumed specific power. */
export function rotorDiameterM(mwPerTurbine, specificPower = DEFAULT_SPECIFIC_POWER_W_M2) {
  const p = Math.max(0.05, Number(mwPerTurbine) || 0) * 1e6;
  return 2 * Math.sqrt(p / (Math.PI * Math.max(50, Number(specificPower) || DEFAULT_SPECIFIC_POWER_W_M2)));
}

/** The keep-out radius around a turbine: hub height plus rotor radius, with a fall-over margin. */
export function keepoutRadiusM(hubM, rotorM) {
  return (Math.max(10, Number(hubM) || 0) + rotorM / 2) * FALLOVER_MULT;
}

function frameOf(ll) {
  const lat0 = ll.reduce((a, p) => a + p[0], 0) / ll.length, lon0 = ll.reduce((a, p) => a + p[1], 0) / ll.length;
  const ky = (R_EARTH * Math.PI) / 180, kx = ky * Math.cos(rad(lat0));
  return { toXY: (p) => [(p[1] - lon0) * kx, (p[0] - lat0) * ky], toLL: (p) => [lat0 + p[1] / ky, lon0 + p[0] / kx] };
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
 * @param {object} a
 * @param {number[][]} a.polygon        the plot, [lat, lon] points (3 or more)
 * @param {number} a.count              turbines wanted on this plot
 * @param {number} a.mwPerTurbine       one turbine's rating, used to assume its rotor diameter
 * @param {number} [a.hubM]             hub height, m
 * @param {number} [a.setbackM]         distance kept from the boundary, at least the keep-out radius
 * @param {number} [a.azimuthDeg]       the row axis (perpendicular to the assumed prevailing wind), 0 is north-south rows
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
  const keepR = keepoutRadiusM(hubM, D);
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
    if (placed.every((p) => Math.hypot(p[0] - c[0], p[1] - c[1]) >= 2 * keepR * 0.98)) placed.push(c);
  }

  const ll = (q) => f.toLL(fromST(q));
  const circleRing = (c) => Array.from({ length: CIRCLE_POINTS }, (_, i) => {
    const a = (2 * Math.PI * i) / CIRCLE_POINTS;
    return ll([c[0] + Math.cos(a) * keepR, c[1] + Math.sin(a) * keepR]);
  });
  const turbines = placed.map((c, i) => { const [lat, lon] = ll(c); return { n: i + 1, lat, lon, exclusion: circleRing(c) }; });
  return {
    turbines,
    stats: { count: turbines.length, needCount: count, short: turbines.length < count, rotorM: D, hubM, keepoutRadiusM: keepR, rowStepM: rowStep, colStepM: colStep, fitCount: candidates.length },
  };
}
