import { test } from "node:test";
import assert from "node:assert/strict";
import { defaultEngineSettings } from "@voltmira/engine";
import { buildModel } from "./portfolioModel.js";
import { buildWorkbook, buildDataRoom, toCsv, caseLabel, riskRows, esRows, documentRows } from "./portfolioExport.js";
import { unzip } from "./zip.js";

const E = { ...defaultEngineSettings(), fx: { UAH: 50, MDL: 19.8 } };
const row = (id, o = {}) => ({
  id, title: "Site " + id, client_name: "C" + id, address: "", kw: 500, price: 0.18, cons: 600000, market: "MD",
  batt: false, batt_kwh: null, status: "sent", created_at: "2026-09-29T10:00:00Z", yield_per_kwp: 1250, ...o,
});
const projects = [row("a"), row("b", { kw: 300 }), row("c", { market: "UA", price: 0.1, address: "Київ", kw: 200 })];
const portfolio = (o = {}) => ({
  name: "Test = portfolio", market: "MD", project_ids: ["a", "b", "c"],
  finance: { gearingPct: 70, ratePct: 8, tenorYears: 10, discPct: 8 }, scenario: {},
  assets: { a: { docs: { land: "done", grid: "draft" }, capexEur: 600000 } },
  es: { answers: { mgmt_responsibility: { status: "yes", note: "=HYPERLINK(\"x\")" } }, impact: { jobsConstruction: 40 } }, ...o,
});
const model = (o) => buildModel({ portfolio: portfolio(o), projects, E });

// ---- reading the workbook back
const dec = (u) => new TextDecoder().decode(u);
const unesc = (s) => s.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&amp;/g, "&");
function readBook(bytes) {
  const files = Object.fromEntries(unzip(bytes).map((f) => [f.name, dec(f.data)]));
  const names = [...files["xl/workbook.xml"].matchAll(/<sheet name="([^"]*)"/g)].map((m) => unesc(m[1]));
  const sheets = {};
  names.forEach((name, i) => {
    const map = new Map();
    for (const m of files[`xl/worksheets/sheet${i + 1}.xml`].matchAll(/<c r="([A-Z]+\d+)"([^>]*)>(.*?)<\/c>/g)) {
      const [, ref, attrs, inner] = m;
      const f = inner.match(/<f>(.*?)<\/f>/);
      const v = inner.match(/<v>(.*?)<\/v>/);
      const t = inner.match(/<t[^>]*>(.*?)<\/t>/);
      let val = null;
      if (/t="inlineStr"/.test(attrs)) val = t ? unesc(t[1]) : "";
      else if (/t="str"/.test(attrs)) val = v ? unesc(v[1]) : "";
      else if (v) val = Number(v[1]);
      map.set(ref, { f: f ? unesc(f[1]) : null, v: val });
    }
    sheets[name] = map;
  });
  return sheets;
}

