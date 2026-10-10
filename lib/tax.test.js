import { test } from "node:test";
import assert from "node:assert/strict";
import { financeFlows, normalizeFinance, withTaxDefault, TAX_DEFAULT_PCT, TAX_LOSS_YEARS } from "./projectFinance.js";
import { evaluatePlant } from "./plantFinance.js";
import { sizeDebt } from "./debtSizing.js";
import { aggregate } from "./portfolio.js";
import { buildModel, PLANTS_KEY } from "./portfolioModel.js";
import { evaluateAsset } from "./plantFinance.js";
import { defaultEngineSettings } from "../engine/engine.js";

const E = { ...defaultEngineSettings(), horizon: 25 };
const close = (a, b, tol = 1e-6) => assert.ok(Math.abs(a - b) <= tol * Math.max(1, Math.abs(b)), `${a} vs ${b}`);
const PLANT = {
  id: "p1", name: "Park", lat: 46, lon: 28.5,
  wind: { mw: 40, turbines: 8, hubM: 150, study: { p50Mwh: 128000, p90Mwh: 112000 } },
  solar: { mwp: 20, yieldKwhKwp: 1250 },
  revenue: { kind: "auction", priceEurMwh: 62.04, years: 15, afterEurMwh: 50 },
  costs: { windEurPerKw: 1200, solarEurPerKw: 500, gridEur: 2000000, devPct: 3, opexWindEurPerKwYr: 35, opexSolarEurPerKwYr: 10, landEurYr: 30000, insurancePct: 0.35 },
};
const flat = (v, n = 25) => Array(n).fill(v);

test("the market sets the tax when the portfolio sets none; an explicit 0 stays 0", () => {
  assert.deepEqual(TAX_DEFAULT_PCT, { MD: 12, UA: 18 });
  assert.deepEqual(TAX_LOSS_YEARS, { MD: 5, UA: 0 });
  const md = normalizeFinance(withTaxDefault({}, "MD"));
  assert.equal(md.taxPct, 12);
  assert.equal(md.taxLossYears, 5);
  const ua = normalizeFinance(withTaxDefault({ taxPct: "" }, "UA"));
  assert.equal(ua.taxPct, 18);
  assert.equal(ua.taxLossYears, 0);
  assert.equal(normalizeFinance(withTaxDefault({ taxPct: 0 }, "MD")).taxPct, 0);
  assert.equal(normalizeFinance(withTaxDefault({ taxLossYears: 0 }, "MD")).taxLossYears, 0);
  // a quote on its own pays no corporate tax unless asked
  assert.equal(normalizeFinance({}).taxPct, 0);
});

test("tax without a loan: profit after straight-line depreciation, then the full EBITDA once written off", () => {
  const m = financeFlows({ ebitda: flat(200), capexNet: 1000, fin: { gearingPct: 0, taxPct: 12, taxLifeYears: 20 }, scenario: {}, H: 25 });
  m.tax.forEach((t, i) => close(t, i < 20 ? (200 - 50) * 0.12 : 200 * 0.12));
  assert.deepEqual(m.tax, m.taxUnlevered);
  m.cfads.forEach((c, i) => close(c, 200 - m.tax[i]));
  close(m.projectCf[1], 200 - 18);
});

test("the loan's interest lowers the tax; the project's own return uses the tax without the loan", () => {
  const fin = { gearingPct: 50, ratePct: 10, tenorYears: 10, taxPct: 12, taxLifeYears: 20, discPct: 8 };
  const m = financeFlows({ ebitda: flat(200), capexNet: 1000, fin, scenario: {}, H: 25 });
  close(m.loan, 500);
  close(m.sched[0].interest, 50);
  close(m.tax[0], (200 - 50 - 50) * 0.12);
  close(m.taxUnlevered[0], (200 - 50) * 0.12);
  close(m.cfads[0], 200 - 12);
  close(m.projectCf[1], 200 - 18);
  // after the loan is repaid the two taxes meet
  close(m.tax[12], m.taxUnlevered[12]);
  // the project's IRR does not depend on the loan
  const noLoan = financeFlows({ ebitda: flat(200), capexNet: 1000, fin: { ...fin, gearingPct: 0 }, scenario: {}, H: 25 });
  close(m.irr, noLoan.irr);
});

test("a loss is used oldest first and lapses after the market's years", () => {
  const ebitda = [-100, 10, 10, 10, 10, 10, 10, 50, ...flat(50, 17)];
  const at = (lossYears) => financeFlows({ ebitda, capexNet: 0, fin: { gearingPct: 0, taxPct: 12, taxLossYears: lossYears }, scenario: {}, H: 25 }).tax;
  // Moldova: the loss of year 1 offsets years 2 to 6 (50 of it), then lapses
  const md = at(5);
  md.slice(0, 6).forEach((t) => close(t, 0));
  close(md[6], 10 * 0.12);
  close(md[7], 50 * 0.12);
  // no limit: year 7 uses 10 more and year 8 the last 40
  const any = at(0);
  close(any[6], 0);
  close(any[7], 10 * 0.12);
  close(any[8], 50 * 0.12);
  // without tax nothing is charged
  assert.ok(financeFlows({ ebitda, capexNet: 0, fin: { gearingPct: 0 }, scenario: {}, H: 25 }).tax.every((t) => t === 0));
});

