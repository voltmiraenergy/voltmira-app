import { test } from "node:test";
import assert from "node:assert/strict";
import { pickRule, nextVersion, toMinorPerMwh, fromMinorPerMwh, ruleExportMdl, ruleQuoteInputs, diffRules } from "./tariffRules.js";

const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-12, `${a} is not ${b}`);
const R = (o) => ({ market: "MD", operator: "premier", version: 1, effective_from: "2024-01-01", effective_to: null, export_monthly: null, ...o });

test("lei/kWh and minor units per MWh are integers both ways", () => {
  assert.equal(toMinorPerMwh(2.51), 251000);
  assert.equal(toMinorPerMwh(3.06), 306000);
  assert.equal(fromMinorPerMwh(251000), 2.51);
  assert.equal(fromMinorPerMwh(null), null);
  assert.equal(toMinorPerMwh("x"), null);
  for (const v of [1.19, 2.05, 2.3, 3.75, 4.89]) assert.equal(fromMinorPerMwh(toMinorPerMwh(v)), v);
});

test("the rule in force is chosen by the offer's date", () => {
  const rules = [
    R({ id: "a", version: 1, effective_from: "2024-01-01" }),
    R({ id: "b", version: 2, effective_from: "2026-11-01" }),
    R({ id: "n", operator: "rednord", version: 1, effective_from: "2024-01-01" }),
  ];
  assert.equal(pickRule(rules, { operator: "premier", date: "2026-10-31" }).id, "a", "the day before v2");
  assert.equal(pickRule(rules, { operator: "premier", date: "2026-11-01" }).id, "b", "v2's first day");
  assert.equal(pickRule(rules, { operator: "rednord", date: "2027-01-01" }).id, "n", "each operator has its own");
  assert.equal(pickRule(rules, { operator: "premier", date: "2023-12-31" }), null, "before any rule");
  assert.equal(pickRule(rules, { market: "UA", operator: "premier", date: "2026-11-01" }), null);
});

test("an ended version stops applying; a same-day correction wins by version", () => {
  const rules = [
    R({ id: "a", version: 1, effective_from: "2024-01-01", effective_to: "2026-06-01" }),
    R({ id: "c1", version: 2, effective_from: "2026-09-01" }),
    R({ id: "c2", version: 3, effective_from: "2026-09-01" }),
  ];
  assert.equal(pickRule(rules, { operator: "premier", date: "2026-05-31" }).id, "a");
  assert.equal(pickRule(rules, { operator: "premier", date: "2026-07-15" }), null, "a gap between versions");
  assert.equal(pickRule(rules, { operator: "premier", date: "2026-09-02" }).id, "c2");
  assert.equal(nextVersion(rules, { operator: "premier" }), 4);
  assert.equal(nextVersion(rules, { operator: "rednord" }), 1);
});

test("the export price is weighted by the months a system exports in", () => {
  const flatYear = Array(12).fill(250000);
  near(ruleExportMdl(R({ export_monthly: flatYear })), 2.5);
  const winter = [300000, 300000, null, null, null, null, null, null, null, null, 300000, 300000];
  const w = [1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1];
  near(ruleExportMdl(R({ export_monthly: winter }), w), 3);
  assert.equal(ruleExportMdl(R({ export_monthly: null, export_flat_minor_per_mwh: 240000 })), 2.4);
  assert.equal(ruleExportMdl(R({})), null);
  const qi = ruleQuoteInputs(R({ id: "a", export_monthly: flatYear, retail_day_minor_per_mwh: 375000 }), { mdlPerEur: 20 });
  near(qi.feedOverride, 0.125);
  assert.equal(qi.retailDayMdl, 3.75);
  assert.equal(qi.version, 1);
});

test("the diff names each field and month that changed", () => {
  const a = R({ export_monthly: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12], retail_day_minor_per_mwh: 375000, note: "x" });
  const b = { ...a, export_monthly: [1, 2, 3, 99, 5, 6, 7, 8, 9, 10, 11, 12], retail_day_minor_per_mwh: 380000, effective_from: "2026-11-01" };
  const d = diffRules(a, b);
  assert.deepEqual(d.map((x) => x.field).sort(), ["effective_from", "export_monthly.3", "retail_day_minor_per_mwh"]);
  assert.deepEqual(diffRules(a, a), []);
});
