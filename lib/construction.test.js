import { test } from "node:test";
import assert from "node:assert/strict";
import { normalizeFinance, idcFactor, fundingAt, loanAtShare, shareOfLoan, reserveAccount, debtSchedule, evaluateProject } from "./projectFinance.js";
import { evaluatePlant } from "./plantFinance.js";
import { sizeDebt, sculptWeights, capacitySculpted, unitDebtService } from "./debtSizing.js";
import { aggregate, runPortfolioStress } from "./portfolio.js";
import { buildModel } from "./portfolioModel.js";
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
const FIN = { gearingPct: 65, ratePct: 6.5, tenorYears: 15 };

test("without the new terms nothing changes", () => {
  const f = normalizeFinance({});
  assert.equal(f.constructionMonths, 0);
  assert.equal(f.graceYears, 0);
  assert.equal(f.dsraMonths, 0);
  assert.equal(idcFactor(FIN), 0);
  const fu = fundingAt(1000, { gearingPct: 70 });
  assert.equal(fu.loan, 700);
  assert.equal(fu.idc, 0);
  const r = evaluatePlant(PLANT, E, FIN, {});
  assert.equal(r.idcEur, 0);
  assert.equal(r.dsraEur, 0);
  assert.ok(r.reserveNet.every((v) => v === 0));
  close(r.equityCf[0], -(r.equityEur + r.feeEur));
});

test("the terms are clamped: the grace leaves at least one repayment year", () => {
  assert.equal(normalizeFinance({ tenorYears: 3, graceYears: 5 }).graceYears, 2);
  assert.equal(normalizeFinance({ constructionMonths: 99 }).constructionMonths, 48);
  assert.equal(normalizeFinance({ dsraMonths: 30 }).dsraMonths, 12);
});

test("interest during construction: lent with the debt, the debt share taken of the cost plus that interest", () => {
  const fin = { gearingPct: 70, ratePct: 8, constructionMonths: 18 };
  close(idcFactor(fin), 0.08 * 18 / 24);
  const fu = fundingAt(1000, fin);
  close(fu.loan, 700 / (1 - 0.7 * 0.06));
  close(fu.idc, fu.loan * 0.06);
  close(fu.loan / (1000 + fu.idc), 0.7);
  close(fu.equity, 1000 + fu.idc - fu.loan);
  close(loanAtShare(1000, 70, fin), fu.loan);
  close(shareOfLoan(fu.loan, 1000, fin), 70);
  // the first year's programme rate is the one the construction loan pays
  close(idcFactor({ ratePct: 8, rateSteps: [0, 5], constructionMonths: 12 }), 0);
});

test("grace years pay interest only; the principal is repaid over the rest of the term", () => {
  const s = debtSchedule(1000, { ratePct: 10, tenorYears: 4, graceYears: 2 }, 6);
  close(s[0].payment, 100); close(s[0].principal, 0); close(s[0].balance, 1000);
  close(s[1].payment, 100); close(s[1].balance, 1000);
  // two level instalments of the 1000 at 10%
  const level = (1000 * 0.1) / (1 - Math.pow(1.1, -2));
  close(s[2].payment, level); close(s[3].payment, level);
  close(s[3].balance, 0);
  assert.equal(s[4].payment, 0);
});

test("a sculpted loan with grace repays exactly, and its capacity is what the cash flow repays", () => {
  const fin = { ratePct: 7, tenorYears: 8, graceYears: 2, repayment: "sculpted", principalCompensationPct: 20 };
  const cfads = [80, 90, 100, 110, 120, 120, 120, 120, 120, 120];
  const cap = capacitySculpted(cfads, fin, {}, 1.3);
  const s = debtSchedule(cap, fin, 10, cfads);
  close(s[7].balance, 0, 1e-6);
  // every repayment year at the target exactly, the interest-only years above it
  for (let y = 3; y <= 8; y++) close(cfads[y - 1] / s[y - 1].payment, 1.3, 1e-6);
  for (let y = 1; y <= 2; y++) assert.ok(cfads[y - 1] / s[y - 1].payment >= 1.3 - 1e-9);
  assert.deepEqual(sculptWeights(fin, {}, 10).weights.slice(0, 2), [0, 0]);
  // a thin interest-only year binds instead
  const thin = [5, 90, 100, 110, 120, 120, 120, 120];
  const capThin = capacitySculpted(thin, fin, {}, 1.3);
  close(capThin, 5 / (1.3 * unitDebtService(fin, {}, 8)[0]));
});

test("the reserve: drawn in a short year, refilled from surpluses, released at the end", () => {
  const r = reserveAccount([100, 50, 120, 120], [100, 100, 100, 100], { dsraMonths: 6 });
  close(r.opening, 50);
  assert.deepEqual(r.drawn, [0, 50, 0, 0]);
  assert.deepEqual(r.unmet, [0, 0, 0, 0]);
  assert.deepEqual(r.net, [0, 50, -20, 20]);
  assert.deepEqual(r.balance, [50, 0, 20, 0]);
  close(r.drawnEur, 50);
  // what the reserve cannot cover, the sponsor pays: a lender's default
  const s = reserveAccount([100, 0], [100, 100], { dsraMonths: 6 });
  assert.deepEqual(s.unmet, [0, 50]);
  assert.deepEqual(s.shortfallYears, [2]);
  close(s.shortfallEur, 50);
  // without a reserve every short year is unmet
  const n = reserveAccount([100, 60], [100, 100], {});
  assert.equal(n.opening, 0);
  assert.deepEqual(n.unmet, [0, 40]);
  assert.deepEqual(n.net, [0, 0]);
});

