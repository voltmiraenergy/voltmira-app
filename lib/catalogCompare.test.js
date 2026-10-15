/**
 * lib/catalogCompare.test.js — the shared spec-row list behind the product
 * detail modal AND the compare table, plus the objective best-cell picker.
 * Run: node --test lib/catalogCompare.test.js
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { compareRows, formatRowValue, bestIndex } from "./catalogCompare.js";
import { PANELS, INVERTERS, BATTERIES, MOUNTS } from "./supplierCatalog.js";

test("every kind returns a non-empty, uniquely-keyed row list", () => {
  for (const kind of ["panel", "inverter", "battery", "mounting"]) {
    const rows = compareRows(kind, "en");
    assert.ok(rows.length > 0, `${kind} must have rows`);
    const keys = rows.map((r) => r.key);
    assert.equal(new Set(keys).size, keys.length, `${kind} row keys must be unique`);
  }
});

test("an unrecognized kind falls back to the panel rows instead of returning nothing", () => {
  // Compare by key/label/unit, not full deepEqual — each call builds fresh
  // `get`/`fmt` closures, so the row objects are never reference-equal even
  // when they describe the exact same rows.
  const shape = (rows) => rows.map((r) => ({ key: r.key, label: r.label, unit: r.unit }));
  assert.deepEqual(shape(compareRows("bogus", "en")), shape(compareRows("panel", "en")));
});

test("every row is readable against the real shipped catalog without throwing", () => {
  const all = [...PANELS.map((p) => ({ ...p, kind: "panel" })), ...INVERTERS.map((p) => ({ ...p, kind: "inverter" })),
    ...BATTERIES.map((p) => ({ ...p, kind: "battery" })), ...MOUNTS.map((p) => ({ ...p, kind: "mounting" }))];
  for (const p of all) {
    for (const row of compareRows(p.kind, "ro")) {
      assert.doesNotThrow(() => row.get(p));
      assert.doesNotThrow(() => formatRowValue(row, p));
    }
  }
});

test("formatRowValue shows an em dash for missing data, not 'undefined' or 'null'", () => {
  const row = { key: "x", label: "X", unit: " V", get: () => null };
  assert.equal(formatRowValue(row, {}), "—");
  const row2 = { key: "y", label: "Y", unit: "", get: () => undefined };
  assert.equal(formatRowValue(row2, {}), "—");
});

test("formatRowValue appends the row's unit", () => {
  const row = { key: "watt", label: "Power", unit: " W", get: (p) => p.watt };
  assert.equal(formatRowValue(row, { watt: 435 }), "435 W");
});

test("bestIndex picks the max for higherIsBetter:true", () => {
  assert.equal(bestIndex([400, 610, 445], true), 1);
});

test("bestIndex picks the min for higherIsBetter:false", () => {
  assert.equal(bestIndex([70, 108, 64], false), 2);
});

test("bestIndex returns -1 (no highlight) when higherIsBetter is null — no objective ranking exists", () => {
  assert.equal(bestIndex([1, 2, 3], null), -1);
});

test("bestIndex returns -1 on a genuine tie — nothing single-handedly wins", () => {
  assert.equal(bestIndex([5, 5, 3], true), -1);
});

test("bestIndex ignores nulls/non-numbers and still finds the real best among what's left", () => {
  assert.equal(bestIndex([null, 610, undefined, 445], true), 1);
});

test("bestIndex needs at least 2 real values to declare a winner", () => {
  assert.equal(bestIndex([610, null, null], true), -1);
  assert.equal(bestIndex([], true), -1);
});

test("bestIndex never throws on a non-array", () => {
  assert.equal(bestIndex(null, true), -1);
});
