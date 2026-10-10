import { test } from "node:test";
import assert from "node:assert/strict";
import { normalizeTitle, VALID_TITLES } from "./teamValidation.js";

test("each recognized title passes through unchanged", () => {
  for (const t of VALID_TITLES) assert.equal(normalizeTitle(t), t);
});

test("an empty string is a valid, distinct value (an explicit clear)", () => {
  assert.equal(normalizeTitle(""), "");
});

test("an unrecognized string, a number, null, or undefined all normalize to null", () => {
  assert.equal(normalizeTitle("ceo"), null);
  assert.equal(normalizeTitle("Sales"), null); // case-sensitive on purpose — no silent guessing
  assert.equal(normalizeTitle(123), null);
  assert.equal(normalizeTitle(null), null);
  assert.equal(normalizeTitle(undefined), null);
});