test("a plant with all three: the money balances, the sponsor gets the reserve back", () => {
  const fin = { ...FIN, constructionMonths: 18, graceYears: 1, dsraMonths: 6, feePct: 1 };
  const r = evaluatePlant(PLANT, E, fin, {});
  assert.ok(r.idcEur > 0 && r.dsraEur > 0);
  close(r.loanEur / (r.capexNetEur + r.idcEur), 0.65);
  close(r.dsraEur, 0.5 * r.debtService[0]);
  // year 1 pays interest only
  close(r.debt[0].principal, 0);
  // over the life, the sponsor's flows are its money in and the cash after debt
  // service: the reserve comes back in full once the loan is repaid
  const total = r.equityCf.reduce((a, b) => a + b, 0);
  const expected = -(r.equityEur + r.feeEur) + r.cfads.reduce((a, c, i) => a + c - r.debtService[i], 0);
  close(total, expected, 1e-6);
  // the loan is larger by the interest during construction than without it
  const plain = evaluatePlant(PLANT, E, { ...FIN, feePct: 1 }, {});
  assert.ok(r.loanEur > plain.loanEur);
  assert.ok(r.equityIrr < plain.equityIrr, "the reserve and the interest cost the sponsor");
});

test("a late plant: the grace and the reserve carry the first year the loan would otherwise miss", () => {
  const late = { delayMonths: 6 };
  const bare = evaluatePlant(PLANT, E, FIN, late);
  const guarded = evaluatePlant(PLANT, E, { ...FIN, graceYears: 1, dsraMonths: 6 }, late);
  assert.ok(bare.shortfallEur > 0, "without them the first year runs short");
  assert.ok(guarded.shortfallEur < bare.shortfallEur);
  assert.ok(guarded.dscrMin > bare.dscrMin);
});

test("the portfolio adds up the reserves and the shortfalls, asset by asset", () => {
  const fin = { ...FIN, constructionMonths: 12, dsraMonths: 6 };
  const a = { id: "a", kw: 1, result: evaluatePlant(PLANT, E, fin, {}) };
  const b = { id: "b", kw: 1, result: evaluatePlant({ ...PLANT, id: "p2" }, E, fin, {}) };
  const agg = aggregate([a, b]);
  close(agg.dsraEur, a.result.dsraEur + b.result.dsraEur);
  close(agg.idcEur, a.result.idcEur + b.result.idcEur);
  agg.reserveNet.forEach((v, i) => close(v, a.result.reserveNet[i] + b.result.reserveNet[i]));
  const suite = runPortfolioStress([{ id: "a", kind: "plant", plant: PLANT, kw: 1, market: "MD" }], E, fin, {});
  assert.ok(suite.every((s) => Number.isFinite(s.agg.shortfallEur)));
});

test("sizing: the cap and the recommended share count the interest during construction", () => {
  const fin = { gearingPct: 70, ratePct: 8, tenorYears: 10, constructionMonths: 18 };
  const s = sizeDebt({ cfadsP50: Array(25).fill(150), cfadsP90: Array(25).fill(140), capexNetEur: 1000, fin, sizing: { maxGearingPct: 80 } });
  close(s.gearingCapEur, loanAtShare(1000, 80, fin));
  close(s.idcFactor, 0.06);
  // a model at the recommended share carries no more than the capacity
  assert.ok(loanAtShare(1000, s.recommendedGearingPct, fin) <= s.capacityEur * (1 + 1e-9));
  assert.ok(loanAtShare(1000, s.recommendedGearingPct + 0.5, fin) > s.capacityEur * (1 - 1e-9) || s.binding === "gearing");
});

test("the model at the recommended share passes the cover targets, grace and all", () => {
  const portfolio = { id: "pf", name: "P", market: "MD", project_ids: [], scenario: {}, assets: { __plants: [PLANT] },
    finance: { gearingPct: 65, ratePct: 6.5, tenorYears: 15, constructionMonths: 18, graceYears: 1, dsraMonths: 6 } };
  const m = buildModel({ portfolio, projects: [], E, include: { sensitivity: false, structures: false } });
  const at = buildModel({ portfolio: { ...portfolio, finance: { ...portfolio.finance, gearingPct: m.sizing.recommendedGearingPct } }, projects: [], E, include: { sensitivity: false, structures: false } });
  assert.ok(at.agg.dscrMin >= m.sizing.p50Dscr - 1e-6, `P50 ${at.agg.dscrMin}`);
  assert.ok(at.p90.dscrMin >= m.sizing.p90Dscr - 1e-6, `P90 ${at.p90.dscrMin}`);
  // sources equal uses up to commissioning
  const su = m.sourcesUses;
  close(su.sources.totalEur, su.uses.totalEur, 1e-9);
  assert.ok(su.uses.idcEur > 0 && su.uses.dsraEur > 0);
});

test("a quote runs the same terms as a plant", () => {
  const input = { kw: 100, cons: 120000, market: "MD", phase: "three" };
  const r = evaluateProject(input, E, { gearingPct: 70, ratePct: 8, tenorYears: 8, constructionMonths: 6, graceYears: 1, dsraMonths: 6 }, {});
  assert.ok(r.idcEur > 0 && r.dsraEur > 0);
  close(r.debt[0].principal, 0);
});
