import { test } from "node:test";
import assert from "node:assert/strict";
import { generateWindTurbines, rotorDiameterM, keepoutRadiusM, DOWNWIND_D, CROSSWIND_D } from "./windLayout.js";

const LAT = 46, LON = 28.5;
const KY = (6371008.8 * Math.PI) / 180, KX = KY * Math.cos((LAT * Math.PI) / 180);
const ll = ([x, y]) => [LAT + y / KY, LON + x / KX];
const xy = ([la, lo]) => [(lo - LON) * KX, (la - LAT) * KY];
const rect = (w, h) => [[-w / 2, -h / 2], [w / 2, -h / 2], [w / 2, h / 2], [-w / 2, h / 2]].map(ll);
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
const inPoly = (p, poly) => { let inside = false; for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) { const [xi, yi] = poly[i], [xj, yj] = poly[j]; if ((yi > p[1]) !== (yj > p[1]) && p[0] < ((xj - xi) * (p[1] - yi)) / (yj - yi) + xi) inside = !inside; } return inside; };

test("rotor diameter from rating, and the keep-out radius from hub height and rotor radius", () => {
  const d5 = rotorDiameterM(5);
  assert.ok(d5 > 100 && d5 < 160, `${d5}`);
  // a bigger turbine has a bigger rotor
  assert.ok(rotorDiameterM(10) > d5);
  const r = keepoutRadiusM(150, d5);
  assert.ok(Math.abs(r - (150 + d5 / 2) * 1.15) < 1e-9);
});

test("turbines are set out on a grid, each inside the plot with its full keep-out circle clear of the boundary", () => {
  const poly = rect(3000, 2000);
  const r = generateWindTurbines({ polygon: poly, count: 8, mwPerTurbine: 5, hubM: 150 });
  assert.equal(r.stats.count, 8);
  assert.equal(r.stats.short, false);
  const P = poly.map(xy);
  for (const t of r.turbines) {
    const c = xy([t.lat, t.lon]);
    assert.ok(inPoly(c, P));
    // every point of the drawn keep-out ring stays inside the plot too
    for (const p of t.exclusion) assert.ok(inPoly(xy(p), P));
  }
  // numbered in order, none on top of another
  assert.deepEqual(r.turbines.map((t) => t.n), [1, 2, 3, 4, 5, 6, 7, 8]);
  for (let i = 0; i < r.turbines.length; i++) for (let j = i + 1; j < r.turbines.length; j++) {
    assert.ok(dist(xy([r.turbines[i].lat, r.turbines[i].lon]), xy([r.turbines[j].lat, r.turbines[j].lon])) >= r.stats.keepoutRadiusM * 1.9);
  }
});

test("a plot too small for every turbine places what fits and says so", () => {
  const r = generateWindTurbines({ polygon: rect(400, 400), count: 8, mwPerTurbine: 5, hubM: 150 });
  assert.ok(r.stats.count < 8);
  assert.equal(r.stats.short, true);
  assert.equal(generateWindTurbines({ polygon: rect(50, 50), count: 1, mwPerTurbine: 5 }).turbines.length, 0);
});

test("a turbine's keep-out circle avoids a user-drawn exclusion zone", () => {
  const poly = rect(3000, 2000);
  const pond = rect(300, 300); // at the plot's centre
  const without = generateWindTurbines({ polygon: poly, count: 8, mwPerTurbine: 5, hubM: 150 });
  const withPond = generateWindTurbines({ polygon: poly, count: 8, mwPerTurbine: 5, hubM: 150, exclusions: [pond] });
  const Q = pond.map(xy);
  for (const t of withPond.turbines) assert.ok(!inPoly(xy([t.lat, t.lon]), Q));
  assert.ok(withPond.stats.fitCount <= without.stats.fitCount);
});

test("nothing without a plot or a positive count", () => {
  assert.equal(generateWindTurbines({ polygon: [[46, 28], [46, 29]], count: 4, mwPerTurbine: 5 }), null);
  assert.equal(generateWindTurbines({ polygon: rect(3000, 2000), count: 0, mwPerTurbine: 5 }), null);
});

test("the rotor and the array spacing used are the stated multiples", () => {
  const r = generateWindTurbines({ polygon: rect(3000, 2000), count: 2, mwPerTurbine: 5, hubM: 150 });
  assert.ok(Math.abs(r.stats.rowStepM - DOWNWIND_D * r.stats.rotorM) < 1e-6);
  assert.ok(Math.abs(r.stats.colStepM - CROSSWIND_D * r.stats.rotorM) < 1e-6);
});
