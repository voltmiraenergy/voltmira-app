import { test } from "node:test";
import assert from "node:assert/strict";
import { plantModelSheets, checksSheet } from "./plantWorkbook.js";
import { buildModel } from "./portfolioModel.js";
import { samplePortfolio } from "./plantSample.js";
import { defaultEngineSettings } from "../engine/engine.js";

const E = { ...defaultEngineSettings(), horizon: 25 };


// the sample hybrid park with its energy in place (the app fetches it from public data)
const samplePf = (finance = {}, plantPatch = (p) => p) => {
  const pf = samplePortfolio();
  const plants = pf.plants.map((p) => plantPatch({ ...p, wind: { ...p.wind, study: { p50Mwh: 110000, p90Mwh: 96000 } }, solar: { ...p.solar, yieldKwhKwp: 1290 } }));
  return { name: pf.name, project_ids: [], assets: { __plants: plants }, finance: { ...pf.finance, ...finance } };
};
const model = (finance = {}, plantPatch) => buildModel({ portfolio: samplePf(finance, plantPatch), projects: [], E });

const allOk = (m) => {
  const plants = m.assets.filter((a) => a.kind === "plant");
  assert.ok(plants.length > 0);
  for (const [k, a] of plants.entries()) {
    const { checks } = plantModelSheets({ asset: a, result: a.result, fin: m.fin, scenario: m.scenario, E: m.E, idx: k + 1 });
    for (const c of checks) {
      if (c.app == null && c.mirror == null) continue;
      const tol = c.s === "eur" ? 1 : 1e-6;
      assert.ok(c.app != null && c.mirror != null && Math.abs(c.app - c.mirror) <= Math.max(tol, Math.abs(c.app) * 1e-9), `${c.label}: app ${c.app}, sheet ${c.mirror}`);
    }
    const sheet = checksSheet(checks);
    assert.ok(sheet.rows.slice(3).every((r) => r[4].v === "OK"));
  }
};

test("the live model agrees with the app on the sample hybrid park", () => allOk(model()));

test("it agrees with a grace year, a reserve, stepped rates, a fee and IDC", () => allOk(model({ graceYears: 1, dsraMonths: 6, rateSteps: [3, 5], feePct: 1, constructionMonths: 12, principalCompensationPct: 10 })));

test("it agrees with a sculpted loan in the local currency and a loss limit", () => allOk(model({ repayment: "sculpted", debtCurrency: "local", taxLossYears: 5, taxPct: 12 })));

test("it agrees with replacements and an indexed contract", () => allOk(model({}, (p) => ({ ...p, revenue: { ...p.revenue, indexPct: 1.5 }, costs: { ...p.costs, invReplaceYear: 12, invReplaceEurPerKw: 45, bessAugYear: 9, bessAugEurPerKwh: 70 } }))));

test("every Model formula reads its inputs, never a typed number for a yearly line", () => {
  const m = model();
  const a = m.assets.find((x) => x.kind === "plant");
  const { sheets } = plantModelSheets({ asset: a, result: a.result, fin: m.fin, scenario: m.scenario, E: m.E, idx: 1 });
  const modelSheet = sheets[1];
  const yearly = modelSheet.rows.slice(1).filter((r) => r && r.length > 3 && typeof r[2] === "object" && r[2]);
  assert.ok(yearly.length > 40);
  for (const r of yearly) for (const c of r.slice(2)) if (c) assert.ok(typeof c.f === "string" && c.f.length > 0, `${r[0]} has a typed value`);
});
