import { test } from "node:test";
import assert from "node:assert/strict";
import { readiness, READINESS_WEIGHTS } from "./portfolioReadiness.js";
import { DOC_KEYS } from "./portfolio.js";
import { defaultEngineSettings } from "@voltmira/engine";
import { buildModel } from "./portfolioModel.js";

const close = (a, b, eps = 1e-9) => assert.ok(Math.abs(a - b) <= eps * Math.max(1, Math.abs(b)), `${a} vs ${b}`);
const all = (s) => Object.fromEntries(DOC_KEYS.map((k) => [k, s]));
const asset = (o = {}) => ({ name: "School, Lviv", market: "MD", docs: {}, hasSiteYield: true, capexOverrideEur: 1000, lat: 47, lon: 28.8, ...o });
const sizing = { p50Dscr: 1.3, p90Dscr: 1.2, recommendedGearingPct: 55 };
const screening = (yes, na, no, open) => ({ total: yes + na + no + open, yes, na, no, open });

test("a portfolio with everything in place scores 100 and has nothing to do", () => {
  const r = readiness({ assets: [asset({ docs: all("done") })], fin: { gearingPct: 60 }, dscr: { p50: 1.5, p90: 1.3 }, sizing, screening: screening(10, 2, 0, 0), termsSourced: true });
  close(r.score, 100);
  assert.deepEqual(r.actions, []);
  assert.equal(r.parts.reduce((s, p) => s + p.points, 0).toFixed(6), "100.000000");
});

test("the score is the weighted parts, and a part that does not apply is left out", () => {
  // papers half (draft everywhere), cover fails P90 only, screening 6 of 12, inputs: 3 checks met of 4
  const r = readiness({ assets: [asset({ docs: all("draft") })], fin: { gearingPct: 70 }, dscr: { p50: 1.35, p90: 1.1 }, sizing, screening: screening(5, 1, 2, 4), termsSourced: false });
  const want = (35 * 0.5 + 25 * 0.5 + 20 * 0.5 + 20 * 0.75) / 100 * 100;
  close(r.score, want);
  // no debt: the cover part drops out and the rest rescale
  const free = readiness({ assets: [asset({ docs: all("done") })], fin: { gearingPct: 0 }, dscr: {}, sizing, screening: screening(12, 0, 0, 0) });
  assert.equal(free.parts.find((p) => p.id === "cover").value, null);
  assert.equal(free.parts.find((p) => p.id === "inputs").checks.length, 3, "no terms check without debt or grant");
  close(free.score, 100);
  assert.equal(free.weightSum, READINESS_WEIGHTS.papers + READINESS_WEIGHTS.screening + READINESS_WEIGHTS.inputs);
});

test("actions name the asset, group the rest, and the gains add up to the missing points", () => {
  const assets = [asset({ name: "School, Lviv", docs: { land: "done", grid: "missing", permit: "draft" } }), asset({ name: "Winery", docs: {}, hasSiteYield: false, lat: null, lon: null })];
  const r = readiness({ assets, fin: { gearingPct: 70 }, dscr: { p50: 1.2, p90: 1.0 }, sizing, screening: screening(4, 0, 1, 7), termsSourced: false });
  const grid = r.actions.find((a) => a.id === "doc_grid_missing");
  assert.deepEqual(grid.names, ["School, Lviv", "Winery"]);
  const permitDraft = r.actions.find((a) => a.id === "doc_permit_draft");
  assert.deepEqual(permitDraft.names, ["School, Lviv"]);
  assert.equal(permitDraft.key, "act_draft_permit");
  assert.ok(r.actions.find((a) => a.id === "es_open").n === 7);
  assert.ok(r.actions.find((a) => a.id === "cover_p50").vars.g === 55);
  assert.equal(r.actions.find((a) => a.id === "in_location").n, 1);
  for (let i = 1; i < r.actions.length; i++) assert.ok(r.actions[i].gain <= r.actions[i - 1].gain, "biggest gain first");
  close(r.score + r.actions.reduce((s, a) => s + a.gain, 0), 100, 1e-9);
});

test("a Ukrainian asset adds the war-risk insurance check", () => {
  const r = readiness({ assets: [asset({ market: "UA", docs: all("done") })], fin: { gearingPct: 0 }, scenario: { warRiskPremiumPct: 0 }, sizing, screening: screening(13, 0, 0, 0) });
  assert.ok(r.actions.some((a) => a.id === "in_war"));
  const ok = readiness({ assets: [asset({ market: "UA", docs: all("done") })], fin: { gearingPct: 0 }, scenario: { warRiskPremiumPct: 1.2 }, sizing, screening: screening(13, 0, 0, 0) });
  close(ok.score, 100);
});

test("an empty portfolio scores nothing rather than a false 100", () => {
  const r = readiness({ assets: [], fin: {}, sizing, screening: screening(0, 0, 0, 15) });
  assert.equal(r.score, 0);
});

test("the model carries the score, from the rows' own data", () => {
  const E = defaultEngineSettings();
  const rows = [{ id: "x", title: "Farm", kw: 300, price: 0.18, cons: 200000, market: "MD", yield_per_kwp: 1250, lat: 47.1, lon: 28.6 },
    { id: "y", title: "Shop", kw: 100, price: 0.18, cons: 90000, market: "MD" }];
  const m = buildModel({ portfolio: { project_ids: ["x", "y"], finance: { gearingPct: 60, termSheet: true } }, projects: rows, E });
  assert.ok(m.readiness.score > 0 && m.readiness.score < 100);
  const inputs = m.readiness.parts.find((p) => p.id === "inputs");
  assert.deepEqual(inputs.checks.map((c) => [c.id, c.value]), [["yield", 0.5], ["capex", 0], ["location", 0.5], ["terms", 1]]);
  assert.equal(m.assets[1].lat, null);
});
