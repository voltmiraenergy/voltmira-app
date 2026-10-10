/**
 * lib/supplierCatalog.test.js — recommendMount() matches a roof material to
 * a REAL catalog product's own `type` string, never a fabricated guess.
 *
 * Run: node --test lib/
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { recommendMount, autoBom, MOUNTS } from "./supplierCatalog.js";

test("recommendMount matches tile, trapezoidal, flat and ground roofs to real, verified catalog products", () => {
  const tile = recommendMount("tile");
  assert.ok(tile && MOUNTS.includes(tile));
  assert.match(tile.type, /tile/i);

  const trapezoidal = recommendMount("trapezoidal");
  assert.ok(trapezoidal && MOUNTS.includes(trapezoidal));
  assert.match(trapezoidal.type, /trapezoidal/i);

  const ground = recommendMount("ground");
  assert.ok(ground && MOUNTS.includes(ground));
  assert.match(ground.type, /ground/i);

  // K2 Dome 6 — a real, verified ballasted flat-roof system (added once one
  // was actually sourced; previously this catalog had none, and flat
  // returned null rather than substituting the wrong hardware).
  const flat = recommendMount("flat");
  assert.ok(flat && MOUNTS.includes(flat));
  assert.match(flat.type, /flat|ballasted/i);
  assert.equal(flat.brand, "K2 Systems");
  assert.equal(flat.model, "Dome 6");
});

test("recommendMount returns null for an unknown/missing roof type", () => {
  assert.equal(recommendMount(undefined), null);
  assert.equal(recommendMount("not-a-real-type"), null);
});

test("autoBom uses the roof-matched mount when given a roof type, and the old default otherwise", () => {
  const withRoof = autoBom(6, 0, "trapezoidal").find((l) => l.kind === "mounting");
  const matched = recommendMount("trapezoidal");
  assert.equal(withRoof.brand, matched.brand);
  assert.equal(withRoof.model, matched.model);

  const withFlatRoof = autoBom(6, 0, "flat").find((l) => l.kind === "mounting");
  const matchedFlat = recommendMount("flat");
  assert.equal(withFlatRoof.brand, matchedFlat.brand);
  assert.equal(withFlatRoof.model, matchedFlat.model);

  const withoutRoof = autoBom(6, 0).find((l) => l.kind === "mounting");
  const withUnknownRoof = autoBom(6, 0, "not-a-real-type").find((l) => l.kind === "mounting");
  assert.equal(withoutRoof.model, withUnknownRoof.model, "an unmatched roof type falls back to the same default as no roof type at all");
});
