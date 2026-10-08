import { test } from "node:test";
import assert from "node:assert/strict";
import { defaultEngineSettings } from "@voltmira/engine";
import { evaluateProject, irrOf } from "./projectFinance.js";
import { aggregate, runPortfolioStress, riskMatrix, docReadiness, DOC_KEYS } from "./portfolio.js";
import { FINANCING_PRESETS, presetsFor, presetFinance } from "./financingPresets.js";
import { ES_ITEMS, itemsFor, esProgress, co2Avoided, GRID_EMISSION_FACTOR } from "./esScreening.js";

const E = defaultEngineSettings();
const FIN = { gearingPct: 70, ratePct: 8, tenorYears: 10 };
const A = { id: "a", name: "Winery", market: "MD", region: "premier", kw: 800, input: { kw: 800, price: 0.18, cons: 1_000_000, market: "MD", yieldOverride: 1250 } };
const B = { id: "b", name: "Cold store", market: "MD", region: "rednord", kw: 400, input: { kw: 400, price: 0.18, cons: 300_000, market: "MD", yieldOverride: 1200 } };
const C = { id: "c", name: "School", market: "UA", region: "lviv", kw: 200, input: { kw: 200, price: 0.0847, cons: 400_000, market: "UA", yieldOverride: 1100, startYear: 2026.75 } };
const items = (list, fin = FIN) => list.map((a) => ({ ...a, result: evaluateProject(a.input, E, fin, {}) }));
const close = (a, b, eps = 1e-6) => assert.ok(Math.abs(a - b) <= eps * Math.max(1, Math.abs(b)), `${a} vs ${b}`);

test("portfolio totals are the sums of its assets", () => {
  const its = items([A, B]);
  const g = aggregate(its);
  assert.equal(g.count, 2);
  assert.equal(g.kwp, 1200);
  close(g.capexEur, its[0].result.capexEur + its[1].result.capexEur);
  close(g.loanEur, its[0].result.loanEur + its[1].result.loanEur);
  close(g.year1Mwh, (its[0].result.year1Kwh + its[1].result.year1Kwh) / 1000);
  close(g.npv, its[0].result.npv + its[1].result.npv);
});

test("blended IRR is the IRR of the summed cash flow, between the assets' own", () => {
  const its = items([A, B]);
  const g = aggregate(its);
  close(g.irr, irrOf(g.projectCf), 1e-9);
  const lo = Math.min(its[0].result.irr, its[1].result.irr), hi = Math.max(its[0].result.irr, its[1].result.irr);
  assert.ok(g.irr >= lo - 1e-9 && g.irr <= hi + 1e-9);
});

test("pooled DSCR is total CFADS over total service; the weakest asset is named", () => {
  const its = items([A, B, C]);
  const g = aggregate(its);
  g.dscrByYear.slice(0, 10).forEach((d, i) => close(d, g.cfads[i] / g.debtService[i]));
  assert.equal(g.dscrByYear[10], null);
  const mins = its.map((x) => x.result.dscrMin);
  assert.equal(g.weakest.dscrMin, Math.min(...mins));
  assert.equal(g.weakest.id, its[mins.indexOf(Math.min(...mins))].id);
});

test("concentration by asset, area and market", () => {
  const g = aggregate(items([A, B, C]));
  close(g.byRegion.reduce((s, r) => s + r.sharePct, 0), 100, 1e-9);
  assert.equal(g.byRegion[0].key, "premier");
  assert.equal(g.byMarket.map((m) => m.key).sort().join(), "MD,UA");
  assert.ok(g.largestSharePct > 40 && g.largestSharePct < 100);
  assert.equal(aggregate(items([A])).largestSharePct, 100);
});

test("an empty portfolio is zeros and nulls, not NaN", () => {
  const g = aggregate([]);
  assert.equal(g.count, 0); assert.equal(g.irr, null); assert.equal(g.dscrMin, null);
  assert.ok(Object.values({ k: g.kwp, c: g.capexEur, n: g.npv }).every(Number.isFinite));
});

