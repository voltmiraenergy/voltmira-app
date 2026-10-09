// lib/siteLayout.js — an indicative layout of a fixed-tilt solar plant on a
// plot the user has outlined: the panel tables in rows, the inverter stations
// in the service aisles, the medium-voltage cable along the aisles and one
// access corridor to the grid connection point. It answers what a bank's
// technical adviser asks first: does the plant fit on the land it says it has,
// and how much cable does it need to reach the grid. Pure; no I/O.
//
// THE RULES (every one is stated on the page):
//  - A module's area is its rating over 21.5% efficiency at 1,000 W/m2, taken
//    as a 2:1 rectangle; a table is two modules high (portrait) and 26 wide.
//  - The row pitch leaves no row shading the next at solar noon on 21
//    December: pitch = L (cos t + sin t / tan e), L the slope length of the
//    table, t the tilt, e = 90 - latitude - 23.44 degrees (never below 5).
//  - Tables stay 5 m inside the boundary and 0.6 m apart along a row.
//  - One 6 m corridor runs across the rows at the connection point; no table
//    stands in it.
//  - Rows are taken from the connection side until the module count is
//    reached; the plot's whole capacity (as many tables as fit) is reported
//    next to what the plant needs.
//  - One inverter station (6 x 2.4 m) per group of rows, in the aisle behind
//    the middle row of its group; its cable runs along the aisle to the
//    corridor and along the corridor to the connection point.
//  - A single-axis tracker has no fixed tilt: its rows run north-south and
//    its pitch is set from a ground-cover ratio target (0.40 by default,
//    typical of a single-axis tracker array) instead of the shading rule.
// The layout is indicative and is not a design drawing. The geometry is worked
// in metres on a flat frame around the plot's centre, then set back on the globe.

const R_EARTH = 6371008.8;
const rad = (d) => (d * Math.PI) / 180;

export const MODULE_EFF = 0.215;
export const TABLE_MODULES_WIDE = 26;
export const TABLE_MODULES_HIGH = 2;
export const TABLE_GAP_M = 0.6;
export const SETBACK_M = 5;
export const CORRIDOR_M = 6;
export const STATION_M = { along: 6, across: 2.4 };
/** Land beyond the tables' footprint: roads, stations, the corridor, the fence line. */
export const LAND_ALLOWANCE = 1.12;
export const MAX_PLOT_HA = 5000;
/** A single-axis tracker's target ground-cover ratio (collector width / pitch); typical range and the default this module assumes. */
export const TRACKER_GCR_RANGE = [0.2, 0.6];
export const TRACKER_GCR_DEFAULT = 0.4;

/** A module's long and short side in metres from its rating (2:1). */
export function moduleSides(wp) {
  const area = Math.max(wp, 100) / (MODULE_EFF * 1000);
  const L = Math.sqrt(2 * area);
  return { long: L, short: L / 2, area };
}

/**
 * The table and row geometry for a rating, a tilt and a latitude. A tracker
 * ignores the tilt and the shading rule: its rows run north-south (set by
 * `generateLayout`, which forces the frame's axis for a tracker) and its
 * pitch is the collector's width over the ground-cover ratio target.
 * @returns {{ widthM:number, slopeM:number, depthM:number, pitchM:number, stepM:number, modules:number, kwp:number, gcr:number, sunElevDeg:number|null, moduleLongM:number, moduleShortM:number, tracker:boolean }}
 */