// ---- a small spreadsheet evaluator for exactly the functions the workbook uses
function colNum(s) { let n = 0; for (const ch of s) n = n * 26 + ch.charCodeAt(0) - 64; return n; }
function colStr(n) { let s = ""; for (; n > 0; n = Math.floor((n - 1) / 26)) s = String.fromCharCode(65 + ((n - 1) % 26)) + s; return s; }
function evaluator(sheets) {
  const cache = new Map();
  const cell = (sheet, ref) => {
    ref = ref.replace(/\$/g, "");
    const key = sheet + "!" + ref;
    if (cache.has(key)) return cache.get(key);
    const c = sheets[sheet]?.get(ref);
    const v = !c ? null : c.f != null ? run(c.f, sheet) : c.v;
    cache.set(key, v);
    return v;
  };
  const range = (sheet, a, b) => {
    const [, ca, ra] = a.replace(/\$/g, "").match(/([A-Z]+)(\d+)/), [, cb, rb] = b.replace(/\$/g, "").match(/([A-Z]+)(\d+)/);
    const out = [];
    for (let r = +ra; r <= +rb; r++) for (let c = colNum(ca); c <= colNum(cb); c++) out.push(cell(sheet, colStr(c) + r));
    return out;
  };
  const nums = (args) => args.flat().filter((v) => typeof v === "number");
  const irr = (vals) => {
    const f = (r) => vals.reduce((s, c, i) => s + c / Math.pow(1 + r, i), 0);
    let lo = -0.9, hi = 1.5, fl = f(lo);
    if (fl * f(hi) > 0) throw new Error("#NUM!");
    for (let i = 0; i < 120; i++) { const m = (lo + hi) / 2, fm = f(m); if (Math.abs(fm) < 1e-6) return m; if (fl * fm < 0) hi = m; else { lo = m; fl = fm; } }
    return (lo + hi) / 2;
  };
  const FN = {
    SUM: (a) => nums(a).reduce((x, y) => x + y, 0),
    MIN: (a) => Math.min(...nums(a)),
    MAX: (a) => Math.max(...nums(a)),
    INT: (a) => Math.floor(nums(a)[0]),
    AVERAGE: (a) => { const n = nums(a); return n.reduce((x, y) => x + y, 0) / n.length; },
    COUNT: (a) => nums(a).length,
    COUNTA: (a) => a.flat().filter((v) => v !== null && v !== "").length,
    NPV: (a) => nums(a.slice(1)).reduce((s, c, i) => s + c / Math.pow(1 + a[0], i + 1), 0),
    IRR: (a) => irr(nums(a)),
  };
  function run(src, sheet) {
    const tokens = [...src.matchAll(/"(?:[^"]|"")*"|\d+(?:\.\d+)?(?:[eE][-+]?\d+)?|[A-Z][A-Z0-9.]*(?=\()|(?:'[^']+'|[A-Za-z_]\w*)!\$?[A-Z]{1,3}\$?\d+(?::\$?[A-Z]{1,3}\$?\d+)?|\$?[A-Z]{1,3}\$?\d+(?::\$?[A-Z]{1,3}\$?\d+)?|<=|>=|<>|[-+*/(),<>=]/g)].map((m) => m[0]);
    let p = 0;
    const peek = () => tokens[p], next = () => tokens[p++];
    const cmp = () => {
      let l = add();
      while (["<", ">", "=", "<=", ">=", "<>"].includes(peek())) {
        const op = next(), r = add(), a = l;
        l = () => { const x = a(), y = r(); return op === "<" ? x < y : op === ">" ? x > y : op === "=" ? x === y : op === "<=" ? x <= y : op === ">=" ? x >= y : x !== y; };
      }
      return l;
    };
    const add = () => {
      let l = mul();
      while (peek() === "+" || peek() === "-") { const op = next(), r = mul(), a = l; l = () => (op === "+" ? a() + r() : a() - r()); }
      return l;
    };
    const mul = () => {
      let l = unary();
      while (peek() === "*" || peek() === "/") {
        const op = next(), r = unary(), a = l;
        l = () => { const y = r(); if (op === "/" && y === 0) throw new Error("#DIV/0!"); return op === "*" ? a() * y : a() / y; };
      }
      return l;
    };
    const unary = () => { if (peek() === "-") { next(); const u = unary(); return () => -u(); } return primary(); };
    const primary = () => {
      const t = next();
      if (t === "(") { const e = cmp(); next(); return e; }
      if (t[0] === '"') { const s = t.slice(1, -1).replace(/""/g, '"'); return () => s; }
      if (/^\d/.test(t)) return () => Number(t);
      if (/^[A-Z][A-Z0-9.]*$/.test(t) && peek() === "(") {
        next();
        const args = [];
        if (peek() !== ")") { args.push(cmp()); while (peek() === ",") { next(); args.push(cmp()); } }
        next();
        if (t === "IF") return () => (args[0]() ? args[1]() : args[2] ? args[2]() : false);
        if (t === "IFERROR") return () => { try { const v = args[0](); if (typeof v === "number" && !Number.isFinite(v)) throw new Error(); return v; } catch { return args[1](); } };
        return () => FN[t](args.map((a) => a()));
      }
      // a reference, with or without a sheet, single or a range
      const m = t.match(/^(?:('?)([^!']+)\1!)?(.+)$/);
      const sh = m[2] || sheet;
      const [a, b] = m[3].split(":");
      return b ? () => range(sh, a, b) : () => cell(sh, a);
    };
    const top = cmp();
    return top();
  }
  return { cell, run };
}

const near = (a, b) => (typeof a === "number" && typeof b === "number" ? Math.abs(a - b) <= 1e-6 * Math.max(1, Math.abs(b)) : a === b);

