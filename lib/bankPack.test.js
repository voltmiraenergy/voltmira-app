import { test } from "node:test";
import assert from "node:assert/strict";
import { plantOnly, findPlant, llcr, contractYears, stillMissing, missingLine, gapText, permitCsv, packManifest, packManifestDocx, buildBankPack, PACK_LANGS } from "./bankPack.js";
import { buildModel, PLANTS_KEY } from "./portfolioModel.js";
import { evaluatePlant } from "./plantFinance.js";
import { PERMITS } from "./plantPermits.js";
import { unzip } from "./zip.js";
import { docxText } from "./docx.js";
import { defaultEngineSettings } from "../engine/engine.js";

const E = { ...defaultEngineSettings(), horizon: 25 };
const PLANT = {
  id: "p1", name: "Test park", locality: "Cahul", lat: 46, lon: 28.5,
  wind: { mw: 20, turbines: 4, hubM: 120, lossesPct: 15, study: { p50Mwh: 60000, p90Mwh: 52000 } },
  solar: { mwp: 10, yieldKwhKwp: 1250 },
  revenue: { kind: "auction", priceEurMwh: 62.04, years: 15, afterEurMwh: 50 },
  costs: { windEurPerKw: 1200, solarEurPerKw: 500, gridEur: 1000000, devPct: 3, opexWindEurPerKwYr: 35, opexSolarEurPerKwYr: 10, landEurYr: 30000, insurancePct: 0.35 },
};
const FIN = { gearingPct: 65, ratePct: 6.5, tenorYears: 15 };
const PORTFOLIO = { id: "pf", name: "Mixed", market: "MD", project_ids: ["q1"], finance: FIN, scenario: {}, assets: { q1: { docs: {} }, [PLANTS_KEY]: [PLANT, { ...PLANT, id: "p2", name: "Other" }] } };
const allDone = Object.fromEntries(PERMITS.map((p) => [p.id, { status: "done" }]));

test("a plant is modelled as its own facility: the portfolio's terms, this plant alone", () => {
  assert.equal(findPlant(PORTFOLIO, "p2").name, "Other");
  assert.equal(plantOnly(PORTFOLIO, "nope"), null);
  assert.equal(plantOnly(PORTFOLIO, ""), null);
  const one = plantOnly(PORTFOLIO, "p1");
  assert.deepEqual(one.project_ids, []);
  assert.deepEqual(one.assets[PLANTS_KEY].map((p) => p.id), ["p1"]);
  assert.equal(one.finance, PORTFOLIO.finance);
  const model = buildModel({ portfolio: one, projects: [{ id: "q1", market: "MD", kw: 10 }], E, include: { sensitivity: false, structures: false } });
  assert.equal(model.assets.length, 1);
  // the portfolio sets no tax, so the market's own applies (Moldova 12%)
  const own = evaluatePlant(PLANT, E, { ...FIN, taxPct: 12 }, {});
  model.agg.cfads.forEach((v, i) => assert.ok(Math.abs(v - own.cfads[i]) < 1e-6, `year ${i + 1}`));
  assert.ok(Math.abs(model.agg.loanEur - own.loanEur) < 1e-6);
});

test("LLCR: the loan's CFADS discounted at its rate, over the loan", () => {
  // CFADS 130 a year against a loan whose level service is 100: LLCR 1.30
  const r = 0.065, n = 15;
  const loan = (100 * (1 - Math.pow(1 + r, -n))) / r;
  assert.ok(Math.abs(llcr(Array(25).fill(130), loan, { ratePct: 6.5, tenorYears: 15 }) - 1.3) < 1e-9);
  // only the loan's years count
  assert.ok(Math.abs(llcr([...Array(15).fill(130), ...Array(10).fill(1e9)], loan, { ratePct: 6.5, tenorYears: 15 }) - 1.3) < 1e-9);
  // each year at its own rate
  const stepped = llcr([110, 110], 200, { ratePct: 5, tenorYears: 2, rateSteps: [10, 0] });
  assert.ok(Math.abs(stepped - (110 / 1.1 + 110 / 1.1) / 200) < 1e-9);
  assert.equal(llcr([1, 2], 0, FIN), null);
});

test("the contract covers the loan's years, or none when sold on the market", () => {
  assert.deepEqual(contractYears(PLANT, { tenorYears: 12 }), { years: 12, tenor: 12 });
  assert.deepEqual(contractYears({ ...PLANT, revenue: { ...PLANT.revenue, years: 10 } }, { tenorYears: 15 }), { years: 10, tenor: 15 });
  assert.deepEqual(contractYears({ ...PLANT, revenue: { kind: "merchant", priceEurMwh: 70 } }, { tenorYears: 15 }), { years: 0, tenor: 15 });
});

