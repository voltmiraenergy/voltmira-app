// lib/roofLayout.js — fits real, physical panels into a drawn roof plane,
// skipping its obstacles, instead of assuming a rooftop can hold whatever a
// kW target implies (lib/supplierCatalog.js's autoBom: kw*1000/panelWatt).
// Pure geometry, no I/O. A local equirectangular projection (fine at roof
// scale — tens of meters, not kilometers) turns the plane's lat/lon ring
// into meters; a grid of panel-sized rectangles (+ spacing) aligned to the
// plane's own longest edge is then tested against the polygon and its
// obstacles. No geometry library: this matches the codebase's style of
// small, dependency-free lib/ modules (lib/stringDesign.js, lib/leadSizing.js)
// rather than pulling in turf.js for one function.

import { shadowReach } from "./siteLayout.js";

const EARTH_R = 6371000; // meters, mean radius — plenty accurate at roof scale
const EPS = 1e-9; // guards grid-loop boundaries against float noise from the
                   // degrees<->meters round trip, so an exact-fit edge isn't
                   // dropped by a stray 1e-13 rounding error

// Exported so a caller that already has a plane's real geometry (a proposal
// snapshot, frozen once at send-time — see lib/actions.js createProposal) can
// project it into the SAME local meters fitPanels() uses internally, without
// duplicating this formula. Local equirectangular projection: fine at roof
// scale, not meant for anything bigger.
export function project(latlngs, originLat, originLon) {
  const cosLat = Math.cos(originLat * Math.PI / 180);
  return latlngs.map(([lat, lon]) => [
    (lon - originLon) * Math.PI / 180 * EARTH_R * cosLat,
    (lat - originLat) * Math.PI / 180 * EARTH_R,
  ]);
}

export function unproject(xy, originLat, originLon) {
  const cosLat = Math.cos(originLat * Math.PI / 180);
  return xy.map(([x, y]) => [
    originLat + (y / EARTH_R) * 180 / Math.PI,
    originLon + (x / (EARTH_R * cosLat)) * 180 / Math.PI,
  ]);
}

function centroid(ring) {
  let sx = 0, sy = 0;
  for (const [x, y] of ring) { sx += x; sy += y; }
  return [sx / ring.length, sy / ring.length];
}

// Ray-casting point-in-polygon.
function pointInPolygon([px, py], ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i], [xj, yj] = ring[j];
    const intersect = ((yi > py) !== (yj > py))
      && (px < (xj - xi) * (py - yi) / (yj - yi) + xi);
    if (intersect) inside = !inside;
  }
  return inside;
}

/** A drawn roof plane's real area in m², via the shoelace formula on the
 * same local projection fitPanels uses — so a proposal can print the actual
 * measured roof instead of the flat kw*5.5 rule of thumb. */
export function polygonAreaM2(ring) {
  if (!Array.isArray(ring) || ring.length < 3) return 0;
  const originLat = ring[0][0], originLon = ring[0][1];
  const xy = project(ring, originLat, originLon);
  let sum = 0;
  for (let i = 0, j = xy.length - 1; i < xy.length; j = i++) {
    sum += xy[j][0] * xy[i][1] - xy[i][0] * xy[j][1];
  }
  return Math.abs(sum) / 2;
}

// Standard 8-point compass, translated. PVGIS's own convention (aspect: 0 =
// south, -90 = east, 90 = west, ±180 = north) drives the tilt/azimuth values
// a plane is drawn with, so the label rotates that onto a normal compass
// heading rather than inventing a separate direction.
const COMPASS = [
  { ro: "Nord", en: "North", ru: "Север", uk: "Північ" },
  { ro: "Nord-Est", en: "Northeast", ru: "Северо-восток", uk: "Північний схід" },
  { ro: "Est", en: "East", ru: "Восток", uk: "Схід" },
  { ro: "Sud-Est", en: "Southeast", ru: "Юго-восток", uk: "Південний схід" },
  { ro: "Sud", en: "South", ru: "Юг", uk: "Південь" },
  { ro: "Sud-Vest", en: "Southwest", ru: "Юго-запад", uk: "Південний захід" },
  { ro: "Vest", en: "West", ru: "Запад", uk: "Захід" },
  { ro: "Nord-Vest", en: "Northwest", ru: "Северо-запад", uk: "Північний захід" },
];

