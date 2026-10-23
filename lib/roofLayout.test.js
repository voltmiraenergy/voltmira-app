import { test } from "node:test";
import assert from "node:assert/strict";
import { fitPanels, polygonAreaM2, compassLabel, facingFromShape, fitOptions, slopeAreaM2 } from "./roofLayout.js";

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
  assert.deepEqual(fitPanels([[0, 0], [0, 1]], [], 1000, 1700), { panels: [], count: 0, rows: [] });
  assert.deepEqual(fitPanels(null, [], 1000, 1700), { panels: [], count: 0, rows: [] });
  assert.deepEqual(fitPanels(undefined, [], 1000, 1700), { panels: [], count: 0, rows: [] });
});

test("rows groups panels by the row they were placed in, with a real rail length", () => {
  // 2m x 1.7m plane, 1m x 1.7m portrait panel, no spacing/margin: 2 panels,
  // side by side, in exactly one row.
  const r = fitPanels(rect(2, 1.7), [], 1000, 1700, { spacingM: 0, marginM: 0 });
  assert.equal(r.rows.length, 1);
  assert.equal(r.rows[0].count, 2);
  assert.ok(Math.abs(r.rows[0].lengthM - 2) < 0.01, `lengthM=${r.rows[0].lengthM}`);
  assert.equal(r.rows[0].rail1.length, 2);
  assert.equal(r.rows[0].rail2.length, 2);
});

