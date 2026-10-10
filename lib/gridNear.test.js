import { test } from "node:test";
import assert from "node:assert/strict";
import { voltagesKv, classOf, classesOf, kvIn, pointToPathKm, simplifyPath, routeKm, parseGrid, gridSummary, keepGrid, normalizeGrid, allOptions, chosenPoint, optionRoute, connectionEstimate, ROUTE_FACTOR, MAX_PATH_POINTS } from "./gridNear.js";
import { gridQuery, slotWait } from "./gridData.js";
import { gridText, stillMissing } from "./bankPack.js";
import { JSON_FIXTURE } from "./gridTestData.js";
import { normalizePlant } from "./plantFinance.js";

const AT = { lat: 45.95, lon: 28.33 };
const kept = () => keepGrid(parseGrid(JSON_FIXTURE, AT), AT, "2026-10-04");

test("voltages and classes as OpenStreetMap tags them; a substation serves every class it has", () => {
  assert.deepEqual(voltagesKv("110000;35000;10000"), [110, 35, 10]);
  assert.deepEqual(voltagesKv("110"), [110]);
  assert.deepEqual(voltagesKv("medium"), []);
  assert.equal(classOf(400), "hv");
  assert.equal(classOf(110), "110");
  assert.equal(classOf(35), "35");
  assert.equal(classOf(10), null);
  assert.deepEqual(classesOf([400, 110, 10]), ["hv", "110"]);
  assert.deepEqual(classesOf([], true), ["hv"]);
  assert.deepEqual(classesOf([10]), []);
  assert.equal(kvIn([400, 110, 10], "110"), 110);
  assert.equal(kvIn([400, 110, 10], "hv"), 400);
});

test("distances to a line, a lighter route that keeps its shape, and a route's length", () => {
  const r = pointToPathKm(AT, [{ lat: 45.96, lon: 28.0 }, { lat: 45.96, lon: 28.6 }]);
  assert.ok(Math.abs(r.km - 1.1057) < 0.01, String(r.km));
  assert.equal(pointToPathKm(AT, []), null);
  // a straight run of 50 points becomes its two ends; a corner stays
  const straight = Array.from({ length: 50 }, (_, i) => [45.9, 28 + i * 0.01]);
  assert.equal(simplifyPath(straight).length, 2);
  const corner = [[45.9, 28.0], [45.9, 28.1], [46.0, 28.1]];
  assert.equal(simplifyPath(corner).length, 3);
  const km = routeKm([[45.9, 28.0], [45.9, 28.1]]);
  assert.ok(Math.abs(km - 7.75) < 0.05, String(km));
});

test("the answer becomes substations and lines, nearest first; village transformers are left out", () => {
  const g = parseGrid(JSON_FIXTURE, AT);
  assert.deepEqual(g.substations.map((s) => s.id), ["way/2", "node/5", "way/1", "way/3"]);
  assert.ok(!g.substations.some((s) => s.id === "node/4"), "10 kV is not a connection point for a plant");
  assert.deepEqual(g.substations.find((s) => s.id === "way/3").classes, ["hv", "110"]);
  assert.deepEqual(g.lines.map((l) => l.id), ["way/10", "way/11"]);
  const sum = gridSummary(g);
  assert.equal(sum.sub["110"].name, "Cahul");
  assert.equal(sum.sub.hv.id, "node/5");
  assert.equal(sum.line["110"].id, "way/10");
});

test("what is kept on the plant: a few of each class and the routes, simplified and capped", () => {
  const k = kept();
  assert.equal(k.fetched, "2026-10-04");
  assert.deepEqual(k.paths.map((p) => p.id), ["way/10", "way/11"]);
  assert.equal(k.paths[0].path.length, 2, "the straight 110 kV line keeps its two ends");
  const n = normalizeGrid({ ...k, choice: { kind: "line", id: "way/10" }, routeFactor: 9, costs: { 110: { perKm: "85000", sub: 400000 } } });
  assert.equal(n.routeFactor, 3);
  assert.deepEqual(n.choice, { kind: "line", id: "way/10", cls: "110" });
  assert.deepEqual(n.costs["110"], { perKm: 85000, sub: 400000, tap: null });
  assert.equal(n.paths.length, 2);
  assert.equal(normalizeGrid(null), null);
  assert.equal(normalizeGrid({ at: { lat: "x" } }), null);
  assert.equal(normalizeGrid({ at: AT }).routeFactor, ROUTE_FACTOR);
  // too many route points: the record is capped
  const huge = { at: AT, paths: Array.from({ length: 10 }, (_, i) => ({ id: `w/${i}`, cls: "110", path: Array.from({ length: 400 }, (_, j) => [45 + j / 1000, 28]) })) };
  assert.ok(normalizeGrid(huge).paths.reduce((s, p) => s + p.path.length, 0) <= MAX_PATH_POINTS);
});

test("the first version's single cost per km moves to the chosen voltage", () => {
  const n = normalizeGrid({ ...kept(), choice: { kind: "line", id: "way/10" }, eurPerKm: 90000, worksEur: 650000 });
  assert.deepEqual(n.costs["110"], { perKm: 90000, sub: null, tap: 650000 });
});