test("every formula in the workbook, recomputed from scratch, equals the value cached in the file", () => {
  for (const m of [model(), model({ finance: { gearingPct: 0 } }),
    model({ finance: { gearingPct: 60, rateSteps: [0, 5, 7], tenorYears: 3, principalCompensationPct: 30, grantPct: 40, feePct: 1.5 }, scenario: { ppa: { sharePct: 50, priceEurMwh: 70, years: 8, escalationPct: 1, currency: "EUR" }, curtailmentPct: 5, delayMonths: 6 } }),
    model({ finance: { gearingPct: 75, ratePct: 11, tenorYears: 7, debtCurrency: "local", feePct: 2, sizing: { p50Dscr: 1.25, p90Dscr: 1.1, maxGearingPct: 70 } }, scenario: { localDepreciationPctYr: 3 } })]) {
    const sheets = readBook(buildWorkbook(m, "en", { generatedAt: "2026-10-01" }));
    const ev = evaluator(sheets);
    let formulas = 0;
    for (const [name, cells] of Object.entries(sheets)) {
      for (const [ref, c] of cells) {
        if (c.f == null) continue;
        formulas++;
        const got = ev.cell(name, ref);
        assert.ok(near(got, c.v), `${name}!${ref} =${c.f}: recomputed ${got}, cached ${c.v}`);
      }
    }
    assert.ok(formulas > 100, "the workbook is formula-driven, not pasted values");
  }
});

test("the Summary figures are the model's, read through the Cashflow sheet", () => {
  const m = model();
  const sheets = readBook(buildWorkbook(m, "en"));
  const ev = evaluator(sheets);
  const find = (label) => { for (const [ref, c] of sheets.Summary) if (c.v === label && ref.startsWith("A")) return ev.cell("Summary", "B" + ref.slice(1)); };
  assert.ok(near(find("Total investment"), m.agg.capexEur));
  assert.ok(near(find("NPV"), m.agg.npv));
  assert.ok(near(find("Blended project IRR"), m.agg.irr));
  assert.ok(near(find("Pooled DSCR, lowest year"), m.agg.dscrMin));
  assert.equal(find("Assets"), 3);
});

test("the debt sizing sheet is live: its capacity is the model's, and a new target recomputes it", () => {
  const m = model({ finance: { gearingPct: 70, ratePct: 8, tenorYears: 10, feePct: 1 } });
  const sheets = readBook(buildWorkbook(m, "en"));
  const ev = evaluator(sheets);
  assert.ok(near(ev.cell("DebtSizing", "B17"), m.sizing.capacityEur));
  assert.equal(ev.cell("DebtSizing", "B18"), m.sizing.recommendedGearingPct);
  assert.ok(near(ev.cell("DebtSizing", "B14"), m.sizing.p50.loanEur));
  assert.ok(near(ev.cell("DebtSizing", "B15"), m.sizing.p90.loanEur));
  const sumRow = [...sheets.Summary].find(([ref, c]) => ref.startsWith("A") && c.v === "Debt capacity")[0].slice(1);
  assert.equal(sheets.Summary.get("B" + sumRow).f, "DebtSizing!B17", "the Summary reads the capacity from the sizing sheet");
  // an analyst raises the P50 target: the capacity on that test falls by exactly the ratio
  sheets.DebtSizing.set("B2", { f: null, v: m.sizing.p50Dscr * 1.25 });
  const ev2 = evaluator(sheets);
  assert.ok(near(ev2.cell("DebtSizing", "B14"), m.sizing.p50.loanEur / 1.25));
  // sources and uses balance, and equity carries the fee
  // sources less uses: the interest during construction and the reserve rows sit above it
  assert.ok(Math.abs(ev.cell("SourcesUses", "B15")) < 1e-6);
  assert.ok(near(ev.cell("SourcesUses", "B12"), m.agg.equityEur + m.agg.feeEur + m.agg.dsraEur));
  assert.ok(near(ev.cell("Cashflow", "B6"), -(m.agg.equityEur + m.agg.feeEur)));
  // the structure and sensitivity sheets carry one row per structure and per driver
  assert.equal([...sheets.Structures.keys()].filter((r) => /^A\d+$/.test(r)).length, m.structures.length + 2);
  assert.equal([...sheets.Sensitivity.keys()].filter((r) => /^A\d+$/.test(r)).length, m.sensitivity.rows.length + 4);
});

test("a portfolio with no debt shows n/a for cover, not an error", () => {
  const sheets = readBook(buildWorkbook(model({ finance: { gearingPct: 0 } }), "en"));
  const ev = evaluator(sheets);
  assert.equal(ev.cell("Cashflow", "B11"), "n/a");
  assert.equal(ev.cell("Cashflow", "B12"), "n/a");
});

test("workbook sheets, labels follow the language, and the stress sheet lists every case", () => {
  const m = model();
  const uk = readBook(buildWorkbook(m, "uk"));
  assert.deepEqual(Object.keys(uk), ["Summary", "Assumptions", "Assets", "AssetCFADS", "AssetDebt", "AssetReserve", "AssetTax", "AssetTaxUnlevered", "Cashflow", "DebtSizing", "SourcesUses", "Structures", "Sensitivity", "Stress", "Risks", "Documents", "E&S", "Read me"]);
  assert.ok([...uk.Summary.values()].some((c) => c.v === "Загальні інвестиції"));
  assert.equal([...uk.Stress.keys()].filter((r) => /^A\d+$/.test(r)).length, m.suite.length + 2, "header, every case and the note (a blank row writes no cells)");
});

