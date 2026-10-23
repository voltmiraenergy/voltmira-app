import { test } from "node:test";
import assert from "node:assert/strict";
import { siteOf } from "./roofSite.js";

test("a place with real coordinates is kept, with its imagery depth", () => {
  assert.deepEqual(siteOf({ lat: "47.0105", lon: 28.8638, tileZoom: 19 }), { lat: 47.0105, lon: 28.8638, tileZoom: 19 });
  assert.equal(siteOf({ lat: 47, lon: 28, tileZoom: 25 }).tileZoom, 18);
  assert.equal(siteOf({ lat: 47, lon: 28 }).tileZoom, 18);
});

test("a place found from the address says so", () => {
  assert.equal(siteOf({ lat: 47, lon: 28, approx: true }).approx, true);
  assert.equal("approx" in siteOf({ lat: 47, lon: 28 }), false);
});

test("a place that cannot be on a map is nothing", () => {
  assert.equal(siteOf(null), undefined);
  assert.equal(siteOf({}), undefined);
  assert.equal(siteOf({ lat: null, lon: null }), undefined);
  assert.equal(siteOf({ lat: 0, lon: 0 }), undefined);
  assert.equal(siteOf({ lat: 120, lon: 28 }), undefined);
  assert.equal(siteOf({ lat: "x", lon: 28 }), undefined);
});