export function tableGeometry(wp, tiltDeg, latDeg, { wide = TABLE_MODULES_WIDE, high = TABLE_MODULES_HIGH, tracker = false, trackerGcr = TRACKER_GCR_DEFAULT } = {}) {
  const m = moduleSides(wp);
  const slope = high * m.long;
  const width = wide * m.short;
  const modules = wide * high;
  if (tracker) {
    const gcr = Math.min(TRACKER_GCR_RANGE[1], Math.max(TRACKER_GCR_RANGE[0], Number(trackerGcr) || TRACKER_GCR_DEFAULT));
    const pitch = slope / gcr;
    return { widthM: width, slopeM: slope, depthM: slope, pitchM: pitch, stepM: width + TABLE_GAP_M, modules, kwp: (modules * wp) / 1000, gcr, sunElevDeg: null, moduleLongM: m.long, moduleShortM: m.short, tracker: true };
  }
  const t = rad(Math.min(60, Math.max(0, tiltDeg)));
  const elev = Math.max(5, 90 - Math.abs(latDeg) - 23.44);
  const pitch = slope * (Math.cos(t) + Math.sin(t) / Math.tan(rad(elev)));
  return {
    widthM: width, slopeM: slope, depthM: slope * Math.cos(t), pitchM: Math.max(pitch, slope * Math.cos(t) + 0.5), stepM: width + TABLE_GAP_M,
    modules, kwp: (modules * wp) / 1000, gcr: slope / Math.max(pitch, 0.01), sunElevDeg: elev, moduleLongM: m.long, moduleShortM: m.short, tracker: false,
  };
}

/**
 * The land the tables need before any plot is drawn: tables, footprint and
 * hectares with the allowance for roads and stations.
 */
export function landNeed({ moduleCount, wp, tiltDeg, latDeg, wide, high, tracker, trackerGcr }) {
  const g = tableGeometry(wp, tiltDeg, latDeg, { wide, high, tracker, trackerGcr });
  const tables = Math.ceil(moduleCount / g.modules);
  return { tables, ha: (tables * g.stepM * g.pitchM * LAND_ALLOWANCE) / 1e4, pitchM: g.pitchM, gcr: g.gcr, modulesPerTable: g.modules };
}

// ---- plane geometry (metres, any frame)
const cross = (ax, ay, bx, by) => ax * by - ay * bx;
export function pointInPoly(p, poly) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i], [xj, yj] = poly[j];
    if ((yi > p[1]) !== (yj > p[1]) && p[0] < ((xj - xi) * (p[1] - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}
function segmentsCross(a, b, c, d) {
  const d1 = cross(b[0] - a[0], b[1] - a[1], c[0] - a[0], c[1] - a[1]);
  const d2 = cross(b[0] - a[0], b[1] - a[1], d[0] - a[0], d[1] - a[1]);
  const d3 = cross(d[0] - c[0], d[1] - c[1], a[0] - c[0], a[1] - c[1]);
  const d4 = cross(d[0] - c[0], d[1] - c[1], b[0] - c[0], b[1] - c[1]);
  return d1 * d2 < 0 && d3 * d4 < 0;
}
const inRect = (p, r) => p[0] >= r.s0 && p[0] <= r.s1 && p[1] >= r.t0 && p[1] <= r.t1;
/** Whether a rectangle lies wholly inside a polygon: its corners inside and no polygon edge through it. */
function rectInside(r, poly) {
  const c = [[r.s0, r.t0], [r.s1, r.t0], [r.s1, r.t1], [r.s0, r.t1]];
  if (!c.every((p) => pointInPoly(p, poly))) return false;
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i], b = poly[(i + 1) % poly.length];
    if (inRect(a, r)) return false;
    for (let k = 0; k < 4; k++) if (segmentsCross(a, b, c[k], c[(k + 1) % 4])) return false;
  }
  return true;
}
/** Whether a rectangle and a polygon share any ground. */
function rectTouches(r, poly) {
  const c = [[r.s0, r.t0], [r.s1, r.t0], [r.s1, r.t1], [r.s0, r.t1]];
  if (c.some((p) => pointInPoly(p, poly))) return true;
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i], b = poly[(i + 1) % poly.length];
    if (inRect(a, r)) return true;
    for (let k = 0; k < 4; k++) if (segmentsCross(a, b, c[k], c[(k + 1) % 4])) return true;
  }
  return false;
}
const areaOf = (poly) => Math.abs(poly.reduce((a, p, i) => { const q = poly[(i + 1) % poly.length]; return a + (p[0] * q[1] - q[0] * p[1]); }, 0)) / 2;

