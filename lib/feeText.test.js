import { test } from "node:test";
import assert from "node:assert/strict";
import { FT, ft, monthName, feeDay } from "./feeText.js";

test("every key has all four languages, the same placeholders, and no banned punctuation", () => {
  const holes = (s) => (s.match(/\{\w+\}/g) || []).sort().join(",");
  for (const [k, e] of Object.entries(FT)) {
    for (const l of ["en", "ro", "ru", "uk"]) {
      assert.ok(typeof e[l] === "string" && e[l].trim(), `${k} ${l}`);
      assert.equal(holes(e[l]), holes(e.en), `${k} ${l} placeholders`);
      assert.ok(!/[—–·✓✔…]/.test(e[l]), `${k} ${l} has a banned mark`);
    }
    assert.ok(!/[ыэёъ]/i.test(e.uk), `${k} uk has a Russian letter`);
  }
  assert.equal(ft("calc_out", "ro", { kw: 10 }), "Taxa VoltMira estimată pentru 10 kW");
});

test("month and day names, on the Chișinău clock", () => {
  assert.equal(monthName("2026-10", "ro"), "octombrie 2026");
  assert.equal(monthName("2026-10", "en"), "October 2026");
  assert.ok(!/[·]/.test(monthName("2026-10", "ru")));
  assert.equal(monthName("", "ro"), "");
  assert.match(feeDay("2026-10-31T22:30:00Z", "ro"), /^1 nov/);
});