/** e.g. compassLabel(-30, "ro") -> "Sud-Vest" */
export function compassLabel(azimuthDeg, lang) {
  const heading = ((azimuthDeg + 180) % 360 + 360) % 360;
  const idx = Math.round(heading / 45) % 8;
  return COMPASS[idx][lang] || COMPASS[idx].ro;
}

/** A roof side's real area on its slope: the area seen from above over cos(pitch). */
export function slopeAreaM2(ring, tiltDeg) {
  const t = Number(tiltDeg);
  return polygonAreaM2(ring) / (Number.isFinite(t) && t > 0 && t < 80 ? Math.cos((t * Math.PI) / 180) : 1);
}

// Two segments cross at a point inside both (touching or running along each other does not count).
function segmentsCross(a, b, c, d) {
  const o = (p, q, r) => (q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0]);
  const d1 = o(a, b, c), d2 = o(a, b, d), d3 = o(c, d, a), d4 = o(c, d, b);
  return ((d1 > EPS && d2 < -EPS) || (d1 < -EPS && d2 > EPS)) && ((d3 > EPS && d4 < -EPS) || (d3 < -EPS && d4 > EPS));
}
function segmentDist(p, a, b) {
  const dx = b[0] - a[0], dy = b[1] - a[1], L2 = dx * dx + dy * dy;
  const t = L2 ? Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / L2)) : 0;
  return Math.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dy);
}
// Whether any edge of one ring crosses any edge of the other.
function ringsCross(r1, r2) {
  for (let i = 0; i < r1.length; i++) {
    const a = r1[i], b = r1[(i + 1) % r1.length];
    for (let j = 0; j < r2.length; j++) if (segmentsCross(a, b, r2[j], r2[(j + 1) % r2.length])) return true;
  }
  return false;
}
// A polygon grown outward by `d` metres (a ring of [x, y] metres). Each corner moves along the bisector of its
// two edges, to the distance that puts both edges `d` out (a miter, capped at 3 d so a sharp corner cannot
// shoot out). Meant for a small obstacle: a vent, a chimney, a skylight; a concave one is only approximated.
export function inflateXY(ring, d) {
  if (!(d > 0) || !Array.isArray(ring) || ring.length < 3) return ring;
  let area = 0;
  for (let i = 0; i < ring.length; i++) { const p = ring[i], q = ring[(i + 1) % ring.length]; area += p[0] * q[1] - q[0] * p[1]; }
  const sgn = area >= 0 ? 1 : -1;    // counter-clockwise rings turn left
  const unit = (a, b) => { const x = b[0] - a[0], y = b[1] - a[1], L = Math.hypot(x, y) || 1; return [x / L, y / L]; };
  return ring.map((p, i) => {
    const prev = ring[(i - 1 + ring.length) % ring.length], next = ring[(i + 1) % ring.length];
    const e1 = unit(prev, p), e2 = unit(p, next);
    // outward normals of the two edges
    const n1 = [sgn * e1[1], -sgn * e1[0]], n2 = [sgn * e2[1], -sgn * e2[0]];
    const bx = n1[0] + n2[0], by = n1[1] + n2[1];
    const dot = n1[0] * n2[0] + n1[1] * n2[1];
    const k = Math.min(3, 1 / Math.max(0.05, Math.sqrt((1 + dot) / 2)));
    const bl = Math.hypot(bx, by) || 1;
    return [p[0] + (bx / bl) * d * k, p[1] + (by / bl) * d * k];
  });
}

// The convex hull of a set of [x, y] points (Andrew's monotone chain).
export function hullXY(points) {
  const pts = [...points].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  if (pts.length < 3) return pts;
  const cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lower = [];
  for (const p of pts) { while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) lower.pop(); lower.push(p); }
  const upper = [];
  for (const p of [...pts].reverse()) { while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) upper.pop(); upper.push(p); }
  return lower.slice(0, -1).concat(upper.slice(0, -1));
}

// Whether an outline crosses itself (two edges that are not neighbours cross).
function selfCrossing(ring) {
  const n = ring.length;
  for (let i = 0; i < n; i++) {
    for (let j = i + 2; j < n; j++) {
      if (i === 0 && j === n - 1) continue;
      if (segmentsCross(ring[i], ring[(i + 1) % n], ring[j], ring[(j + 1) % n])) return true;
    }
  }
  return false;
}

function pointInAABB([x, y], minX, minY, maxX, maxY) {
  return x >= minX - EPS && x <= maxX + EPS && y >= minY - EPS && y <= maxY + EPS;
}