/** Whether two polygons, in the same flat frame, share any ground: a vertex of one inside the other, or an edge crossing. */
export function polygonsOverlap(a, b) {
  if (a.some((p) => pointInPoly(p, b)) || b.some((p) => pointInPoly(p, a))) return true;
  for (let i = 0; i < a.length; i++) {
    const p1 = a[i], p2 = a[(i + 1) % a.length];
    for (let j = 0; j < b.length; j++) if (segmentsCross(p1, p2, b[j], b[(j + 1) % b.length])) return true;
  }
  return false;
}

/** A flat metre frame around a polygon of [lat, lon] points: to and from the globe. */
function frameOf(ll) {
  const lat0 = ll.reduce((a, p) => a + p[0], 0) / ll.length, lon0 = ll.reduce((a, p) => a + p[1], 0) / ll.length;
  const ky = (R_EARTH * Math.PI) / 180, kx = ky * Math.cos(rad(lat0));
  return { lat0, lon0, toXY: (p) => [(p[1] - lon0) * kx, (p[0] - lat0) * ky], toLL: (p) => [lat0 + p[1] / ky, lon0 + p[0] / kx] };
}

/** The area of a polygon of [lat, lon] points, hectares. */
export function plotHectares(ll) {
  if (!Array.isArray(ll) || ll.length < 3) return 0;
  const f = frameOf(ll);
  return areaOf(ll.map(f.toXY)) / 1e4;
}

/**
 * @param {object} a
 * @param {number[][]} a.polygon     the plot, [lat, lon] points (3 or more)
 * @param {number} a.moduleCount     the modules the plant needs
 * @param {number} a.wp              the rating of a module, Wp
 * @param {number} a.tiltDeg         fixed tilt
 * @param {number} a.azimuthDeg      0 is south, -90 east, 90 west
 * @param {number} [a.stations]      inverter stations wanted (at least 1)
 * @param {{lat:number, lon:number}|null} [a.target]  where the grid is, to put the corridor on the near side
 * @param {number[][][]} [a.exclusions]  areas no table may stand on (a pond, a road, a line corridor), [lat, lon] rings
 * @param {number} [a.setbackM]   distance kept from the boundary and from every exclusion
 * @param {number} [a.wide]       modules along a table
 * @param {number} [a.high]       modules up a table (portrait)
 * @param {boolean} [a.tracker]   a single-axis tracker: rows forced north-south, pitch from `trackerGcr`, `tiltDeg` ignored
 * @param {number} [a.trackerGcr] the tracker's target ground-cover ratio
 * @returns {null | {
 *   tables:{ corners:number[][], row:number }[], stations:{ corners:number[][], center:number[], n:number }[],
 *   cables:number[][][], connection:{ lat:number, lon:number },
 *   stats:{ plotHa:number, needTables:number, placedTables:number, fitTables:number, modulesPlaced:number, mwpPlaced:number, mwpFit:number, mwpNeed:number, short:boolean,
 *     pitchM:number, gcr:number, widthM:number, depthM:number, rows:number, cableM:number, landNeedHa:number, setbackM:number, tiltDeg:number, azimuthDeg:number, modulesPerTable:number, tracker:boolean }
 * }} null when the polygon is not a plot (under 3 points, no area, or over 5,000 ha)
 */
