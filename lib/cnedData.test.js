import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { cnedEnabled, cnedSnapshot, raionStats, nationalTotals, marketSummary, raionBrief, regionalContext } from "./cnedData.js";
import { CNED_ESER } from "./data/cnedEser.js";
import { SHAPES, CENTRES } from "./data/mdRaionShapes.js";
import { COVERED, raionId, RAIONS } from "./mdRaions.js";

test("CNED data stays off unless CNED_DATA is on", () => {
  assert.equal(cnedEnabled({}), false);
  assert.equal(cnedEnabled({ CNED_DATA: "1" }), false);
  assert.equal(cnedEnabled({ CNED_DATA: "On" }), true);
  assert.equal(cnedSnapshot({}), null);
  assert.equal(cnedSnapshot({ CNED_DATA: "on" }), CNED_ESER);
});

test("the snapshot holds aggregates only: no names, IDNO, owners, contacts or EIC codes", () => {
  const text = JSON.stringify(CNED_ESER);
  for (const k of ["denumire", "idno", "proprietar", "contact", "mail", "eic", "adresa", "name", "owner", "phone", "telefon"]) {
    assert.ok(!new RegExp(`"[^"]*${k}[^"]*"\\s*:`, "i").test(text), `a field like "${k}" is in the snapshot`);
  }
  // positions are rounded to 0.01 degree
  for (const [lat, lon] of CNED_ESER.points) {
    assert.equal(Math.round(lat * 100) / 100, lat);
    assert.equal(Math.round(lon * 100) / 100, lon);
  }
});

test("the snapshot's parts add up to CNED's own totals", () => {
  const n = CNED_ESER.national;
  const byArea = (f) => Object.values(CNED_ESER.raions).reduce((s, r) => s + f(r), 0);
  const close = (a, b) => assert.ok(Math.abs(a - b) < 1, `${a} vs ${b}`);
  for (const t of ["pv", "wind", "hydro", "other"]) close(byArea((r) => r.plants[t].kw), n.plants[t].kw);
  close(byArea((r) => r.prosumers.kw), n.prosumers.kw);
  assert.equal(byArea((r) => r.prosumers.n), n.prosumers.n);
  close(n.prosumers.pf.kw + n.prosumers.pj.kw, n.prosumers.kw);
  close(n.prosumers.cn.kw + n.prosumers.fn.kw, n.prosumers.kw);
  assert.equal(Object.keys(CNED_ESER.raions).length, COVERED.length);
  // the August 2026 figures on CNED's dashboard
  if (CNED_ESER.source.dataTo === "2026-08-31") {
    const t = nationalTotals(CNED_ESER);
    close(t.totalKw, 1119176); // the dashboard prints 1,119,176 kW; the parts here carry one decimal
    assert.equal(t.installations, 573);
    assert.equal(n.prosumers.n, 10291);
  }
});

test("no client component imports the snapshot (it would ship to every visitor)", () => {
  const roots = ["app", "components"];
  const offenders = [];
  const walk = (dir) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) { if (e.name !== "node_modules" && !e.name.startsWith(".")) walk(p); continue; }
      if (!/\.(jsx?|mjs)$/.test(e.name)) continue;
      const src = fs.readFileSync(p, "utf8");
      // an import, not a mention in a comment
      if (/^\s*["']use client["']/.test(src) && /(from|import\()\s*["'][^"']*(cnedEser|cnedData)(\.js)?["']/.test(src)) offenders.push(p);
    }
  };
  for (const r of roots) walk(r);
  assert.deepEqual(offenders, []);
});

