import { test } from "node:test";
import assert from "node:assert/strict";
import { ET, et } from "./estimateText.js";

test("every key has all four languages, the same placeholders, and no banned punctuation", () => {
  for (const [k, e] of Object.entries(ET)) {
    for (const l of ["en", "ro", "ru", "uk"]) {
      assert.ok(typeof e[l] === "string" && e[l].length > 0, `${k} missing ${l}`);
      assert.ok(!/[—–·✓✔…]/.test(e[l]), `${k} ${l} has a dash, middle dot, ellipsis or check mark`);
    }
    const vars = (s) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort().join();
    for (const l of ["ro", "ru", "uk"]) assert.equal(vars(e[l]), vars(e.en), `${k} ${l} placeholders differ from English`);
  }
});

test("a homeowner is addressed formally, and Ukrainian has no Russian-only letters", () => {
  for (const [k, e] of Object.entries(ET)) {
    assert.ok(!/[ыэёъ]/i.test(e.uk), `${k} uk has a Russian letter`);
    assert.ok(!/\b(tu|ta|tău|tale|ai)\b/i.test(e.ro), `${k} ro speaks informally`);
  }
  assert.equal(et("thanks", "ro", { co: "SolarTech" }), "SolarTech a primit cererea și vă contactează în curând.");
});
