/**
 * lib/leadSizing.test.js — this sizes a stranger's roof sight-unseen, so the
 * edges (no bill, a junk bill, a bill in the wrong currency) matter as much as
 * the happy path.
 *
 * Run: node --test lib/leadSizing.test.js
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { annualConsFromBill, sizeSystemKw } from "./leadSizing.js";

// RO: price 0.21 EUR/kWh, RON 4.97/EUR (matches @voltmira/engine's MARKETS/FX)
const RO_PRICE = 0.21, RON = 4.97;

test("a real bill converts through the local currency to annual kWh", () => {
  // 350 RON/mo -> 70.42 EUR/mo -> 845.07 EUR/yr -> /0.21 = 4024.1 kWh/yr
  const c = annualConsFromBill(350, RO_PRICE, RON);
  assert.ok(Math.abs(c - 4024.1) < 1, `cons=${c}`);
});

test("no bill falls back to a typical household, not zero", () => {
  assert.equal(annualConsFromBill(null, RO_PRICE, RON), 4200);
  assert.equal(annualConsFromBill(undefined, RO_PRICE, RON), 4200);
  assert.equal(annualConsFromBill(0, RO_PRICE, RON), 4200);
  assert.equal(annualConsFromBill(-50, RO_PRICE, RON), 4200);
  assert.equal(annualConsFromBill("not a number", RO_PRICE, RON), 4200);
});

test("a missing price can't produce an invented number, and a zero FX rate can't divide by zero", () => {
  assert.equal(annualConsFromBill(350, 0, RON), 4200, "no price means the formula can't run at all");
  // A zero or missing FX rate both fall back to 1:1 (no conversion) rather than
  // crashing or zeroing out — 350 * 12 / 0.21 = 20000, clamped band untouched.
  const noConversion = Math.min(30000, Math.max(800, (350 * 12) / RO_PRICE));
  assert.equal(annualConsFromBill(350, RO_PRICE, 0), noConversion, "fx=0 must not divide by zero");
  assert.equal(annualConsFromBill(350, RO_PRICE, undefined), noConversion, "a missing fx rate defaults to 1:1");
});

test("consumption is clamped to a plausible residential band either way", () => {
  // an implausibly huge bill must not size a factory off one household lead
  assert.equal(annualConsFromBill(100000, RO_PRICE, RON), 30000);
  // an implausibly tiny bill still gets a floor
  assert.equal(annualConsFromBill(1, RO_PRICE, RON), 800);
});

test("system size follows consumption, rounded to the nearest half kW", () => {
  // 4200 kWh / 1100 kWh/kWp = 3.818 -> *2=7.636 -> round 8 -> /2 = 4.0
  assert.equal(sizeSystemKw(4200, 1100), 4);
  // 6000 / 1200 = 5 exactly
  assert.equal(sizeSystemKw(6000, 1200), 5);
});

test("system size is clamped to a household range, not a mansion or a nightlight", () => {
  assert.equal(sizeSystemKw(100000, 1100), 15, "must not size a 90 kW array off one lead");
  assert.equal(sizeSystemKw(10, 1100), 2, "must not size an unbuildable fraction of a kW");
});

test("junk inputs return a safe default kW rather than NaN or Infinity", () => {
  assert.equal(sizeSystemKw(4200, 0), 3);
  assert.equal(sizeSystemKw(0, 1100), 3);
  assert.equal(sizeSystemKw(null, undefined), 3);
  assert.ok(Number.isFinite(sizeSystemKw("x", "y")));
});
