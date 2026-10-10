import { test } from "node:test";
import assert from "node:assert/strict";
import * as G from "./greenData.js";

test("every dataset and programme names a source that exists", () => {
  const datasets = [G.COVERAGE, G.DAY_SUPPLY, G.RES_SHARE, G.CAPACITY_JUL_2026, G.TARGETS_2050, G.OBJECTIVES, G.BESS_STATUS, G.DAY_AHEAD, G.BALANCING, G.AUCTION_2, G.RAA, G.EVO];
  for (const d of datasets) assert.ok(G.SOURCES[d.source], `unknown source ${d.source}`);
  for (const p of G.PROGRAMS) {
    assert.ok(p.sources.length > 0, p.id);
    for (const s of p.sources) assert.ok(G.SOURCES[s], `${p.id}: ${s}`);
    if (p.law) assert.ok(G.LAWS[p.law], p.id);
  }
  for (const s of Object.values(G.SOURCES)) for (const l of ["en", "ro", "ru", "uk"]) assert.ok(s.title[l] && s.publisher[l], `${s.id} ${l}`);
});

test("each coverage period adds up to 100% within the slide's rounding", () => {
  for (const r of [...G.COVERAGE.yearly, ...G.COVERAGE.monthly]) {
    const sum = [r.right, r.left, r.ua, r.ro].reduce((s, v) => s + (v || 0), 0);
    // 2019 to 2021 print no Romanian share; the slide's own labels sum to 99..101
    assert.ok(sum >= 98.5 && sum <= 101.5, `${r.period}: ${sum}`);
  }
});

test("the transcription the owner confirmed: 2022, 2023, 2024 and the left bank at zero from 2025", () => {
  const y = Object.fromEntries(G.COVERAGE.yearly.map((r) => [r.period, r]));
  assert.deepEqual([y["2022"].ua, y["2022"].ro], [11, 11]);
  assert.deepEqual([y["2023"].ua, y["2023"].ro], [0.2, 6]);
  assert.deepEqual([y["2024"].right, y["2024"].ua, y["2024"].ro], [19, 1, 12]);
  assert.ok(G.COVERAGE.monthly.every((r) => r.left === 0));
  assert.equal(G.COVERAGE.monthly.length, 18);
  assert.equal(G.COVERAGE.monthly[0].period, "2025-01");
  assert.equal(G.COVERAGE.monthly.at(-1).period, "2026-06");
});

test("installed capacity keeps the slide's stated total and the parts it prints, gap and all", () => {
  const c = G.CAPACITY_JUL_2026;
  const parts = Object.values(c.mw).reduce((s, v) => s + v, 0) + c.excludedPrintedMw;
  assert.equal(Math.round(parts * 100) / 100, 1089.75);
  assert.equal(c.statedTotalMw, 1119.18);
});

test("nothing out of scope slips in: no oil, biogas, biomass, waste, nuclear or gas series", () => {
  const keys = new Set();
  const walk = (o) => {
    if (!o || typeof o !== "object") return;
    for (const [k, v] of Object.entries(o)) { keys.add(k.toLowerCase()); walk(v); }
  };
  const { EXCLUDED, ...rest } = G;
  walk(rest);
  for (const w of EXCLUDED) assert.ok(!keys.has(w), `series ${w} found`);
  for (const p of G.PROGRAMS) for (const w of EXCLUDED) assert.ok(!p.id.includes(w), p.id);
});

test("legal amounts stay in lei, as set", () => {
  for (const p of G.PROGRAMS) if (p.cap) assert.equal(p.cap.currency, "MDL", p.id);
  const g = G.PROGRAMS.find((p) => p.id === "bess_guarantee");
  assert.equal(g.cap.amount, 30000000);
  assert.equal(g.cap.basis, "loan");
});

test("no acceleration zone is invented before one is designated", () => {
  assert.deepEqual(G.RAA.zones, []);
  assert.equal(G.OBJECTIVES.interconnections.length, 7);
});
