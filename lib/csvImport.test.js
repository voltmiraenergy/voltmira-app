import { test } from "node:test";
import assert from "node:assert/strict";
import { parseCsv, normalizeProductRows, productCsvTemplate, CSV_TEMPLATE_HEADER } from "./csvImport.js";

test("parseCsv splits plain comma-separated rows", () => {
  const rows = parseCsv("kind,brand,model\npanel,Jinko,Tiger Neo");
  assert.deepEqual(rows, [["kind", "brand", "model"], ["panel", "Jinko", "Tiger Neo"]]);
});

test("parseCsv handles quoted fields with embedded commas and escaped quotes", () => {
  const rows = parseCsv('brand,model\n"Acme, Inc.","The ""Big"" One"');
  assert.deepEqual(rows, [["brand", "model"], ["Acme, Inc.", 'The "Big" One']]);
});

test("parseCsv handles a quoted field with an embedded newline", () => {
  const rows = parseCsv('brand,note\nAcme,"line one\nline two"');
  assert.deepEqual(rows, [["brand", "note"], ["Acme", "line one\nline two"]]);
});

test("parseCsv accepts \\r\\n line endings and strips a leading BOM", () => {
  const rows = parseCsv("﻿kind,brand\r\npanel,Jinko\r\n");
  assert.deepEqual(rows, [["kind", "brand"], ["panel", "Jinko"]]);
});

test("parseCsv drops trailing blank lines", () => {
  const rows = parseCsv("kind,brand\npanel,Jinko\n\n");
  assert.equal(rows.length, 2);
});

test("productCsvTemplate round-trips through parseCsv with the documented header", () => {
  const rows = parseCsv(productCsvTemplate());
  assert.deepEqual(rows[0], CSV_TEMPLATE_HEADER);
  assert.equal(rows.length, 2); // header + one filled example row
});

test("normalizeProductRows accepts a well-formed row and normalizes numbers", () => {
  const csv = [
    ["kind", "brand", "model", "spec", "cost_price", "unit_price", "stock"],
    ["panel", "Jinko", "Tiger Neo 425W", "425 W", "60", "74", "50"],
  ];
  const { valid, results, truncated } = normalizeProductRows(csv);
  assert.equal(truncated, false);
  assert.equal(results.length, 1);
  assert.equal(results[0].ok, true);
  assert.deepEqual(valid[0], {
    kind: "panel", brand: "Jinko", model: "Tiger Neo 425W", spec: "425 W",
    cost_price: 60, unit_price: 74, track_stock: true, stock: 50, image_url: "",
  });
});

test("normalizeProductRows matches header columns by name, case-insensitively, in any order", () => {
  const csv = [
    ["Unit_Price", "Brand", "Kind", "Model"],
    ["74", "Jinko", "panel", "Tiger Neo"],
  ];
  const { valid } = normalizeProductRows(csv);
  assert.equal(valid[0].unit_price, 74);
  assert.equal(valid[0].brand, "Jinko");
  assert.equal(valid[0].kind, "panel");
});

test("normalizeProductRows rejects an unknown kind, never silently defaulting it", () => {
  const csv = [["kind", "brand", "model"], ["solar-thing", "Jinko", "X"]];
  const { valid, results } = normalizeProductRows(csv);
  assert.equal(valid.length, 0);
  assert.equal(results[0].ok, false);
  assert.equal(results[0].error, "cat_imp_row_kind");
});

test("normalizeProductRows rejects a row with neither brand nor model", () => {
  const csv = [["kind", "brand", "model"], ["panel", "", ""]];
  const { valid, results } = normalizeProductRows(csv);
  assert.equal(valid.length, 0);
  assert.equal(results[0].error, "cat_imp_row_name");
});

test("normalizeProductRows rejects a non-numeric price rather than coercing it to 0", () => {
  const csv = [["kind", "brand", "model", "unit_price"], ["panel", "Jinko", "X", "free"]];
  const { valid, results } = normalizeProductRows(csv);
  assert.equal(valid.length, 0);
  assert.equal(results[0].error, "cat_imp_row_price");
});

test("normalizeProductRows treats a blank price/cost/stock as 0/untracked, not an error", () => {
  const csv = [["kind", "brand", "model", "cost_price", "unit_price", "stock"], ["panel", "Jinko", "X", "", "", ""]];
  const { valid, results } = normalizeProductRows(csv);
  assert.equal(results[0].ok, true);
  assert.equal(valid[0].cost_price, 0);
  assert.equal(valid[0].unit_price, 0);
  assert.equal(valid[0].track_stock, false);
});

test("normalizeProductRows skips fully-blank rows without counting them as errors", () => {
  const csv = [["kind", "brand", "model"], ["", "", ""], ["panel", "Jinko", "X"]];
  const { valid, results } = normalizeProductRows(csv);
  assert.equal(results.length, 1);
  assert.equal(valid.length, 1);
});

test("normalizeProductRows caps at 500 rows and reports truncation", () => {
  const header = ["kind", "brand", "model"];
  const rows = Array.from({ length: 510 }, (_, i) => ["panel", "Jinko", `Model ${i}`]);
  const { valid, results, truncated } = normalizeProductRows([header, ...rows]);
  assert.equal(truncated, true);
  assert.equal(results.length, 500);
  assert.equal(valid.length, 500);
});

test("normalizeProductRows returns empty, not a crash, for a header-only or missing file", () => {
  assert.deepEqual(normalizeProductRows([["kind", "brand", "model"]]), { valid: [], results: [], truncated: false });
  assert.deepEqual(normalizeProductRows([]), { valid: [], results: [], truncated: false });
  assert.deepEqual(normalizeProductRows(null), { valid: [], results: [], truncated: false });
});
