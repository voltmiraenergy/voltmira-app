import { test } from "node:test";
import assert from "node:assert/strict";
import { defaultEngineSettings } from "@voltmira/engine";
import { evaluateProject } from "./projectFinance.js";
import { aggregate } from "./portfolio.js";
import { tornado, sortTornado, tornadoDrivers, compareStructures } from "./portfolioSensitivity.js";
import { buildModel, structuresOf, MAX_STRUCTURES } from "./portfolioModel.js";

const E = defaultEngineSettings();
const A = { id: "a", name: "Winery", market: "MD", region: "premier", kw: 800, input: { kw: 800, price: 0.18, cons: 1_000_000, market: "MD", yieldOverride: 1250 } };
const B = { id: "b", name: "School", market: "UA", region: "lviv", kw: 200, input: { kw: 200, price: 0.0847, cons: 400_000, market: "UA", yieldOverride: 1100 } };
const FIN = { gearingPct: 70, ratePct: 8, tenorYears: 10 };
const close = (a, b, eps = 1e-6) => assert.ok(Math.abs(a - b) <= eps * Math.max(1, Math.abs(b)), `${a} vs ${b}`);

test("the tornado's base is the base case, and each flex moves the right way", () => {
  const t = tornado([A, B], E, FIN, {});
  const base = aggregate([A, B].map((a) => ({ ...a, result: evaluateProject(a.input, E, FIN, {}) })));
  close(t.base.npv, base.npv);
  close(t.base.dscrMin, base.dscrMin);
  const r = (id) => t.rows.find((x) => x.id === id);
  assert.ok(r("yield").lo.dscrMin < t.base.dscrMin && r("yield").hi.dscrMin > t.base.dscrMin, "more yield, more cover");
  assert.ok(r("price").lo.npv < t.base.npv && r("price").hi.npv > t.base.npv);
  assert.ok(r("capex").hi.npv < t.base.npv, "capex up, NPV down");
  assert.ok(r("rate").hi.dscrMin < t.base.dscrMin, "a higher rate, less cover");
  close(r("rate").hi.npv, t.base.npv, 1e-12);                        // the rate is financing: NPV does not move
  assert.equal(r("curtailment").lo, null, "one-sided");
  assert.ok(r("delay").hi.npv < t.base.npv);
});

test("sorted for a metric: widest swing first; a driver with no effect drops out; no debt means no DSCR tornado", () => {
  const t = tornado([A, B], E, FIN, {});
  const rows = sortTornado(t, "npv");
  for (let i = 1; i < rows.length; i++) assert.ok(rows[i].span <= rows[i - 1].span);
  assert.ok(!rows.some((x) => x.id === "rate"), "the interest rate does not move the project NPV");
  const d = sortTornado(t, "dscrMin");
  assert.ok(d.some((x) => x.id === "rate"));
  d.forEach((x) => { if (x.dLo != null) close(x.dLo, x.lo - t.base.dscrMin); });
  const free = tornado([A], E, { gearingPct: 0 }, {});
  assert.deepEqual(sortTornado(free, "dscrMin"), []);
  assert.ok(!tornadoDrivers({ gearingPct: 0 }, {}, E).some((x) => x.id === "rate"));
  assert.deepEqual(tornado([], E, FIN, {}), { base: null, rows: [] });
});

test("escalation flexes around the engine's default when the base keeps it", () => {
  const ds = tornadoDrivers(FIN, {}, E);
  const esc = ds.find((x) => x.id === "escalation");
  assert.equal(esc.lo.scenario.tariffEscalationPct, E.bands.expc.infl - 2);
  assert.equal(esc.hi.scenario.tariffEscalationPct, E.bands.expc.infl + 2);
  const set = tornadoDrivers(FIN, { tariffEscalationPct: 5 }, E).find((x) => x.id === "escalation");
  assert.equal(set.lo.scenario.tariffEscalationPct, 3);
});

test("structures side by side: the current one matches the model, a grant lowers the debt and lifts the project IRR", () => {
  const rows = [{ id: "a", title: "Winery", kw: 800, price: 0.18, cons: 1e6, market: "MD", yield_per_kwp: 1250 }];
  const finance = {
    gearingPct: 70, ratePct: 8, tenorYears: 10,
    compare: [
      { id: "g", label: "Grant", fin: { gearingPct: 50, ratePct: 8, tenorYears: 10, grantPct: 30 } },
      { id: "l", label: "Lei", fin: { gearingPct: 65, ratePct: 12, tenorYears: 7, debtCurrency: "local" } },
    ],
  };
  const m = buildModel({ portfolio: { project_ids: ["a"], finance }, projects: rows, E });
  assert.equal(m.structures.length, 3);
  const [cur, grant, lei] = m.structures;
  close(cur.npv, m.agg.npv); close(cur.dscrMin, m.agg.dscrMin); close(cur.dscrMinP90, m.p90.dscrMin);
  close(cur.capacityEur, m.sizing.capacityEur);
  assert.ok(grant.grantEur > 0 && grant.loanEur < cur.loanEur);
  assert.ok(grant.irr > cur.irr, "a grant lowers the investment, so the project IRR rises");
  assert.equal(lei.fin.debtCurrency, "local");
  assert.equal(grant.label, "Grant");
  // never more than four, current first
  const many = structuresOf({ compare: Array.from({ length: 9 }, (_, i) => ({ id: "x" + i, fin: {} })) });
  assert.equal(many.length, MAX_STRUCTURES);
  assert.equal(many[0].id, "current");
  assert.equal(structuresOf({ compare: [null, { id: "x" }] }).length, 1, "an entry without terms is ignored");
  assert.deepEqual(compareStructures({ assets: [], E, scenario: {}, structures: structuresOf({}) }), []);
});
