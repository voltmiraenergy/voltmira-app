/**
 * Quote-analysis tests. The battery sweep decides what an installer tells a
 * client to buy, so its edge cases are asserted rather than eyeballed.
 *
 * Run: node --test lib/quoteAnalysis.test.js
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { defaultEngineSettings, simulate } from "@voltmira/engine";
import { batterySweep, financials, bomTotal, bomPricesBattery, surplusRevenue } from "./quoteAnalysis.js";

const E = defaultEngineSettings();
const MD = { market: "MD", kw: 6, price: 0.18, cons: 5000 };
const RO = { market: "RO", kw: 6, price: 0.21, cons: 5000 };

test("a battery that never pays recommends 0 kWh, not the biggest one swept", () => {
  // RO is 1:1 net metering — exports are already credited at the retail price,
  // so storage only adds cost. The old code fell through to the last swept
  // point and recommended 10 kWh on a system where storage lost money.
  const s = batterySweep(RO, E, 0);
  assert.equal(s.paysOff, false, "storage must not read as paying off under 1:1 net metering");
  assert.equal(s.knee, 0, `recommended ${s.knee} kWh where every capacity loses money`);
  assert.ok(s.atKnee === s.base0, "the recommendation's value must be the no-battery value");
});

test("under net billing the battery does pay, and the knee sits inside the range", () => {
  const s = batterySweep(MD, E, 0);
  assert.equal(s.paysOff, true);
  assert.ok(s.knee > 0 && s.knee < s.max, `knee=${s.knee} should be a real interior point`);
  assert.ok(s.atKnee > s.base0, "the recommendation must be worth more than no battery");
});

test("the recommendation never sits past the peak of the curve", () => {
  const s = batterySweep(MD, E, 0);
  const peakIdx = s.deltas.reduce((best, v, i) => (v > s.deltas[best] ? i : best), 0);
  assert.ok(s.knee <= s.pts[peakIdx].b + 1e-9,
    `knee ${s.knee} is past the peak at ${s.pts[peakIdx].b} — capacity beyond it is worth less, not more`);
});

test("the sweep extends past whatever capacity is already quoted", () => {
  // A 13 kWh pick against a 10 kWh sweep reported the value at 10 instead —
  // the chart's dot and the "current pick" tile both silently lied.
  const s = batterySweep(MD, E, 13);
  assert.ok(s.max >= 13, `max=${s.max} must cover the 13 kWh already quoted`);
  const at13 = s.pts.find((p) => Math.abs(p.b - 13) < 1e-9);
  assert.ok(at13, "13 kWh must be an actual point in the sweep");
  assert.equal(s.atCurrent, at13.year1, "the current-pick value must be the value AT 13 kWh");
});

test("a capacity below the recommendation is worth less than the recommendation", () => {
  const s = batterySweep(MD, E, 1);
  assert.ok(s.atCurrent <= s.atKnee, "1 kWh cannot beat the recommended size");
});

test("junk current capacity doesn't break the sweep", () => {
  for (const bad of [undefined, null, NaN, -5, "x"]) {
    const s = batterySweep(MD, E, bad);
    assert.ok(Number.isFinite(s.atCurrent), `current=${String(bad)} produced ${s.atCurrent}`);
    assert.equal(s.atCurrent, s.base0, "no battery means the no-battery value");
  }
});

test("financials: NPV falls as the discount rate rises, IRR is null when it never crosses", () => {
  const sim = simulate({ ...MD, batt: false }, E, "expc");
  const cheap = financials(sim, sim.grossCost, 3, E);
  const dear = financials(sim, sim.grossCost, 12, E);
  assert.ok(cheap.npv > dear.npv, `NPV must fall with the rate: ${cheap.npv} vs ${dear.npv}`);
  assert.ok(cheap.irr === null || (cheap.irr > -0.5 && cheap.irr < 1.5), "IRR must be in the bracketed range or null");
  // A system that can never pay back has no IRR to report. `rows` is CUMULATIVE
  // cashflow seeded at -cost, so "loses 1000 every year" is a falling series,
  // not a flat one — every yearly net is negative and NPV never crosses zero.
  const losing = Array.from({ length: 25 }, (_, i) => -10000 - 1000 * (i + 1));
  const dead = financials({ rows: losing, prod0: 0 }, 10000, 6, E);
  assert.equal(dead.irr, null, "no sign change must give null, not a fabricated rate");
  assert.equal(dead.lcoe, 0, "no production must give 0, not Infinity");
  assert.ok(dead.npv < 0, "a permanently losing project must have negative NPV");
});

test("bomTotal sums qty x unit price and survives junk lines", () => {
  assert.equal(bomTotal([{ qty: 10, unit_price: 78 }, { qty: 1, unit_price: 820 }]), 1600);
  assert.equal(bomTotal([{ qty: "3", unit_price: "10" }]), 30, "numeric strings must count");
  assert.equal(bomTotal([{}, { qty: null }, { unit_price: 5 }]), 0);
  assert.equal(bomTotal(undefined), 0);
  assert.equal(bomTotal("nope"), 0);
});

test("bomPricesBattery only counts a battery line with real quantity", () => {
  assert.equal(bomPricesBattery([{ kind: "battery", qty: 1 }]), true);
  assert.equal(bomPricesBattery([{ kind: "battery", qty: 0 }]), false);
  assert.equal(bomPricesBattery([{ kind: "panel", qty: 10 }]), false);
  assert.equal(bomPricesBattery([]), false);
});

test("surplus revenue scales with what is actually exported", () => {
  const none = surplusRevenue(10000, 1, 19.8);      // 100% self-consumed
  assert.equal(none.totalKwh, 0);
  assert.equal(none.mdl, 0);
  const half = surplusRevenue(10000, 0.5, 19.8);
  assert.ok(Math.abs(half.totalKwh - 5000) < 1, `exported ${half.totalKwh}`);
  assert.ok(half.mdl > 0 && half.eur > 0);
  // Self-consumption over 100% (or junk) must never invent negative exports.
  assert.equal(surplusRevenue(10000, 1.4, 19.8).totalKwh, 0);
  assert.equal(surplusRevenue(-5, 0.5, 19.8).totalKwh, 0);
});
