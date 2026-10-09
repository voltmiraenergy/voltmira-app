import { test } from "node:test";
import assert from "node:assert/strict";
import { layoutFor, layoutPlots, autoPlot, layoutInputs, ASSUMED_WP, ASSUMED_MVA } from "./plantLayout.js";
import { rotorDiameterM, keepoutRadiusM } from "./windLayout.js";
import { normalizePlant } from "./plantFinance.js";
import { normalizeLayout } from "./siteLayout.js";
import { preflight } from "./preflight.js";
import { checkText } from "./preflightText.js";

const LAT = 46, LON = 28.5;
const KY = (6371008.8 * Math.PI) / 180, KX = KY * Math.cos((LAT * Math.PI) / 180);
const rect = (w, h) => [[-w / 2, -h / 2], [w / 2, -h / 2], [w / 2, h / 2], [-w / 2, h / 2]].map(([x, y]) => [LAT + y / KY, LON + x / KX]);
const plant = (extra = {}) => ({ id: "p", name: "P", lat: LAT, lon: LON, solar: { mwp: 10, yieldKwhKwp: 1300 }, ...extra });

test("the plot outline is kept only as a polygon of real coordinates", () => {
  assert.equal(normalizeLayout(null), null);
  assert.equal(normalizeLayout({ boundary: [[46, 28], [46.1, 28]] }), null);
  assert.equal(normalizeLayout({ boundary: [[46, 28], [46.1, 28], ["x", 3], [200, 5]] }), null, "bad points are dropped, and two are not a plot");
  const n = normalizeLayout({ boundary: [[46.1234567891, 28], [46.2, 28.1], [46.2, 28]] });
  assert.deepEqual(n.plots[0][0], [46.123457, 28]);
  assert.equal(normalizeLayout({ boundary: Array.from({ length: 200 }, (_, i) => [46 + i * 1e-4, 28]) }).plots[0].length, 80);
  assert.equal(normalizePlant(plant({ layout: { boundary: rect(300, 300) } })).layout.plots[0].length, 4);
});

test("why there is no layout: no solar part, no site; a tracker now gets one", () => {
  assert.equal(layoutFor(normalizePlant({ id: "w", lat: LAT, lon: LON, wind: { mw: 20, turbines: 4 } })).reason, "no_solar");
  assert.equal(layoutFor(normalizePlant({ id: "s", solar: { mwp: 10, yieldKwhKwp: 1300 } })).reason, "no_site");
  const trk = layoutFor(normalizePlant(plant({ equipment: { mounting: { kind: "tracker" } }, layout: { boundary: rect(300, 300) } })));
  assert.equal(trk.reason, null);
  assert.equal(trk.inputs.tracker, true);
  assert.ok(trk.result.tables.length > 0);
  assert.equal(trk.result.stats.tracker, true);
});

test("the inputs come from the equipment list; what is not entered is assumed and says so", () => {
  const bare = layoutFor(normalizePlant(plant()));
  assert.deepEqual(bare.assumed, { wp: true, tilt: true });
  assert.equal(bare.inputs.wp, ASSUMED_WP);
  assert.equal(bare.inputs.moduleCount, Math.round(10e6 / ASSUMED_WP));
  assert.equal(bare.inputs.tiltDeg, 35);
  assert.equal(bare.result, null, "no plot, no layout; only the land need");
  assert.ok(bare.need.ha > 8 && bare.need.ha < 20, `${bare.need.ha}`);
  // 10 MWp with no AC rating is taken as DC/AC 1.25: 8 MW over 4.4 MVA is two stations
  assert.equal(bare.inputs.stations, 2);
  const full = layoutFor(normalizePlant(plant({ equipment: { modules: { count: 25000, wp: 400 }, mounting: { kind: "fixed", tiltDeg: 20, azimuthDeg: -10 }, inverters: { count: 20, kw: 400 }, transformers: { count: 4, mva: 2 } } })));
  assert.deepEqual(full.assumed, { wp: false, tilt: false });
  assert.equal(full.inputs.moduleCount, 25000); assert.equal(full.inputs.wp, 400);
  assert.equal(full.inputs.tiltDeg, 20); assert.equal(full.inputs.azimuthDeg, -10);
  assert.equal(full.inputs.stations, 4, "8 MW of inverters over 2 MVA transformers");
  assert.ok(ASSUMED_MVA > 0);
});

