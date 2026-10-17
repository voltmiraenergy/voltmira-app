import { test } from "node:test";
import assert from "node:assert/strict";
import { tileXY, tilesAround } from "./tileWarm.js";

test("the tiles around a site cover the box at each zoom, and stop at the ceiling", () => {
  assert.deepEqual(tileXY(47.0105, 28.8638, 19), { x: 304179, y: 184383 });
  const urls = tilesAround({ lat: 47, lon: 28.8 }, 250, [17, 18], ["a/{z}/{y}/{x}", "b/{z}/{y}/{x}"]);
  assert.ok(urls.length > 8 && urls.every((u) => /^[ab]\/1[78]\/\d+\/\d+$/.test(u)));
  assert.ok(urls.some((u) => u.startsWith("b/")), "the names are kept with the imagery");
  assert.equal(tilesAround({ lat: 47, lon: 28.8 }, 5000, [19], ["a/{z}/{y}/{x}"], 50).length, 50);
  assert.deepEqual(tilesAround({ lat: NaN, lon: 1 }, 100, [17], ["a"]), []);
});
