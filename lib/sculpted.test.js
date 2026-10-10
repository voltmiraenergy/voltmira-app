import { test } from "node:test";
import assert from "node:assert/strict";
import { debtSchedule, normalizeFinance } from "./projectFinance.js";
import { evaluatePlant } from "./plantFinance.js";
import { sizeDebt, capacitySculpted } from "./debtSizing.js";
import { runPortfolioStress } from "./portfolio.js";
import { defaultEngineSettings } from "../engine/engine.js";

const E = { ...defaultEngineSettings(), horizon: 25 };
const PLANT = {
  id: "p1", name: "Test park", lat: 46, lon: 28.5,
  wind: { mw: 20, turbines: 4, hubM: 120, study: { p50Mwh: 60000, p90Mwh: 52000 } },
  solar: { mwp: 10, yieldKwhKwp: 1250, degrPctYr: 0.5 },
  revenue: { kind: "auction", priceEurMwh: 62.04, years: 15, afterEurMwh: 50 },
  costs: { windEurPerKw: 1200, solarEurPerKw: 500, gridEur: 1000000, devPct: 3, opexWindEurPerKwYr: 35, opexSolarEurPerKwYr: 10, landEurYr: 30000, insurancePct: 0.35 },
};
const SC = { gearingPct: 60, ratePct: 6.5, tenorYears: 12, repayment: "sculpted" };

test("the setting is kept, anything else means equal instalments", () => {
  assert.equal(normalizeFinance({ repayment: "sculpted" }).repayment, "sculpted");
  assert.equal(normalizeFinance({ repayment: "odd" }).repayment, "annuity");
  assert.equal(normalizeFinance({}).repayment, "annuity");
});

test("a sculpted schedule pays in proportion to the shape and repays the loan exactly", () => {
  const shape = [100, 120, 90, 110, 80, 130, 100, 100];
  const fin = { ratePct: 7, tenorYears: 6, repayment: "sculpted" };
  const s = debtSchedule(1000, fin, 8, shape);
  const k = s[0].payment / shape[0];
  for (let i = 0; i < 6; i++) assert.ok(Math.abs(s[i].payment / shape[i] - k) < 1e-9, `year ${i + 1}`);
  assert.equal(s[6].payment, 0);
  assert.ok(Math.abs(s[5].balance) < 1e-6);
  // the payments' present value at the loan rate is the loan
  const pv = s.slice(0, 6).reduce((t, d, i) => t + d.payment / Math.pow(1.07, i + 1), 0);
  assert.ok(Math.abs(pv - 1000) < 1e-6);
  // a flat shape is the ordinary annuity
  const flat = debtSchedule(1000, fin, 8, [1, 1, 1, 1, 1, 1]);
  const ann = debtSchedule(1000, { ...fin, repayment: "annuity" }, 8);
  flat.forEach((d, i) => assert.ok(Math.abs(d.payment - ann[i].payment) < 1e-9));
});

test("sculpted on the base case: the P50 cover is level; P90 keeps the same payments and shows the real cover", () => {
  const p50 = evaluatePlant(PLANT, E, SC, {});
  const live = p50.dscr.filter((v) => v != null);
  assert.equal(live.length, 12);
  for (const v of live) assert.ok(Math.abs(v - live[0]) < 1e-9);
  const p90 = evaluatePlant(PLANT, E, SC, {}, { exceed: "P90" });
  // the same payments, so a weaker year shows up as weaker cover
  p90.debtService.forEach((d, i) => assert.ok(Math.abs(d - p50.debtService[i]) < 1e-6));
  assert.ok(p90.dscrMin < p50.dscrMin);
  // and the line is not flat
  assert.ok(Math.abs(p50.debtService[0] - p50.debtService[11]) > 1);
});

test("sizing with sculpted repayment: the capacity puts every year at the target", () => {
  const r = evaluatePlant(PLANT, E, { ...SC, gearingPct: 0 }, {});
  const r90 = evaluatePlant(PLANT, E, { ...SC, gearingPct: 0 }, {}, { exceed: "P90" });
  const sz = sizeDebt({ cfadsP50: r.cfads, cfadsP90: r90.cfads, capexNetEur: r.capexNetEur, fin: SC, scenario: {}, sizing: { maxGearingPct: 95 } });
  assert.equal(sz.repayment, "sculpted");
  assert.ok(Math.abs(sz.p50.loanEur - capacitySculpted(r.cfads, SC, {}, sz.p50Dscr)) < 1e-6);
  assert.ok(sz.levelEur <= sz.capacityEur + 1e-6, "sculpting never supports less than level repayments");
  // borrow exactly the P50 capacity: every year's cover is the target
  const atCap = evaluatePlant(PLANT, E, { ...SC, gearingPct: (sz.p50.loanEur / r.capexNetEur) * 100 }, {});
  for (const v of atCap.dscr.filter((x) => x != null)) assert.ok(Math.abs(v - sz.p50Dscr) < 1e-6);
});

test("stress cases do not reshape a sculpted loan", () => {
  const assets = [{ id: "p1", kind: "plant", plant: PLANT, name: "x", market: "MD", region: "", kw: 30000 }];
  const suite = runPortfolioStress(assets, E, SC, {});
  const base = suite.find((c) => c.id === "base").agg;
  const delay = suite.find((c) => c.id === "delay").agg;
  // a late start with payments that still fall due from year 1
  assert.ok(delay.dscrMin < base.dscrMin);
  base.debtService.forEach((d, i) => assert.ok(Math.abs(d - delay.debtService[i]) < 1e-6));
});
