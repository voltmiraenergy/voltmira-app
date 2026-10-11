import { test } from "node:test";
import assert from "node:assert/strict";
import { CT, ct } from "./cnedText.js";

test("every key has all four languages, the same placeholders, and no banned punctuation", () => {
  for (const [k, e] of Object.entries(CT)) {
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
  for (const [k, e] of Object.entries(CT)) assert.ok(!/[ыэёъ]/i.test(e.uk), `${k} uk has a Russian letter`);
});

test("ct fills placeholders and falls back to English, then to the key", () => {
  assert.equal(ct("p_rank", "ro", { r: 3, t: 35 }), "locul 3 din 35");
  assert.equal(ct("mk_h", "xx"), "Your market");
  assert.equal(ct("nope"), "nope");
});
