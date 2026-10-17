import { test } from "node:test";
import assert from "node:assert/strict";
import { simulate, defaultEngineSettings } from "@voltmira/engine";
import {
  evaluateProject, debtSchedule, irrOf, stressCases, normalizeScenario, normalizeFinance,
  DEFAULT_FINANCE, SIGMA_PCT, Z,
} from "./projectFinance.js";

const E = defaultEngineSettings();
// a 1 MW commercial roof in Moldova, consuming most of what it makes
const MD = { kw: 1000, price: 0.18, cons: 1_200_000, market: "MD", costOverride: 0, yieldOverride: 1250 };
const UA = { ...MD, market: "UA", price: 0.0847, startYear: 2026.75 };
const close = (a, b, eps = 1e-6) => assert.ok(Math.abs(a - b) <= eps * Math.max(1, Math.abs(b)), `${a} vs ${b}`);

test("base case is the quote engine's own cash flow, not a second model", () => {
  const fin = { ...DEFAULT_FINANCE, gearingPct: 0 };
  const r = evaluateProject(MD, E, fin, {});
  const sim = simulate({ ...MD }, E, "expc");
  let prev = -sim.cost;
  sim.rows.forEach((cum, i) => { close(r.cfads[i], cum - prev); prev = cum; });
  close(r.capexEur, sim.grossCost);
  assert.equal(r.dscrMin, null, "no debt, no DSCR");
});

test("debt: loan is gearing x capex; DSCR is CFADS over service", () => {
  const r = evaluateProject(MD, E, { gearingPct: 70, ratePct: 8, tenorYears: 10 }, {});
  close(r.loanEur, r.capexEur * 0.7);
  close(r.equityEur, r.capexEur * 0.3);
  r.dscr.slice(0, 10).forEach((d, i) => close(d, r.cfads[i] / r.debtService[i]));
  assert.equal(r.dscr[10], null, "no service after the tenor");
  assert.ok(r.dscrMin > 0 && Number.isFinite(r.dscrMin));
});

test("the debt schedule pays the loan off, with a stepped rate and a compensation", () => {
  const flat = debtSchedule(1000, { ratePct: 8, tenorYears: 5 }, 8);
  close(flat.reduce((s, d) => s + d.principal, 0), 1000, 1e-9);
  assert.equal(flat[5].payment, 0);
  const stepped = debtSchedule(1000, { ratePct: 10, rateSteps: [0, 5, 7], tenorYears: 5, principalCompensationPct: 30 }, 8);
  assert.equal(stepped[0].interest, 0, "0% in year 1");
  close(stepped[1].interest, stepped[1].payment - stepped[1].principal);
  close(stepped[0].compensation, 300, 1e-9);
  close(stepped.reduce((s, d) => s + d.principal + d.compensation, 0), 1000, 1e-9);
  assert.ok(stepped[3].interest / stepped[2].balance > 0.09, "falls back to ratePct after the steps");
});

test("P90 is the P50 yield less 1.2816 sigma", () => {
  const p50 = evaluateProject(MD, E, null, {});
  const p90 = evaluateProject(MD, E, null, {}, { exceed: "P90" });
  close(p90.year1Kwh / p50.year1Kwh, 1 - (Z.P90 * SIGMA_PCT) / 100, 1e-9);
  assert.ok(p90.npv < p50.npv && p90.dscrMin < p50.dscrMin);
});

test("each downside lowers value and cover, and only its own driver moves", () => {
  const f = { gearingPct: 70, ratePct: 8, tenorYears: 10 };
  const base = evaluateProject(MD, E, f, {});
  for (const sc of [{ tariffMultiplier: 0.8 }, { curtailmentPct: 10 }, { delayMonths: 6 }, { localDepreciationPctYr: 5 }, { warRiskPremiumPct: 1 }, { capexMultiplier: 1.15 }]) {
    const r = evaluateProject(MD, E, f, sc);
    assert.ok(r.npv < base.npv, JSON.stringify(sc) + " should lower NPV");
    assert.ok(r.dscrMin <= base.dscrMin + 1e-9, JSON.stringify(sc) + " should not raise DSCR");
  }
  const t = evaluateProject(MD, E, f, { tariffMultiplier: 0.8 });
  close(t.capexEur, base.capexEur);
  close(t.year1Kwh, base.year1Kwh);
});