function boundsOf(ring) {
  const xs = ring.map((p) => p[0]), ys = ring.map((p) => p[1]);
  return { minX: Math.min(...xs), maxX: Math.max(...xs), minY: Math.min(...ys), maxY: Math.max(...ys) };
}

// Splits one axis into panel-start offsets, breaking into gapped clusters
// once `maxPerCluster` tiles have been placed (0/falsy = one contiguous run,
// the original ungapped behaviour). Whole tiles only — a cluster boundary
// never lands mid-panel.
function buildAxisPositions(min, availableLen, tileLen, spacingM, maxPerCluster, clusterGapM) {
  const positions = [];
  let x = min, run = 0;
  while (x + tileLen <= min + availableLen + EPS) {
    positions.push(x);
    run++;
    if (maxPerCluster && run >= maxPerCluster) { x += tileLen + clusterGapM; run = 0; }
    else x += tileLen + spacingM;
  }
  return positions;
}

/**
 * Fit panel-sized rectangles into a roof plane polygon, skipping any that
 * overlap an obstacle.
 * @param {number[][]} planePolygon - ring of [lat,lon], 3+ points
 * @param {number[][][]} obstaclePolygons - array of rings, each [lat,lon][]
 * @param {number} panelWmm - panel width, mm
 * @param {number} panelHmm - panel height, mm
 * @param {object} [opts]
 * @param {number} [opts.spacingM=0.02] - gap between adjacent panels, meters (fallback for both axes)
 * @param {number} [opts.rowSpacingM] - gap between rows (up-slope axis), meters — defaults to spacingM
 * @param {number} [opts.colSpacingM] - gap within a row (ridge axis), meters — defaults to spacingM
 * @param {number} [opts.marginM=0.3] - clearance/setback kept from the plane's own edge, meters
 * @param {"portrait"|"landscape"|"auto"} [opts.orientation="portrait"] - "auto" tries both and keeps whichever fits more panels
 * @param {number} [opts.clusterMaxWidthM] - cap on contiguous panels along the ridge axis before a gap is inserted
 * @param {number} [opts.clusterMaxHeightM] - cap on contiguous panels up-slope before a gap is inserted
 * @param {number} [opts.clusterGapM=0] - gap inserted between clusters, meters
 * @param {number} [opts.tiltDeg] - the side's pitch: the outline is drawn from above, so the
 *   roof runs 1/cos(pitch) longer up the slope than it looks, and fits that many more rows
 * @param {number} [opts.rackTiltDeg] - for racks on a flat roof or the ground: the angle the panels stand at; each takes
 *   up L cos(tilt) of the roof in plan and the rows are spaced so none shades the next (tiltDeg is then 0)
 * @param {number} [opts.azimuthDeg] - which way the side faces (0 south, -90 east, 90 west):
 *   rows run across the slope even when the longest edge runs down it
 * @returns {{panels: number[][][], count: number, rows: {count:number, lengthM:number, rail1:number[][], rail2:number[][]}[]}}
 *   each panel as a [lat,lon] rectangle ring; `rows` groups the same panels
 *   by the row they were placed in (see lib/mountingEstimate.js, which reads
 *   this to compute real rail length and clamp counts from this same
 *   geometry, not a separate guess).
 */
