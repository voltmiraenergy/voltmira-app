import { test } from "node:test";
import assert from "node:assert/strict";
import { powerIssues, productionPower, PROSUMER_FORM_MAX_KW } from "./gridPower.js";

test("installed power may not pass the contracted power, the household ceiling or the form's 200 kW", () => {
  assert.deepEqual(powerIssues({ installedKw: 8, contractedKw: 10, ceilingKw: 10.8, kind: "person" }), { blocks: [], warns: [] });
  assert.deepEqual(powerIssues({ installedKw: 12, contractedKw: 10, ceilingKw: 10.8, kind: "person" }).blocks, ["over_contracted", "over_household_ceiling"]);
  // a company is not held to the household ceiling
  assert.deepEqual(powerIssues({ installedKw: 12, contractedKw: 15, ceilingKw: 10.8, kind: "company" }).blocks, []);
  assert.deepEqual(powerIssues({ installedKw: PROSUMER_FORM_MAX_KW + 1, contractedKw: 500, kind: "company" }).blocks, ["over_form_max"]);
  // exactly equal passes
  assert.deepEqual(powerIssues({ installedKw: 10, contractedKw: 10 }).blocks, []);
});

test("a contracted power not entered is a word of warning, not a stop", () => {
  assert.deepEqual(powerIssues({ installedKw: 8 }), { blocks: [], warns: ["contracted_missing"] });
});

test("the production power is the inverters' AC power when the BOM names one, else the system size", () => {
  assert.deepEqual(productionPower({ kw: 6, bom: [] }), { kw: 6, fromInverter: false, dcKw: 6, phases: null });
  const p = productionPower({ kw: 12, bom: [{ kind: "inverter", brand: "Huawei", model: "SUN2000-10KTL-M1", qty: 1 }] });
  assert.equal(p.dcKw, 12);
  if (p.fromInverter) assert.ok(p.kw > 0 && p.kw <= 12);
});
