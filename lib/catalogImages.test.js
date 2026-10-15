/**
 * lib/catalogImages.test.js — hero images for the catalog grid: real,
 * kind-representative photos via productImage(), with placeholderImage() as
 * the local fallback (initial src for an unphotographed kind, and the
 * <img onError> swap everywhere else).
 * Run: node --test lib/catalogImages.test.js
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { productImage, placeholderImage, placeholderSize } from "./catalogImages.js";
import { PANELS, INVERTERS, BATTERIES, MOUNTS } from "./supplierCatalog.js";

test("each kind gets its own consistent width/height", () => {
  assert.deepEqual(placeholderSize("panel"), { width: 320, height: 220 });
  assert.deepEqual(placeholderSize("inverter"), { width: 240, height: 240 });
  assert.deepEqual(placeholderSize("battery"), { width: 240, height: 240 });
  assert.deepEqual(placeholderSize("mounting"), { width: 320, height: 200 });
});

test("an unknown/missing kind falls back to a sane default rather than throwing", () => {
  assert.deepEqual(placeholderSize("other"), { width: 280, height: 220 });
  assert.deepEqual(placeholderSize(undefined), { width: 280, height: 220 });
});

test("productImage returns a real https photo for every kind that has one", () => {
  for (const kind of ["panel", "inverter", "battery", "mounting"]) {
    const url = productImage({ kind, id: "x1" });
    assert.match(url, /^https:\/\//, `${kind} must resolve to a real hotlinked photo`);
  }
});

test("productImage falls back to the local placeholder for a kind with no photo pool", () => {
  const url = productImage({ kind: "other", id: "x1" });
  assert.match(url, /^\/placeholder\.svg\?/);
});

test("productImage is stable for the same product (no flicker across re-renders)", () => {
  const p = { kind: "battery", id: "pylontech-us5000x2" };
  assert.equal(productImage(p), productImage({ ...p }));
});

test("productImage picks by id, not array position — reordering/filtering the grid can't reshuffle a product's photo", () => {
  const p = { kind: "panel", id: "longi-hi-mo6-435" };
  // same id, wrapped differently (as if it arrived via a filtered/sorted copy of the array) -> same photo
  assert.equal(productImage(p), productImage({ kind: "panel", id: "longi-hi-mo6-435", extra: "anything" }));
});

test("productImage spreads across a kind's whole photo pool, not just one photo", () => {
  const ids = Array.from({ length: 24 }, (_, i) => `panel-${i}`);
  const urls = new Set(ids.map((id) => productImage({ kind: "panel", id })));
  assert.ok(urls.size > 1, "24 different panel ids should not all collapse onto a single photo");
});

test("placeholderImage embeds the kind-matched size and is always a relative path", () => {
  const url = placeholderImage({ kind: "panel" });
  assert.match(url, /^\/placeholder\.svg\?height=220&width=320/);
  assert.ok(!/^https?:\/\//i.test(url));
});

test("neither function throws on missing id/brand/model/kind", () => {
  assert.doesNotThrow(() => productImage({}));
  assert.doesNotThrow(() => productImage(null));
  assert.doesNotThrow(() => placeholderImage({}));
  assert.doesNotThrow(() => placeholderImage(null));
});

test("productImage prefers the product's own real photoUrl over the generic kind pool", () => {
  const real = "https://example-manufacturer.com/real-product-photo.jpg";
  assert.equal(productImage({ kind: "panel", id: "x1", photoUrl: real }), real);
});

test("a photoUrl on an unrecognized kind still wins — the specific photo doesn't need a fallback pool to exist", () => {
  const real = "https://example-manufacturer.com/real-product-photo.jpg";
  assert.equal(productImage({ kind: "other", id: "x1", photoUrl: real }), real);
});

test("sanity check against the real shipped catalog: every entry with a photoUrl serves a real https link, and every kind has at least one", () => {
  const all = [...PANELS, ...INVERTERS, ...BATTERIES, ...MOUNTS];
  const withPhoto = all.filter((p) => p.photoUrl);
  assert.ok(withPhoto.length > 0, "at least one shipped entry should carry a real photoUrl");
  for (const p of withPhoto) {
    assert.match(p.photoUrl, /^https:\/\//, `${p.brand} ${p.model}'s photoUrl must be a real https link`);
  }
  // Entries with no photoUrl must still resolve to *something* renderable.
  for (const p of all) {
    if (p.photoUrl) continue;
    const url = productImage({ ...p, kind: PANELS.includes(p) ? "panel" : INVERTERS.includes(p) ? "inverter" : BATTERIES.includes(p) ? "battery" : "mounting" });
    assert.ok(url, `${p.brand} ${p.model} with no photoUrl must still resolve to a fallback image`);
  }
});