test("an obstacle gap mid-row still yields one continuous rail spanning both remaining panels", () => {
  // 3m x 1.7m plane, 3 columns of 1m x 1.7m portrait panels in one row; an
  // obstacle knocks out the middle column only.
  const plane = rect(3, 1.7);
  const obstacle = [[0.1 * M, 1.1 * M], [0.1 * M, 1.9 * M], [1.6 * M, 1.9 * M], [1.6 * M, 1.1 * M]];
  const r = fitPanels(plane, [obstacle], 1000, 1700, { spacingM: 0, marginM: 0 });
  assert.equal(r.count, 2); // left + right columns only
  assert.equal(r.rows.length, 1);
  assert.equal(r.rows[0].count, 2);
  // Rail still spans the full 3m row, bridging the missing middle panel —
  // conservative, never under-estimates material.
  assert.ok(Math.abs(r.rows[0].lengthM - 3) < 0.01, `lengthM=${r.rows[0].lengthM}`);
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

test("a roof's facing is guessed from its longest edge, on the side nearer south", () => {
  // 10 m along E-W, 5 m N-S: the eave runs east-west, so the slope faces south
  assert.equal(facingFromShape(rect(10, 5)), 0);
  // 4 m E-W, 12 m N-S: the long edge runs north-south, so east or west; both
  // are 90° from south and the first found (east) is kept
  assert.equal(Math.abs(facingFromShape(rect(4, 12))), 90);
  // a plane turned 30° off the grid faces 30° off south
  const rot = (deg) => {
    const r = (deg * Math.PI) / 180;
    return [[0, 0], [10, 0], [10, 5], [0, 5]].map(([x, y]) => [(x * Math.sin(r) + y * Math.cos(r)) * M, (x * Math.cos(r) - y * Math.sin(r)) * M]);
  };
  assert.equal(Math.abs(facingFromShape(rot(30))), 30);
  assert.equal(facingFromShape([[0, 0], [1, 1]]), null);
});

test("saved designer settings become the same fit options everywhere, with safe defaults", () => {
  assert.deepEqual(fitOptions(undefined), { orientation: "portrait", rowSpacingM: 0.02, colSpacingM: 0.02, marginM: 0.3, clusterMaxWidthM: 0, clusterMaxHeightM: 0, clusterGapM: 0, clearanceM: 0 });
  const o = fitOptions({ orientation: "landscape", rowSpacingCm: 5, colSpacingCm: 0, setbackCm: 50, clusterMaxW: 6, clusterGap: 0.5 });
  assert.equal(o.orientation, "landscape");
  assert.equal(o.rowSpacingM, 0.05);
  assert.equal(o.colSpacingM, 0);
  assert.equal(o.marginM, 0.5);
  assert.equal(o.clusterMaxWidthM, 6);
  assert.equal(o.clusterGapM, 0.5);
  // nonsense is ignored rather than trusted
  assert.equal(fitOptions({ orientation: "diagonal", setbackCm: -4 }).orientation, "portrait");
  assert.equal(fitOptions({ setbackCm: 900 }).marginM, 0.3);
  // a landscape saving changes the count the same way the designer showed it
  const plane = rect(10, 6);
  assert.equal(fitPanels(plane, [], 1134, 1909, fitOptions({})).count, fitPanels(plane, [], 1134, 1909, { orientation: "portrait" }).count);
});

test("limitPanels keeps the quote's panels, the south side first, and cuts a row's rails to the panels it keeps", async () => {
  const { limitPanels } = await import("./roofLayout.js");
  const west = { ...fitPanels(rect(6, 3.4), [], 1000, 1700, { spacingM: 0, marginM: 0 }), azimuthDeg: 90 };
  const south = { ...fitPanels(rect(6, 3.4), [], 1000, 1700, { spacingM: 0, marginM: 0 }), azimuthDeg: -10 };
  assert.equal(south.count, 12); // 6 x 2
  const [w, s] = limitPanels([west, south], 9);
  // the side facing nearest south fills first, the rest goes on the west side
  assert.equal(s.count, 9);
  assert.equal(w.count, 0);
  assert.equal(s.panels.length + s.spare.length, 12);
  assert.equal(w.spare.length, 12);
  // a full row of 6, then 3 of the next: its rails span 3 panels, 3 m
  assert.deepEqual(s.rows.map((r) => r.count), [6, 3]);
  assert.ok(Math.abs(s.rows[1].lengthM - 3) < 0.01, `${s.rows[1].lengthM}`);
  assert.equal(s.rows.reduce((a, r) => a + r.count, 0), s.count);
  // no limit keeps everything; a limit above what fits keeps everything too
  assert.deepEqual(limitPanels([west, south], 0).map((f) => f.count), [12, 12]);
  assert.deepEqual(limitPanels([west, south], 99).map((f) => f.count), [12, 12]);
  assert.deepEqual(limitPanels(null, 5), []);
});

test("a pitched side fits the rows its real slope holds, not the view from above", () => {
  // 10 m along the ridge, 6 m up the slope as seen from above; at 35 degrees the slope is 7.32 m
  const plane = rect(10, 6);
  const flat = fitPanels(plane, [], 1000, 1700, { spacingM: 0, marginM: 0 });
  const pitched = fitPanels(plane, [], 1000, 1700, { spacingM: 0, marginM: 0, tiltDeg: 35, azimuthDeg: 0 });
  assert.equal(flat.count, 30); // 10 x 3 rows of 1.7 m in 6 m
  assert.equal(pitched.count, 40); // 10 x 4 rows of 1.7 m in 7.32 m
  // drawn back from above, every panel still lies inside the outline
  const inside = (p) => p[0] >= -1e-9 && p[0] <= 6 * M + 1e-9 && p[1] >= -1e-9 && p[1] <= 10 * M + 1e-9;
  assert.ok(pitched.panels.every((ring) => ring.every(inside)));
  assert.ok(Math.abs(slopeAreaM2(plane, 35) - 60 / Math.cos((35 * Math.PI) / 180)) < 0.5);
});

test("the setback holds on a slanted edge, not only on the straight ones", () => {
  // a trapezoid: a 12 m eave, a 6 m ridge, 6 m up the side seen from above
  const trap = [[0, 0], [0, 12 * M], [6 * M, 9 * M], [6 * M, 3 * M]];
  const r = fitPanels(trap, [], 1000, 1700, { spacingM: 0, marginM: 0.3 });
  assert.ok(r.count > 0);
  const xy = (p) => [p[1] / M, p[0] / M];
  const edges = trap.map(xy);
  const dist = (p, a, b) => { const dx = b[0] - a[0], dy = b[1] - a[1]; const t = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / (dx * dx + dy * dy))); return Math.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dy); };
  const nearest = Math.min(...r.panels.flatMap((ring) => ring.map(xy)).map((c) => Math.min(...edges.map((a, i) => dist(c, a, edges[(i + 1) % 4])))));
  assert.ok(nearest >= 0.299, `${nearest}`);
});

