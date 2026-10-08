import { test } from "node:test";
import assert from "node:assert/strict";
import { BT, bt } from "./bankText.js";

test("every key has all four languages, the same placeholders, and no banned punctuation", () => {
  for (const [k, e] of Object.entries(BT)) {
    for (const l of ["en", "ro", "ru", "uk"]) {
      assert.ok(typeof e[l] === "string" && e[l].length > 0, `${k} missing ${l}`);
      const text = e[l].replace(/(к|М)Вт·(ч|год)/g, "");
      assert.ok(!/[—–·✓✔]/.test(text), `${k} ${l} has a dash, middle dot or check mark`);
    }
    const vars = (s) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort().join();
    for (const l of ["ro", "ru", "uk"]) assert.equal(vars(e[l]), vars(e.en), `${k} ${l} placeholders differ`);
  }
});

test("Ukrainian text carries no Russian-only letters", () => {
  for (const [k, e] of Object.entries(BT)) assert.ok(!/[ыэёъ]/i.test(e.uk), `${k} uk has a Russian letter`);
});

test("the document is written for the bank: no informal Romanian", () => {
  for (const [k, e] of Object.entries(BT)) assert.ok(!/\b(tu|tău|poți|vrei|ești)\b/i.test(e.ro), `${k} ro speaks informally`);
});

test("bt fills placeholders and picks the singular", () => {
  assert.equal(bt("pack_missing", "ro", { n: 1, x: "Teren" }), "Lipsește încă un element: Teren.");
  assert.equal(bt("pack_missing", "en", { n: 3, x: "a, b and c" }), "3 items still missing: a, b and c.");
  assert.equal(bt("nope"), "nope");
});