export function generateLayout({ polygon, moduleCount, wp = 440, tiltDeg = 35, azimuthDeg = 0, stations = 1, target = null, exclusions = [], setbackM = SETBACK_M, wide = TABLE_MODULES_WIDE, high = TABLE_MODULES_HIGH, tracker = false, trackerGcr = TRACKER_GCR_DEFAULT }) {
  if (!Array.isArray(polygon) || polygon.length < 3 || !(moduleCount > 0)) return null;
  const f = frameOf(polygon);
  const xy = polygon.map(f.toXY);
  const plotM2 = areaOf(xy);
  if (!(plotM2 > 100) || plotM2 > MAX_PLOT_HA * 1e4) return null;

  const geo = tableGeometry(wp, tiltDeg, f.lat0, { wide, high, tracker, trackerGcr });
  const SB = Math.min(50, Math.max(0, Number(setbackM) || 0));
  // a tracker's rows run north-south regardless of the stored facing
  const axisDeg = tracker ? 90 : azimuthDeg;
  const b = rad(180 + axisDeg);
  const fv = [Math.sin(b), Math.cos(b)];     // the way the panels face
  const uv = [-Math.cos(b), Math.sin(b)];    // along a row
  const toST = (p) => [p[0] * uv[0] + p[1] * uv[1], p[0] * fv[0] + p[1] * fv[1]];
  const fromST = (q) => [q[0] * uv[0] + q[1] * fv[0], q[0] * uv[1] + q[1] * fv[1]];
  const poly = xy.map(toST);
  const excl = (exclusions || []).filter((e) => Array.isArray(e) && e.length >= 3).map((e) => e.map(f.toXY).map(toST));
  const smin = Math.min(...poly.map((p) => p[0])), smax = Math.max(...poly.map((p) => p[0]));
  const tmin = Math.min(...poly.map((p) => p[1])), tmax = Math.max(...poly.map((p) => p[1]));

  const needTables = Math.ceil(moduleCount / geo.modules);
  const stepS = geo.stepM, pitch = geo.pitchM, depth = geo.depthM, wT = geo.widthM;

  // the table grid that fits the most tables, tried at nine offsets
  const gridAt = (os, ot) => {
    const out = [];
    for (let j = 0, t = tmin + ot * pitch; t + depth + SB <= tmax; j++, t += pitch) {
      for (let i = 0, s = smin + os * stepS; s + wT + SB <= smax; i++, s += stepS) {
        const r = { s0: s, s1: s + wT, t0: t, t1: t + depth, j, i };
        const inflated = { s0: r.s0 - SB, s1: r.s1 + SB, t0: r.t0 - SB, t1: r.t1 + SB };
        if (rectInside(inflated, poly) && !excl.some((e) => rectTouches(inflated, e))) out.push(r);
      }
    }
    return out;
  };
  let best = [];
  for (const os of [0, 1 / 3, 2 / 3]) for (const ot of [0, 1 / 3, 2 / 3]) { const g = gridAt(os, ot); if (g.length > best.length) best = g; }

  // the corridor to the connection point: on the side the grid is, clear of tables
  const targetST = target && Number.isFinite(target.lat) && Number.isFinite(target.lon) ? toST(f.toXY([target.lat, target.lon])) : null;
  const sLo = best.length ? Math.min(...best.map((r) => r.s0)) : smin, sHi = best.length ? Math.max(...best.map((r) => r.s1)) : smax;
  const sc = targetST ? Math.min(sHi, Math.max(sLo, targetST[0])) : (sLo + sHi) / 2;
  const cLo = sc - CORRIDOR_M / 2, cHi = sc + CORRIDOR_M / 2;
  const free = best.filter((r) => r.s1 <= cLo || r.s0 >= cHi);

  // where the corridor meets the boundary on the connection side
  const crossings = [];
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i], c = poly[(i + 1) % poly.length];
    if ((a[0] - sc) * (c[0] - sc) < 0) crossings.push(a[1] + ((sc - a[0]) / (c[0] - a[0])) * (c[1] - a[1]));
  }
  const wantT = targetST ? targetST[1] : tmin - 1;
  const tEnd = crossings.length ? crossings.reduce((p, q) => (Math.abs(q - wantT) < Math.abs(p - wantT) ? q : p)) : tmin;

  // rows, nearest the connection point first; the last row is filled from the corridor outwards
  const rows = new Map();
  for (const r of free) { if (!rows.has(r.j)) rows.set(r.j, []); rows.get(r.j).push(r); }
  const order = [...rows.keys()].sort((x, y) => Math.abs(rows.get(x)[0].t0 - tEnd) - Math.abs(rows.get(y)[0].t0 - tEnd) || x - y);
  const placed = [];
  for (const j of order) {
    if (placed.length >= needTables) break;
    const row = rows.get(j).sort((p, q) => p.s0 - q.s0);
    const take = needTables - placed.length;
    const chosen = row.length <= take ? row : [...row].sort((p, q) => Math.abs((p.s0 + p.s1) / 2 - sc) - Math.abs((q.s0 + q.s1) / 2 - sc)).slice(0, take).sort((p, q) => p.s0 - q.s0);
    placed.push(...chosen);
  }
  const usedRows = [...new Set(placed.map((r) => r.j))].sort((p, q) => p - q);

  // inverter stations: contiguous groups of rows, each in the aisle behind its middle row
  // a plot that holds only part of the plant carries only that part's stations
  const share = placed.length >= needTables ? 1 : placed.length / needTables;
  const nSt = Math.max(1, Math.min(Math.round((Number(stations) || 1) * share), usedRows.length || 1));
  const perRow = usedRows.map((j) => placed.filter((r) => r.j === j));
  const total = placed.length;
  const groups = [];
  let acc = 0, cur = [];
  perRow.forEach((row, k) => {
    cur.push(row); acc += row.length;
    const target1 = (total * (groups.length + 1)) / nSt;
    if ((acc >= target1 - 1e-9 && groups.length < nSt - 1) || k === perRow.length - 1) { groups.push(cur); cur = []; }
  });
  const stationList = [], cablesST = [];
  const half = { a: STATION_M.along / 2, c: STATION_M.across / 2 };
  groups.forEach((g, n) => {
    if (!g.length) return;
    let run = 0, mid = 0;
    const want = g.reduce((a, r) => a + r.length, 0) / 2;
    for (let k = 0; k < g.length; k++) { run += g[k].length; if (run >= want) { mid = k; break; } }
    const row = g[mid];
    const rsum = [...row].sort((p, q) => p.s0 - q.s0);
    let s = rsum.length ? (rsum[Math.floor(rsum.length / 2)].s0 + rsum[Math.floor(rsum.length / 2)].s1) / 2 : sc;
    // out of the corridor, which stays clear for the cable and for vehicles
    if (Math.abs(s - sc) < CORRIDOR_M / 2 + half.a) s = sc + (s >= sc ? 1 : -1) * (CORRIDOR_M / 2 + half.a + 0.5);
    const t = row[0].t0 + depth + (pitch - depth) / 2;
    stationList.push({ n: n + 1, st: [s, t] });
    cablesST.push([[s, t], [sc, t], [sc, tEnd]]);
  });

  // the cable length: each aisle run, and the corridor once from the farthest station to the connection point
  const tS = stationList.map((x) => x.st[1]);
  const aisleM = stationList.reduce((a, x) => a + Math.abs(x.st[0] - sc), 0);
  const corridorM = tS.length ? Math.max(...tS.map((t) => Math.abs(t - tEnd))) : 0;
  const cableM = aisleM + corridorM;

  const ll = (q) => f.toLL(fromST(q));
  const tablesOut = placed.map((r) => ({ row: r.j, corners: [[r.s0, r.t0], [r.s1, r.t0], [r.s1, r.t1], [r.s0, r.t1]].map(ll) }));
  const stationsOut = stationList.map((x) => ({
    n: x.n, center: ll(x.st),
    corners: [[x.st[0] - half.a, x.st[1] - half.c], [x.st[0] + half.a, x.st[1] - half.c], [x.st[0] + half.a, x.st[1] + half.c], [x.st[0] - half.a, x.st[1] + half.c]].map(ll),
  }));
  const conn = ll([sc, tEnd]);
  const mwp = (n) => (n * geo.kwp) / 1000;
  return {
    tables: tablesOut, stations: stationsOut, cables: cablesST.map((c) => c.map(ll)), connection: { lat: conn[0], lon: conn[1] },
    stats: {
      plotHa: plotM2 / 1e4, needTables, placedTables: placed.length, fitTables: free.length, modulesPlaced: placed.length * geo.modules,
      mwpPlaced: mwp(placed.length), mwpFit: mwp(free.length), mwpNeed: (moduleCount * wp) / 1e6, short: free.length < needTables,
      pitchM: pitch, gcr: geo.gcr, widthM: wT, depthM: depth, rows: usedRows.length, cableM, landNeedHa: (needTables * stepS * pitch * LAND_ALLOWANCE) / 1e4,
      setbackM: SB, tiltDeg, azimuthDeg: tracker ? null : azimuthDeg, modulesPerTable: geo.modules, kwpPerTable: geo.kwp, tracker,
    },
  };
}