test("currency: revenue falls (1 - d)^(n-1); local debt service falls with it, EUR debt does not", () => {
  const f = { gearingPct: 70, ratePct: 8, tenorYears: 10 };
  const base = evaluateProject(MD, E, f, {});
  const dep = evaluateProject(MD, E, f, { localDepreciationPctYr: 10 });
  close(dep.revenue[9], base.revenue[9] * Math.pow(0.9, 9), 1e-9);
  close(dep.cfads[9], dep.revenue[9] - base.opex[9], 1e-9);
  close(dep.debtService[3], base.debtService[3], 1e-12);
  const local = evaluateProject(MD, E, { ...f, debtCurrency: "local" }, { localDepreciationPctYr: 10 });
  close(local.debtService[3], base.debtService[3] * Math.pow(0.9, 3), 1e-9);
  assert.ok(local.dscrMin > dep.dscrMin, "a local-currency loan hedges the revenue");
});

test("war-risk premium is a yearly cost of the insured value", () => {
  const base = evaluateProject(UA, E, null, {});
  const war = evaluateProject(UA, E, null, { warRiskPremiumPct: 1 });
  close(base.cfads[4] - war.cfads[4], base.capexEur * 0.01, 1e-9);
});

test("curtailment only takes the exported share", () => {
  const plant = { ...MD, cons: 0 };
  const a = evaluateProject(plant, E, null, {});
  const b = evaluateProject(plant, E, null, { curtailmentPct: 10 });
  close(b.revenue[0], a.revenue[0] * 0.9, 1e-9);
  const own = { ...MD, cons: 5_000_000 };
  const c = evaluateProject(own, E, null, {});
  const d = evaluateProject(own, E, null, { curtailmentPct: 10 });
  assert.ok(d.revenue[0] > c.revenue[0] * 0.9 + 1, "less than 10% off when part is self-consumed");
});

test("delay shifts operation but not the debt", () => {
  const f = { gearingPct: 70, ratePct: 8, tenorYears: 10 };
  const base = evaluateProject(MD, E, f, {});
  const late = evaluateProject(MD, E, f, { delayMonths: 12 });
  close(late.revenue[1], base.revenue[0], 1e-9);
  assert.equal(late.revenue[0], 0);
  close(late.debtService[0], base.debtService[0], 1e-12);
  assert.equal(late.dscr[0], 0, "year 1 has debt service and nothing to pay it with");
  assert.ok(late.dscrMin === 0 && base.dscrMin > 1);
  const half = evaluateProject(MD, E, f, { delayMonths: 6 });
  close(half.revenue[0], base.revenue[0] / 2, 1e-9);
});

test("PPA: the contracted share earns the fixed price for its term, then returns to the market", () => {
  const plant = { ...MD, cons: 0 };
  const sc = { ppa: { sharePct: 100, priceEurMwh: 70, years: 10, escalationPct: 0, currency: "EUR" } };
  const r = evaluateProject(plant, E, null, sc);
  const mwh1 = r.energyKwh[0] / 1000;
  close(r.revenue[0], mwh1 * 70, 1e-9);
  const base = evaluateProject(plant, E, null, {});
  close(r.revenue[10], base.revenue[10], 1e-9);
  const half = evaluateProject(plant, E, null, { ppa: { ...sc.ppa, sharePct: 50 } });
  close(half.revenue[0], 0.5 * base.revenue[0] + 0.5 * mwh1 * 70, 1e-9);
  const loc = evaluateProject(plant, E, null, { localDepreciationPctYr: 10, ppa: { ...sc.ppa, currency: "local" } });
  const eur = evaluateProject(plant, E, null, { localDepreciationPctYr: 10, ppa: sc.ppa });
  assert.ok(eur.revenue[5] > loc.revenue[5]);
});

