import { test } from "node:test";
import assert from "node:assert/strict";
import { project, staticView, located, markerRadius, TILES } from "./portfolioMap.js";

test("Web Mercator: the world at zoom 0 is one 256 px tile, centred on 0,0", () => {
  const c = project(0, 0, 0);
  assert.ok(Math.abs(c.x - 128) < 1e-9 && Math.abs(c.y - 128) < 1e-9);
  assert.ok(project(0, 180, 0).x === 256);
  assert.ok(project(60, 0, 3).y < project(40, 0, 3).y, "north is up");
});

test("the view fits every site inside the frame with its margin, at the closest zoom that does", () => {
  const pts = [{ lat: 47.02, lon: 28.83 }, { lat: 47.76, lon: 27.93 }, { lat: 46.35, lon: 28.65 }, { lat: 49.84, lon: 24.03 }];
  const v = staticView(pts, { width: 640, height: 300, pad: 36 });
  for (const p of v.points) {
    assert.ok(p.x >= 36 - 1e-6 && p.x <= 640 - 36 + 1e-6, `x ${p.x}`);
    assert.ok(p.y >= 36 - 1e-6 && p.y <= 300 - 36 + 1e-6, `y ${p.y}`);
  }
  const closer = staticView(pts, { width: 640, height: 300, pad: 36, maxZoom: v.z + 1, minZoom: v.z + 1 });
  assert.ok(closer.points.some((p) => p.x < 36 || p.x > 604 || p.y < 36 || p.y > 264), "one zoom closer no longer fits");
  // the tiles cover the frame
  for (const t of v.tiles) assert.ok(t.left > -256 && t.left < 640 && t.top > -256 && t.top < 300);
  assert.ok(v.tiles[0].src.startsWith("https://server.arcgisonline.com/") && v.tiles[0].ref.includes("Reference"));
  assert.ok(v.tiles.every((t) => !/\{[xyz]\}/.test(t.src + t.ref)));
});

test("one site gets the closest allowed zoom; sites without a position are dropped", () => {
  const v = staticView([{ lat: 47, lon: 28.8 }], { maxZoom: 11 });
  assert.equal(v.z, 11);
  assert.equal(v.points[0].x, 320);
  assert.equal(staticView([{ lat: null, lon: 28 }, { lat: 0, lon: 0 }, {}]), null);
  assert.equal(located([{ lat: "47.1", lon: "28.2" }, { lat: 95, lon: 0 }]).length, 1);
  assert.ok(staticView([{ lat: 47, lon: 28 }], { tiles: TILES.dark }).tiles[0].src.includes("Dark"));
});

test("marker area follows capacity", () => {
  assert.equal(markerRadius(0, 100), 5);
  assert.equal(markerRadius(100, 100), 16);
  const r = (k) => markerRadius(k, 400) - 5;
  assert.ok(Math.abs(r(100) / r(400) - 0.5) < 1e-9, "a quarter of the capacity is half the radius growth");
});