test("every name the sources use folds to one area id", () => {
  for (const s of ["Ștefan-Vodă", "..Stefan Voda", "Stefan Voda", "SIngerei", "RIscani", "UTA Găgăuzia (Ciadîr-Lunga, Vulcăneşti, Comrat)", "U.T.A. Gagauzia", "Mun. Chisinau", "Telenesti", "Hîncești", "Bălți", "Transnistria", "Bender"]) {
    assert.ok(raionId(s), s);
  }
  assert.equal(raionId("Kyiv"), null);
  const pop = COVERED.reduce((s, r) => s + r.population, 0);
  assert.equal(pop, 2365645); // BNS, 1 January 2026, total for the country
  assert.equal(RAIONS.length, 37);
});

test("area figures: ranks, per 10,000 residents and 12-month growth", () => {
  const stats = raionStats(CNED_ESER, CENTRES);
  assert.equal(stats.length, 35);
  const ia = stats.find((s) => s.id === "ialoveni");
  assert.equal(ia.perTenK, Math.round((ia.prosumers.n / 74930) * 100000) / 10);
  assert.ok(ia.rank.perTenK >= 1 && ia.rank.perTenK <= 35);
  assert.equal(ia.near.length, 5);
  assert.ok(!ia.near.includes("ialoveni"));
  assert.ok(ia.growth12 && ia.growth12.n >= 0);
  const ranks = stats.map((s) => s.rank.perTenK).sort((a, b) => a - b);
  assert.deepEqual(ranks, Array.from({ length: 35 }, (_, i) => i + 1));
});

test("the market summary adds the chosen areas and suggests growing neighbours outside them", () => {
  const stats = raionStats(CNED_ESER, CENTRES);
  assert.equal(marketSummary(stats, []), null);
  const m = marketSummary(stats, ["ialoveni", "chisinau"]);
  const a = stats.find((s) => s.id === "ialoveni"), b = stats.find((s) => s.id === "chisinau");
  assert.equal(m.n, a.prosumers.n + b.prosumers.n);
  assert.ok(m.nearby.every((s) => s.id !== "ialoveni" && s.id !== "chisinau"));
  assert.ok(m.nearby.length > 0);
});

test("a quote's area and a portfolio's regional context come from the position", () => {
  const stats = raionStats(CNED_ESER);
  assert.equal(raionBrief(stats, "nowhere"), null);
  assert.equal(raionBrief(stats, "ialoveni").id, "ialoveni");
  const ctx = regionalContext(stats, [{ name: "A", lat: 46.94, lon: 28.78 }, { name: "B", lat: 46.84, lon: 29.63 }, { name: "C", lat: null, lon: null }], SHAPES);
  assert.equal(ctx.length, 2);
  assert.equal(ctx[0].raion, "ialoveni");
  assert.equal(ctx[1].raion, "transnistria");
  assert.equal(ctx[1].covered, false);
  assert.equal(ctx[1].pvKw, null);
});

test("capacityNear counts the plants within the radius, by technology; gridContext adds the district", async () => {
  const { capacityNear, gridContext, raionStats, NEAR_KM } = await import("./cnedStats.js");
  const { SHAPES } = await import("./data/mdRaionShapes.js");
  const snap = { points: [[47.0, 28.8, "pv", 5000, 2], [47.05, 28.85, "wind", 20000, 1], [46.0, 28.0, "pv", 9000, 1]] };
  const near = capacityNear(snap, 47.0, 28.8);
  assert.equal(NEAR_KM, 15);
  assert.deepEqual([near.pv.kw, near.pv.n, near.wind.kw, near.wind.n, near.km], [5000, 2, 20000, 1, 15]);
  assert.equal(capacityNear(null, 47, 28.8).pv.kw, 0);
  // the real snapshot: a point in Chisinau has a district with plants, a point outside Moldova has none
  const real = CNED_ESER;
  const ctx = gridContext(real, raionStats(real), 47.02, 28.83, SHAPES);
  assert.ok(ctx && ctx.raion && ctx.plantsN >= 0 && typeof ctx.crowded === "boolean");
  assert.equal(gridContext(real, raionStats(real), 50.45, 30.52, SHAPES), null);
});
