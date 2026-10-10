import { test } from "node:test";
import assert from "node:assert/strict";
import { PT, plt } from "./plantText.js";
import { PERMITS, STATUSES } from "./plantPermits.js";

test("every key has all four languages, the same placeholders, and no banned punctuation", () => {
  for (const [k, e] of Object.entries(PT)) {
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
  for (const [k, e] of Object.entries(PT)) assert.ok(!/[ыэёъ]/i.test(e.uk), `${k} uk has a Russian letter`);
});

test("every permit and status has words", () => {
  for (const p of PERMITS) assert.ok(PT["pm_" + p.id], p.id);
  for (const s of STATUSES) assert.ok(PT["ps_" + s], s);
});

test("plt fills placeholders and picks the singular", () => {
  assert.equal(plt("n_plants", "ro", { n: 1 }), "1 centrală");
  assert.equal(plt("n_plants", "ro", { n: 3 }), "3 centrale");
  assert.equal(plt("nope"), "nope");
});
