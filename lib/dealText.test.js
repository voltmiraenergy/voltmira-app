import { test } from "node:test";
import assert from "node:assert/strict";
import { DT, DT_BANK, dt } from "./dealText.js";

test("every key has all four languages, the same placeholders, and no banned punctuation", () => {
  for (const [k, e] of Object.entries(DT)) {
    for (const l of ["en", "ro", "ru", "uk"]) {
      assert.ok(typeof e[l] === "string" && e[l].length > 0, `${k} missing ${l}`);
      assert.ok(!/[—–·✓✔]/.test(e[l]), `${k} ${l} has a dash, middle dot or check mark`);
    }
    const vars = (s) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort().join();
    for (const l of ["ro", "ru", "uk"]) assert.equal(vars(e[l]), vars(e.en), `${k} ${l} placeholders differ`);
  }
});

test("Ukrainian text carries no Russian-only letters", () => {
  for (const [k, e] of Object.entries(DT)) assert.ok(!/[ыэёъ]/i.test(e.uk), `${k} uk has a Russian letter`);
});

test("what the bank reads is formal Romanian", () => {
  for (const [k, e] of Object.entries(DT_BANK)) assert.ok(!/\b(tu|tău|ta|poți|vrei|ești|încearcă|scrie)\b/i.test(e.ro), `${k} ro speaks informally`);
});

test("dt fills placeholders and picks the singular", () => {
  assert.equal(dt("dr_open_q", "ro", { n: 1, x: "Racordarea la rețea" }), "O întrebare așteaptă răspunsul tău: Racordarea la rețea.");
  assert.equal(dt("dr_open_q", "en", { n: 2, x: "a and b" }), "2 questions wait for your answer: a and b.");
  assert.equal(dt("nope"), "nope");
});
