// lib/dataRoom.js — the portfolio data room a lender receives: one ZIP with
//
//   00-MANIFEST.docx          what each file is, the report ID, the date, what
//                             is not included, and each file's SHA-256
//   01-bankability-report.pdf the report (when it could be rendered)
//   02-financial-model.xlsx   the live model (lib/portfolioExport.js buildWorkbook)
//   03-assets.xlsx            the registers, as formatted workbooks: a title
//   04-document-register.xlsx block (what it is, units, sources, date, report
//   05-es-screening.xlsx      ID), frozen headers, number formats and notes
//   06-stress-tests.xlsx
//   07-lender-questions.docx  the questions a credit officer asks, answered
//                             with the model's figures (lib/lenderQuestions.js)
//
// Server-side only (it builds Word files), so the portfolio page's own bundle
// never carries it. Pure; no I/O.
import { zip } from "./zip.js";
import { buildXlsx } from "./xlsx.js";
import { buildDocx } from "./docx.js";
import { sha256 } from "./sha256.js";
import { pt } from "./portfolioText.js";
import { reportId } from "./reportId.js";
import { buildWorkbook, assetRows, documentRows, esRows, caseLabel, caseNote, ASSET_COLUMNS } from "./portfolioExport.js";
import { lenderQuestionsDocx } from "./lenderQuestions.js";

/**
 * A register as a workbook sheet: a title block, then the table with its
 * header frozen. `styles` gives each column's number format (lib/xlsx.js).
 */
export function registerSheet({ name, title, what, units, sources, generatedAt, rid, head, rows, styles = [], widths }) {
  const top = [
    [{ v: title, s: "bold" }],
    [{ v: `What it is: ${what}`, s: "wrap" }],
    [{ v: `Units: ${units}`, s: "note" }],
    [{ v: `Sources: ${sources}`, s: "note" }],
    [{ v: `Generated ${generatedAt}. Report ID ${rid}.`, s: "note" }],
    [],
  ];
  const headRow = head.map((h) => ({ v: h, s: "head" }));
  const body = rows.map((r) => r.map((c, i) => (c == null || c === "" ? null : styles[i] && typeof c === "number" ? { v: c, s: styles[i] } : c)));
  return { name, rows: [...top, headRow, ...body], widths: widths || head.map((h, i) => (i === 0 ? 34 : Math.max(12, Math.min(40, String(h).length + 4)))), freeze: { row: top.length + 1 } };
}

const one = (sheet) => buildXlsx([sheet]);

