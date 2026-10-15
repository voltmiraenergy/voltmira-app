import { test } from "node:test";
import assert from "node:assert/strict";
import { circuitMw, lineLoss, compareOptions, connectionGroups, withOption, CONDUCTORS, DEFAULT_CONDUCTOR } from "./gridOptions.js";
import { keepGrid, parseGrid } from "./gridNear.js";
import { evaluatePlant, normalizePlant } from "./plantFinance.js";
import { crossingsQuery, parseCrossings, sampleRoute, routeKey, kindOf, crossingCounts } from "./gridCrossings.js";
import { permitItem, permitProgress, gridSteps, GRID_STEPS } from "./plantPermits.js";
import { stillMissing, missingLine, permitCsv } from "./bankPack.js";
import { JSON_FIXTURE } from "./gridTestData.js";
import { defaultEngineSettings } from "../engine/engine.js";

const E = { ...defaultEngineSettings(), horizon: 25 };
const AT = { lat: 45.95, lon: 28.33 };
const grid = (o = {}) => ({ ...keepGrid(parseGrid(JSON_FIXTURE, AT), AT, "2026-10-04"), ...o });
const PLANT = {
  id: "p1", name: "Park", lat: AT.lat, lon: AT.lon,
  wind: { mw: 40, turbines: 8, hubM: 150, study: { p50Mwh: 128000, p90Mwh: 112000 } },
  solar: { mwp: 20, yieldKwhKwp: 1250 },
  revenue: { kind: "auction", priceEurMwh: 62.04, years: 15, afterEurMwh: 50 },
  costs: { windEurPerKw: 1200, solarEurPerKw: 500, gridEur: 2000000, devPct: 3, opexWindEurPerKwYr: 35, opexSolarEurPerKwYr: 10 },
};
const FIN = { gearingPct: 65, ratePct: 6.5, tenorYears: 15 };
const COSTS = { hv: { perKm: 400000, sub: 3000000, tap: 6000000 }, 110: { perKm: 100000, sub: 500000, tap: 1500000 }, 35: { perKm: 50000, sub: 150000, tap: 400000 } };

test("what one circuit carries: sqrt(3) x kV x A x 0.95", () => {
  // 110 kV on AC-185 (510 A): about 92 MW; 35 kV on AC-120 (390 A): about 22 MW
  assert.ok(Math.abs(circuitMw(110, "AC-185") - Math.sqrt(3) * 110 * 0.51 * 0.95) < 1e-9);
  assert.ok(circuitMw(110, "AC-185") > 90 && circuitMw(110, "AC-185") < 95);
  assert.ok(circuitMw(35, "AC-120") > 22 && circuitMw(35, "AC-120") < 23);
  assert.equal(circuitMw(110, "nonsense"), null);
  for (const c of Object.values(DEFAULT_CONDUCTOR)) assert.ok(CONDUCTORS[c]);
});

test("line losses: three phases of I squared R at the peak, spread by the loss-load factor", () => {
  const l = lineLoss({ mw: 60, cf: 0.29, kv: 110, km: 7, conductor: "AC-185" });
  const amps = 60e6 / (Math.sqrt(3) * 110e3 * 0.95);
  const peakKw = (3 * amps * amps * 0.1591 * 7) / 1000;
  assert.ok(Math.abs(l.peakKw - peakKw) < 1e-6);
  const llf = 0.3 * 0.29 + 0.7 * 0.29 * 0.29;
  assert.ok(Math.abs(l.mwh - (peakKw / 1000) * llf * 8760) < 1e-6);
  assert.ok(l.pct > 0.2 && l.pct < 0.5, `about a third of a percent: ${l.pct}`);
  // the same power at 35 kV loses about ten times as much
  const low = lineLoss({ mw: 60, cf: 0.29, kv: 35, km: 7, conductor: "AC-185" });
  assert.ok(low.pct / l.pct > 9 && low.pct / l.pct < 10.5);
  assert.deepEqual(lineLoss({ mw: 0, cf: 0.3, kv: 110, km: 5, conductor: "AC-185" }), { peakKw: 0, mwh: 0, pct: 0 });
});

test("an applied option's losses come off the plant's energy", () => {
  const base = evaluatePlant(normalizePlant(PLANT), E, FIN, {});
  const lossy = evaluatePlant(normalizePlant(withOption({ ...PLANT, grid: grid() }, "way/1@110", 2000000, 2)), E, FIN, {});
  assert.ok(Math.abs(lossy.energyKwh[0] / base.energyKwh[0] - 0.98) < 1e-9);
});

test("the comparison: capacity, losses, cost and the effect on the deal; the best that can carry the plant", () => {
  const plant = { ...PLANT, grid: grid({ costs: COSTS }) };
  const r = compareOptions(plant, { E, fin: FIN, scenario: {} });
  assert.equal(Math.round(r.mw), 60);
  const by = Object.fromEntries(r.options.map((o) => [o.key, o]));
  // 60 MW is too much for one 35 kV circuit, fine for 110 kV
  assert.equal(by["way/2@35"].fits, false);
  assert.equal(by["way/1@110"].fits, true);
  assert.ok(by["way/2@35"].loss.pct > by["way/1@110"].loss.pct);
  for (const o of r.options) {
    assert.ok(o.costEur > 0 && o.effect && Number.isFinite(o.effect.npv), o.key);
    const c = COSTS[o.cls];
    assert.ok(Math.abs(o.costEur - (o.route.km * c.perKm + (o.kind === "sub" ? c.sub : c.tap))) < 1e-6, o.key);
  }
  const best = r.options.find((o) => o.key === r.recommended);
  assert.ok(best.fits);
  for (const o of r.options.filter((x) => x.fits)) assert.ok(best.effect.npv >= o.effect.npv - 1e-6);
  // without costs, nothing is recommended
  assert.equal(compareOptions({ ...PLANT, grid: grid() }, { E, fin: FIN, scenario: {} }).recommended, null);
  assert.deepEqual(compareOptions(PLANT, { E, fin: FIN }).options, []);
});