test("CSV neutralises formulas typed into notes, quotes commas and keeps non-ASCII", () => {
  const csv = toCsv([["=SUM(A1)", "+1", "-2", "@x", "ok, fine", 'say "hi"', "звіт"]]);
  assert.match(csv, /"'=SUM\(A1\)","'\+1","'-2","'@x","ok, fine","say ""hi""","звіт"/);
  assert.ok(csv.startsWith("﻿"));
  const esCsv = toCsv(esRows(model(), "en"));
  assert.ok(esCsv.includes(`"'=HYPERLINK(""x"")"`), "a note that starts with = is neutralised in the file");
  assert.ok(!esCsv.includes(`,"=HYPERLINK`), "and never appears as a bare formula");
});

test("case labels carry the shock size for the market; risk and register rows are complete", () => {
  assert.equal(caseLabel("tariff", "en", "MD"), "Price paid 20% lower");
  assert.equal(caseLabel("war", "en", "UA"), "War-risk insurance 1% a year");
  assert.equal(caseLabel("base", "uk", "MD"), "Базовий сценарій (P50)");
  const m = model();
  const rr = riskRows(m, "en");
  assert.equal(rr.length, 9);
  assert.ok(rr.every((r) => r[0] && r[1] && r[3]));
  const docs = documentRows(m, "en");
  assert.equal(docs.length, 4);
  assert.equal(docs[1][1], "Done");
  assert.equal(docs[1][2], "Draft");
  assert.equal(docs[2][1], "Missing");
});

test("the data room holds the report when given one, the model, the registers and a manifest that says what is missing", () => {
  const m = model();
  const room = buildDataRoom(m, { lang: "en", pdf: new TextEncoder().encode("%PDF-1.4 fake"), company: "SolarTech", generatedAt: "2026-10-01" });
  const files = Object.fromEntries(unzip(room.bytes).map((f) => [f.name, f.data]));
  const names = Object.keys(files);
  assert.ok(names.every((n) => n.startsWith("Test-portfolio/")), "everything sits in one folder");
  assert.deepEqual(room.files, ["00-MANIFEST.txt", "01-bankability-report.pdf", "02-financial-model.xlsx", "03-assets.csv", "04-document-register.csv", "05-es-screening.csv", "06-stress-tests.csv"]);
  assert.equal(room.filename, "Test-portfolio-data-room.zip");
  const manifest = dec(files["Test-portfolio/00-MANIFEST.txt"]);
  assert.match(manifest, /Prepared by: SolarTech/);
  assert.match(manifest, /Not included: land, grid, permit/);
  assert.match(manifest, /not a certified submission/);
  assert.ok(unzip(files["Test-portfolio/02-financial-model.xlsx"]).some((f) => f.name === "xl/workbook.xml"), "the model inside is itself a valid archive");
  // without a PDF the room still builds, and says nothing it does not hold
  const noPdf = buildDataRoom(m, { generatedAt: "2026-10-01" });
  assert.ok(!noPdf.files.includes("01-bankability-report.pdf"));
  const noPdfManifest = dec(Object.fromEntries(unzip(noPdf.bytes).map((f) => [f.name, f.data]))["Test-portfolio/00-MANIFEST.txt"]);
  assert.match(noPdfManifest, /report \(PDF\) could not be built this time and is NOT in this archive/);
  assert.doesNotMatch(manifest, /could not be built/);
});

