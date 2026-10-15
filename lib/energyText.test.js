import { test } from "node:test";
import assert from "node:assert/strict";
import { ET, et, sourceLine } from "./energyText.js";
import { PROGRAMS } from "./greenData.js";

test("every key has all four languages, the same placeholders, and no banned punctuation", () => {
  for (const [k, e] of Object.entries(ET)) {
    for (const l of ["en", "ro", "ru", "uk"]) {
      assert.ok(typeof e[l] === "string" && e[l].length > 0, `${k} missing ${l}`);
      // unit spellings such as "кВт·год" are standard; any other middle dot is decoration
      const text = e[l].replace(/(к|М)Вт·(ч|год)/g, "");
      assert.ok(!/[—–·✓✔]/.test(text), `${k} ${l} has a dash, middle dot or check mark`);
    }
    const vars = (s) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort().join();
    for (const l of ["ro", "ru", "uk"]) assert.equal(vars(e[l]), vars(e.en), `${k} ${l} placeholders differ from English`);
  }
});

test("Ukrainian text carries no Russian-only letters", () => {
  for (const [k, e] of Object.entries(ET)) assert.ok(!/[ыэёъ]/i.test(e.uk), `${k} uk has a Russian letter`);
});

test("every programme and client type has a name", () => {
  for (const p of PROGRAMS) assert.ok(ET["pg_" + p.id], p.id);
  for (const k of ["household", "sme", "company"]) assert.ok(ET["kind_" + k], k);
});

test("et fills placeholders, falls back to English, then to the key", () => {
  assert.equal(et("upto", "ro", { x: "12.000 lei" }), "până la 12.000 lei");
  assert.equal(et("sp_kind", "xx"), "Who is the client?");
  assert.equal(et("nope", "en"), "nope");
});

test("a source line names the publisher and the document in the reader's language", () => {
  assert.equal(sourceLine(["mbw2026"], "ro"), "Ministerul Energiei al Republicii Moldova, Moldova Business Week 2026");
  assert.match(sourceLine(["mbw2026", "moldpres_bess"], "en"), /; Moldpres, /);
});