test("plants at the same point: their MW together against the circuit, and a shared line split by MW", () => {
  const choice = { kind: "sub", id: "way/1", cls: "110" };
  const a = { ...PLANT, id: "a", grid: grid({ costs: COSTS, choice, shared: true }) };
  const b = { ...PLANT, id: "b", name: "Park 2", grid: grid({ costs: COSTS, choice, shared: true }) };
  const groups = connectionGroups([a, b]);
  const g = groups.get("way/1@110");
  assert.equal(g.members.length, 2);
  assert.equal(Math.round(g.mw), 120);
  const r = compareOptions(a, { E, fin: FIN, scenario: {}, groups });
  const o = r.options.find((x) => x.key === "way/1@110");
  assert.equal(Math.round(o.totalMw), 120);
  assert.equal(o.fits, false, "120 MW is over one 110 kV circuit");
  assert.ok(Math.abs(o.shareOf - 0.5) < 1e-9);
  assert.ok(Math.abs(o.costEur - o.aloneEur / 2) < 1e-6, "same route, same works, half each");
  // not shared: each pays its own line
  const alone = compareOptions({ ...a, grid: grid({ costs: COSTS, choice, shared: false }) }, { E, fin: FIN, scenario: {}, groups });
  assert.equal(alone.options.find((x) => x.key === "way/1@110").shareOf, null);
});

test("crossings: the query follows the route, the answer is one entry per feature, the route has a key", () => {
  const route = [[45.95, 28.33], [45.92, 28.26], [45.8835, 28.1831]];
  const q = crossingsQuery(route);
  assert.match(q, /around:30,45\.95000,28\.33000,45\.92000,28\.26000,45\.88350,28\.18310\)/);
  assert.match(q, /is_in\(45\.95000,28\.33000\);/);
  const pts = sampleRoute(route, 1, 25);
  assert.ok(pts.length >= 10 && pts.length <= 25);
  assert.equal(kindOf({ boundary: "protected_area" }), "protected");
  assert.equal(kindOf({ waterway: "river" }), "river");
  assert.equal(kindOf({ highway: "residential" }), null);
  const items = parseCrossings({ elements: [
    { type: "way", id: 1, tags: { highway: "primary", ref: "R32", name: "Cahul-Taraclia" } },
    { type: "way", id: 2, tags: { highway: "primary", ref: "R32", name: "Cahul-Vulcănești" } },
    { type: "way", id: 3, tags: { waterway: "river", name: "Prut" } },
    { type: "area", id: 3600001, tags: { boundary: "protected_area", name: "Lunca Prutului de Jos" } },
    { type: "way", id: 4, tags: { power: "line" } },
    { type: "way", id: 5, tags: { power: "line" } },
  ] });
  assert.deepEqual(items.map((x) => x.kind), ["protected", "river", "road", "power", "power"]);
  assert.deepEqual(crossingCounts(items), { protected: 1, river: 1, road: 1, power: 2 });
  assert.notEqual(routeKey(route), routeKey([...route.slice(0, 2), [45.88, 28.19]]));
  assert.equal(routeKey(route), routeKey(route.map((q) => [...q])));
});

test("connection steps: the grid item follows them, and the bank sees the open ones", () => {
  assert.equal(gridSteps({}), null);
  const steps = { request: { status: "done" }, approval: { status: "in_progress", by: "Moldelectrica", due: "2026-09-01" } };
  const permits = { land: { status: "done" }, grid: { status: "todo", steps } };
  assert.equal(permitItem(permits, "grid").status, "in_progress");
  const all = Object.fromEntries(GRID_STEPS.map((k) => [k, { status: "done" }]));
  assert.equal(permitItem({ grid: { steps: all } }, "grid").status, "done");
  assert.equal(permitItem({ grid: { status: "na", steps } }, "grid").status, "na", "not needed stays not needed");
  const row = permitProgress(permits, "2026-10-04").rows.find((r) => r.id === "grid");
  assert.equal(row.steps.length, 5);
  assert.equal(row.steps[1].overdue, true);
  const miss = stillMissing({ ...PLANT, permits }, "2026-10-04");
  const gridItems = miss.items.filter((r) => r.id === "grid");
  assert.deepEqual(gridItems.map((r) => r.step), ["approval", "contract", "works", "energised"]);
  assert.match(missingLine(gridItems[0], "ro"), /^Racordarea la rețea, Avizul de racordare \(condiții și punct\): În lucru, responsabil: Moldelectrica, termen 2026-09-01, întârziat$/);
  assert.match(missingLine(gridItems[1], "en"), /waits for Connection approval/);
  const csv = permitCsv({ ...PLANT, permits }, "2026-10-04");
  assert.match(csv, /Cererea de racordare/);
});
