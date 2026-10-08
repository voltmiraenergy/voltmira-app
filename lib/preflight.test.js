import { test } from "node:test";
import assert from "node:assert/strict";
import { preflight } from "./preflight.js";
import { checkText } from "./preflightText.js";
import { BT } from "./bankText.js";

const TODAY = "2026-10-08";
const ok = () => ({
  id: "a", name: "Sud",
  solar: { mwp: 10, yieldKwhKwp: 1300, yieldSource: "pvgis", degrFirstPct: 2, variabilityPct: 3.7, variabilityDb: "PVGIS-SARAH2", variabilityYears: "2005-2020" },
  revenue: { kind: "ppa", priceEurMwh: 60, years: 15 }, permits: {},
});
const ids = (f) => f.map((x) => x.id);

test("a plant with its assumptions stated and nothing odd has nothing to check", () => {
  assert.deepEqual(preflight({ plant: ok(), docs: [], todayKey: TODAY }), []);
});

test("what the cover rests on: no price, no energy, no generating part stop the pack", () => {
  assert.deepEqual(preflight({ plant: { ...ok(), revenue: { kind: "ppa", priceEurMwh: 0 } }, todayKey: TODAY }).map((x) => [x.id, x.level]), [["no_price", "stop"]]);
  assert.ok(ids(preflight({ plant: { ...ok(), solar: { mwp: 10, yieldKwhKwp: 0 } }, todayKey: TODAY })).includes("no_energy"));
  assert.ok(ids(preflight({ plant: { id: "x", revenue: { kind: "ppa", priceEurMwh: 60 } }, todayKey: TODAY })).includes("no_source"));
  // a merchant plant needs no contract price
  assert.ok(!ids(preflight({ plant: { ...ok(), revenue: { kind: "merchant", afterEurMwh: 50 } }, todayKey: TODAY })).includes("no_price"));
  // stops come first
  const f = preflight({ plant: { ...ok(), revenue: { kind: "ppa", priceEurMwh: 0 }, solar: { mwp: 10, yieldKwhKwp: 1300, yieldSource: "pvgis" } }, todayKey: TODAY });
  assert.equal(f[0].level, "stop");
});

test("a capacity factor outside the usual range, and a study far from the public data, are flagged", () => {
  const cf = preflight({ plant: { ...ok(), solar: { ...ok().solar, yieldKwhKwp: 4000 } }, todayKey: TODAY }).find((x) => x.id === "cf_range");
  assert.equal(cf.part, "solar");
  assert.ok(cf.cf > 0.3);
  // a study 40% above the PVGIS-based estimate
  const far = ok(); far.solar.study = { p50Mwh: 10 * 1300 * 1.4, p90Mwh: 17000, p90Basis: "1y" };
  const v = preflight({ plant: far, todayKey: TODAY }).find((x) => x.id === "study_vs_public");
  assert.ok(v && Math.abs(v.ratio - 1.4) < 1e-9);
  const near = ok(); near.solar.study = { p50Mwh: 10 * 1300 * 1.05, p90Mwh: 12000, p90Basis: "1y" };
  assert.ok(!ids(preflight({ plant: near, todayKey: TODAY })).includes("study_vs_public"));
  // a manual yield has no public data to compare with
  const manual = ok(); manual.solar.yieldSource = "manual"; manual.solar.study = { p50Mwh: 30000, p90Mwh: 27000, p90Basis: "1y" };
  assert.ok(!ids(preflight({ plant: manual, todayKey: TODAY })).includes("study_vs_public"));
});

test("studies: a P90 with no horizon, no P90, and a study older than three years", () => {
  const s = ok(); s.solar.study = { p50Mwh: 13000, p90Mwh: 11900, date: "2022-05-01" };
  const f = preflight({ plant: s, todayKey: TODAY });
  assert.ok(ids(f).includes("p90_horizon"));
  const old = f.find((x) => x.id === "study_old");
  assert.deepEqual([old.years, old.date], [4, "2022-05-01"]);
  const none = ok(); none.solar.study = { p50Mwh: 13000, date: "2026-05-01" };
  const g = preflight({ plant: none, todayKey: TODAY });
  assert.ok(ids(g).includes("p90_missing") && !ids(g).includes("study_old") && !ids(g).includes("p90_horizon"));
});

test("assumptions the figures rest on are stated: first-year degradation unset, weather not measured", () => {
  const p = ok(); p.solar.degrFirstPct = 0; p.solar.variabilityPct = null;
  assert.deepEqual(ids(preflight({ plant: p, todayKey: TODAY })).sort(), ["degr_first", "weather_unmeasured"]);
  // a study carries its own, so neither is raised
  const s = ok(); s.solar.degrFirstPct = 0; s.solar.variabilityPct = null; s.solar.study = { p50Mwh: 13000, p90Mwh: 11900, p90Basis: "1y", date: "2026-05-01" };
  assert.deepEqual(preflight({ plant: s, todayKey: TODAY }), []);
});

test("the paper: a file on record twice, and an item marked done with nothing behind it", () => {
  const p = ok(); p.permits = { land: { status: "done" }, grid: { status: "in_progress" } };
  const docs = [{ item_id: "grid", name: "Aviz.pdf", size: 10 }, { item_id: "grid", name: "AVIZ.pdf", size: 10 }, { item_id: "grid", name: "Aviz.pdf", size: 11 }];
  const f = preflight({ plant: p, docs, todayKey: TODAY });
  assert.deepEqual(f.filter((x) => x.id === "dup_file").map((x) => x.name), ["AVIZ.pdf"]);
  assert.deepEqual(f.filter((x) => x.id === "done_no_doc").map((x) => x.item), ["land"]);
  // where the deal room is not set up there is nothing to compare with
  assert.ok(!ids(preflight({ plant: p, docs: null, todayKey: TODAY })).includes("done_no_doc"));
});

test("every finding reads as a sentence in all four languages, with no placeholder left", () => {
  const all = [
    { id: "no_price", level: "stop" }, { id: "no_energy", level: "stop", part: "wind" }, { id: "no_source", level: "stop" },
    { id: "cf_range", level: "check", part: "solar", cf: 0.41, lo: 0.08, hi: 0.3 }, { id: "study_vs_public", level: "check", part: "wind", ratio: 1.4 },
    { id: "p90_horizon", level: "check", part: "solar" }, { id: "p90_missing", level: "check", part: "wind" }, { id: "study_old", level: "check", part: "solar", years: 4, date: "2022-05-01" },
    { id: "degr_first", level: "check" }, { id: "weather_unmeasured", level: "check" }, { id: "dup_file", level: "check", name: "Aviz.pdf" }, { id: "done_no_doc", level: "check", item: "land" },
  ];
  for (const lang of ["en", "ro", "ru", "uk"]) for (const f of all) {
    const t = checkText(f, lang);
    assert.ok(t.length > 10 && !/\{\w+\}|^pf_/.test(t), `${f.id} ${lang}: ${t}`);
    assert.ok(!/[—–·✓]/.test(t));
  }
  assert.equal(checkText({ id: "study_vs_public", ratio: 1.4, part: "wind" }, "en"), "Wind: the study's P50 is 40% above the public-data estimate for this site. A difference this large needs an explanation from the consultant (layout, losses, a measured resource).");
  assert.ok(Object.keys(BT).filter((k) => k.startsWith("pf_")).length >= 18);
});