test("a self-crossing outline holds no panels; a thin strip across the roof blocks the panels it crosses", () => {
  const bowtie = [[0, 0], [6 * M, 10 * M], [0, 10 * M], [6 * M, 0]];
  assert.equal(fitPanels(bowtie, [], 1000, 1700, { spacingM: 0, marginM: 0 }).count, 0);
  const plane = rect(4, 3.4); // 4 x 2
  const strip = [[-1 * M, 1.95 * M], [-1 * M, 2.05 * M], [5 * M, 2.05 * M], [5 * M, 1.95 * M]]; // 10 cm wide, north-south through x = 2 m
  const before = fitPanels(plane, [], 1000, 1700, { spacingM: 0, marginM: 0 }).count;
  const after = fitPanels(plane, [strip], 1000, 1700, { spacingM: 0, marginM: 0 }).count;
  assert.equal(before, 8);
  assert.equal(after, 4); // the column either side of x = 2 m in both rows
});

test("a deep side whose longest edge runs down the slope still gets rows across it", () => {
  // 4 m along the eave, 9 m down the slope, facing south
  const deep = rect(4, 9);
  const r = fitPanels(deep, [], 1000, 1700, { spacingM: 0, marginM: 0, azimuthDeg: 0 });
  // portrait panels: 1 m along the eave (4 across), 1.7 m up the slope (5 rows)
  assert.equal(r.count, 20);
  assert.equal(r.rows.length, 5);
});

test("an obstacle is kept clear all round: a vent costs the panels its clearance reaches, and none beyond", async () => {
  const { inflateXY, presetRing } = await import("./roofLayout.js");
  // a 1 m square grown by 0.2 m is 1.4 m square
  const sq = inflateXY([[0, 0], [1, 0], [1, 1], [0, 1]], 0.2);
  const w = Math.max(...sq.map((p) => p[0])) - Math.min(...sq.map((p) => p[0]));
  assert.ok(Math.abs(w - 1.4) < 1e-9, `${w}`);
  // an 8 m x 3.4 m plane: 8 x 2 panels of 1 m x 1.7 m; a 30 cm vent in the middle of the lower row
  const plane = rect(8, 3.4);
  const vent = presetRing("vent", [1.0 * M, 4.0 * M]);
  const bare = fitPanels(plane, [vent], 1000, 1700, { spacingM: 0, marginM: 0 }).count;
  const kept = fitPanels(plane, [vent], 1000, 1700, { spacingM: 0, marginM: 0, clearanceM: 0.5 }).count;
  assert.ok(kept <= bare && bare >= 14, `${bare} ${kept}`);
});

test("with obstacles the grid is shifted to keep the most panels; with none it is the grid it always was", () => {
  const plane = rect(10, 5.1);   // 10 x 3 panels of 1 m x 1.7 m
  const none = fitPanels(plane, [], 1000, 1700, { spacingM: 0, marginM: 0 });
  assert.equal(none.count, 30);
  // three small vents that a grid from the corner hits in three different panels
  const small = (x, y) => [[y * M, x * M], [y * M, (x + 0.2) * M], [(y + 0.2) * M, (x + 0.2) * M], [(y + 0.2) * M, x * M]];
  const vents = [small(2.5, 0.8), small(5.5, 2.5), small(8.5, 4.2)];
  const fit = fitPanels(plane, vents, 1000, 1700, { spacingM: 0, marginM: 0 });
  assert.ok(fit.count >= 27, `${fit.count}`);
});

