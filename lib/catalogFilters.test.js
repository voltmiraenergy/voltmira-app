/**
 * lib/catalogFilters.test.js — the filter pass the catalog browser applies.
 * Run: node --test lib/catalogFilters.test.js
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { sizeOf, priceOf, brandsFor, sizeRangeFor, priceRangeFor, filterProducts } from "./catalogFilters.js";
import { ALL_SUPPLIER_PRODUCTS } from "./supplierCatalog.js";

const PANEL = { kind: "panel", brand: "Acme", model: "P1", watt: 400, price: 70, stock: 10, supplierId: "a" };
const INVERTER = { kind: "inverter", brand: "Beta", model: "I1", kw: 6, price: 800, stock: 0, supplierId: "b" };
const BATTERY = { kind: "battery", brand: "Acme", model: "B1", kwh: 5, price: 1200, stock: 5, supplierId: "a" };
const MOUNT = { kind: "mounting", brand: "Gamma", model: "M1", eurPerKw: 60, stock: 999, supplierId: "b" };
const ROWS = [PANEL, INVERTER, BATTERY, MOUNT];

test("sizeOf reads the kind-appropriate field and is null for mounts / bad data", () => {
  assert.equal(sizeOf(PANEL), 400);
  assert.equal(sizeOf(INVERTER), 6);
  assert.equal(sizeOf(BATTERY), 5);
  assert.equal(sizeOf(MOUNT), null);
  assert.equal(sizeOf(null), null);
  assert.equal(sizeOf({ kind: "panel", watt: "not a number" }), null);
});

test("priceOf falls back to eurPerKw for mounts, and never throws on junk", () => {
  assert.equal(priceOf(PANEL), 70);
  assert.equal(priceOf(MOUNT), 60);
  assert.equal(priceOf(null), 0);
  assert.equal(priceOf({}), 0);
});

test("brandsFor is sorted and deduplicated", () => {
  assert.deepEqual(brandsFor(ROWS), ["Acme", "Beta", "Gamma"]);
  assert.deepEqual(brandsFor([PANEL, { ...PANEL }]), ["Acme"]);
  assert.deepEqual(brandsFor([]), []);
});

test("sizeRangeFor ignores rows with no size axis and returns null for an all-mount set", () => {
  assert.deepEqual(sizeRangeFor(ROWS), { min: 5, max: 400 }, "mount's missing size must not collapse the range to 0");
  assert.equal(sizeRangeFor([MOUNT]), null);
  assert.equal(sizeRangeFor([]), null);
});

test("priceRangeFor covers every row, mounts included", () => {
  assert.deepEqual(priceRangeFor(ROWS), { min: 60, max: 1200 });
  assert.equal(priceRangeFor([]), null);
});

test("filterProducts with no options returns everything unchanged", () => {
  assert.equal(filterProducts(ROWS).length, 4);
  assert.equal(filterProducts(null).length, 0, "non-array input degrades to empty, never throws");
});

test("kind/supplier/free-text filters combine as AND, exactly like the old inline logic", () => {
  assert.deepEqual(filterProducts(ROWS, { kind: "panel" }), [PANEL]);
  assert.deepEqual(filterProducts(ROWS, { supplier: "b" }), [INVERTER, MOUNT]);
  assert.deepEqual(filterProducts(ROWS, { q: "acme" }), [PANEL, BATTERY]);
  assert.deepEqual(filterProducts(ROWS, { q: "P1" }), [PANEL]);
  assert.deepEqual(filterProducts(ROWS, { kind: "panel", q: "beta" }), []);
});

test("brand filter matches an explicit allow-list; empty/omitted means all brands", () => {
  assert.deepEqual(filterProducts(ROWS, { brands: ["Acme"] }), [PANEL, BATTERY]);
  assert.deepEqual(filterProducts(ROWS, { brands: [] }), ROWS, "an empty array must mean 'no brand filter', not 'match nothing'");
});

test("size range filter never excludes a row with no size axis (mounts)", () => {
  const r = filterProducts(ROWS, { minSize: 1000, maxSize: 2000 });
  assert.ok(r.includes(MOUNT), "a mount has no size to compare, so a size filter must not exclude it");
  assert.ok(!r.includes(PANEL) && !r.includes(INVERTER) && !r.includes(BATTERY));
});

test("size range boundaries are inclusive", () => {
  assert.ok(filterProducts(ROWS, { minSize: 400, maxSize: 400 }).includes(PANEL));
  assert.ok(!filterProducts(ROWS, { minSize: 401 }).includes(PANEL));
});

test("price range filter applies uniformly across kinds (price vs eurPerKw)", () => {
  assert.deepEqual(filterProducts(ROWS, { minPrice: 60, maxPrice: 70 }), [PANEL, MOUNT]);
  assert.deepEqual(filterProducts(ROWS, { minPrice: 1200 }), [BATTERY]);
});

test("in-stock-only drops zero-stock rows only", () => {
  const r = filterProducts(ROWS, { inStockOnly: true });
  assert.ok(!r.includes(INVERTER) && r.length === 3);
});

test("sanity check against the real shipped catalog: filters never throw and every row has a kind", () => {
  const r = filterProducts(ALL_SUPPLIER_PRODUCTS, { kind: "panel", inStockOnly: true, minPrice: 0, maxPrice: 1e9 });
  assert.ok(r.length > 0);
  assert.ok(r.every((p) => p.kind === "panel" && (Number(p.stock) || 0) > 0));
});
