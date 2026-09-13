import { test } from "node:test";
import assert from "node:assert/strict";
import { fitPanels, polygonAreaM2, compassLabel } from "./roofLayout.js";

// Degrees-per-meter at the equator — keeps every plane in these tests at a
// known, hand-computed physical size without fighting latitude scaling.
const M = 1 / (6371000 * Math.PI / 180);

function rect(wM, hM) {
  // [lat,lon] ring, width along longitude (E-W), height along latitude (N-S).
  return [[0, 0], [0, wM * M], [hM * M, wM * M], [hM * M, 0]];
}

test("an exact-fit rectangle packs the precise, hand-computed panel count", () => {
  // 2m x 1.7m plane, a 1m x 1.7m portrait panel, no spacing/margin: exactly
  // 2 columns x 1 row fit with nothing left over.
  const r = fitPanels(rect(2, 1.7), [], 1000, 1700, { spacingM: 0, marginM: 0 });
  assert.equal(r.count, 2);
  assert.equal(r.panels.length, 2);
  for (const panel of r.panels) assert.equal(panel.length, 4);
});

test("an obstacle removes exactly the panel it overlaps, not its neighbor", () => {
  const plane = rect(2, 1.7);
  // Comfortably inside where the left-hand panel cell lands, clear of the
  // plane's own edges and of the right-hand cell.
  const obstacle = [[0.1 * M, 0.1 * M], [0.1 * M, 0.9 * M], [1.6 * M, 0.9 * M], [1.6 * M, 0.1 * M]];
  const withoutObstacle = fitPanels(plane, [], 1000, 1700, { spacingM: 0, marginM: 0 });
  const withObstacle = fitPanels(plane, [obstacle], 1000, 1700, { spacingM: 0, marginM: 0 });
  assert.equal(withoutObstacle.count, 2);
  assert.equal(withObstacle.count, 1);
});

test("orientation changes which dimension has to fit where", () => {
  // 1.7m (E-W) x 1.0m (N-S) plane, 1000x1700mm panel: portrait needs 1.7m of
  // north-south room the plane doesn't have (0 panels); landscape only needs
  // 1.0m north-south, which fits exactly (1 panel).
  const plane = rect(1.7, 1.0);
  const portrait = fitPanels(plane, [], 1000, 1700, { spacingM: 0, marginM: 0 });
  const landscape = fitPanels(plane, [], 1000, 1700, { spacingM: 0, marginM: 0, orientation: "landscape" });
  assert.equal(portrait.count, 0);
  assert.equal(landscape.count, 1);
});

test("a polygon with fewer than 3 points returns no panels, never throws", () => {
  assert.deepEqual(fitPanels([[0, 0], [0, 1]], [], 1000, 1700), { panels: [], count: 0 });
  assert.deepEqual(fitPanels(null, [], 1000, 1700), { panels: [], count: 0 });
  assert.deepEqual(fitPanels(undefined, [], 1000, 1700), { panels: [], count: 0 });
});

test("a plane too small for even one panel returns 0, not a negative or infinite loop", () => {
  const tiny = rect(0.01, 0.01);
  const r = fitPanels(tiny, [], 1000, 1700, { spacingM: 0, marginM: 0 });
  assert.equal(r.count, 0);
});

test("zero or missing panel dimensions return 0 rather than crash or loop forever", () => {
  const plane = rect(2, 1.7);
  assert.equal(fitPanels(plane, [], 0, 1700).count, 0);
  assert.equal(fitPanels(plane, [], 1000, 0).count, 0);
  assert.equal(fitPanels(plane, [], NaN, 1700).count, 0);
});

test("a non-array obstacles argument is treated as no obstacles, not a crash", () => {
  const plane = rect(2, 1.7);
  const base = fitPanels(plane, [], 1000, 1700, { spacingM: 0, marginM: 0 });
  const junk = fitPanels(plane, "not an array", 1000, 1700, { spacingM: 0, marginM: 0 });
  assert.equal(junk.count, base.count);
});

test("margin shrinks the usable area, so a wider margin never increases panel count", () => {
  const plane = rect(5, 4);
  const tight = fitPanels(plane, [], 1000, 1700, { spacingM: 0.02, marginM: 0.1 }).count;
  const loose = fitPanels(plane, [], 1000, 1700, { spacingM: 0.02, marginM: 0.6 }).count;
  assert.ok(loose <= tight);
  assert.ok(tight > 0);
});

test("polygonAreaM2 matches the hand-computed area of a plain rectangle", () => {
  assert.ok(Math.abs(polygonAreaM2(rect(10, 4)) - 40) < 0.01);
  assert.ok(Math.abs(polygonAreaM2(rect(2, 1.7)) - 3.4) < 0.01);
});

test("polygonAreaM2 returns 0 for degenerate input, never throws", () => {
  assert.equal(polygonAreaM2([[0, 0], [0, 1]]), 0);
  assert.equal(polygonAreaM2(null), 0);
  assert.equal(polygonAreaM2(undefined), 0);
});

test("compassLabel rotates PVGIS's aspect convention onto real compass words", () => {
  assert.equal(compassLabel(0, "ro"), "Sud");   // PVGIS: aspect 0 = south
  assert.equal(compassLabel(-90, "en"), "East"); // PVGIS: negative = east
  assert.equal(compassLabel(90, "en"), "West");  // PVGIS: positive = west
  assert.equal(compassLabel(180, "ro"), "Nord");
  assert.equal(compassLabel(-180, "ro"), "Nord");
});
