import { test } from "node:test";
import assert from "node:assert/strict";
import { defaultEngineSettings } from "@voltmira/engine";
import { namesList, actionText, fxNote, keyMessages, structureName, termsLine, driverLabel } from "./portfolioDisplay.js";
import { moneyFmt, fxRate, capacity } from "./portfolioFormat.js";
import { buildModel } from "./portfolioModel.js";
import { normalizeFinance } from "./projectFinance.js";

test("names read naturally in every language", () => {
  assert.equal(namesList(["School"], "en"), "School");
  assert.equal(namesList(["School", "Winery"], "en"), "School and Winery");
  assert.equal(namesList(["A", "B", "C"], "en"), "A, B and C");
  assert.equal(namesList(["A", "B", "C", "D", "E"], "en"), "A, B and 3 more");
  assert.equal(namesList(["A", "B", "C", "D"], "uk"), "A, B та ще 2");
  assert.equal(namesList([], "en"), "");
});

test("a readiness step names its asset and its numbers", () => {
  assert.equal(actionText({ key: "act_doc_grid", names: ["School, Lviv"] }, "en"), "Get the grid connection agreement for School, Lviv");
  assert.equal(actionText({ key: "act_cover_p50", vars: { x: 1.21, t: 1.3, g: 62.5 } }, "en"),
    "Lower the debt share to 62.5% or lengthen the term: the lowest P50 cover is 1.21x against a 1.30x target");
  assert.equal(actionText({ key: "act_es_open", n: 12 }, "en"), "Answer 12 open screening questions");
});

test("money in the display currency, with the rate and its date stated", () => {
  const m = moneyFmt("en", { cur: "MDL", rate: 20 });
  assert.equal(m.full(1000), "20,000");
  assert.equal(m.compact(1_500_000), "30M");
  assert.equal(moneyFmt("en", { cur: "XXX", rate: 9 }).full(1000), "1,000", "an unknown currency falls back to EUR");
  assert.equal(moneyFmt("en", {}).full(null), "");
  const fx = { rates: { MDL: 19.9612, UAH: 48.1 }, meta: { MDL: { source: "BNM", asOf: "01.10.2026", live: true }, UAH: { source: "static", live: false } } };
  assert.equal(fxNote("en", "MDL", fx), "Figures in MDL at 19.9612 MDL per EUR (BNM, 01.10.2026). The model runs in EUR.");
  assert.match(fxNote("en", "UAH", fx), /fixed reference rate of 48.10 UAH per EUR: the live rate was not available/);
  assert.equal(fxNote("en", "EUR", fx), "All figures in EUR.");
  assert.equal(fxRate(51, "en"), "51.00");
  assert.equal(capacity(1250, "en"), "1.25 MW");
  assert.equal(capacity(850, "uk"), "850 кВт");
});

test("structure names and terms say what the structure is", () => {
  assert.equal(structureName({ id: "current" }, "en"), "Current");
  assert.equal(structureName({ id: "x", preset: "ua_579" }, "en"), "State-subsidised loan (5-7-9 family)");
  assert.equal(structureName({ id: "x", label: "Variant 2" }, "en"), "Variant 2");
  assert.equal(termsLine(normalizeFinance({ gearingPct: 70, ratePct: 9, tenorYears: 3, rateSteps: [0, 5, 7], debtCurrency: "local" }), "en"),
    "70% at 9%, 3 yrs, steps 0/5/7, local currency");
  assert.equal(termsLine(normalizeFinance({ gearingPct: 0, grantPct: 50 }), "en"), "No loan, grant 50%");
  assert.equal(driverLabel("yield", 10, "en"), "Energy yield ±10%");
});

test("key messages come from the model's own numbers", () => {
  const E = defaultEngineSettings();
  const rows = [{ id: "a", title: "Winery", kw: 800, price: 0.18, cons: 1e6, market: "MD", yield_per_kwp: 1250 }];
  const m = buildModel({ portfolio: { project_ids: ["a"], finance: { gearingPct: 95, ratePct: 8, tenorYears: 10 } }, projects: rows, E });
  const msgs = keyMessages(m, "en", moneyFmt("en"));
  assert.match(msgs[0], /^The cash flow supports debt of [\d,]+, \d+% of the capex after grant, at 1.30x on P50 and 1.20x on P90 over 10 years\./);
  assert.match(msgs[0], /is above that capacity by [\d,]+: the recommended debt share is [\d.]+%\./, "95% is over capacity");
  assert.ok(msgs.some((s) => s.startsWith("Blended project IRR")));
  const free = buildModel({ portfolio: { project_ids: ["a"], finance: { gearingPct: 0 } }, projects: rows, E });
  assert.match(keyMessages(free, "en", moneyFmt("en"))[0], /^No debt is modelled; the cash flow would support/);
  assert.deepEqual(keyMessages(buildModel({ portfolio: { project_ids: [] }, projects: [], E }), "en", moneyFmt("en")), []);
});

test("names with their own comma are separated by semicolons", () => {
  assert.equal(namesList(["Casa Rusu, Chișinău", "Fermă, Orhei", "X", "Y"], "en"), "Casa Rusu, Chișinău; Fermă, Orhei and 2 more");
  assert.equal(namesList(["Casa Rusu, Chișinău", "Farm"], "en"), "Casa Rusu, Chișinău and Farm");
});