/** The most corners a plot outline keeps. */
export const MAX_CORNERS = 80;

const ring = (b) => (Array.isArray(b) ? b.slice(0, MAX_CORNERS).map((p) => (Array.isArray(p) ? [Number(p[0]), Number(p[1])] : null))
  .filter((p) => p && Number.isFinite(p[0]) && Number.isFinite(p[1]) && Math.abs(p[0]) <= 85 && Math.abs(p[1]) <= 180)
  .map((p) => [Math.round(p[0] * 1e6) / 1e6, Math.round(p[1] * 1e6) / 1e6]) : []);

/** What an exclusion zone is, for its label. */
export const EXCLUSION_KINDS = ["building", "water", "road", "line", "trees", "other"];
/** The table formats offered: modules up the table x modules along it. */
export const TABLE_FORMATS = [{ high: 2, wide: 26 }, { high: 2, wide: 13 }, { high: 3, wide: 20 }, { high: 1, wide: 30 }];

/**
 * The stored plan, cleaned: the plots (3 to 80 corners each, up to 12), the
 * exclusion zones with their kind, the table format and the setback. An older
 * plan with one `boundary` is read as one plot. null when no plot remains.
 * @param {any} x
 * @returns {null | { plots:number[][][], exclusions:{ring:number[][], kind:string}[], high:number, wide:number, setbackM:number, trackerGcr:number }}
 */