export function fitPanels(planePolygon, obstaclePolygons, panelWmm, panelHmm, opts = {}) {
  if (!Array.isArray(planePolygon) || planePolygon.length < 3) return { panels: [], count: 0, rows: [] };
  if (!(panelWmm > 0) || !(panelHmm > 0)) return { panels: [], count: 0, rows: [] };

  if (opts.orientation === "auto") {
    const a = fitPanels(planePolygon, obstaclePolygons, panelWmm, panelHmm, { ...opts, orientation: "portrait" });
    const b = fitPanels(planePolygon, obstaclePolygons, panelWmm, panelHmm, { ...opts, orientation: "landscape" });
    return b.count > a.count ? b : a;
  }

  const spacingM = opts.spacingM ?? 0.02;
  const rowSpacingM = opts.rowSpacingM ?? spacingM; // up-slope, between rows
  const colSpacingM = opts.colSpacingM ?? spacingM; // along the ridge, within a row
  const marginM = opts.marginM ?? 0.3;
  const landscape = opts.orientation === "landscape";
  const pw = (landscape ? panelHmm : panelWmm) / 1000;
  const ph = (landscape ? panelWmm : panelHmm) / 1000;

  const originLat = planePolygon[0][0], originLon = planePolygon[0][1];
  const ring = project(planePolygon, originLat, originLon);
  // each obstacle is kept clear by `clearanceM` all round (a vent is not a place to fit a panel's edge to)
  const clearanceM = Number(opts.clearanceM) > 0 ? Number(opts.clearanceM) : 0;
  const obstacles = (Array.isArray(obstaclePolygons) ? obstaclePolygons : [])
    .map((o) => (Array.isArray(o) ? project(o, originLat, originLon) : []))
    .filter((o) => o.length >= 3)
    .map((o) => (clearanceM ? inflateXY(o, clearanceM) : o));
  // an outline that crosses itself encloses no roof to fill
  if (selfCrossing(ring)) return { panels: [], count: 0, rows: [] };

  // Align the grid to the plane's own longest edge, so rows run along the
  // roof rather than a fixed compass direction — closer to how panels are
  // actually racked on a sloped plane.
  let bestAngle = 0, bestLen = -1;
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i], b = ring[(i + 1) % ring.length];
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (len > bestLen) { bestLen = len; bestAngle = Math.atan2(b[1] - a[1], b[0] - a[0]); }
  }
  // With the facing known, rows must run across the slope: if the longest edge runs
  // down it (a deep, narrow side), take the longest edge within 30 degrees of the
  // ridge line instead, else the ridge line itself.
  const az = Number(opts.azimuthDeg);
  if (opts.azimuthDeg != null && Number.isFinite(az)) {
    const down = [-Math.sin((az * Math.PI) / 180), -Math.cos((az * Math.PI) / 180)];
    const across = (ang) => Math.abs(Math.cos(ang) * down[0] + Math.sin(ang) * down[1]) < 0.5;
    if (!across(bestAngle)) {
      let alt = null, altLen = -1;
      for (let i = 0; i < ring.length; i++) {
        const a = ring[i], b = ring[(i + 1) % ring.length];
        const len = Math.hypot(b[0] - a[0], b[1] - a[1]), ang = Math.atan2(b[1] - a[1], b[0] - a[0]);
        if (across(ang) && len > altLen) { altLen = len; alt = ang; }
      }
      bestAngle = alt != null ? alt : Math.atan2(-down[0], down[1]);
    }
  }
  // the grid's second axis runs up the slope; seen from above it is foreshortened by cos(pitch)
  const tilt = Number(opts.tiltDeg);
  const k = Number.isFinite(tilt) && tilt > 0 && tilt < 80 ? 1 / Math.cos((tilt * Math.PI) / 180) : 1;

  const [ocx, ocy] = centroid(ring);
  const cosA = Math.cos(bestAngle), sinA = Math.sin(bestAngle);
  // World -> grid (rotate by -bestAngle around the centroid, then stretch to true slope metres)
  const toGrid = ([x, y]) => {
    const dx = x - ocx, dy = y - ocy;
    return [dx * cosA + dy * sinA, (-dx * sinA + dy * cosA) * k];
  };
  // Grid -> world (back to the view from above, inverse rotation)
  const fromGrid = ([gx, gy0]) => { const gy = gy0 / k; return [ocx + gx * cosA - gy * sinA, ocy + gx * sinA + gy * cosA]; };

  const gridRing = ring.map(toGrid);
  const gridObstacles = obstacles.map((o) => o.map(toGrid));
  const b = boundsOf(gridRing);
  // Racks on a flat roof or the ground: the panels stand tilted on frames, so each takes up only L cos(tilt) of
  // the roof in plan, and the rows must stand far enough apart that none shades the next (the same rule the plant
  // planner uses, lib/siteLayout.js: no shade between 10:00 and 14:00 on 21 December). Packed edge to edge, as on a
  // pitched roof, a flat roof was given about two thirds more panels than it can hold.
  const rackT = Number(opts.rackTiltDeg);
  const rack = Number.isFinite(rackT) && rackT > 0 && rackT < 80;
  const rackRad = rack ? (rackT * Math.PI) / 180 : 0;
  const phG = rack ? ph * Math.cos(rackRad) : ph;
  const rowGapM = rack ? Math.max(rowSpacingM, ph * (Math.cos(rackRad) + Math.sin(rackRad) * shadowReach(originLat, opts.azimuthDeg ?? 0, 2).k) - phG) : rowSpacingM;
  const stepX = pw + colSpacingM, stepY = phG + rowGapM;
  const minX = b.minX + marginM, maxX = b.maxX - marginM;
  const minY = b.minY + marginM, maxY = b.maxY - marginM;

  // Cluster caps are given in meters along each axis; converted to a whole-
  // panel count so a cluster boundary can never bisect a panel.
  const maxColsPerCluster = opts.clusterMaxWidthM > 0 ? Math.max(1, Math.floor((opts.clusterMaxWidthM + colSpacingM) / stepX)) : 0;
  const maxRowsPerCluster = opts.clusterMaxHeightM > 0 ? Math.max(1, Math.floor((opts.clusterMaxHeightM + rowGapM) / stepY)) : 0;
  const clusterGapM = Math.max(0, opts.clusterGapM || 0);
  // The grid starts at the plane's corner; with obstacles on the roof a few other starting points are tried too
  // (the grid shifted by a fraction of a panel each way) and the one that keeps the most panels is used, so three
  // vents do not cost a whole column each. A roof without obstacles keeps the one start it always had.
  const shifts = gridObstacles.length ? [[0, 0], [0.5, 0], [0, 0.5], [0.5, 0.5], [0.25, 0.25], [0.75, 0.25], [0.25, 0.75], [0.75, 0.75]] : [[0, 0]];
  let placedBest = null;
  for (const [sx, sy] of shifts) {
    const got = placeGrid(sx * stepX, sy * stepY);
    if (!placedBest || got.panelsGrid.length > placedBest.panelsGrid.length) placedBest = got;
  }
  const { panelsGrid, rowsGrid } = placedBest;

  function placeGrid(dx, dy) {
  const xPositions = buildAxisPositions(minX + dx, maxX - minX - dx, pw, colSpacingM, maxColsPerCluster, clusterGapM);
  const yPositions = buildAxisPositions(minY + dy, maxY - minY - dy, phG, rowGapM, maxRowsPerCluster, clusterGapM);

  const panelsGrid = [];
  const rowsGrid = []; // one entry per row that placed at least one panel
  for (const gy of yPositions) {
    const placedGxs = [];
    for (const gx of xPositions) {
      const corners = [[gx, gy], [gx + pw, gy], [gx + pw, gy + phG], [gx, gy + phG]];
      // Ray-casting treats a point exactly ON an edge as ambiguous (often
      // "outside"), which would reject an exact-fit panel whose corner lands
      // precisely on the plane's own boundary. Nudge each corner a fraction
      // of a millimeter toward the panel's own center before testing
      // containment — negligible for real corners, but resolves that edge
      // case without ever admitting a corner that's actually outside.
      const cx = gx + pw / 2, cy = gy + phG / 2;
      const testCorners = corners.map(([x, y]) => [x + Math.sign(cx - x) * 1e-4, y + Math.sign(cy - y) * 1e-4]);
      if (!testCorners.every((c) => pointInPolygon(c, gridRing))) continue;
      // the setback from every edge, slanted ones too (the bounds above only keep it from the straight ones)
      if (marginM > 0 && corners.some((c) => gridRing.some((a, i) => segmentDist(c, a, gridRing[(i + 1) % gridRing.length]) < marginM - 1e-6))) continue;
      // a notch in the outline: a roof corner inside the panel, or an edge cutting through it
      if (gridRing.some(([x, y]) => x > gx + 1e-6 && x < gx + pw - 1e-6 && y > gy + 1e-6 && y < gy + phG - 1e-6)) continue;
      if (ringsCross(corners, gridRing)) continue;
      const hitsObstacle = gridObstacles.some((o) => {
        // a thin strip (a ridge vent, a cable run) crosses the panel without a corner inside either
        if (ringsCross(corners, o)) return true;
        if (corners.some((c) => pointInPolygon(c, o))) return true;
        if (pointInPolygon([gx + pw / 2, gy + phG / 2], o)) return true;
        // A small obstacle fully inside one panel cell touches none of that
        // panel's corners and isn't hit by a center-point test either unless
        // it happens to cover the center — catch that case from the other
        // side: any obstacle vertex landing inside this panel's cell.
        return o.some((oc) => pointInAABB(oc, gx, gy, gx + pw, gy + phG));
      });
      if (hitsObstacle) continue;
      panelsGrid.push(corners);
      placedGxs.push(gx);
    }
    if (placedGxs.length) {
      // Rail run spans the row's full placed extent, bridging any internal
      // gap left by a mid-row obstacle — a real rail is a continuous piece
      // of stock, not cut around one skipped panel, so this is the
      // conservative (never-under-estimates) length, same rounding
      // direction as lib/batteryBackup.js's own stated convention.
      const left = Math.min(...placedGxs), right = Math.max(...placedGxs) + pw;
      rowsGrid.push({
        count: placedGxs.length,
        lengthM: right - left,
        // Two rail lines per row, near its two long edges (gy and gy+phG) —
        // the standard portrait/landscape rail-racking layout, not specific
        // to one manufacturer.
        rail1: [[left, gy], [right, gy]].map(fromGrid),
        rail2: [[left, gy + phG], [right, gy + phG]].map(fromGrid),
      });
    }
  }
  return { panelsGrid, rowsGrid };
  }

  const panels = panelsGrid.map((corners) => unproject(corners.map(fromGrid), originLat, originLon));
  const rows = rowsGrid.map((r) => ({
    count: r.count,
    lengthM: Math.round(r.lengthM * 100) / 100,
    rail1: unproject(r.rail1, originLat, originLon),
    rail2: unproject(r.rail2, originLat, originLon),
  }));
  return { panels, count: panels.length, rows };
}