test("still missing: every open checklist item, the unnamed borrower, a study without its figures", () => {
  const blank = stillMissing(PLANT, "2026-10-03");
  assert.equal(blank.items.length, PERMITS.length);
  assert.deepEqual(blank.gaps.map((g) => g.id), ["borrower"]);
  assert.equal(blank.count, PERMITS.length + 1);
  const studied = { ...PLANT, borrower: "Parc SRL", solar: { ...PLANT.solar, study: { p50Mwh: 12000, p90Mwh: 11000 } } };
  const ready = stillMissing({ ...studied, permits: allDone }, "2026-10-03");
  assert.equal(ready.count, 0);
  // not needed counts as closed
  const na = stillMissing({ ...studied, permits: { ...allDone, om: { status: "na" } } }, "2026-10-03");
  assert.equal(na.count, 0);
  // the study marked done while the solar figures still come from PVGIS
  const pvgis = stillMissing({ ...PLANT, borrower: "Parc SRL", permits: allDone }, "2026-10-03");
  assert.deepEqual(pvgis.gaps, [{ id: "study", sources: ["solar"] }]);
});

test("a study marked done without its P50 and P90 is a gap", () => {
  const screened = { ...PLANT, borrower: "Parc SRL", wind: { ...PLANT.wind, study: null }, permits: allDone };
  const m = stillMissing(screened, "2026-10-03");
  assert.deepEqual(m.gaps, [{ id: "study", sources: ["wind", "solar"] }]);
  assert.match(gapText(m.gaps[0], "en"), /wind, solar/);
  assert.match(gapText(m.gaps[0], "ro"), /vânt, solar/);
  // the solar study entered: only wind is left
  const withSolar = { ...screened, solar: { ...PLANT.solar, study: { p50Mwh: 12000, p90Mwh: 11000 } } };
  assert.deepEqual(stillMissing(withSolar, "2026-10-03").gaps, [{ id: "study", sources: ["wind"] }]);
});

test("a missing item reads with its status, who, when, and what it waits for", () => {
  const plant = { ...PLANT, permits: { land: { status: "in_progress", by: "Ion Rusu", due: "2026-09-01" } } };
  const m = stillMissing(plant, "2026-10-03");
  const land = m.items.find((r) => r.id === "land");
  assert.equal(missingLine(land, "en"), "Land rights (ownership or lease): In progress, responsible: Ion Rusu, due 2026-09-01, overdue");
  const building = m.items.find((r) => r.id === "building");
  assert.match(missingLine(building, "ro"), /așteaptă: /);
  const yieldRow = m.items.find((r) => r.id === "yield");
  assert.match(missingLine(yieldRow, "en"), /can start now$/);
});

test("the checklist CSV has both languages and one row per item", () => {
  const csv = permitCsv({ ...PLANT, permits: { grid: { status: "done", ref: "ATR-1/2026" } } }, "2026-10-03");
  const lines = csv.replace(/^﻿/, "").trim().split("\r\n");
  assert.equal(lines.length, PERMITS.length + 1);
  assert.match(lines[0], /Element.*Item.*Stadiu \/ Status/);
  assert.ok(lines.some((l) => l.includes("ATR-1/2026") && l.includes("Gata / Done")));
});

test("the pack: manifest in Romanian and English, both summaries, the model and the checklist", () => {
  const one = plantOnly(PORTFOLIO, "p1");
  const model = buildModel({ portfolio: one, projects: [], E });
  const fake = new TextEncoder().encode("%PDF-1.7 test");
  const pack = buildBankPack({ model, plant: one.assets[PLANTS_KEY][0], pdfs: { ro: fake, en: fake }, company: "Volt SRL", generatedAt: "2026-10-03" });
  assert.deepEqual(pack.files, ["00-MANIFEST.docx", "01-credit-summary-ro.pdf", "02-credit-summary-en.pdf", "03-financial-model.xlsx", "04-permit-checklist.csv"]);
  assert.equal(pack.filename, "Test-park-bank-pack.zip");
  assert.deepEqual(pack.failed, []);
  const files = unzip(pack.bytes);
  assert.deepEqual(files.map((f) => f.name).sort(), pack.files.map((p) => "Test-park/" + p).sort());
  const manifest = docxText(files.find((f) => f.name.endsWith("MANIFEST.docx")).data);
  assert.match(manifest, /Pachet pentru bancă: Test park/);
  assert.match(manifest, /Bank submission pack: Test park/);
  assert.match(manifest, /Pregătit de Volt SRL la 2026-10-03/);
  assert.match(manifest, /Name the borrower/);
  assert.ok(manifest.indexOf("Pachet") < manifest.indexOf("Bank submission"), "Romanian first");
  assert.ok(!/[—–·]/.test(manifest), "no dashes or middle dots");
  assert.ok(!/NU este în această arhivă/.test(manifest));
  // the summary carries the figures a credit officer reads first, from the plant's own model
  assert.match(manifest, /Cifre-cheie/);
  assert.match(manifest, /Key figures/);
  assert.match(manifest, /Proposed terms/);
  assert.match(manifest, /Waits for/);
  assert.ok(manifest.includes(model.agg.loanEur > 0 ? Math.round(model.agg.loanEur).toLocaleString("en-GB") : ""), "the loan amount");
});

