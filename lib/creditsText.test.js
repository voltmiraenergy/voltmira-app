import { test } from "node:test";
import assert from "node:assert/strict";
import { CR, cr } from "./creditsText.js";

test("every key has all four languages, the same placeholders, and no banned punctuation", () => {
  for (const [k, e] of Object.entries(CR)) {
    for (const l of ["en", "ro", "ru", "uk"]) {
      assert.ok(typeof e[l] === "string" && e[l].length > 0, `${k} missing ${l}`);
      assert.ok(!/[—–·✓✔…]/.test(e[l]), `${k} ${l} has a dash, middle dot, ellipsis or check mark`);
    }
    const vars = (s) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort().join();
    for (const l of ["ro", "ru", "uk"]) assert.equal(vars(e[l]), vars(e.en), `${k} ${l} placeholders differ from English`);
  }
});

test("Ukrainian text carries no Russian-only letters", () => {
  for (const [k, e] of Object.entries(CR)) assert.ok(!/[ыэёъ]/i.test(e.uk), `${k} uk has a Russian letter`);
});

test("the prices in the words are the prices decided", () => {
  assert.match(CR.pro_year.en, /490/);
  assert.match(CR.team_year.en, /1,190/);
  assert.match(CR.pro_month.en, /49/);
  assert.match(CR.team_month.en, /119/);
  assert.match(CR.pack10.en, /25/);
  assert.match(CR.pack50.en, /99/);
  assert.equal(cr("balance", "ro", { n: 7 }), "Ți-au rămas 7 credite");
});