test("sculpted with tax: the repayment follows the CFADS after tax, so the cover is level", () => {
  const ebitda = Array.from({ length: 25 }, (_, i) => 200 + 5 * Math.sin(i));
  const m = financeFlows({ ebitda, capexNet: 1000, fin: { gearingPct: 60, ratePct: 7, tenorYears: 12, repayment: "sculpted", taxPct: 12 }, scenario: {}, H: 25 });
  const covers = m.dscr.slice(0, 12);
  covers.forEach((d) => close(d, covers[0], 1e-6));
});

test("storage earns its contract's payment for the contract's years only", () => {
  const withBess = { ...PLANT, bess: { mw: 10, mwh: 20 }, revenue: { ...PLANT.revenue, bessEurPerMwYr: 50000, bessYears: 5 } };
  const none = { ...withBess, revenue: { ...withBess.revenue, bessEurPerMwYr: 0 } };
  const a = evaluatePlant(withBess, E, { gearingPct: 0 }, {});
  const b = evaluatePlant(none, E, { gearingPct: 0 }, {});
  a.revenue.forEach((v, i) => close(v - b.revenue[i], i < 5 ? 500000 : 0));
  // without a stated term the energy contract's years apply
  const dflt = evaluatePlant({ ...withBess, revenue: { ...withBess.revenue, bessYears: undefined } }, E, { gearingPct: 0 }, {});
  dflt.revenue.forEach((v, i) => close(v - b.revenue[i], i < 15 ? 500000 : 0));
});

test("LCOE is the plant's own cost: a grant or a loan does not lower it", () => {
  const base = evaluatePlant(PLANT, E, { gearingPct: 0 }, {});
  close(evaluatePlant(PLANT, E, { gearingPct: 70, grantPct: 30 }, {}).lcoe, base.lcoe);
  close(evaluatePlant(PLANT, E, { gearingPct: 0, taxPct: 12 }, {}).lcoe, base.lcoe);
});

test("the average cover counts the repayment years only; the minimum counts every year", () => {
  const fin = { gearingPct: 65, ratePct: 6.5, tenorYears: 15, graceYears: 2 };
  const r = evaluatePlant(PLANT, E, fin, {});
  const repaying = r.dscr.filter((d, i) => d != null && r.debt[i].principal > 1e-9);
  close(r.dscrAvg, repaying.reduce((a, b) => a + b, 0) / repaying.length);
  assert.equal(r.dscrMin, Math.min(...r.dscr.filter((d) => d != null)));
  assert.ok(repaying.length === 13);
});

test("with tax the debt capacity is a fixed point: the loan it finds is the loan its cash flow was taxed at", () => {
  const portfolio = { id: "x", market: "MD", project_ids: [], finance: { gearingPct: 80, ratePct: 7, tenorYears: 15 }, assets: { [PLANTS_KEY]: [PLANT] } };
  const model = buildModel({ portfolio, projects: [], E, include: { sensitivity: false, structures: false } });
  assert.equal(model.fin.taxPct, 12);
  const sz = model.sizing;
  assert.ok(sz.capacityPct > 0);
  // run the plant again at the share the sizing found, and size on that
  const f2 = { ...model.fin, gearingPct: sz.capacityPct };
  const asset = model.assets[0];
  const r50 = aggregate([{ ...asset, result: evaluateAsset(asset, E, f2, model.scenario) }]);
  const r90 = aggregate([{ ...asset, result: evaluateAsset(asset, E, f2, model.scenario, { exceed: "P90" }) }]);
  r50.cfads.forEach((v, i) => close(v, sz.cfadsP50[i], 1e-4));
  const again = sizeDebt({ cfadsP50: r50.cfads, cfadsP90: r90.cfads, capexNetEur: r50.capexEur - r50.grantEur, fin: model.fin, scenario: model.scenario, sizing: {} });
  assert.ok(Math.abs(again.capacityEur - sz.capacityEur) < 2, `${again.capacityEur} vs ${sz.capacityEur}`);
});

test("each tenor and each asset alone are settled the same way; a structure's equity counts the reserve", () => {
  const portfolio = { id: "x", market: "MD", project_ids: [], finance: { gearingPct: 70, ratePct: 7, tenorYears: 12, dsraMonths: 6, compare: [{ id: "a", fin: { gearingPct: 60, ratePct: 6, tenorYears: 15 } }] }, assets: { [PLANTS_KEY]: [PLANT] } };
  const model = buildModel({ portfolio, projects: [], E, include: { sensitivity: false } });
  const sz = model.sizing;
  assert.equal(sz.byTenor.find((t) => t.tenorYears === 12).capacityEur, sz.capacityEur);
  // one plant alone is the facility
  assert.ok(Math.abs(model.assets[0].capacityEur - sz.capacityEur) < 2);
  // a longer tenor carries more debt
  const t15 = sz.byTenor.find((t) => t.tenorYears === 15).capacityEur;
  assert.ok(t15 >= sz.capacityEur);
  // the current structure's sponsor money is the sources and uses' equity
  close(model.structures[0].equityEur, model.sourcesUses.sources.equityEur);
  assert.ok(model.agg.dsraEur > 0);
});