test("with a plot: the layout is drawn, and a plot that is too small raises the pre-send check", () => {
  const ok = layoutFor(normalizePlant(plant({ layout: { boundary: rect(600, 500) } })));
  assert.ok(ok.result.tables.length > 0 && !ok.result.stats.short);
  assert.equal(ok.result.stats.placedTables, ok.need.tables);
  const small = normalizePlant(plant({ layout: { boundary: rect(220, 180) }, equipment: { modules: { count: 22727, wp: 440 } } }));
  const lay = layoutFor(small);
  assert.equal(lay.result.stats.short, true);
  const f = preflight({ plant: small, todayKey: "2026-10-09" }).find((x) => x.id === "layout_small");
  assert.ok(f && f.fit < f.need);
  for (const lang of ["en", "ro", "ru", "uk"]) {
    const t = checkText({ level: "check", ...f }, lang);
    assert.ok(t && !/\{\w+\}/.test(t), `${lang}: ${t}`);
  }
  // a plot that holds it raises nothing
  assert.ok(!preflight({ plant: plant({ layout: { boundary: rect(600, 500) } }), todayKey: "2026-10-09" }).some((x) => x.id === "layout_small"));
});

test("the grid connection the plant is planned to reach decides the side of the corridor", () => {
  const near = (dLat) => normalizePlant(plant({ layout: { boundary: rect(600, 500) },
    grid: { at: { lat: LAT, lon: LON }, fetched: "2026-10-09", substations: [{ id: "s1", lat: LAT + dLat, lon: LON, cls: "110", kv: [110], km: 3 }], lines: [], paths: [], choice: { kind: "sub", id: "s1", cls: "110" } } }));
  const n = layoutFor(near(0.02)), s = layoutFor(near(-0.02));
  assert.ok(n.inputs.target && n.inputs.target.lat > LAT, JSON.stringify(n.inputs.target));
  assert.ok(n.result.connection.lat > LAT && s.result.connection.lat < LAT);
});

const shift = (ring, dx) => ring.map(([la, lo]) => [la, lo + dx / KX]);

test("the stored plan: several plots, exclusion zones with their kind, a table format from the list, a setback in range", () => {
  const n = normalizeLayout({ plots: [rect(300, 300), [[1, 2]], rect(100, 100)], exclusions: [{ ring: rect(40, 40), kind: "water" }, { ring: rect(10, 10), kind: "lava" }, { ring: [] }], high: 3, wide: 20, setbackM: 80 });
  assert.equal(n.plots.length, 2, "a plot with one corner is dropped");
  assert.deepEqual(n.exclusions.map((e) => e.kind), ["water", "other"]);
  assert.equal(n.high, 3); assert.equal(n.wide, 20);
  assert.equal(n.setbackM, 50);
  const d = normalizeLayout({ plots: [rect(300, 300)], high: 7, wide: 9 });
  assert.equal(d.high, 2); assert.equal(d.wide, 26); assert.equal(d.setbackM, 5);
  assert.equal(normalizeLayout({ plots: [] }), null);
});

test("an exclusion zone has no table on it, and the setback holds around it", () => {
  const pond = rect(160, 120);
  const lay = layoutFor(normalizePlant(plant({ layout: { plots: [rect(600, 500)], exclusions: [{ ring: pond, kind: "water" }] } })));
  const P = pond.map(([la, lo]) => [(lo - LON) * KX, (la - LAT) * KY]);
  const inside = (p) => p[0] > P[0][0] - 5 && p[0] < P[1][0] + 5 && p[1] > P[0][1] - 5 && p[1] < P[2][1] + 5;
  for (const t of lay.result.tables) for (const c of t.corners) assert.ok(!inside([(c[1] - LON) * KX, (c[0] - LAT) * KY]), "a table on the pond");
  const without = layoutFor(normalizePlant(plant({ layout: { plots: [rect(600, 500)] } })));
  assert.ok(lay.result.stats.fitTables < without.result.stats.fitTables);
});

test("two plots: the one nearer the grid fills first, the other takes the rest, and a cable joins them", () => {
  const near = rect(300, 300), far = shift(rect(300, 300), 900);
  const grid = { at: { lat: LAT, lon: LON }, fetched: "2026-10-09", substations: [{ id: "s1", lat: LAT, lon: LON - 0.03, cls: "110", kv: [110], km: 2 }], lines: [], paths: [], choice: { kind: "sub", id: "s1", cls: "110" } };
  const lay = layoutFor(normalizePlant(plant({ layout: { plots: [far, near] }, grid })));
  const r = lay.result;
  assert.equal(r.stats.plotCount, 2);
  assert.equal(r.plots[0].k, 1, "the plot nearer the grid comes first");
  assert.ok(r.plots[0].stats.placedTables === r.plots[0].stats.fitTables, "the near plot is filled");
  assert.equal(r.stats.placedTables, r.stats.needTables);
  assert.equal(r.links.length, 1);
  assert.ok(r.stats.linkM > 700 && r.stats.linkM < 1300, `${r.stats.linkM}`);
  assert.ok(r.stats.cableM > r.stats.linkM);
  // stations are numbered across the plots
  assert.deepEqual(r.stations.map((s) => s.n), r.stations.map((_, i) => i + 1));
});

