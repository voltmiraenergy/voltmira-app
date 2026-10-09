import { test } from "node:test";
import assert from "node:assert/strict";
import { layoutFor, ASSUMED_WP, ASSUMED_MVA } from "./plantLayout.js";
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
  assert.deepEqual(n.boundary[0], [46.123457, 28]);
  assert.equal(normalizeLayout({ boundary: Array.from({ length: 200 }, (_, i) => [46 + i * 1e-4, 28]) }).boundary.length, 80);
  assert.equal(normalizePlant(plant({ layout: { boundary: rect(300, 300) } })).layout.boundary.length, 4);
});

test("why there is no layout: no solar part, a tracker, no site", () => {
  assert.equal(layoutFor(normalizePlant({ id: "w", lat: LAT, lon: LON, wind: { mw: 20, turbines: 4 } })).reason, "no_solar");
  assert.equal(layoutFor(normalizePlant(plant({ equipment: { mounting: { kind: "tracker" } } }))).reason, "tracker");
  assert.equal(layoutFor(normalizePlant({ id: "s", solar: { mwp: 10, yieldKwhKwp: 1300 } })).reason, "no_site");
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
