import { test } from "node:test";
import assert from "node:assert/strict";
import { QFT, qft } from "./quoteFastText.js";

test("every key has all four languages, the same placeholders, and no banned punctuation", () => {
  for (const [k, e] of Object.entries(QFT)) {
    for (const l of ["en", "ro", "ru", "uk"]) {
      assert.ok(typeof e[l] === "string" && e[l].length > 0, `${k} missing ${l}`);
      assert.ok(!/[—–·✓✔…]/.test(e[l]), `${k} ${l} has a dash, middle dot, ellipsis or check mark`);
    }
    const vars = (s) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort().join();
    for (const l of ["ro", "ru", "uk"]) assert.equal(vars(e[l]), vars(e.en), `${k} ${l} placeholders differ from English`);
  }
});

test("Ukrainian text carries no Russian-only letters", () => {
  for (const [k, e] of Object.entries(QFT)) assert.ok(!/[ыэёъ]/i.test(e.uk), `${k} uk has a Russian letter`);
  assert.equal(qft("badge", "ro", { n: 82 }), "Scor 82");
});