test("stress across the portfolio: base first, combined last, every case no better than base", () => {
  const suite = runPortfolioStress([A, B, C], E, FIN, {});
  assert.equal(suite[0].id, "base");
  assert.equal(suite[suite.length - 1].id, "combined");
  assert.ok(suite.some((s) => s.id === "war"), "a Ukrainian asset brings the war-risk case");
  for (const s of suite) assert.ok(s.agg.npv <= suite[0].agg.npv + 1e-6, s.id);
  const mdOnly = runPortfolioStress([A, B], E, FIN, {});
  assert.ok(!mdOnly.some((s) => s.id === "war"));
  // the base row equals evaluating the assets directly
  close(suite[0].agg.capexEur, aggregate(items([A, B, C])).capexEur);
});

const row = (rows, id) => rows.find((r) => r.id === id);
const fakeSuite = (m) => Object.entries(m).map(([id, dscrMin]) => ({ id, agg: { dscrMin, largestSharePct: 20, byRegion: [{ key: "x", sharePct: 20 }] } }));

test("risk matrix: every level follows its stated DSCR rule", () => {
  const assets = [{ id: "a", market: "MD", kw: 100, docs: {} }];
  const mk = (m, fin = {}, sc = {}) => riskMatrix({ suite: fakeSuite(m), fin, scenario: sc, assets });
  let r = mk({ base: 1.4, p90: 1.2, tariff: 1.2, curtailment: 1.2, currency: 1.2, delay: 1.1 });
  assert.deepEqual(["cover", "resource", "tariff", "curtailment", "currency", "construction"].map((k) => row(r, k).level),
    ["low", "low", "low", "low", "low", "low"]);
  r = mk({ base: 1.2, p90: 1.05, tariff: 1.05, curtailment: 1.05, currency: 1.05, delay: 0.7 });
  assert.deepEqual(["cover", "resource", "tariff", "curtailment", "currency", "construction"].map((k) => row(r, k).level),
    ["medium", "medium", "medium", "medium", "medium", "medium"]);
  r = mk({ base: 1.0, p90: 0.9, tariff: 0.9, curtailment: 0.9, currency: 0.9, delay: 0.3 });
  assert.deepEqual(["cover", "resource", "tariff", "curtailment", "currency", "construction"].map((k) => row(r, k).level),
    ["high", "high", "high", "high", "high", "high"]);
  assert.equal(row(mk({ base: 1.0, currency: 0.5 }, { debtCurrency: "local" }), "currency").level, "low", "a local-currency loan is hedged");
  assert.equal(row(mk({}), "cover").level, "unknown");
});

test("risk matrix: revenue basis, concentration and documents", () => {
  const assets = (kw, docs = {}) => [{ id: "a", market: "UA", kw, docs }];
  const limit = { UA: 30 };
  const base = (a, sc = {}) => riskMatrix({ suite: fakeSuite({ base: 1.4 }), fin: {}, scenario: sc, assets: a, schemeLimitKw: limit });
  assert.equal(row(base(assets(20)), "revenue").level, "medium");
  assert.equal(row(base(assets(500)), "revenue").level, "high", "above the scheme limit, the tariff does not apply");
  assert.equal(row(base(assets(500), { ppa: { sharePct: 80, priceEurMwh: 70, years: 10 } }), "revenue").level, "low");
  const all = Object.fromEntries(DOC_KEYS.map((k) => [k, "done"]));
  assert.equal(row(base(assets(20, all)), "documents").level, "low");
  assert.equal(row(base(assets(20, {})), "documents").level, "high");
  const conc = (share) => riskMatrix({ suite: [{ id: "base", agg: { dscrMin: 1.4, largestSharePct: share, byRegion: [{ key: "x", sharePct: 10 }] } }], fin: {}, scenario: {}, assets: assets(20) });
  assert.deepEqual([30, 45, 60].map((s) => row(conc(s), "concentration").level), ["low", "medium", "high"]);
});

test("document readiness: done counts 1, draft counts half", () => {
  assert.equal(docReadiness({}), 0);
  assert.equal(docReadiness(Object.fromEntries(DOC_KEYS.map((k) => [k, "done"]))), 1);
  close(docReadiness({ land: "done", grid: "draft" }), 1.5 / DOC_KEYS.length);
});