test("a grant lowers the capital to fund, up to its cap", () => {
  const f = { gearingPct: 50, grantPct: 70 };
  const r = evaluateProject(MD, E, f, {});
  close(r.grantEur, r.capexEur * 0.7);
  close(r.capexNetEur, r.capexEur * 0.3);
  const capped = evaluateProject(MD, E, { ...f, grantCapEur: 100_000 }, {});
  close(capped.grantEur, 100_000);
  assert.ok(r.irr > evaluateProject(MD, E, { gearingPct: 50 }, {}).irr, "the grant raises the return");
});

test("IRR is null, not invented, when the cash flow never turns positive", () => {
  assert.equal(irrOf([-100, -1, -1]), null);
  close(irrOf([-100, 110]), 0.1, 1e-6);
  const dud = evaluateProject({ ...MD, kw: 1000, price: 0.0001, cons: 0 }, E, null, { tariffMultiplier: 0 });
  assert.equal(dud.irr, null);
});

test("inputs are clamped, never NaN", () => {
  const f = normalizeFinance({ gearingPct: 500, ratePct: "x", tenorYears: 99, rateSteps: [] });
  assert.equal(f.gearingPct, 95); assert.equal(f.ratePct, 8); assert.equal(f.tenorYears, 25); assert.equal(f.rateSteps, null);
  const s = normalizeScenario({ ppa: { sharePct: 50 }, curtailmentPct: -3, tariffMultiplier: "abc" });
  assert.equal(s.ppa, null, "a PPA with no price or term is no PPA");
  assert.equal(s.curtailmentPct, 0); assert.equal(s.tariffMultiplier, 1);
  const r = evaluateProject({ ...MD, kw: "", price: undefined }, E, { gearingPct: "z" }, { delayMonths: "q" });
  assert.ok(r.cfads.every(Number.isFinite) && Number.isFinite(r.npv));
});

test("stress suite: base first, Ukraine adds the war-risk case, the combined case is the worst", () => {
  const md = stressCases("MD", {});
  const ua = stressCases("UA", {});
  assert.equal(md[0].id, "base");
  assert.ok(!md.some((c) => c.id === "war") && ua.some((c) => c.id === "war"));
  const f = { gearingPct: 70, ratePct: 8, tenorYears: 10 };
  const res = Object.fromEntries(ua.map((c) => [c.id, evaluateProject(UA, E, f, c.scenario, { exceed: c.exceed })]));
  for (const c of ua) if (c.id !== "base") assert.ok(res[c.id].npv <= res.base.npv + 1e-6, c.id);
  assert.ok(res.combined.dscrMin <= Math.min(...Object.values(res).map((r) => r.dscrMin)) + 1e-9);
  const withBase = stressCases("MD", { curtailmentPct: 20 });
  assert.equal(withBase.find((c) => c.id === "tariff").scenario.curtailmentPct, 20);
});

test("LLCR is the cash flow over the loan's life at the loan's rate, against the debt then owed", async () => {
  const { financeFlows } = await import("./projectFinance.js");
  const ebitda = Array.from({ length: 20 }, () => 150);
  const m = financeFlows({ ebitda, capexNet: 1000, fin: { gearingPct: 70, ratePct: 6, tenorYears: 10 }, scenario: {}, H: 20 });
  const pv = Array.from({ length: 10 }, (_, t) => 150 / Math.pow(1.06, t + 1)).reduce((a, b) => a + b, 0);
  assert.ok(Math.abs(m.llcr0 - pv / 700) < 1e-9);
  assert.ok(Math.abs(m.llcrPv - pv) < 1e-9);
  // in year 4 against the balance left after year 3
  const pv4 = Array.from({ length: 7 }, (_, t) => 150 / Math.pow(1.06, t + 1)).reduce((a, b) => a + b, 0);
  assert.ok(Math.abs(m.llcr[3] - pv4 / m.sched[2].balance) < 1e-9);
  assert.equal(m.llcr[10], null);
});