/**
 * Keep at most `limit` of the panels fitted on a roof's sides: the sides
 * facing nearest south first, each side's rows in the order they were
 * fitted. A row cut short keeps rails only under the panels it keeps. What
 * the quote sells is what the designer, the rail estimate and the offer's
 * drawings show; the places left over come back as `spare`.
 * @param {{panels:number[][][], rows:object[], count:number, azimuthDeg?:number}[]} fits  fitPanels() per side, with the side's azimuth
 * @param {number} limit  panels to keep; 0, negative or missing keeps them all
 * @returns {{panels:number[][][], rows:object[], count:number, spare:number[][][]}[]}  in the same order as `fits`
 */
export function limitPanels(fits, limit) {
  const list = Array.isArray(fits) ? fits : [];
  let left = Number(limit) > 0 ? Math.floor(Number(limit)) : Infinity;
  const metres = (a, b) => {
    const k = Math.PI / 180;
    return Math.hypot((b[1] - a[1]) * k * EARTH_R * Math.cos(((a[0] + b[0]) / 2) * k), (b[0] - a[0]) * k * EARTH_R);
  };
  const out = new Array(list.length);
  const order = list.map((f, i) => ({ f, i })).sort((a, b) => Math.abs(Number(a.f.azimuthDeg) || 0) - Math.abs(Number(b.f.azimuthDeg) || 0) || a.i - b.i);
  for (const { f, i } of order) {
    const panels = Array.isArray(f.panels) ? f.panels : [];
    const keep = Math.max(0, Math.min(panels.length, left));
    left -= keep;
    if (keep === panels.length) { out[i] = { ...f, count: keep, spare: [] }; continue; }
    // the panels are listed row by row, so a row's panels are the next `count` of them
    const rows = [];
    let at = 0;
    for (const r of f.rows || []) {
      if (at >= keep) break;
      const m = Math.min(r.count, keep - at);
      if (m === r.count) rows.push(r);
      else {
        const first = panels[at], last = panels[at + m - 1];
        rows.push({ count: m, lengthM: Math.round(metres(first[0], last[1]) * 100) / 100, rail1: [first[0], last[1]], rail2: [first[3], last[2]] });
      }
      at += r.count;
    }
    out[i] = { ...f, panels: panels.slice(0, keep), rows, count: keep, spare: panels.slice(keep) };
  }
  return out;
}