test("financing presets: every one has four languages, a note and honest status; grant cap converts", () => {
  for (const p of FINANCING_PRESETS) {
    for (const l of ["en", "ro", "ru", "uk"]) {
      assert.ok(p.name[l] && p.note[l], `${p.id} ${l}`);
      assert.ok(!/[—·]/.test(p.name[l] + p.note[l]), `${p.id} ${l} has an em dash or middle dot`);
    }
    assert.ok(["placeholder", "published"].includes(p.status));
    if (p.status === "published") assert.ok(p.source?.url?.startsWith("https://") && p.source.label, `${p.id} cites its source`);
  }
  assert.ok(presetsFor("MD").every((p) => p.markets.includes("MD")));
  assert.ok(presetsFor("UA").some((p) => p.id === "ua_greendim"));
  const g = presetFinance(FINANCING_PRESETS.find((p) => p.id === "ua_greendim"), 50);
  assert.equal(g.grantCapEur, 40_000);
  assert.equal(presetFinance(FINANCING_PRESETS.find((p) => p.id === "ua_greendim"), 50.97).grantCapEur, 39239, "rounded to whole EUR");
  assert.equal(g.grantCapUah, undefined);
  assert.deepEqual(presetFinance(FINANCING_PRESETS.find((p) => p.id === "ua_579"), 50).rateSteps, [0, 5, 7]);
});

test("E&S checklist: four languages, no em dashes, Ukraine-only items stay out of Moldova", () => {
  const ids = new Set();
  for (const i of ES_ITEMS) {
    assert.ok(!ids.has(i.id)); ids.add(i.id);
    for (const l of ["en", "ro", "ru", "uk"]) {
      assert.ok(i.q[l] && i.q[l].length > 20, `${i.id} ${l}`);
      assert.ok(!/[—·]/.test(i.q[l]), `${i.id} ${l} has an em dash or middle dot`);
    }
  }
  assert.ok(itemsFor("UA").some((i) => i.id === "safety_ordnance"));
  assert.ok(!itemsFor("MD").some((i) => i.id === "safety_ordnance"));
  const answers = { mgmt_responsibility: { status: "yes" }, labour_contracts: { status: "no" }, heritage: { status: "open" } };
  const p = esProgress(answers, ["MD"]);
  assert.equal(p.answered, 2); assert.equal(p.flagged, 1); assert.equal(p.total, itemsFor("MD").length);
  assert.equal(esProgress({}, []).answered, 0);
});

test("avoided CO2: output times the grid factor, falling with degradation", () => {
  const c = co2Avoided({ year1Mwh: 1000, market: "UA", years: 25, degrPctYr: 0.5 });
  close(c.tPerYear, 1000 * GRID_EMISSION_FACTOR.UA.tPerMwh);
  assert.ok(c.tLifetime < c.tPerYear * 25 && c.tLifetime > c.tPerYear * 22);
  assert.equal(co2Avoided({ year1Mwh: -5, market: "MD" }).tPerYear, 0);
});

test("Moldovan presets: published with a dated source, grant caps in lei convert, and only complete terms count as sourced", async () => {
  const { termsSourced } = await import("./financingPresets.js");
  const md = presetsFor("MD").map((p) => p.id);
  for (const id of ["md_eu4business", "md_geff_homes", "md_oda_ee"]) assert.ok(md.includes(id), id);
  for (const p of FINANCING_PRESETS.filter((x) => x.status === "published")) {
    assert.equal(typeof p.complete, "boolean", `${p.id} says whether every term is published`);
    assert.match(p.source.label, /20\d\d/, `${p.id} dates its source`);
  }
  const oda = FINANCING_PRESETS.find((p) => p.id === "md_oda_ee");
  assert.equal(presetFinance(oda, 50, 20).grantCapEur, 75_000, "1.5 million lei at 20 lei per EUR");
  assert.equal(presetFinance(oda, 50, 20).grantPct, 50);
  assert.equal(presetFinance(oda, 50, 20).grantCapMdl, undefined);
  const eu = presetFinance(FINANCING_PRESETS.find((p) => p.id === "md_eu4business"), 50, 20);
  assert.equal(eu.tenorYears, 6); assert.equal(eu.principalCompensationPct, 10); assert.equal(eu.debtCurrency, "EUR");
  assert.equal(termsSourced({ preset: "md_eu4business" }), false, "its rate is a placeholder");
  assert.equal(termsSourced({ preset: "md_oda_ee" }), true);
  assert.equal(termsSourced({ preset: "commercial_eur" }), false);
  assert.equal(termsSourced({ preset: "commercial_eur", termSheet: true }), true);
  assert.equal(termsSourced(null), false);
});