/** The data room. `pdf` is optional (null if it could not be built). */
export function buildDataRoom(model, { lang = "en", pdf = null, xlsx = null, company = "", generatedAt = new Date().toISOString().slice(0, 10), date } = {}) {
  const name = (model.portfolio?.name || "portfolio").replace(/[^\w.-]+/g, "-").slice(0, 60);
  const rid = reportId(model, generatedAt);
  const market = model.portfolio?.market || "MD";
  const files = [];
  const add = (path, data, what) => files.push({ path, data, what });
  const reg = { generatedAt, rid };

  if (pdf) add("01-bankability-report.pdf", pdf, "Bankability report: summary, technical basis, financial model, sensitivity, risk matrix, screening, document register.");
  add("02-financial-model.xlsx", xlsx || buildWorkbook(model, lang, { generatedAt, date }),
    "The financial model with live formulas: each plant's Inputs, Model and Tax sheets, the Checks against the app, the pooled cash flow, debt sizing, sources and uses, stress and sensitivity.");

  const plantNo = new Map(model.assets.filter((a) => a.kind === "plant").map((a, k) => [a.id, k + 1]));
  add("03-assets.xlsx", one(registerSheet({
    name: "Assets", title: `${model.portfolio?.name || ""}: assets`, ...reg,
    what: "one row per asset, at P50 on the base scenario, with its lowest P90 cover.",
    units: "EUR; kWp; MWh in year 1; IRR as a share; DSCR as a ratio (x).",
    sources: "the VoltMira portfolio model; each plant's figures are rebuilt with formulas on its own sheets of 02-financial-model.xlsx.",
    head: [...ASSET_COLUMNS, "Notes"],
    rows: assetRows(model, false).map((r, i) => {
      const a = model.assets[i];
      return [...r, a.kind === "plant" ? `Plant: live model on the P${plantNo.get(a.id)} sheets of the financial model` : "Rooftop quote: values from the quote engine"];
    }),
    styles: [null, null, null, "num", "eur", "eur", "eur", "eur", "eur", "pct", "eur", "x", "eur", "x", "eur", "eur", "eur"],
    widths: [30, 9, 18, 10, 14, 14, 14, 14, 12, 12, 14, 14, 14, 14, 18, 16, 18, 52],
  })), "One row per asset: size, capex, funding, energy, returns and cover.");

  const docs = documentRows(model, lang);
  add("04-document-register.xlsx", one(registerSheet({
    name: "Documents", title: `${model.portfolio?.name || ""}: document register`, ...reg,
    what: "the status of each paper per asset: missing, draft or done. The files themselves are not included.",
    units: "status words only.", sources: "the installer's own checklist in VoltMira.",
    head: docs[0], rows: docs.slice(1), widths: [30, ...docs[0].slice(1).map(() => 20)],
  })), "Status of the papers per asset: missing, draft or done. The files themselves are not included.");

  const es = esRows(model, lang);
  add("05-es-screening.xlsx", one(registerSheet({
    name: "E&S", title: `${model.portfolio?.name || ""}: environmental and social screening`, ...reg,
    what: "the screening answers against the lenders' standards. A screening, not an impact assessment.",
    units: "yes, no, not applicable or open; a no is a concern to follow up.", sources: "the installer's answers in VoltMira; the standards each question comes from are named in the first column.",
    head: es[0], rows: es.slice(1), widths: [22, 90, 14, 40],
  })), "Environmental and social screening answers.");

  add("06-stress-tests.xlsx", one(registerSheet({
    name: "Stress", title: `${model.portfolio?.name || ""}: stress tests`, ...reg,
    what: "each case changes one thing from the base case; the last combines the worst of them. The sizes of the shocks are illustrative round numbers, not forecasts.",
    units: "DSCR as a ratio (x); IRR as a share; NPV in EUR.", sources: "separate runs of the whole portfolio model, one per case.",
    head: ["Case", "Yield level", "Lowest DSCR", "Lowest DSCR, repayment years", "LLCR", "Project IRR", "NPV EUR", "Equity IRR", "Notes"],
    rows: model.suite.map((s) => [caseLabel(s.id, lang, market), s.exceed, s.agg.dscrMin, s.agg.dscrMinRepay, s.agg.llcr, s.agg.irr, s.agg.npv, s.agg.equityIrr, caseNote(s, model.suite[0], lang) || ""]),
    styles: [null, null, "x", "x", "x", "pct", "eur", "pct", null],
    widths: [40, 12, 14, 18, 10, 12, 16, 12, 70],
  })), "The stress cases run on the whole portfolio.");

  add("07-lender-questions.docx", lenderQuestionsDocx({ model, company, generatedAt, todayKey: generatedAt, reportId: rid }),
    "The questions a credit officer asks, each answered with the model's figure and the cell it comes from, in Romanian and English.");

  // the index, last, so it can list every other file and its fingerprint
  const blocks = [
    { h1: `Data room: ${model.portfolio?.name || ""}` },
    { p: { text: `Prepared by ${company || "n/a"}. Generated ${generatedAt}. Report ID ${rid}. Tool: VoltMira.`, color: "5B6A62" } },
    { h2: "Contents" },
    { table: { widths: [0.34, 0.66], head: ["File", "What it is"], rows: files.map((f) => [[{ text: f.path, bold: true }], f.what]) } },
    ...(pdf ? [] : [{ p: { text: "The bankability report (PDF) could not be built this time and is NOT in this archive. Download it from the portfolio page and add it before sending.", bold: true, color: "B4472F" } }]),
    { h2: "Not included" },
    { p: "Land, grid, permit, design and offtake documents and any signed agreements. Keep them in your own folder and add them here; the document register shows which exist." },
    { h2: "Limits" },
    { p: pt("r_limits_p", "en") },
    { p: "What a given fund or lender requires differs. Ask it for its checklist and map these files to it; this package is a starting structure, not a certified submission." },
    { h2: "Fingerprints (SHA-256)" },
    { p: "Each file's SHA-256: anyone can recompute it to confirm a file is the one sent with this index." },
    { table: { widths: [0.34, 0.66], head: ["File", "SHA-256"], rows: files.map((f) => [f.path, [{ text: sha256(f.data), mono: true, size: 16 }]]) } },
  ];
  add("00-MANIFEST.docx", buildDocx(blocks, { title: `Data room: ${model.portfolio?.name || ""}`, subject: rid, creator: company || "VoltMira" }), "");

  const out = zip(files.sort((a, b) => a.path.localeCompare(b.path)).map((f) => ({ name: `${name}/${f.path}`, data: f.data })), { date });
  return { bytes: out, filename: `${name}-data-room.zip`, files: files.map((f) => f.path) };
}
