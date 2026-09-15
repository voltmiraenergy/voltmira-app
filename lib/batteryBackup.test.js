/**
 * lib/batteryBackup.test.js — hours of backup at the household's own average
 * draw. The whole point of this number is that it must never be a fabricated
 * or exaggerated claim, so the edge cases matter as much as the happy path.
 * Run: node --test lib/batteryBackup.test.js
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { backupHours } from "./batteryBackup.js";

test("a typical household+battery pair gives a sane number of hours", () => {
  // 10 kWh battery, 4800 kWh/yr household -> avg draw 0.548 kW -> ~18.25 h
  const h = backupHours(10, 4800);
  assert.ok(Math.abs(h - 18.25) < 0.1, `h=${h}`);
});

test("more battery capacity means more hours, linearly", () => {
  const a = backupHours(5, 4800);
  const b = backupHours(10, 4800);
  assert.ok(Math.abs(b - a * 2) < 1e-9);
});

test("no battery means no backup claim — null, not zero, not a false positive", () => {
  assert.equal(backupHours(0, 4800), null);
  assert.equal(backupHours(null, 4800), null);
  assert.equal(backupHours(undefined, 4800), null);
  assert.equal(backupHours(-5, 4800), null);
});

test("no consumption data means the figure can't be computed — null, never Infinity", () => {
  assert.equal(backupHours(10, 0), null);
  assert.equal(backupHours(10, null), null);
  assert.equal(backupHours(10, undefined), null);
  assert.equal(backupHours(10, -100), null);
});

test("junk inputs never throw or produce NaN", () => {
  assert.doesNotThrow(() => backupHours("x", "y"));
  assert.equal(backupHours("x", "y"), null);
  assert.doesNotThrow(() => backupHours({}, []));
});

test("a bigger household (more annual consumption) gets fewer hours from the same battery", () => {
  const small = backupHours(10, 3000);
  const big = backupHours(10, 9000);
  assert.ok(big < small);
});