test("options: each substation at each of its voltages, each line as a tap; the chosen one or the nearest 110 kV", () => {
  const g = normalizeGrid(kept());
  const keys = allOptions(g).map((o) => o.key);
  assert.ok(keys.includes("way/3@hv") && keys.includes("way/3@110"), "400/110 kV offered at both");
  assert.equal(chosenPoint(g).key, "way/1@110");
  const line = normalizeGrid({ ...kept(), choice: { kind: "line", id: "way/10", cls: "110" } });
  assert.equal(chosenPoint(line).key, "way/10@110");
  assert.equal(chosenPoint(normalizeGrid({ ...kept(), choice: { kind: "sub", id: "way/999", cls: "110" } })).key, "way/1@110");
  assert.equal(chosenPoint(null), null);
});

test("a drawn route replaces the straight line times the route factor", () => {
  const g0 = normalizeGrid(kept());
  const o = chosenPoint(g0);
  const straight = optionRoute(g0, o);
  assert.equal(straight.drawn, false);
  assert.ok(Math.abs(straight.km - o.km * ROUTE_FACTOR) < 1e-9);
  const drawn = [[AT.lat, AT.lon], [45.93, 28.25], [o.to.lat, o.to.lon]];
  const g = normalizeGrid({ ...kept(), routes: { [o.key]: drawn, "bad key": drawn } });
  const r = optionRoute(g, o);
  assert.equal(r.drawn, true);
  assert.ok(Math.abs(r.km - routeKm(drawn)) < 1e-9);
  assert.deepEqual(Object.keys(g.routes), [o.key]);
});

test("the estimate: the route, times the cost per km of that voltage, plus the works for that kind of point", () => {
  const g = normalizeGrid({ ...kept(), choice: { kind: "line", id: "way/10", cls: "110" }, costs: { 110: { perKm: 100000, sub: 300000, tap: 500000 } } });
  const e = connectionEstimate(g);
  assert.ok(Math.abs(e.totalEur - (e.routeKm * 100000 + 500000)) < 1e-6, "a tap pays the tap works");
  assert.equal(connectionEstimate({ ...g, costs: {} }), null, "no cost, no estimate");
});

test("the bank's documents get one line; a plant moved since is flagged", () => {
  const grid = { ...kept(), costs: { 110: { perKm: 100000 } } };
  const plant = { id: "p", name: "Park", lat: AT.lat, lon: AT.lon, grid };
  const t = gridText(plant, "ro", (v) => `${Math.round(v)} EUR`);
  assert.match(t, /^stația de 110 kV Cahul, la \d+,\d km; linia de 110 kV, la \d+,\d km; racordare estimată la \d+ EUR$/);
  assert.equal(gridText({ id: "q", lat: 1, lon: 1 }, "en", String), null);
  const moved = stillMissing({ ...plant, lat: 46.3 }, "2026-10-04");
  assert.ok(moved.gaps.some((g) => g.id === "moved" && g.part === "grid"));
  assert.ok(normalizePlant(plant).grid.substations.length > 0);
});

test("the query keeps substations inside Moldova and asks for the lines' routes; the busy server's wait is read", () => {
  const q = gridQuery(45.95, 28.33);
  assert.match(q, /area\["ISO3166-1"="MD"\]/);
  assert.match(q, /\(area\.md\)\(around:40000,45\.95000,28\.33000\)/);
  assert.match(q, /way\["power"="line"\].*\(around:20000,45\.95000,28\.33000\);\s*out tags geom qt;/s);
  assert.equal(slotWait("1 slots available now.\nSlot available after: x, in 19 seconds."), 0);
  assert.equal(slotWait("0 slots available now.\nSlot available after: x, in 19 seconds."), 19);
  assert.equal(slotWait(""), null);
});

test("an unnamed point takes the name of the nearest village within 6 km; a named one keeps its own", () => {
  const withPlaces = { elements: [...JSON_FIXTURE.elements,
    { type: "node", id: 900, lat: 45.925, lon: 28.355, tags: { place: "village", name: "Cotihana", "name:ro": "Cotihana" } },
    { type: "node", id: 901, lat: 45.886, lon: 28.19, tags: { place: "town", name: "Cahul" } },
    { type: "node", id: 902, lat: 47.0, lon: 28.8, tags: { place: "city", name: "Chișinău" } }] };
  const g = parseGrid(withPlaces, AT);
  assert.equal(g.substations.find((s) => s.id === "way/2").place, "Cotihana");
  assert.equal(g.substations.find((s) => s.id === "way/1").place, "", "Cahul has its own name");
  assert.equal(g.substations.find((s) => s.id === "node/5").place, "", "no village within 6 km");
  const n = normalizeGrid(keepGrid(g, AT, "2026-10-04"));
  assert.equal(n.substations.find((s) => s.id === "way/2").place, "Cotihana");
  assert.equal(allOptions(n).find((o) => o.id === "way/2").place, "Cotihana");
});