test("the cover is read over the repayment years, with the interest-only years apart", async () => {
  const { financeFlows } = await import("./projectFinance.js");
  const ebitda = [60, ...Array.from({ length: 19 }, () => 150)];
  const m = financeFlows({ ebitda, capexNet: 1000, fin: { gearingPct: 70, ratePct: 6, tenorYears: 10, graceYears: 1 }, scenario: {}, H: 20 });
  assert.ok(Math.abs(m.dscrIo - 60 / 42) < 1e-9);
  assert.ok(m.dscrMinRepay > m.dscrIo);
  assert.equal(m.dscrMin, Math.min(m.dscrIo, m.dscrMinRepay));
});

test("the interest-rate case raises every rate by two points and leaves the debt share", async () => {
  const { finForCase, stressCases } = await import("./projectFinance.js");
  const c = stressCases("MD", {}).find((x) => x.id === "rate");
  assert.equal(c.ratePlusPct, 2);
  const f = finForCase({ ratePct: 7, rateSteps: [0, 5], gearingPct: 70 }, c);
  assert.equal(f.ratePct, 9);
  assert.deepEqual(f.rateSteps, [2, 7]);
  assert.equal(f.gearingPct, 70);
  assert.equal(finForCase({ ratePct: 7 }, { id: "base" }).ratePct, 7);
});

test("the end of the life: value less decommissioning, raised by inflation, in the last year after the loan", async () => {
  const { endOfLife, financeFlows } = await import("./projectFinance.js");
  assert.equal(endOfLife(1000, {}, 25, 0.02), 0);
  const e = endOfLife(1000, { endCostPct: 5, endValuePct: 2 }, 25, 0.02);
  assert.ok(Math.abs(e - 1000 * -0.03 * Math.pow(1.02, 24)) < 1e-9);
  const ebitda = Array.from({ length: 25 }, () => 150);
  const base = financeFlows({ ebitda, capexNet: 1000, fin: { gearingPct: 70, ratePct: 6, tenorYears: 10 }, scenario: {}, H: 25 });
  const m = financeFlows({ ebitda, capexNet: 1000, fin: { gearingPct: 70, ratePct: 6, tenorYears: 10 }, scenario: {}, H: 25, endCash: e });
  assert.ok(Math.abs((m.projectCf[25] - base.projectCf[25]) - e) < 1e-9);
  assert.ok(Math.abs((m.equityCf[25] - base.equityCf[25]) - e) < 1e-9);
  assert.deepEqual(m.cfads, base.cfads, "the cover does not move");
});

test("a rooftop quote takes the portfolio's inverter replacement in its year", async () => {
  const { evaluateProject } = await import("./projectFinance.js");
  const { defaultEngineSettings } = await import("@voltmira/engine");
  const E = { ...defaultEngineSettings(), horizon: 25 };
  const input = { kw: 10, price: 0.18, cons: 9000, market: "MD", yieldOverride: 1250 };
  const a = evaluateProject(input, E, { gearingPct: 0 }, {});
  const b = evaluateProject(input, E, { gearingPct: 0, quoteInvYear: 12, quoteInvEurPerKw: 60 }, {});
  const infl = E.bands.expc.infl / 100;
  assert.ok(Math.abs(b.sustaining[11] - 10 * 60 * Math.pow(1 + infl, 11)) < 1e-6);
  assert.ok(Math.abs((a.cfads[11] - b.cfads[11]) - b.sustaining[11]) < 1e-6);
  assert.ok(b.npv < a.npv);
});

test("IRR with a cost at the end (two sign changes) is the rate nearest 10%, as Excel's", async () => {
  const { irrOf } = await import("./projectFinance.js");
  const cf = [-1000, ...Array.from({ length: 24 }, () => 120), 120 - 400];
  const r = irrOf(cf);
  assert.ok(r > 0.1 && r < 0.12, String(r));
  assert.ok(Math.abs(cf.reduce((s, c, n) => s + c / Math.pow(1 + r, n), 0)) < 1e-4);
  // the plain case is unchanged
  const plain = irrOf([-100, 60, 60]);
  assert.ok(Math.abs(plain - 0.1307) < 1e-3);
  assert.equal(irrOf([-100, -1, -1]), null);
});
