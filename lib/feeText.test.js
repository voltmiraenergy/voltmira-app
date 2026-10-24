import { test } from "node:test";
import assert from "node:assert/strict";
import { FT, ft } from "./feeText.js";

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
  assert.equal(ft("grace_left", "ro", { n: 9 }), "Mai ai 9 zile să plătești. Până atunci documentele rămân deschise.");
});