test("sculpted repayment: every formula still recomputes, and the sizing sheet is the model's", () => {
  const plant = {
    id: "pl1", name: "Park", lat: 46, lon: 28.5,
    wind: { mw: 20, turbines: 4, hubM: 120, study: { p50Mwh: 60000, p90Mwh: 52000 } },
    solar: { mwp: 10, yieldKwhKwp: 1250 },
    revenue: { kind: "auction", priceEurMwh: 62.04, years: 15, afterEurMwh: 50 },
    costs: { windEurPerKw: 1200, solarEurPerKw: 500, gridEur: 1000000, devPct: 3, opexWindEurPerKwYr: 35, opexSolarEurPerKwYr: 10 },
  };
  const cases = [
    model({ finance: { gearingPct: 70, ratePct: 8, tenorYears: 10, repayment: "sculpted" } }),
    model({ finance: { gearingPct: 60, rateSteps: [0, 5, 7], tenorYears: 6, principalCompensationPct: 30, repayment: "sculpted", debtCurrency: "local" }, scenario: { localDepreciationPctYr: 3 } }),
    model({ project_ids: ["a"], assets: { __plants: [plant] }, finance: { gearingPct: 65, ratePct: 6.5, tenorYears: 15, repayment: "sculpted" } }),
  ];
  for (const m of cases) {
    assert.equal(m.sizing.repayment, "sculpted");
    const sheets = readBook(buildWorkbook(m, "en", { generatedAt: "2026-10-03" }));
    const ev = evaluator(sheets);
    for (const [name, cells] of Object.entries(sheets)) {
      for (const [ref, c] of cells) {
        if (c.f == null) continue;
        assert.ok(near(ev.cell(name, ref), c.v), `${name}!${ref} =${c.f}: recomputed ${ev.cell(name, ref)}, cached ${c.v}`);
      }
    }
    assert.ok(near(ev.cell("DebtSizing", "B14"), m.sizing.p50.loanEur));
    assert.ok(near(ev.cell("DebtSizing", "B15"), m.sizing.p90.loanEur));
    assert.ok(near(ev.cell("DebtSizing", "B17"), m.sizing.capacityEur));
  }
  // a higher P50 target lowers the sculpted capacity by exactly the ratio
  const m = cases[0];
  const sheets = readBook(buildWorkbook(m, "en"));
  sheets.DebtSizing.set("B2", { f: null, v: m.sizing.p50Dscr * 1.25 });
  assert.ok(near(evaluator(sheets).cell("DebtSizing", "B14"), m.sizing.p50.loanEur / 1.25));
});

test("construction, grace and the reserve: every formula recomputes, sources balance, the equity row carries the reserve", () => {
  const plant = {
    id: "pl1", name: "Park", lat: 46, lon: 28.5,
    wind: { mw: 20, turbines: 4, hubM: 120, study: { p50Mwh: 60000, p90Mwh: 52000 } },
    solar: { mwp: 10, yieldKwhKwp: 1250 },
    revenue: { kind: "auction", priceEurMwh: 62.04, years: 15, afterEurMwh: 50 },
    costs: { windEurPerKw: 1200, solarEurPerKw: 500, gridEur: 1000000, devPct: 3, opexWindEurPerKwYr: 35, opexSolarEurPerKwYr: 10 },
  };
  const build = { constructionMonths: 18, graceYears: 1, dsraMonths: 6 };
  const cases = [
    model({ finance: { gearingPct: 70, ratePct: 8, tenorYears: 10, ...build } }),
    model({ finance: { gearingPct: 60, ratePct: 7, tenorYears: 8, principalCompensationPct: 20, repayment: "sculpted", constructionMonths: 12, graceYears: 2, dsraMonths: 6 } }),
    model({ project_ids: ["a"], assets: { __plants: [plant] }, finance: { gearingPct: 65, ratePct: 6.5, tenorYears: 15, repayment: "sculpted", feePct: 1, ...build } }),
  ];
  for (const m of cases) {
    assert.ok(m.agg.idcEur > 0 && m.agg.dsraEur > 0);
    const sheets = readBook(buildWorkbook(m, "en", { generatedAt: "2026-10-04" }));
    const ev = evaluator(sheets);
    for (const [name, cells] of Object.entries(sheets)) {
      for (const [ref, c] of cells) {
        if (c.f == null) continue;
        assert.ok(near(ev.cell(name, ref), c.v), `${name}!${ref} =${c.f}: recomputed ${ev.cell(name, ref)}, cached ${c.v}`);
      }
    }
    assert.ok(Math.abs(ev.cell("SourcesUses", "B15")) < 1e-3, "sources equal uses");
    assert.ok(near(ev.cell("SourcesUses", "B4"), m.agg.idcEur));
    assert.ok(near(ev.cell("SourcesUses", "B6"), m.agg.dsraEur));
    assert.ok(near(ev.cell("Cashflow", "B6"), -(m.agg.equityEur + m.agg.feeEur + m.agg.dsraEur)));
    assert.ok(near(ev.cell("Cashflow", "B10"), m.agg.equityIrr));
    assert.ok(near(ev.cell("DebtSizing", "B16"), m.sizing.gearingCapEur));
    assert.ok(near(ev.cell("DebtSizing", "B17"), m.sizing.capacityEur));
    assert.ok(near(ev.cell("DebtSizing", "B18"), m.sizing.recommendedGearingPct));
  }
});