test("a smaller table format packs differently but still places every module it needs", () => {
  const a = layoutFor(normalizePlant(plant({ layout: { plots: [rect(600, 500)], high: 2, wide: 26 } })));
  const b = layoutFor(normalizePlant(plant({ layout: { plots: [rect(600, 500)], high: 3, wide: 20 } })));
  assert.equal(a.result.stats.modulesPerTable, 52); assert.equal(b.result.stats.modulesPerTable, 60);
  assert.ok(a.result.stats.modulesPlaced >= a.inputs.moduleCount && b.result.stats.modulesPlaced >= b.inputs.moduleCount);
  assert.ok(b.result.stats.pitchM > a.result.stats.pitchM, "a taller table casts a longer shadow");
});

const hybrid = (extra = {}) => plant({ wind: { mw: 40, turbines: 8, hubM: 150 }, ...extra });

test("a hybrid's turbines are placed with the solar tables, and their keep-out circles clear the ground for the tables", () => {
  const poly = rect(3000, 2000);
  const lay = layoutFor(normalizePlant(hybrid({ layout: { plots: [poly] } })));
  const r = lay.result;
  assert.equal(r.turbines.length, 8);
  assert.equal(r.stats.needTurbines, 8);
  assert.equal(r.stats.turbinesShort, false);
  assert.ok(r.stats.rotorM > 100);
  assert.deepEqual(r.turbines.map((t) => t.n), [1, 2, 3, 4, 5, 6, 7, 8]);
  // no table stands inside a turbine's keep-out circle
  const dist = (a, b) => { const k = Math.PI / 180; const x = (b[1] - a[1]) * k * Math.cos(((a[0] + b[0]) / 2) * k), y = (b[0] - a[0]) * k; return Math.hypot(x, y) * 6371008.8; };
  for (const t of r.turbines) for (const tbl of r.tables) for (const c of tbl.corners) assert.ok(dist([t.lat, t.lon], c) >= r.stats.keepoutRadiusM ? true : dist([t.lat, t.lon], c) >= r.stats.rotorM * 1.5, `table too close to turbine ${t.n}`);
  // a wind-only plant (no wind input) places no turbines
  const solarOnly = layoutFor(normalizePlant(plant({ layout: { plots: [poly] } })));
  assert.equal(solarOnly.result.turbines.length, 0);
});

test("a plot too small for every turbine reports the shortfall", () => {
  const lay = layoutFor(normalizePlant(hybrid({ layout: { plots: [rect(500, 500)] } })));
  assert.ok(lay.result.turbines.length < 8);
  assert.equal(lay.result.stats.turbinesShort, true);
});

test("autoPlot sizes a rectangle around the site for the solar need, widened to also hold the wind turbines", () => {
  const solarOnly = autoPlot(normalizePlant(plant()));
  assert.ok(solarOnly.plots.length === 1 && solarOnly.plots[0].length === 4);
  const hyb = autoPlot(normalizePlant(hybrid()));
  const { site, inputs } = layoutInputs(normalizePlant(hybrid()));
  const D = rotorDiameterM(inputs.wind.mwPerTurbine), keepR = keepoutRadiusM(inputs.wind.hubM, D);
  const kx = (6371008.8 * Math.PI / 180) * Math.cos((site.lat * Math.PI) / 180), ky = (6371008.8 * Math.PI) / 180;
  const w = (Math.max(...hyb.plots[0].map((p) => p[1])) - Math.min(...hyb.plots[0].map((p) => p[1]))) * kx;
  const h = (Math.max(...hyb.plots[0].map((p) => p[0])) - Math.min(...hyb.plots[0].map((p) => p[0]))) * ky;
  assert.ok(w > 4 * D && h > 4 * D, `${w} x ${h}, D=${D}`);
  // the turbines placed on it are at or near the full count asked for
  const r = layoutPlots(hyb.plots, [], inputs);
  assert.ok(r.turbines.length >= inputs.wind.count - 1, `${r.turbines.length} of ${inputs.wind.count}`);
  assert.ok(keepR > 0);
  assert.equal(autoPlot(normalizePlant({ id: "w", wind: { mw: 20, turbines: 4 } })), null, "no solar part");
  assert.equal(autoPlot(normalizePlant({ id: "s", solar: { mwp: 10, yieldKwhKwp: 1300 } })), null, "no site");
});
