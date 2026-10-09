import { test } from "node:test";
import assert from "node:assert/strict";
import { generateLayout, tableGeometry, landNeed, plotHectares, moduleSides, SETBACK_M, CORRIDOR_M } from "./siteLayout.js";

const LAT = 46, LON = 28.5;
const KY = (6371008.8 * Math.PI) / 180, KX = KY * Math.cos((LAT * Math.PI) / 180);
const ll = ([x, y]) => [LAT + y / KY, LON + x / KX];
const xy = ([la, lo]) => [(lo - LON) * KX, (la - LAT) * KY];
const rect = (w, h) => [[-w / 2, -h / 2], [w / 2, -h / 2], [w / 2, h / 2], [-w / 2, h / 2]].map(ll);
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
const inPoly = (p, poly) => { let inside = false; for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) { const [xi, yi] = poly[i], [xj, yj] = poly[j]; if ((yi > p[1]) !== (yj > p[1]) && p[0] < ((xj - xi) * (p[1] - yi)) / (yj - yi) + xi) inside = !inside; } return inside; };
const distToEdges = (p, poly) => Math.min(...poly.map((a, i) => { const b = poly[(i + 1) % poly.length]; const dx = b[0] - a[0], dy = b[1] - a[1]; const t = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / (dx * dx + dy * dy))); return Math.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dy); }));
const quadContains = (q, p) => { let sign = 0; for (let i = 0; i < 4; i++) { const a = q[i], b = q[(i + 1) % 4]; const c = (b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0]); if (c !== 0) { if (sign && Math.sign(c) !== sign) return false; sign = Math.sign(c); } } return true; };
const base = { moduleCount: 22727, wp: 440, tiltDeg: 25, azimuthDeg: 0, stations: 3 };

test("the table and the row: a 440 Wp module, 25 degrees, latitude 46", () => {
  const m = moduleSides(440);
  assert.ok(Math.abs(m.long / m.short - 2) < 1e-9);
  assert.ok(m.long > 1.9 && m.long < 2.2, `${m.long}`);
  const g = tableGeometry(440, 25, 46);
  assert.equal(g.modules, 52);
  assert.ok(Math.abs(g.kwp - 22.88) < 1e-9);
  assert.ok(Math.abs(g.sunElevDeg - 20.56) < 1e-9);
  // no row shades the next at solar noon on 21 December
  const shadowM = (g.slopeM * Math.sin((25 * Math.PI) / 180)) / Math.tan((g.sunElevDeg * Math.PI) / 180);
  assert.ok(Math.abs(g.pitchM - (g.depthM + shadowM)) < 1e-9);
  assert.ok(g.pitchM > 7.5 && g.pitchM < 9.5, `${g.pitchM}`);
  assert.ok(g.gcr > 0.4 && g.gcr < 0.55);
  // a steeper tilt needs more room; a lower latitude needs less
  assert.ok(tableGeometry(440, 35, 46).pitchM > g.pitchM);
  assert.ok(tableGeometry(440, 25, 36).pitchM < g.pitchM);
});

test("land need before any plot: about one hectare per MWp at this latitude", () => {
  const n = landNeed({ moduleCount: 45455, wp: 440, tiltDeg: 25, latDeg: 46 });
  assert.equal(n.tables, 875);
  assert.ok(n.ha > 17 && n.ha < 26, `${n.ha}`);
  assert.ok(plotHectares(rect(600, 500)) > 29.9 && plotHectares(rect(600, 500)) < 30.1);
  assert.equal(plotHectares([[1, 1]]), 0);
});

test("a plot that holds the plant: every table placed, inside the boundary and the setback, none on another", () => {
  const poly = rect(600, 500);
  const r = generateLayout({ ...base, polygon: poly });
  assert.equal(r.stats.placedTables, 438);
  assert.equal(r.stats.short, false);
  assert.ok(r.stats.fitTables >= 438);
  assert.equal(r.stats.modulesPlaced, 438 * 52);
  assert.ok(Math.abs(r.stats.mwpPlaced - (438 * 22.88) / 1000) < 1e-9);
  const P = poly.map(xy);
  for (const t of r.tables) {
    const c = t.corners.map(xy);
    for (const p of c) { assert.ok(inPoly(p, P)); assert.ok(distToEdges(p, P) >= SETBACK_M - 0.05, `${distToEdges(p, P)}`); }
  }
  // no table centre lies inside another table
  const quads = r.tables.map((t) => t.corners.map(xy));
  const centres = quads.map((q) => [(q[0][0] + q[2][0]) / 2, (q[0][1] + q[2][1]) / 2]);
  for (let i = 0; i < quads.length; i += 7) for (let j = 0; j < quads.length; j++) if (i !== j) assert.ok(!quadContains(quads[j], centres[i]), `${i} in ${j}`);
  // the table is as wide as the geometry says
  const g = tableGeometry(440, 25, LAT);
  assert.ok(Math.abs(dist(quads[0][0], quads[0][1]) - g.widthM) < 0.05);
  assert.ok(Math.abs(dist(quads[0][1], quads[0][2]) - g.depthM) < 0.05);
});

test("rows are a pitch apart, and run east to west for a plant facing south", () => {
  const r = generateLayout({ ...base, polygon: rect(600, 500) });
  const g = tableGeometry(440, 25, LAT);
  const q = r.tables.map((t) => t.corners.map(xy));
  // the long side of a table runs east-west
  assert.ok(Math.abs(q[0][0][1] - q[0][1][1]) < 0.05);
  const ys = [...new Set(q.map((c) => Math.round(c[0][1] * 10) / 10))].sort((a, b) => a - b);
  assert.equal(ys.length, r.stats.rows);
  for (let i = 1; i < ys.length; i++) assert.ok(Math.abs(ys[i] - ys[i - 1] - g.pitchM) < 0.2, `${ys[i] - ys[i - 1]}`);
});