test("the Word summary leaves the figures out, never invents them, when there is no model", () => {
  const bytes = packManifestDocx({ plant: PLANT, files: [], generatedAt: "2026-10-03" });
  const text = docxText(bytes);
  assert.ok(!/Key figures/.test(text));
  assert.match(text, /Still missing before the credit decision/);
});

test("a summary that could not be rendered is named in the manifest, never left out quietly", () => {
  const one = plantOnly(PORTFOLIO, "p1");
  const model = buildModel({ portfolio: one, projects: [], E, include: { sensitivity: false, structures: false } });
  const pack = buildBankPack({ model, plant: one.assets[PLANTS_KEY][0], pdfs: { ro: new Uint8Array([1]) }, generatedAt: "2026-10-03" });
  assert.deepEqual(pack.failed, ["en"]);
  assert.ok(!pack.files.includes("02-credit-summary-en.pdf"));
  const manifest = packManifest({ plant: PLANT, files: [], failed: ["en"], generatedAt: "2026-10-03" });
  assert.match(manifest, /rezumatul de credit în engleză nu a putut fi generat/);
  assert.match(manifest, /the credit summary in English could not be built/);
  assert.deepEqual(PACK_LANGS, ["ro", "en"]);
});

test("the sample notice travels with a sample plant", () => {
  const m = packManifest({ plant: { ...PLANT, sample: true }, files: [], generatedAt: "2026-10-03" });
  assert.match(m, /Valori exemplu/);
  assert.match(m, /Sample values for illustration/);
});

test("the documents on file travel in the pack, one folder per item, and the manifest and checklist name them", () => {
  const one = plantOnly(PORTFOLIO, "p1");
  const model = buildModel({ portfolio: one, projects: [], E, include: { sensitivity: false, structures: false } });
  const bytes = (s) => new TextEncoder().encode(s);
  const documents = [
    { item_id: "grid", name: "Aviz tehnic de racordare.pdf", data: bytes("%PDF grid") },
    { item_id: "land", name: "Contract de arendă.pdf", data: bytes("%PDF land") },
    { item_id: "grid", name: "Aviz tehnic de racordare.pdf", data: bytes("%PDF grid 2") },
    { item_id: "other", name: "Foto amplasament.jpg", data: bytes("jpg") },
  ];
  const pack = buildBankPack({ model, plant: one.assets[PLANTS_KEY][0], pdfs: { ro: bytes("%PDF"), en: bytes("%PDF") }, generatedAt: "2026-10-04", documents });
  const docFiles = pack.files.filter((p) => p.startsWith("05-documents/"));
  // checklist order: land (1) before grid (4), "other" last
  assert.deepEqual(docFiles, [
    "05-documents/01-land-rights-ownership-or-lease/Contract-de-arenda.pdf",
    "05-documents/04-grid-connection/Aviz-tehnic-de-racordare.pdf",
    "05-documents/04-grid-connection/Aviz-tehnic-de-racordare (2).pdf",
    "05-documents/13-other-documents/Foto-amplasament.jpg",
  ]);
  const files = unzip(pack.bytes);
  assert.equal(new TextDecoder().decode(files.find((f) => f.name.endsWith("racordare (2).pdf")).data), "%PDF grid 2");
  const manifest = docxText(files.find((f) => f.name.endsWith("MANIFEST.docx")).data);
  assert.match(manifest, /Documentele depuse sunt în 05-documents/);
  assert.match(manifest, /The documents on file are in 05-documents/);
  assert.match(manifest, /Items with no document on file: Urban planning certificate/);
  assert.ok(!/Not included: the permits/.test(manifest));
  const csv = new TextDecoder().decode(files.find((f) => f.name.endsWith(".csv")).data);
  assert.match(csv, /Documente \/ Documents/);
  assert.match(csv, /Aviz tehnic de racordare\.pdf; Aviz tehnic de racordare\.pdf/);
  assert.match(csv, /Foto amplasament\.jpg/);
});

