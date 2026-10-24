import { test } from "node:test";
import assert from "node:assert/strict";
import { alternatives, batteryFor, catalogBom, bomFor } from "./quoteOptions.js";

const labels = { essential: "Esențial", complete: "Complet, cu baterie" };

test("beside the recommended size: a smaller one, and the same size with a battery", () => {
  const [small, full] = alternatives(6, 4800, labels);
  assert.deepEqual(small, { label: "Esențial", kw: 4, battKwh: 0 });
  assert.deepEqual(full, { label: "Complet, cu baterie", kw: 6, battKwh: 8 });
});

test("a system too small to shrink gets only the battery option", () => {
  const opts = alternatives(1, 1500, labels);
  assert.equal(opts.length, 1);
  assert.equal(opts[0].battKwh, 5);
});

test("the battery is about 60% of a day's use, 5 to 15 kWh", () => {
  assert.equal(batteryFor(0), 5);
  assert.equal(batteryFor(4800), 8);
  assert.equal(batteryFor(60000), 15);
});

const catalog = [
  { id: "p1", kind: "panel", brand: "JA", model: "440", spec: "440 W", unit_price: 76 },
  { id: "p2", kind: "panel", brand: "LONGi", model: "550", spec: "550 W", unit_price: 95, cost_price: 88 },
  { id: "i1", kind: "inverter", brand: "Deye", model: "5K", spec: "5 kW hybrid", unit_price: 700 },
  { id: "i2", kind: "inverter", brand: "Huawei", model: "10K", spec: "10 kW", unit_price: 980 },
  { id: "b1", kind: "battery", brand: "Pylontech", model: "US5000", spec: "4,8 kWh", unit_price: 1190 },
  { id: "m1", kind: "mounting", brand: "K2", model: "Rail", spec: "roof", unit_price: 60 },
  { id: "x", kind: "panel", brand: "Old", model: "300", spec: "300 W", unit_price: 50, active: false },
];

test("the installer's own catalog: the strongest panel, the smallest inverter that covers it, the mount", () => {
  const bom = catalogBom(6, 0, catalog);
  assert.equal(bom[0].productId, "p2");
  assert.equal(bom[0].qty, 11);               // 6000 / 550
  assert.equal(bom[0].unit_price, 88);        // the purchase price when set
  assert.equal(bom[1].productId, "i1");       // 5 kW carries up to 6.75 kWp
  assert.equal(bom[1].qty, 1);
  assert.equal(bom.at(-1).kind, "mounting");
  assert.ok(bom.every((l) => l.source === "own"));
});

test("too big for any one inverter: as many of the largest as it takes; a battery when asked", () => {
  const bom = catalogBom(20, 10, catalog);
  const inv = bom.find((l) => l.kind === "inverter");
  assert.equal(inv.productId, "i2");
  assert.equal(inv.qty, 2);
  assert.equal(bom.find((l) => l.kind === "battery").qty, 2);
});

test("a product tracked and out of stock is passed over while another of its kind is in stock", () => {
  const stocked = [...catalog.map((p) => (p.id === "p2" ? { ...p, track_stock: true, stock: 0 } : p))];
  assert.equal(catalogBom(6, 0, stocked)[0].productId, "p1");
  const allOut = stocked.map((p) => (p.kind === "panel" ? { ...p, track_stock: true, stock: 0 } : p));
  assert.equal(catalogBom(6, 0, allOut)[0].productId, "p2");   // none in stock: the best one still
});

test("a catalog without a panel or an inverter falls back to the starter kit", () => {
  assert.equal(catalogBom(6, 0, catalog.filter((p) => p.kind !== "inverter")), null);
  assert.ok(bomFor(6, []).every((l) => l.source === "supplier"));
  assert.ok(bomFor(6, catalog).every((l) => l.source === "own"));
});