export function normalizeLayout(x) {
  if (!x || typeof x !== "object") return null;
  const raw = Array.isArray(x.plots) ? x.plots : x.boundary ? [x.boundary] : [];
  const plots = raw.slice(0, 12).map(ring).filter((r) => r.length >= 3);
  if (!plots.length) return null;
  const exclusions = (Array.isArray(x.exclusions) ? x.exclusions : []).slice(0, 60)
    .map((e) => ({ ring: ring(e?.ring), kind: EXCLUSION_KINDS.includes(e?.kind) ? e.kind : "other" })).filter((e) => e.ring.length >= 3);
  const fmt = TABLE_FORMATS.find((t) => t.high === Number(x.high) && t.wide === Number(x.wide)) || TABLE_FORMATS[0];
  const sb = Number(x.setbackM);
  const tg = Number(x.trackerGcr);
  return {
    plots, exclusions, high: fmt.high, wide: fmt.wide,
    setbackM: Number.isFinite(sb) && x.setbackM !== "" && x.setbackM != null ? Math.min(50, Math.max(0, sb)) : SETBACK_M,
    trackerGcr: Number.isFinite(tg) && x.trackerGcr !== "" && x.trackerGcr != null ? Math.min(TRACKER_GCR_RANGE[1], Math.max(TRACKER_GCR_RANGE[0], tg)) : TRACKER_GCR_DEFAULT,
  };
}
