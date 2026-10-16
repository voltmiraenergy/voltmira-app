import { test } from "node:test";
import assert from "node:assert/strict";
import { defaultEngineSettings } from "@voltmira/engine";
import { buildModel } from "./portfolioModel.js";
import { buildDataRoom } from "./dataRoom.js";
import { unzip } from "./zip.js";
import { docxText } from "./docx.js";
import { sha256 } from "./sha256.js";

const E = { ...defaultEngineSettings(), horizon: 25, fx: { UAH: 50, MDL: 19.8 } };
const row = (id, o = {}) => ({
  id, title: "Site " + id, client_name: "C" + id, address: "", kw: 500, price: 0.18, cons: 600000, market: "MD",
  batt: false, batt_kwh: null, status: "sent", created_at: "2026-09-29T10:00:00Z", yield_per_kwp: 1250, ...o,
});
const plant = {
  id: "pl1", name: "Parcul Sud", lat: 46, lon: 28.5,
  wind: { mw: 20, turbines: 4, hubM: 120, study: { p50Mwh: 60000, p90Mwh: 52000, by: "Wind Consult", date: "2026-05-01" } },
  solar: { mwp: 10, yieldKwhKwp: 1250, acMw: 8 }, bess: { mw: 5, mwh: 10 },
  revenue: { kind: "auction", priceEurMwh: 62.04, years: 15, afterEurMwh: 50 },
  costs: { windEurPerKw: 1200, solarEurPerKw: 500, bessEurPerKwh: 250, gridEur: 1000000, devPct: 3, opexWindEurPerKwYr: 35, opexSolarEurPerKwYr: 10, opexBessEurPerKwhYr: 5, landEurYr: 30000, insurancePct: 0.35, invReplaceYear: 13, invReplaceEurPerKw: 40 },
};
const model = () => buildModel({
  portfolio: { name: "Test portfolio", market: "MD", project_ids: ["a"], finance: { gearingPct: 70, ratePct: 7, tenorYears: 15, discPct: 8, graceYears: 1, taxPct: 12 }, scenario: {},
    assets: { a: { docs: { land: "done" } }, __plants: [plant] }, es: { answers: {} } },
  projects: [row("a")], E,
});

test("the data room holds the report, the live model, formatted registers, the lender questions and a Word index with fingerprints", () => {
  const m = model();
  const room = buildDataRoom(m, { lang: "en", pdf: new TextEncoder().encode("%PDF-1.4 fake"), company: "SolarTech", generatedAt: "2026-10-16" });
  assert.deepEqual(room.files, ["00-MANIFEST.docx", "01-bankability-report.pdf", "02-financial-model.xlsx", "03-assets.xlsx", "04-document-register.xlsx",
    "05-es-screening.xlsx", "06-stress-tests.xlsx", "07-lender-questions.docx"]);
  const files = Object.fromEntries(unzip(room.bytes).map((f) => [f.name.split("/").pop(), f.data]));
  assert.ok(Object.keys(files).length === 8);
  // every register is a real workbook with its title block
  for (const n of ["03-assets.xlsx", "04-document-register.xlsx", "05-es-screening.xlsx", "06-stress-tests.xlsx"]) {
    const sheet = new TextDecoder().decode(unzip(files[n]).find((f) => f.name === "xl/worksheets/sheet1.xml").data);
    assert.match(sheet, /What it is:/, n);
    assert.match(sheet, /Report ID VM-/, n);
    assert.match(sheet, /state="frozen"/, n);
  }
  // the index lists each file with its SHA-256
  const index = docxText(files["00-MANIFEST.docx"]);
  assert.match(index, /Prepared by SolarTech/);
  for (const n of Object.keys(files)) if (n !== "00-MANIFEST.docx") assert.ok(index.includes(sha256(files[n])), `fingerprint of ${n}`);
  assert.doesNotMatch(index, /could not be built/);
  // the lender questions: both languages, real figures, real cells, no made-up gaps
  const q = docxText(files["07-lender-questions.docx"]);
  assert.match(q, /Întrebările unui creditor/);
  assert.match(q, /Questions a lender will ask/);
  assert.match(q, /Wind Consult/);
  assert.match(q, /P1 Inputs!B\d+/);
  assert.match(q, /P1 Model!C\d+/);
  assert.match(q, /Inverters are replaced in year 13/);
  assert.match(q, /No battery augmentation is modelled/);
  assert.match(q, /No\. The model runs 25 years/);
  assert.match(q, /Year 16: .*contracted price ends/);
  assert.match(q, /(\d+) of \1 agree within 1 EUR/);
  assert.doesNotMatch(q, /undefined|NaN|\{\w+\}/);
});

test("without a report the room still builds and says the report is missing", () => {
  const room = buildDataRoom(model(), { generatedAt: "2026-10-16" });
  assert.ok(!room.files.includes("01-bankability-report.pdf"));
  const files = Object.fromEntries(unzip(room.bytes).map((f) => [f.name.split("/").pop(), f.data]));
  assert.match(docxText(files["00-MANIFEST.docx"]), /could not be built this time and is NOT in this archive/);
});
