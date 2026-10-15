import { test } from "node:test";
import assert from "node:assert/strict";
import { PT, pt } from "./portfolioText.js";

test("every key has all four languages, the same placeholders, and no banned punctuation", () => {
  for (const [k, e] of Object.entries(PT)) {
    for (const l of ["en", "ro", "ru", "uk"]) {
      assert.ok(typeof e[l] === "string" && e[l].length > 0, `${k} missing ${l}`);
      // the unit spelling "кВт·ч" is standard and used app-wide; any other middle dot is decoration
      const text = e[l].replace(/(к|М)Вт·(ч|год)|А·(ч|год)/g, "");
      assert.ok(!/[—·✓]/.test(text), `${k} ${l} has an em dash, middle dot or check mark`);
    }
    const vars = (s) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort().join();
    for (const l of ["ro", "ru", "uk"]) assert.equal(vars(e[l]), vars(e.en), `${k} ${l} placeholders differ from English`);
  }
});

test("Ukrainian text carries no Russian-only letters", () => {
  for (const [k, e] of Object.entries(PT)) {
    assert.ok(!/[ыэёъ]/i.test(e.uk), `${k} uk has a Russian letter`);
  }
});

test("pt fills placeholders and falls back to English, then to the key", () => {
  assert.equal(pt("st_tariff", "en", { n: 20 }), "Price paid 20% lower");
  assert.equal(pt("n_assets", "uk", { n: 3 }), "об’єктів: 3");
  assert.equal(pt("nope", "en"), "nope");
  assert.equal(pt("nav", "xx"), "Portfolios");
});
