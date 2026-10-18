import { test } from "node:test";
import assert from "node:assert/strict";
import { HT, ht } from "./homeText.js";

const LANGS = ["en", "ro", "ru", "uk"];
const holes = (s) => (s.match(/\{\w+\}/g) || []).sort().join(",");

test("every key has all four languages, the same placeholders, and no banned punctuation", () => {
  for (const [k, e] of Object.entries(HT)) {
    for (const l of LANGS) {
      assert.ok(typeof e[l] === "string" && e[l].trim(), `${k} ${l}`);
      assert.equal(holes(e[l]), holes(e.en), `${k} ${l} placeholders`);
      assert.ok(!/[—–·✓✔]/.test(e[l]), `${k} ${l} has a banned mark`);
    }
    assert.ok(!/[ыэёъ]/i.test(e.uk), `${k} uk has a Russian letter`);
  }
});

test("the homeowner is addressed formally in Romanian", () => {
  // letter-aware boundaries: \b treats "ț" as a non-letter
  const informal = /(?<!\p{L})(tu|tine|ta|tău|tale|tăi|ești|ai|poți|vrei|apasă|completează|introdu)(?!\p{L})/iu;
  for (const [k, e] of Object.entries(HT)) assert.ok(!informal.test(e.ro), `${k}: ${e.ro}`);
});

test("ht fills placeholders and falls back", () => {
  assert.equal(ht("hm_by", "ro", { co: "SolarTech" }), "Instalat de SolarTech");
  assert.equal(ht("nope", "ro"), "nope");
});
