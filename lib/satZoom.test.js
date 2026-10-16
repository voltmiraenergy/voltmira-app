import { test } from "node:test";
import assert from "node:assert/strict";
import { tileAt, deepestImageryZoom } from "./satZoom.js";

test("the tile holding a point is the standard slippy-map tile", () => {
  assert.deepEqual(tileAt(47.0105, 28.8638, 19), { x: 304179, y: 184383 });
});

test("the deepest real imagery is found level by level, and any failure keeps 18", async () => {
  const has = (levels) => async (url) => ({ ok: levels.some((z) => url.includes(`/tile/${z}/`)) });
  assert.equal(await deepestImageryZoom(47, 28.8, { fetchImpl: has([19]) }), 19);
  assert.equal(await deepestImageryZoom(47, 28.8, { fetchImpl: has([19, 20]) }), 20);
  assert.equal(await deepestImageryZoom(47, 28.8, { fetchImpl: has([]) }), 18);
  // a level 20 without 19 is never trusted
  assert.equal(await deepestImageryZoom(47, 28.8, { fetchImpl: has([20]) }), 18);
  assert.equal(await deepestImageryZoom(47, 28.8, { fetchImpl: async () => { throw new Error("offline"); } }), 18);
  assert.equal(await deepestImageryZoom(NaN, 28.8, { fetchImpl: has([19]) }), 18);
  const seen = [];
  await deepestImageryZoom(47, 28.8, { fetchImpl: async (u) => { seen.push(u); return { ok: false }; } });
  assert.match(seen[0], /blankTile=false$/);
});
