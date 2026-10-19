import { test } from "node:test";
import assert from "node:assert/strict";
import { FT, ft } from "./feeText.js";

test("every key has all four languages, the same placeholders, and no banned punctuation", () => {
  for (const [k, e] of Object.entries(FT)) {
    for (const l of ["en", "ro", "ru", "uk"]) {
      assert.ok(typeof e[l] === "string" && e[l].length > 0, `${k} missing ${l}`);
      // unit spellings such as "кВт·год" are standard; any other middle dot is decoration
      const text = e[l].replace(/(к|М)Вт·(ч|год)/g, "");
      assert.ok(!/[—–·✓✔…]/.test(text), `${k} ${l} has a dash, middle dot, ellipsis or check mark`);
    }
    const vars = (s) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort().join();
    for (const l of ["ro", "ru", "uk"]) assert.equal(vars(e[l]), vars(e.en), `${k} ${l} placeholders differ from English`);
  }
});

test("Ukrainian text carries no Russian-only letters", () => {
  for (const [k, e] of Object.entries(FT)) assert.ok(!/[ыэёъ]/i.test(e.uk), `${k} uk has a Russian letter`);
});

test("ft fills placeholders and falls back to English, then to the key", () => {
  assert.equal(ft("r_cap", "ro", { lei: "8.000" }), "Maximum 8.000 lei pe lucrare");
  assert.equal(ft("badge", "xx"), "Pay per signed job");
  assert.equal(ft("nope"), "nope");
});