/**
 * Which way a drawn roof plane most likely faces, as a PVGIS azimuth (0 =
 * south, -90 = east, 90 = west, ±180 = north). A plane is normally drawn
 * with its eave or ridge as the longest edge, and the slope runs at right
 * angles to that edge; of the two ways it could run, the one nearer south is
 * taken, since that is the side a roof gets panels on. Rounded to 5°. Only a
 * starting point: the installer confirms it in Site Designer.
 * @param {number[][]} ring - [lat,lon] ring, 3+ points
 * @returns {number|null}
 */
export function facingFromShape(ring) {
  if (!Array.isArray(ring) || ring.length < 3) return null;
  const xy = project(ring, ring[0][0], ring[0][1]);
  let best = null, bestLen = 0;
  for (let i = 0; i < xy.length; i++) {
    const a = xy[i], b = xy[(i + 1) % xy.length];
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (len > bestLen) { bestLen = len; best = [b[0] - a[0], b[1] - a[1]]; }
  }
  if (!best || bestLen < 0.01) return null;
  const toAzimuth = ([x, y]) => {
    const heading = (Math.atan2(x, y) * 180) / Math.PI; // 0 = north, 90 = east
    let az = heading - 180;
    while (az <= -180) az += 360;
    while (az > 180) az -= 360;
    return az;
  };
  const a1 = toAzimuth([best[1], -best[0]]);
  const a2 = toAzimuth([-best[1], best[0]]);
  const az = Math.abs(a1) <= Math.abs(a2) ? a1 : a2;
  const r = Math.round(az / 5) * 5;
  return r === -180 ? 180 : r || 0;
}

