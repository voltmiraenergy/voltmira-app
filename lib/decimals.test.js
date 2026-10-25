import { test } from "node:test";
import assert from "node:assert/strict";
import { dec } from "./decimals.js";

test("dec writes decimals the way each language does", () => {
  assert.equal(dec(6, 1, "ro"), "6,0");
  assert.equal(dec(6, 1, "en"), "6.0");
  assert.equal(dec(2.934, 2, "ru"), "2,93");
  assert.equal(dec(2.934, 2, "uk"), "2,93");
  assert.equal(dec(1234.5, 1, "en"), "1,234.5");
});

test("dec is empty for what is not a number, and Romanian for an unknown language", () => {
  assert.equal(dec(undefined, 1, "ro"), "");
  assert.equal(dec(null, 1, "ro"), "0,0");
  assert.equal(dec(1.25, 1, "xx"), "1,3");
});
