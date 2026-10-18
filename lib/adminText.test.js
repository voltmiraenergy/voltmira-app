import { test } from "node:test";
import assert from "node:assert/strict";
import { AT, at } from "./adminText.js";

test("every key has all four languages, the same placeholders, and no banned punctuation", () => {
  for (const [k, e] of Object.entries(AT)) {
    for (const l of ["en", "ro", "ru", "uk"]) {
      assert.ok(typeof e[l] === "string" && e[l].length > 0, `${k} missing ${l}`);
      const text = e[l].replace(/(к|М)Вт·(ч|год)/g, "");
      assert.ok(!/[—–·✓✔]/.test(text), `${k} ${l} has a dash, middle dot or check mark`);
    }
    const vars = (s) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort().join();
    for (const l of ["ro", "ru", "uk"]) assert.equal(vars(e[l]), vars(e.en), `${k} ${l} placeholders differ from English`);
  }
});

test("Ukrainian text carries no Russian-only letters", () => {
  for (const [k, e] of Object.entries(AT)) assert.ok(!/[ыэёъ]/i.test(e.uk), `${k} uk has a Russian letter`);
});

test("at fills placeholders and falls back", () => {
  assert.equal(at("tr_publish", "ro", { v: 2 }), "Publică versiunea 2");
  assert.equal(at("tr_versions", "xx"), "Versions");
  assert.equal(at("nope", "ro"), "nope");
});