test("a document that could not be read is named in the manifest", () => {
  const m = packManifest({ plant: PLANT, files: [], docs: [], docFailed: ["Aviz.pdf"], generatedAt: "2026-10-04" });
  assert.match(m, /ATENȚIE: Aviz\.pdf nu a putut fi citit/);
  assert.match(m, /NOTE: Aviz\.pdf could not be read/);
});

import { reportId } from "./reportId.js";
import { sha256 } from "./sha256.js";

test("the report ID names the day and the figures: the same figures keep it, a changed one changes it", () => {
  const one = plantOnly(PORTFOLIO, "p1");
  const model = buildModel({ portfolio: one, projects: [], E, include: { sensitivity: false, structures: false } });
  const id = reportId(model, "2026-10-08");
  assert.match(id, /^VM-20261008-[0-9A-F]{6}$/);
  assert.equal(reportId(model, "2026-10-08"), id);
  // the same plant, with the heavier runs on: the same figures, the same ID
  assert.equal(reportId(buildModel({ portfolio: one, projects: [], E }), "2026-10-08"), id);
  assert.notEqual(reportId(model, "2026-10-09").slice(-6), "", "the day is part of it");
  assert.equal(reportId(model, "2026-10-09").slice(0, 11), "VM-20261009");
  const moved = buildModel({ portfolio: { ...one, finance: { ...one.finance, ratePct: 9 } }, projects: [], E, include: { sensitivity: false, structures: false } });
  assert.notEqual(reportId(moved, "2026-10-08"), id);
});

test("the manifest carries the report ID and a SHA-256 for every file, and each one matches the file in the archive", () => {
  const one = plantOnly(PORTFOLIO, "p1");
  const model = buildModel({ portfolio: one, projects: [], E });
  const bytes = (s) => new TextEncoder().encode(s);
  const pack = buildBankPack({ model, plant: one.assets[PLANTS_KEY][0], pdfs: { ro: bytes("%PDF ro"), en: bytes("%PDF en") }, generatedAt: "2026-10-08",
    documents: [{ item_id: "grid", name: "Aviz.pdf", data: bytes("%PDF aviz") }] });
  const files = unzip(pack.bytes);
  const manifest = docxText(files.find((f) => f.name.endsWith("MANIFEST.docx")).data);
  const id = reportId(model, "2026-10-08");
  assert.match(manifest, new RegExp(`ID raport ${id}`));
  assert.match(manifest, new RegExp(`Report ID ${id}`));
  assert.match(manifest, /Amprentele fișierelor \(SHA-256\)/);
  // the fingerprint table: one line for the file's path, the next line its hash
  const lines = manifest.split("\n");
  let checked = 0;
  for (const f of files) {
    if (f.name.endsWith("MANIFEST.docx")) continue;
    const path = f.name.slice(f.name.indexOf("/") + 1);
    const at = lines.indexOf(sha256(f.data));
    assert.ok(at >= 0, `${path} has a fingerprint line`);
    assert.equal(lines[at - 1], path, `${path} precedes its fingerprint`);
    checked++;
  }
  assert.equal(checked, pack.files.length - 1);
  assert.ok(!/[—–·]/.test(manifest));
});

test("the points to confirm are stated in the manifest, in both languages, never left out", () => {
  const one = plantOnly(PORTFOLIO, "p1");
  const model = buildModel({ portfolio: one, projects: [], E, include: { sensitivity: false, structures: false } });
  const plant = { ...one.assets[PLANTS_KEY][0], solar: { mwp: 5, yieldKwhKwp: 1300, yieldSource: "pvgis" } };
  const pack = buildBankPack({ model, plant, pdfs: {}, generatedAt: "2026-10-08" });
  const manifest = docxText(unzip(pack.bytes).find((f) => f.name.endsWith("MANIFEST.docx")).data);
  assert.match(manifest, /Verificări înainte de trimitere/);
  assert.match(manifest, /Checks before sending/);
  assert.match(manifest, /Degradarea din primul an nu este setată/);
  assert.match(manifest, /First-year degradation is not set/);
  assert.ok(!/[—–·]/.test(manifest));
});
