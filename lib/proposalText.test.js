import { test } from "node:test";
import assert from "node:assert/strict";
import { PP, ppt, yearsN, kwhUnit } from "../app/p/[code]/text.js";

test("every key has all four languages, the same placeholders, and no banned punctuation", () => {
  for (const [k, e] of Object.entries(PP)) {
    for (const l of ["en", "ro", "ru", "uk"]) {
      assert.ok(typeof e[l] === "string" && e[l].length > 0, `${k} missing ${l}`);
      // the unit spellings "кВт·ч" and "кВт·год" are standard; any other middle dot is decoration
      const text = e[l].replace(/(к|М)Вт·(ч|год)/g, "");
      assert.ok(!/[—–·✓✔]/.test(text), `${k} ${l} has an em or en dash, a middle dot or a check mark`);
    }
    const vars = (s) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort().join();
    for (const l of ["ro", "ru", "uk"]) assert.equal(vars(e[l]), vars(e.en), `${k} ${l} placeholders differ from English`);
  }
});

test("Ukrainian text carries no Russian-only letters", () => {
  for (const [k, e] of Object.entries(PP)) {
    assert.ok(!/[ыэёъ]/i.test(e.uk), `${k} uk has a Russian letter`);
  }
});

test("the client is addressed formally in Romanian", () => {
  // informal "tu" forms a homeowner should never be addressed with
  // (letter-aware boundaries: \b treats "ț" as a non-letter, so "Scrieți" would match "scrie")
  const informal = /(?<!\p{L})(tu|tine|ta|tău|tale|tăi|ești|ai ales|accepți|verifică|economisești|semnează|scrie|desenează)(?!\p{L})/iu;
  for (const [k, e] of Object.entries(PP)) {
    assert.ok(!informal.test(e.ro), `${k} ro uses an informal form: ${e.ro}`);
  }
});

test("ppt fills placeholders and falls back to English, then to the key", () => {
  assert.equal(ppt("valid_until", "en", { d: "20 Oct 2026" }), "Valid until 20 Oct 2026");
  assert.equal(ppt("signed_by", "uk", { name: "Іван", date: "1 жовт." }), "Підписано: Іван, 1 жовт.");
  assert.equal(ppt("nope", "en"), "nope");
  assert.equal(ppt("faq_h", "xx"), "Questions");
});

test("years follow each language's plural rule", () => {
  assert.equal(yearsN(1, "en"), "1 year");
  assert.equal(yearsN(25, "en"), "25 years");
  assert.equal(yearsN(1, "ro"), "1 an");
  assert.equal(yearsN(10, "ro"), "10 ani");
  assert.equal(yearsN(25, "ro"), "25 de ani");
  assert.equal(yearsN(2, "ru"), "2 года");
  assert.equal(yearsN(25, "ru"), "25 лет");
  assert.equal(yearsN(21, "uk"), "21 рік");
  assert.equal(yearsN(3, "uk"), "3 роки");
  assert.equal(yearsN(10, "uk"), "10 років");
  assert.equal(kwhUnit("uk"), "кВт·год");
  assert.equal(kwhUnit("ro"), "kWh");
});