/**
 * Site Designer's saved settings (siteDesign.layout) as fitPanels options, so
 * the designer, the quote's rail estimate and the proposal's roof drawing all
 * fit panels the same way. Missing or implausible values fall back to the
 * defaults fitPanels itself uses (portrait, 2 cm gaps, 30 cm from the edge).
 */
export function fitOptions(saved) {
  const s = saved && typeof saved === "object" ? saved : {};
  const cm = (v, max, dflt) => { const n = Number(v); return v !== "" && v != null && Number.isFinite(n) && n >= 0 && n <= max ? n / 100 : dflt; };
  const m = (v, max) => { const n = Number(v); return Number.isFinite(n) && n > 0 && n <= max ? n : 0; };
  return {
    orientation: ["portrait", "landscape", "auto"].includes(s.orientation) ? s.orientation : "portrait",
    rowSpacingM: cm(s.rowSpacingCm, 20, 0.02),
    colSpacingM: cm(s.colSpacingCm, 20, 0.02),
    marginM: cm(s.setbackCm, 100, 0.3),
    clusterMaxWidthM: m(s.clusterMaxW, 30),
    clusterMaxHeightM: m(s.clusterMaxH, 30),
    clusterGapM: m(s.clusterGap, 10),
    // the distance kept round a vent, a chimney or a skylight; roofs drawn before it existed have none
    clearanceM: cm(s.obstacleClearanceCm, 50, 0),
  };
}

// ---------------------------------------------------------------------------------------------------
// What stands on a roof, and what it shades. Obstacles are placed in one click from a preset (a vent, a
// pipe, a chimney, a skylight), each with its real size and height; a higher roof level shades the lower
// one beside it. A shadow here is a ground shadow thrown due north at noon at the equinox (sun
// elevation 90 - latitude): a plain, stated rule, not a shading simulation. Winter and the morning and
// evening are worse, and the offer does not claim otherwise.
// ---------------------------------------------------------------------------------------------------

/** The roof types where the panels stand on racks (the pitch is then the racks' angle, not the roof's). */
export const RACK_ROOFS = ["flat", "ground"];

/** The obstacles that can be set down with one click: size in metres and height above the roof surface. */
export const OBSTACLE_PRESETS = {
  vent:     { w: 0.3,  h: 0.3,  height: 0.4 },
  pipe:     { d: 0.16, height: 0.5 },
  chimney:  { w: 0.6,  h: 0.6,  height: 1.0 },
  skylight: { w: 1.0,  h: 1.3,  height: 0.1 },
};
/** The height an obstacle drawn by hand is assumed to have, by kind (a tree and "something else" none). */
export const OBSTACLE_HEIGHT_DEFAULT = { chimney: 1.0, vent: 0.4, pipe: 0.5, skylight: 0.1, dormer: 1.5, tree: 0, other: 0 };
/** Below this height a thing casts no shadow worth drawing, m. */
export const MIN_SHADE_HEIGHT_M = 0.3;

/** The sun's elevation on which the shade rule rests: the equinox, at noon. */
export const shadeElevationDeg = (latDeg) => Math.max(5, 90 - Math.abs(Number(latDeg) || 47));

/** The outline of a preset obstacle centred on a point, [lat, lon] corners (a pipe is a 12-sided circle). */
export function presetRing(kind, [lat, lon]) {
  const p = OBSTACLE_PRESETS[kind];
  if (!p) return null;
  const unitRing = p.d
    ? Array.from({ length: 12 }, (_, i) => [(Math.cos((i * Math.PI) / 6) * p.d) / 2, (Math.sin((i * Math.PI) / 6) * p.d) / 2])
    : [[-p.w / 2, -p.h / 2], [p.w / 2, -p.h / 2], [p.w / 2, p.h / 2], [-p.w / 2, p.h / 2]];
  return unproject(unitRing, lat, lon);
}

