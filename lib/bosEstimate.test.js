/**
 * lib/bosEstimate.test.js — real voltage-drop and standard overcurrent-
 * sizing formulas. Reference values are hand-computed, not re-derived by
 * calling the functions under test.
 *
 * Run: node --test lib/
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { dcCableSize, dcCableLengthM, dcBreakerA, acBreakerA, spdCount } from "./bosEstimate.js";

test("dcCableSize: a short/low-current run picks the smallest standard cross-section (4mm²)", () => {
  // VD% = (2*20*10*0.0175)/(4*400)*100 = 7/1600*100 = 0.4375%
  const r = dcCableSize({ oneWayRunM: 20, currentA: 10, stringVoltageV: 400 });
  assert.equal(r.crossSectionMm2, 4);
  assert.ok(Math.abs(r.voltageDropPct - 0.4375) < 1e-9, `dropPct=${r.voltageDropPct}`);
  assert.equal(r.overThreshold, false);
});

test("dcCableSize: a long run that would exceed 1% on 4mm² steps up to 6mm²", () => {
  // 4mm²: (2*60*10*0.0175)/(4*400)*100 = 21/1600*100 = 1.3125% -> over 1%
  // 6mm²: 21/2400*100 = 0.875% -> clears
  const r = dcCableSize({ oneWayRunM: 60, currentA: 10, stringVoltageV: 400 });
  assert.equal(r.crossSectionMm2, 6);
  assert.ok(Math.abs(r.voltageDropPct - 0.875) < 1e-9, `dropPct=${r.voltageDropPct}`);
});

test("dcCableSize: flags overThreshold rather than silently under-sizing when even the largest standard size fails", () => {
  const r = dcCableSize({ oneWayRunM: 500, currentA: 15, stringVoltageV: 300 });
  assert.equal(r.crossSectionMm2, 16); // the largest standard size in the table
  assert.equal(r.overThreshold, true);
});

test("dcCableSize returns null, not NaN, on missing/zero inputs", () => {
  assert.equal(dcCableSize({ oneWayRunM: 0, currentA: 10, stringVoltageV: 400 }), null);
  assert.equal(dcCableSize({ oneWayRunM: 20, currentA: 0, stringVoltageV: 400 }), null);
  assert.equal(dcCableSize({ oneWayRunM: 20, currentA: 10, stringVoltageV: 0 }), null);
});

test("dcCableLengthM: home runs (2x one-way x strings) plus per-module interconnects", () => {
  // homeRun = 2*20*2 = 80; interModule = 1.2*14 = 16.8; total = 96.8
  const len = dcCableLengthM({ oneWayRunM: 20, strings: 2, modules: 14 });
  assert.ok(Math.abs(len - 96.8) < 1e-9, `len=${len}`);
});

test("dcBreakerA: next standard rating above 1.25x Isc", () => {
  // 1.25 * 13.9 = 17.375 -> next standard (6,10,13,16,20,25,32,...) is 20
  assert.equal(dcBreakerA(13.9), 20);
  assert.equal(dcBreakerA(0), null);
});

test("acBreakerA: single-phase uses 230V, three-phase uses 400V line-line", () => {
  // 1ph, 5kW: I = 5000/230 = 21.74A; 1.25x = 27.17A -> next standard 32A
  assert.equal(acBreakerA(5, 1), 32);
  // 3ph, 15kW: I = 15000/(sqrt(3)*400) = 21.65A; 1.25x = 27.07A -> next standard 32A
  assert.equal(acBreakerA(15, 3), 32);
  assert.equal(acBreakerA(0, 1), null);
});

test("spdCount: one DC SPD per MPPT input, one AC SPD per inverter", () => {
  assert.deepEqual(spdCount({ mpptInputs: 2, inverters: 1 }), { dc: 2, ac: 1 });
  assert.deepEqual(spdCount({ mpptInputs: 0, inverters: 0 }), { dc: 0, ac: 0 });
});