test("a thing higher than 30 cm throws a shadow north; a higher roof level shades the lower beside it", async () => {
  const { shadowRing, keepOutsFor, shadeElevationDeg, OBSTACLE_PRESETS } = await import("./roofLayout.js");
  assert.ok(Math.abs(shadeElevationDeg(47) - 43) < 1e-9);
  const ring = [[47, 28], [47, 28 + 0.5 / 111320], [47 + 0.5 / 111320, 28 + 0.5 / 111320], [47 + 0.5 / 111320, 28]];
  const sh = shadowRing(ring, 2);
  const north = Math.max(...sh.map((p) => p[0])) - 47;
  assert.ok(Math.abs(north * 111320 - 2.5) < 0.05, `${north * 111320}`);   // 0.5 m object + 2 m shadow
  assert.equal(shadowRing(ring, 0), null);
  // a plane 3 m higher shades the plane beside it by 3 / tan(43 degrees) = 3.2 m; at equal height there is none
  const low = { id: "low", polygon: [[47.0, 28.0], [47.0, 28.0002], [47.00005, 28.0002], [47.00005, 28.0]] };
  const high = { id: "high", polygon: [[47.00006, 28.0], [47.00006, 28.0002], [47.00011, 28.0002], [47.00011, 28.0]], heightM: 3 };
  assert.equal(keepOutsFor("low", [low, high], []).length, 1);
  assert.equal(keepOutsFor("high", [low, high], []).length, 0, "the higher side is not shaded by the lower one");
  assert.equal(keepOutsFor("low", [low, { ...high, heightM: 0.1 }], []).length, 0, "a step under 30 cm casts nothing");
  // a chimney of the preset height is shaded, a flat obstacle is not
  const chim = { polygon: [[47, 28], [47, 28.00001], [47.00001, 28.00001], [47.00001, 28]], kind: "chimney", heightM: OBSTACLE_PRESETS.chimney.height };
  assert.equal(keepOutsFor("low", [low], [chim]).length, 2);
  assert.equal(keepOutsFor("low", [low], [{ ...chim, heightM: 0 }]).length, 1, "a flat obstacle casts nothing");
  // an obstacle drawn before heights existed has none recorded: it keeps out its own outline only, as it always did
  assert.equal(keepOutsFor("low", [low], [{ polygon: chim.polygon, kind: "chimney" }]).length, 1);
  assert.ok(OBSTACLE_PRESETS.vent.height >= 0.3 && OBSTACLE_PRESETS.chimney.height > OBSTACLE_PRESETS.vent.height);
});

test("fitSidesFor fits every side of a saved roof with the same rules, and the shade of a higher level costs panels", async () => {
  const { fitSidesFor } = await import("./roofLayout.js");
  const dims = { w: 1000, h: 1700 };
  // in Moldova's latitude: the shade rule rests on the sun's height there (at the equator the sun stands overhead)
  const at47 = (ring) => ring.map(([la, lo]) => [47 + la, 28 + lo / Math.cos((47 * Math.PI) / 180)]);
  const low = { id: "low", polygon: at47(rect(8, 5.1)), tiltDeg: 0, azimuthDeg: 0 };
  const same = fitSidesFor({ planes: [low], obstacles: [] }, dims);
  assert.equal(same.length, 1);
  assert.equal(same[0].id, "low");
  assert.ok(same[0].count > 0 && same[0].tiltDeg === 0);
  // a tall side right beside it, to its south (lower latitude is south: rect() starts at lat 0)
  const high = { id: "high", polygon: at47(rect(8, 3).map(([la, lo]) => [la - 3.2 * M, lo])), tiltDeg: 0, azimuthDeg: 0, heightM: 4 };
  const shaded = fitSidesFor({ planes: [low, high], obstacles: [] }, dims).find((f) => f.id === "low");
  assert.ok(shaded.count < same[0].count, `${shaded.count} < ${same[0].count}`);
});

test("panels on racks on a flat roof are spaced against shade: far fewer than packed edge to edge", async () => {
  const { fitSidesFor } = await import("./roofLayout.js");
  const at47 = (ring) => ring.map(([la, lo]) => [47 + la, 28 + lo / Math.cos((47 * Math.PI) / 180)]);
  const plane = (roofType, tiltDeg) => ({ planes: [{ id: "f", polygon: at47(rect(20, 12)), tiltDeg, azimuthDeg: 0, roofType }], obstacles: [] });
  const dims = { w: 1134, h: 1762 };
  const packed = fitSidesFor(plane("tile", 0), dims)[0].count;   // as if flat on the surface: edge to edge
  const racks15 = fitSidesFor(plane("flat", 15), dims)[0].count;
  const racks30 = fitSidesFor(plane("flat", 30), dims)[0].count;
  assert.ok(racks15 < packed * 0.75, `${racks15} vs ${packed}`);
  assert.ok(racks30 < racks15, `${racks30} < ${racks15}`);
  // the same racks standing on the ground are spaced the same way
  assert.equal(fitSidesFor(plane("ground", 15), dims)[0].count, racks15);
  // a pitched roof is not racks: its tilt is the roof, which only stretches the slope
  assert.ok(fitSidesFor(plane("tile", 35), dims)[0].count >= packed);
});
