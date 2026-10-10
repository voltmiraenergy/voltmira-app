import { test } from "node:test";
import assert from "node:assert/strict";
import { defaultEngineSettings } from "@voltmira/engine";
import { evaluateProject, debtSchedule, normalizeFinance } from "./projectFinance.js";
import { sizeDebt, unitDebtService, capacityLevel, capacitySculpted, normalizeSizing, capacityByTenor, DEFAULT_SIZING } from "./debtSizing.js";
import { buildModel } from "./portfolioModel.js";

const E = { ...defaultEngineSettings(), fx: { UAH: 50, MDL: 19.8 } };
const close = (a, b, eps = 1e-6) => assert.ok(Math.abs(a - b) <= eps * Math.max(1, Math.abs(b)), `${a} vs ${b}`);
const row = (id, o = {}) => ({
  id, title: "Site " + id, client_name: "C" + id, address: "", kw: 500, price: 0.18, cons: 600000, market: "MD",
  batt: false, status: "won", yield_per_kwp: 1250, ...o,
});
const projects = [row("a"), row("b", { kw: 300, price: 0.16 }), row("c", { market: "UA", price: 0.1, kw: 200, address: "Київ" })];
const model = (finance, scenario = {}) => buildModel({ portfolio: { market: "MD", project_ids: ["a", "b", "c"], finance, scenario }, projects, E });

test("a loan's debt service is its size times the service of 1 EUR, on every term the model has", () => {
  const input = { kw: 400, price: 0.18, cons: 300000, market: "MD", yieldOverride: 1200 };
  for (const fin of [
    { gearingPct: 70, ratePct: 8, tenorYears: 10 },
    { gearingPct: 60, ratePct: 9, rateSteps: [0, 5, 7], tenorYears: 3, principalCompensationPct: 30, debtCurrency: "local" },
    { gearingPct: 50, ratePct: 0, tenorYears: 6 },
  ]) {
    const sc = { localDepreciationPctYr: 4 };
    const r = evaluateProject(input, E, fin, sc);
    const u = unitDebtService(fin, sc, r.years);
    r.debtService.forEach((d, i) => close(d, r.loanEur * u[i], 1e-9));
  }
});

test("capacity: the binding year's CFADS covers the service exactly at the target, every other year more", () => {
  const cf = [100, 120, 90, 130, 140];
  const unit = [0.3, 0.3, 0.3, 0.3, 0];
  const c = capacityLevel(cf, unit, 1.3);
  close(c.loanEur, 90 / (1.3 * 0.3));
  assert.equal(c.bindingYear, 3);
  cf.forEach((v, i) => { if (unit[i] > 0) assert.ok(v / (c.loanEur * unit[i]) >= 1.3 - 1e-12); });
  assert.deepEqual(capacityLevel([1, 2], [0, 0], 1.3), { loanEur: null, bindingYear: null }, "no repayment year, no test");
  assert.equal(capacityLevel([-5, 10], [0.5, 0.5], 1.2).loanEur, 0, "a negative year means no debt, not negative debt");
});

test("sizing the portfolio: at the recommended share, the model passes both tests; at a share above capacity it fails one", () => {
  const m = model({ gearingPct: 70, ratePct: 8, tenorYears: 10 });
  const s = m.sizing;
  assert.equal(s.p50Dscr, 1.3); assert.equal(s.p90Dscr, 1.2); assert.equal(s.maxGearingPct, 80);
  close(s.capacityEur, Math.min(s.p50.loanEur, s.p90.loanEur, s.gearingCapEur));
  assert.ok(["p50", "p90", "gearing"].includes(s.binding));
  const at = model({ gearingPct: s.recommendedGearingPct, ratePct: 8, tenorYears: 10 });
  assert.ok(at.agg.dscrMin >= 1.3 - 1e-9, `P50 ${at.agg.dscrMin}`);
  assert.ok(at.p90.dscrMin >= 1.2 - 1e-9, `P90 ${at.p90.dscrMin}`);
  assert.ok(at.sizing.withinCapacity);
  if (s.binding !== "gearing") {
    const over = model({ gearingPct: s.recommendedGearingPct + 1, ratePct: 8, tenorYears: 10 });
    assert.ok(over.agg.dscrMin < 1.3 || over.p90.dscrMin < 1.2, "one percent more breaks a test");
    assert.equal(over.sizing.withinCapacity, false);
  }
  // the capacity does not depend on the share modelled
  close(model({ gearingPct: 20, ratePct: 8, tenorYears: 10 }).sizing.capacityEur, s.capacityEur);
  close(model({ gearingPct: 0, ratePct: 8, tenorYears: 10 }).sizing.capacityEur, s.capacityEur);
});

test("the recommended share is floored to half a percent and never above the cap", () => {
  const s = sizeDebt({ cfadsP50: [100, 100, 100], cfadsP90: [90, 90, 90], capexNetEur: 1000, fin: { ratePct: 0, tenorYears: 3, gearingPct: 70 }, sizing: { maxGearingPct: 95 } });
  // service of 1 EUR at 0% over 3 years is 1/3 a year: P50 allows 100/(1.3/3) = 230.77, P90 90/(1.2/3) = 225
  close(s.p50.loanEur, 300 / 1.3);
  close(s.p90.loanEur, 225);
  assert.equal(s.binding, "p90");
  assert.equal(s.recommendedGearingPct, 22.5);
  assert.equal(s.withinCapacity, false);
  close(s.headroomEur, 225 - 700);
  const capped = sizeDebt({ cfadsP50: [1e6], cfadsP90: [1e6], capexNetEur: 1000, fin: { ratePct: 5, tenorYears: 1 }, sizing: { maxGearingPct: 60 } });
  assert.equal(capped.binding, "gearing");
  assert.equal(capped.recommendedGearingPct, 60);
});