/** The obstacle's shadow on the roof beside it: the outline and the same outline moved north by `lengthM`, joined. */
export function shadowRing(ring, lengthM) {
  if (!Array.isArray(ring) || ring.length < 3 || !(lengthM > 0)) return null;
  const [lat0, lon0] = ring[0];
  const xy = project(ring, lat0, lon0);
  const hull = hullXY([...xy, ...xy.map(([x, y]) => [x, y + lengthM])]);
  return hull.length >= 3 ? unproject(hull, lat0, lon0) : null;
}

/**
 * Every outline a panel on one roof side must keep out of: the obstacles drawn, the shadow of each obstacle
 * that stands higher than MIN_SHADE_HEIGHT_M, and the shadow of every other roof side that is higher than
 * this one by that much.
 * @param {string} planeId
 * @param {{id:string, polygon:number[][], heightM?:number}[]} planes
 * @param {{polygon:number[][], kind?:string, heightM?:number}[]} obstacles
 * @returns {number[][][]} rings of [lat, lon]
 */
export function keepOutsFor(planeId, planes, obstacles) {
  const me = (planes || []).find((p) => p.id === planeId);
  const rings = [];
  for (const o of obstacles || []) {
    if (!Array.isArray(o?.polygon) || o.polygon.length < 3) continue;
    rings.push(o.polygon);
    // an obstacle drawn before heights existed has none recorded and casts no shadow: its roof keeps the panels it had
    const h = o.heightM == null || o.heightM === "" || !Number.isFinite(Number(o.heightM)) ? 0 : Number(o.heightM);
    if (h >= MIN_SHADE_HEIGHT_M) {
      const sh = shadowRing(o.polygon, h / Math.tan((shadeElevationDeg(o.polygon[0][0]) * Math.PI) / 180));
      if (sh) rings.push(sh);
    }
  }
  const myH = Number(me?.heightM) || 0;
  for (const p of planes || []) {
    if (!p || p.id === planeId || !Array.isArray(p.polygon) || p.polygon.length < 3) continue;
    const dh = (Number(p.heightM) || 0) - myH;
    if (dh >= MIN_SHADE_HEIGHT_M) {
      const sh = shadowRing(p.polygon, dh / Math.tan((shadeElevationDeg(p.polygon[0][0]) * Math.PI) / 180));
      if (sh) rings.push(sh);
    }
  }
  return rings;
}

/**
 * Fit panels on every side of a saved roof the same way everywhere (the designer, the quote's rail estimate,
 * the offer's drawing): obstacles with their clearance and shadows, the shade of a higher level, the
 * pitch's true slope, and the facing.
 * @param {{planes?:object[], obstacles?:object[], layout?:object}} siteDesign
 * @param {{w:number, h:number}} dims  the panel's width and height, mm
 * @returns {{id:string, polygon:number[][], tiltDeg:number, azimuthDeg:number, panels:number[][][], count:number, rows:object[]}[]}
 */
export function fitSidesFor(siteDesign, dims) {
  const planes = (Array.isArray(siteDesign?.planes) ? siteDesign.planes : []).filter((p) => Array.isArray(p?.polygon) && p.polygon.length >= 3);
  const obstacles = Array.isArray(siteDesign?.obstacles) ? siteDesign.obstacles : [];
  const opts = fitOptions(siteDesign?.layout);
  return planes.map((pl) => {
    // a flat roof or the ground holds panels on racks tilted at "the pitch"; any other roof is the pitch itself
    const racks = RACK_ROOFS.includes(pl.roofType);
    const fit = fitPanels(pl.polygon, keepOutsFor(pl.id, planes, obstacles), dims.h, dims.w, {
      ...opts, tiltDeg: racks ? 0 : Number(pl.tiltDeg) || 0, rackTiltDeg: racks ? Number(pl.tiltDeg) || 0 : 0, azimuthDeg: Number(pl.azimuthDeg) || 0,
    });
    return { id: pl.id, polygon: pl.polygon, tiltDeg: Number(pl.tiltDeg) || 0, azimuthDeg: Number(pl.azimuthDeg) || 0, ...fit };
  });
}
