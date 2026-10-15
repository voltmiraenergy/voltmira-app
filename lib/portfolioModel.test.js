import { test } from "node:test";
import assert from "node:assert/strict";
import { defaultEngineSettings } from "@voltmira/engine";
import { buildModel, buildAsset } from "./portfolioModel.js";

const E = { ...defaultEngineSettings(), fx: { UAH: 50, MDL: 19.8 } };
const row = (id, o = {}) => ({
  id, title: "Site " + id, client_name: "Client " + id, address: "", kw: 500, price: 0.18, cons: 600000, market: "MD",
  batt: false, batt_kwh: null, status: "sent", created_at: "2026-09-29T10:00:00Z", yield_per_kwp: 1250, ...o,
});
const close = (a, b, eps = 1e-6) => assert.ok(Math.abs(a - b) <= eps * Math.max(1, Math.abs(b)), `${a} vs ${b}`);

test("the model keeps the portfolio's order, reports deleted and unsupported quotes, and never prices Romania as Moldova", () => {
  const projects = [row("b"), row("a", { market: "UA", address: "Львів, вул. Зелена 1", price: 0.1 }), row("r", { market: "RO" })];
  const m = buildModel({ portfolio: { market: "MD", project_ids: ["a", "gone", "b", "r"] }, projects, E });
  assert.deepEqual(m.assets.map((a) => a.id), ["a", "b"]);
  assert.deepEqual(m.missing, ["gone"]);
  assert.deepEqual(m.unsupported, ["r"]);
  assert.equal(m.assets[0].regionName, "Львівобленерго", "the area comes from the address");
  assert.deepEqual([...m.markets].sort(), ["MD", "UA"]);
  assert.equal(m.agg.count, 2);
  assert.ok(m.suite.some((s) => s.id === "war"));
});

test("the developer's capex and consumption override the quote's", () => {
  const a = buildAsset(row("x"), { capexEur: 640000, consKwh: 0, docs: { land: "done" }, note: "n" });
  assert.equal(a.input.costOverride, 640000);
  assert.equal(a.input.cons, 0);
  assert.equal(a.docs.land, "done");
  const m = buildModel({ portfolio: { project_ids: ["x"], assets: { x: { capexEur: 640000, consKwh: 0 } } }, projects: [row("x")], E });
  close(m.assets[0].result.capexEur, 640000);
  close(m.assets[0].result.selfRatio, 0);
  const plain = buildModel({ portfolio: { project_ids: ["x"] }, projects: [row("x")], E });
  close(plain.assets[0].result.capexEur, 500 * E.costPerKw);
});

test("finance and scenario come from the portfolio and are clamped", () => {
  const m = buildModel({
    portfolio: { project_ids: ["x"], finance: { gearingPct: 50, ratePct: 6, tenorYears: 8 }, scenario: { curtailmentPct: 5, tariffMultiplier: 0.9 } },
    projects: [row("x")], E,
  });
  assert.equal(m.fin.gearingPct, 50);
  close(m.assets[0].result.loanEur, m.assets[0].result.capexNetEur * 0.5);
  assert.equal(m.scenario.curtailmentPct, 5);
  assert.equal(m.hasDebt, true);
  const free = buildModel({ portfolio: { project_ids: ["x"], finance: { gearingPct: 0 } }, projects: [row("x")], E });
  assert.equal(free.hasDebt, false);
  assert.equal(free.agg.dscrMin, null);
});

test("an empty portfolio produces an empty, safe model", () => {
  const m = buildModel({ portfolio: { market: "UA", project_ids: [] }, projects: [], E });
  assert.equal(m.assets.length, 0);
  assert.equal(m.agg.count, 0);
  assert.deepEqual(m.suite, []);
  assert.deepEqual(m.risks, []);
  assert.deepEqual(m.markets, ["UA"], "the screening still follows the portfolio's own market");
  assert.equal(m.readiness.docsPct, 0);
  assert.equal(buildModel({ portfolio: null, projects: null, E }).assets.length, 0);
});

test("readiness, screening progress and avoided CO2 are carried through", () => {
  const m = buildModel({
    portfolio: {
      market: "UA", project_ids: ["x"], assets: { x: { docs: { land: "done", grid: "done", permit: "done", design: "done", offtake: "done", es: "done" } } },
      es: { answers: { mgmt_responsibility: { status: "yes" } } },
    },
    projects: [row("x", { market: "UA", price: 0.1 })], E,
  });
  assert.equal(m.readiness.docsPct, 100);
  assert.equal(m.esProgress.answered, 1);
  assert.ok(m.co2.tPerYear > 0 && m.co2.tLifetime > m.co2.tPerYear * 20);
  // a Ukrainian asset above the 30 kW household tariff limit is flagged
  assert.equal(m.risks.find((r) => r.id === "revenue").level, "high");
});