test("a plot that is too small: the tables that fit are drawn and the shortfall is stated", () => {
  const r = generateLayout({ ...base, polygon: rect(200, 160) });
  assert.equal(r.stats.short, true);
  assert.equal(r.stats.placedTables, r.stats.fitTables);
  assert.ok(r.stats.placedTables > 0 && r.stats.placedTables < 438);
  assert.ok(r.stats.mwpFit < r.stats.mwpNeed);
  assert.ok(r.stats.landNeedHa > r.stats.plotHa);
  // a plot too small for one table, and a plot that is not one
  const tiny = generateLayout({ ...base, polygon: rect(30, 20) });
  assert.equal(tiny.tables.length, 0);
  assert.equal(tiny.stats.short, true);
  assert.equal(generateLayout({ ...base, polygon: [[46, 28.5], [46.001, 28.5]] }), null);
  assert.equal(generateLayout({ ...base, polygon: rect(10000, 10000) }), null, "over 500 ha is not a plot");
  assert.equal(generateLayout({ ...base, polygon: rect(600, 500), moduleCount: 0 }), null);
});

test("a west-facing plant has its rows running north to south, and every table is still inside", () => {
  const poly = rect(600, 500);
  const r = generateLayout({ ...base, azimuthDeg: 90, polygon: poly });
  const P = poly.map(xy);
  const q = r.tables.map((t) => t.corners.map(xy));
  assert.ok(Math.abs(q[0][0][0] - q[0][1][0]) < 0.05, "the long side runs north-south");
  for (const c of q) for (const p of c) assert.ok(inPoly(p, P) && distToEdges(p, P) >= SETBACK_M - 0.05);
  assert.equal(r.stats.placedTables, 438);
});

test("an L-shaped plot: no table stands in the notch", () => {
  const poly = [[-300, -250], [300, -250], [300, 0], [0, 0], [0, 250], [-300, 250]].map(ll);
  const r = generateLayout({ ...base, moduleCount: 15000, polygon: poly });
  const P = poly.map(xy);
  assert.ok(r.tables.length > 100);
  for (const t of r.tables) for (const p of t.corners.map(xy)) { assert.ok(inPoly(p, P)); assert.ok(distToEdges(p, P) >= SETBACK_M - 0.05); }
});

test("stations stand in the aisles, one per group of rows, and none on a table", () => {
  const r = generateLayout({ ...base, polygon: rect(600, 500) });
  assert.equal(r.stations.length, 3);
  assert.deepEqual(r.stations.map((s) => s.n), [1, 2, 3]);
  const quads = r.tables.map((t) => t.corners.map(xy));
  for (const s of r.stations) {
    const c = s.corners.map(xy);
    // the station's corners and centre are clear of every table
    for (const p of [...c, xy(s.center)]) for (const q of quads) assert.ok(!quadContains(q, p), "a station on a table");
  }
  // never more stations than rows
  const few = generateLayout({ ...base, polygon: rect(600, 500), moduleCount: 1500, stations: 40 });
  assert.ok(few.stations.length <= few.stats.rows);
  // a plot that holds a third of the plant carries about a third of the stations
  const part = generateLayout({ ...base, stations: 6, polygon: rect(260, 200) });
  assert.equal(part.stats.short, true);
  assert.ok(part.stations.length >= 1 && part.stations.length < 6, `${part.stations.length}`);
});

test("the cable: each station to the corridor and along it to a connection point on the boundary; the corridor is clear of tables", () => {
  const poly = rect(600, 500);
  const r = generateLayout({ ...base, polygon: poly });
  const P = poly.map(xy);
  assert.equal(r.cables.length, r.stations.length);
  const end = xy([r.connection.lat, r.connection.lon]);
  assert.ok(distToEdges(end, P) < 0.5, `connection ${distToEdges(end, P)} m from the boundary`);
  for (const c of r.cables) { assert.equal(c.length, 3); assert.ok(dist(xy(c[2]), end) < 0.01); }
  // the longest corridor leg, sampled, is free of tables
  const quads = r.tables.map((t) => t.corners.map(xy));
  const leg = r.cables.map((c) => [xy(c[1]), xy(c[2])]).sort((a, b) => dist(b[0], b[1]) - dist(a[0], a[1]))[0];
  for (let k = 0; k <= 40; k++) {
    const p = [leg[0][0] + ((leg[1][0] - leg[0][0]) * k) / 40, leg[0][1] + ((leg[1][1] - leg[0][1]) * k) / 40];
    for (const q of quads) assert.ok(!quadContains(q, p), "cable through a table");
  }
  assert.ok(r.stats.cableM > 100 && r.stats.cableM < 3000, `${r.stats.cableM}`);
  assert.ok(CORRIDOR_M > 0);
});

test("the connection is on the side the grid is", () => {
  const north = generateLayout({ ...base, polygon: rect(600, 500), target: { lat: LAT + 0.02, lon: LON } });
  const south = generateLayout({ ...base, polygon: rect(600, 500), target: { lat: LAT - 0.02, lon: LON } });
  assert.ok(north.connection.lat > LAT + 0.0015 && south.connection.lat < LAT - 0.0015);
  // the block is built from that side: the rows nearest the grid come first
  const meanLat = (r) => r.tables.reduce((a, t) => a + t.corners[0][0], 0) / r.tables.length;
  assert.ok(meanLat(north) > meanLat(south));
});
