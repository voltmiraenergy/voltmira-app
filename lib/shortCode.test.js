import { test } from "node:test";
import assert from "node:assert/strict";
import { shortCode } from "./shortCode.js";

test("an offer's code: 12 characters by default, from the 31 with no lookalikes, every character in use", () => {
  const seen = new Set();
  for (let i = 0; i < 2000; i++) {
    const c = shortCode();
    assert.match(c, /^[abcdefghjkmnpqrstuvwxyz23456789]{12}$/);
    for (const ch of c) seen.add(ch);
  }
  assert.equal(seen.size, 31);
  assert.equal(shortCode(6).length, 6);
  assert.notEqual(shortCode(), shortCode());
});