test("a longer term supports more debt; a higher target supports less", () => {
  const m = model({ gearingPct: 50, ratePct: 8, tenorYears: 10 });
  const t = m.sizing.byTenor;
  assert.deepEqual(t.map((x) => x.tenorYears), [5, 7, 10, 12, 15], "the current term (10) is already on the list");
  assert.deepEqual(model({ gearingPct: 50, ratePct: 8, tenorYears: 6 }).sizing.byTenor.map((x) => x.tenorYears), [5, 6, 7, 10, 12, 15]);
  for (let i = 1; i < t.length; i++) assert.ok(t[i].capacityEur >= t[i - 1].capacityEur - 1e-6);
  const strict = sizeDebt({ cfadsP50: m.agg.cfads, cfadsP90: m.p90.cfads, capexNetEur: m.agg.capexEur, fin: m.fin, sizing: { p50Dscr: 1.5, p90Dscr: 1.4, maxGearingPct: 95 } });
  const loose = sizeDebt({ cfadsP50: m.agg.cfads, cfadsP90: m.p90.cfads, capexNetEur: m.agg.capexEur, fin: m.fin, sizing: { p50Dscr: 1.1, p90Dscr: 1.0, maxGearingPct: 95 } });
  assert.ok(strict.capacityEur < loose.capacityEur);
  assert.equal(capacityByTenor({ cfadsP50: [], cfadsP90: [], capexNetEur: 0, fin: {}, tenors: [3] }).length, 1);
});

test("a sculpted loan repays exactly from CFADS / target, including the state's repayment after year 1", () => {
  const cf = [80, 95, 110, 120, 125, 130];
  for (const fin of [
    { ratePct: 8, tenorYears: 6 },
    { ratePct: 9, rateSteps: [0, 5, 7], tenorYears: 5, principalCompensationPct: 20 },
    { ratePct: 12, tenorYears: 4, debtCurrency: "local" },
  ]) {
    const sc = { localDepreciationPctYr: 3 };
    const f = normalizeFinance(fin);
    const L = capacitySculpted(cf, fin, sc, 1.25);
    let bal = L;
    for (let y = 1; y <= f.tenorYears; y++) {
      const r = (f.rateSteps && f.rateSteps[y - 1] != null ? f.rateSteps[y - 1] : f.ratePct) / 100;
      const eur = cf[y - 1] / 1.25;
      const local = f.debtCurrency === "local" ? eur / Math.pow(1 - 0.03, y - 1) : eur;
      bal = bal * (1 + r) - local - (y === 1 ? L * f.principalCompensationPct / 100 : 0);
    }
    close(bal, 0, 1e-9);
  }
  // sculpting to a rising cash flow supports at least what a level loan does
  const lvl = capacityLevel(cf, unitDebtService({ ratePct: 8, tenorYears: 6 }, {}, 6), 1.25).loanEur;
  assert.ok(capacitySculpted(cf, { ratePct: 8, tenorYears: 6 }, {}, 1.25) >= lvl);
});

test("targets are clamped to sane ranges and default when blank", () => {
  assert.deepEqual(normalizeSizing(null), DEFAULT_SIZING);
  assert.deepEqual(normalizeSizing({ p50Dscr: "", p90Dscr: 0.5, maxGearingPct: 120 }), { p50Dscr: 1.3, p90Dscr: 1, maxGearingPct: 95 });
  assert.equal(debtSchedule(1, { ratePct: 0, tenorYears: 4 }, 5).filter((d) => d.payment > 0).length, 4);
});

test("each asset carries its own stand-alone capacity, and P90 cover", () => {
  const m = model({ gearingPct: 60, ratePct: 8, tenorYears: 10 });
  for (const a of m.assets) {
    assert.ok(a.capacityEur >= 0 && a.capacityEur <= a.result.capexNetEur * 0.8 + 1e-6, a.id);
    assert.ok(a.dscrMinP90 < a.result.dscrMin, "P90 cover is below P50 cover");
  }
});

test("an arrangement fee is paid by the sponsor: equity IRR falls, the project's own IRR and NPV do not move", () => {
  const a = model({ gearingPct: 70, ratePct: 8, tenorYears: 10 });
  const b = model({ gearingPct: 70, ratePct: 8, tenorYears: 10, feePct: 2 });
  close(b.agg.feeEur, b.agg.loanEur * 0.02);
  close(b.agg.irr, a.agg.irr, 1e-12);
  close(b.agg.npv, a.agg.npv, 1e-12);
  assert.ok(b.agg.equityIrr < a.agg.equityIrr);
  close(b.agg.projectCf[0], a.agg.projectCf[0]);
  // sources equal uses
  const su = b.sourcesUses;
  close(su.sources.totalEur, su.uses.totalEur);
  close(su.uses.feeEur, b.agg.feeEur);
  close(su.sources.equityEur, b.agg.equityEur + b.agg.feeEur);
});
