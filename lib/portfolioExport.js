// lib/portfolioExport.js — the documents a lender takes away: the Excel model,
// the registers as CSV, and the data-room manifest. Pure: given the computed
// model (lib/portfolioModel.js) it returns bytes; the route adds the PDF and
// sends the response.
//
// THE WORKBOOK IS AUDITABLE. Each asset's yearly cash flow and debt service sit
// on their own sheets; the Cashflow sheet adds them with SUM formulas; NPV, IRR
// and DSCR are Excel's own functions on those rows; the Summary reads from
// there. An analyst can change a number and watch the result move, or follow a
// cell back to its source. Stress cases are results, not formulas (each is a
// re-run of the whole model), and say so.
import { buildXlsx, colName } from "./xlsx.js";
import { zip } from "./zip.js";
import { pt } from "./portfolioText.js";
import { mwhUnit } from "./portfolioFormat.js";
import { STRESS_DEFAULTS } from "./projectFinance.js";
import { DOC_KEYS } from "./portfolio.js";
import { ES_ITEMS, GRID_EMISSION_FACTOR } from "./esScreening.js";

const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : null);

/** A stress case's label, with the size of its shock for this market. */
export function caseLabel(id, lang, market = "MD") {
  const d = STRESS_DEFAULTS[market] || STRESS_DEFAULTS.MD;
  const n = { tariff: d.tariffDropPct, escalation: d.escalationPct, curtailment: d.curtailmentPct, delay: d.delayMonths,
    currency: d.localDepreciationPctYr, capex: 15, war: d.warRiskPremiumPct }[id];
  return pt("st_" + id, lang, n != null ? { n } : null);
}

/** Text a spreadsheet would run as a formula is neutralised (CSV injection). */
const safe = (v) => {
  const s = v == null ? "" : String(v);
  return /^[=+\-@\t\r]/.test(s) ? "'" + s : s;
};
export function toCsv(rows) {
  return "﻿" + rows.map((r) => r.map((c) => `"${safe(c).replace(/"/g, '""')}"`).join(",")).join("\r\n") + "\r\n";
}

const pct = (v) => (v == null ? null : v);
const levelText = (l, lang) => pt("lv_" + l, lang);

/** Rows for the risk table: [name, level, rated on, rule]. */
export function riskRows(model, lang) {
  return model.risks.map((r) => {
    let rated = "";
    if (r.value != null) {
      rated = ["revenue"].includes(r.id) ? (r.ppa ? `PPA ${Math.round(r.value)}%` : r.value > 0 ? pt("rk_over", lang, { n: r.value }) : "")
        : ["concentration", "documents"].includes(r.id) ? `${Math.round(r.value)}%`
          : r.value.toFixed(2) + "x";
    }
    return [pt("rk_" + r.id, lang), levelText(r.level, lang), rated, pt("rk_" + r.id + "_r", lang)];
  });
}

/** One row per asset. `round` for CSV and display; the workbook keeps full precision so its formulas match the cached totals. */
export function assetRows(model, round = true) {
  const r = (v) => (round ? Math.round(v) : v);
  return model.assets.map((a) => [
    a.name, a.market, a.regionName || "", a.kw, r(a.result.capexEur), r(a.result.grantEur), r(a.result.loanEur),
    r(a.result.equityEur), round ? Math.round(a.result.year1Kwh / 1000) : a.result.year1Kwh / 1000, a.result.irr, r(a.result.npv), a.result.dscrMin,
  ]);
}

export function documentRows(model, lang) {
  const state = (s) => pt("ds_" + (["draft", "done"].includes(s) ? s : "missing"), lang);
  return [
    [pt("col_asset", lang), ...DOC_KEYS.map((k) => pt("dk_" + k, lang))],
    ...model.assets.map((a) => [a.name, ...DOC_KEYS.map((k) => state(a.docs[k]))]),
  ];
}

export function esRows(model, lang) {
  const answers = model.es?.answers || {};
  const markets = new Set(model.markets);
  const statusText = (s) => pt("es_" + (["yes", "no", "na"].includes(s) ? s : "open"), lang);
  return [
    ["Standard", "Question", "Answer", pt("es_note", lang)],
    ...ES_ITEMS.filter((i) => i.markets.some((m) => markets.has(m))).map((i) => [
      i.std, i.q[lang] || i.q.en, statusText(answers[i.id]?.status), answers[i.id]?.note || "",
    ]),
  ];
}

/** The Excel model. English by default: it is what lenders read. */
export function buildWorkbook(model, lang = "en", meta = {}) {
  const { agg, fin, scenario, assets } = model;
  const n = assets.length;
  const H = agg.cfads.length || 25;
  const last = colName(H + 1);                  // column of year H (year 0 is column B)
  const yearHead = (label) => [label, { v: "Year 0", s: "head" }, ...Array.from({ length: H }, (_, i) => ({ v: `Year ${i + 1}`, s: "head" }))];
  const widths = [34, ...Array.from({ length: H + 1 }, () => 13)];
  const aEnd = n + 1;                           // last asset row on the Assets sheet (row 1 is the header)

  // ---- Assumptions: remember where the discount rate lives
  const assumptions = [
    [{ v: pt("s_finance", lang), s: "head" }, { v: "", s: "head" }, { v: "", s: "head" }],
    [pt("f_gearing", lang), fin.gearingPct],
    [pt("f_rate", lang), fin.ratePct],
    [pt("f_steps", lang), fin.rateSteps ? fin.rateSteps.join(", ") : "none"],
    [pt("f_tenor", lang), fin.tenorYears],
    [pt("f_disc", lang), fin.discPct],
    [pt("f_currency", lang), fin.debtCurrency === "local" ? pt("f_cur_local", lang) : "EUR"],
    [pt("f_grant", lang), fin.grantPct],
    [pt("f_grant_cap", lang), fin.grantCapEur ?? "none"],
    [pt("f_comp", lang), fin.principalCompensationPct],
    [],
    [{ v: pt("s_scenario", lang), s: "head" }, { v: "", s: "head" }, { v: "", s: "head" }],
    [pt("sc_tariff", lang), Math.round(scenario.tariffMultiplier * 100)],
    [pt("sc_esc", lang), scenario.tariffEscalationPct ?? pt("sc_esc_engine", lang)],
    [pt("sc_curt", lang), scenario.curtailmentPct],
    [pt("sc_delay", lang), scenario.delayMonths],
    [pt("sc_dep", lang), scenario.localDepreciationPctYr],
    [pt("sc_war", lang), scenario.warRiskPremiumPct],
    [pt("sc_capex", lang), Math.round(scenario.capexMultiplier * 100)],
    [pt("ppa_h", lang), scenario.ppa ? `${scenario.ppa.sharePct}% at ${scenario.ppa.priceEurMwh} EUR/MWh, ${scenario.ppa.years} years, ${scenario.ppa.escalationPct}% a year, ${scenario.ppa.currency}` : pt("ppa_none", lang)],
    [],
    [{ v: pt("f_note", lang), s: "note" }],
    [{ v: "Placeholder and illustrative values are assumptions to be replaced with term sheets, quotes and measurements.", s: "note" }],
  ];
  const discRef = "Assumptions!B6";

  // ---- Assets
  const assetsSheet = [
    ["Asset", "Market", "Grid area", "kWp", "Capex EUR", "Grant EUR", "Debt EUR", "Equity EUR", "Year-1 MWh", "Project IRR", "NPV EUR", "Min DSCR (P50)"].map((v) => ({ v, s: "head" })),
    ...assetRows(model, false).map((r) => r.map((v, i) => (i >= 4 && i !== 9 && i !== 11 ? { v, s: "eur" } : i === 9 ? { v, s: "pct" } : i === 11 ? { v, s: "x" } : v))),
  ];

  // ---- per-asset yearly series
  const series = (key, label) => [
    yearHead(label),
    ...assets.map((a) => [a.name, null, ...a.result[key].slice(0, H).map((v) => ({ v, s: "eur" }))]),
  ];

  // ---- the pooled cash flow, built from the asset sheets
  const cf = [
    yearHead("EUR"),
    [pt("r_cfads", lang), null, ...Array.from({ length: H }, (_, i) => ({ f: `SUM(AssetCFADS!${colName(i + 2)}2:${colName(i + 2)}${aEnd})`, v: agg.cfads[i], s: "eur" }))],
    [pt("r_ds", lang), null, ...Array.from({ length: H }, (_, i) => ({ f: `SUM(AssetDebt!${colName(i + 2)}2:${colName(i + 2)}${aEnd})`, v: agg.debtService[i], s: "eur" }))],
    ["DSCR", null, ...Array.from({ length: H }, (_, i) => ({ f: `IF(${colName(i + 2)}3>0,${colName(i + 2)}2/${colName(i + 2)}3,"")`, v: agg.dscrByYear[i] ?? "", s: "x" }))],
    ["Project cash flow (after grant)", { f: `-(SUM(Assets!E2:E${aEnd})-SUM(Assets!F2:F${aEnd}))`, v: agg.projectCf[0], s: "eur" }, ...Array.from({ length: H }, (_, i) => ({ f: `${colName(i + 2)}2`, v: agg.cfads[i], s: "eur" }))],
    ["Equity cash flow", { f: `-SUM(Assets!H2:H${aEnd})`, v: -agg.equityEur, s: "eur" }, ...Array.from({ length: H }, (_, i) => ({ f: `${colName(i + 2)}2-${colName(i + 2)}3`, v: agg.cfads[i] - agg.debtService[i], s: "eur" }))],
    [],
    ["NPV at the discount rate", { f: `NPV(${discRef}/100,C5:${last}5)+B5`, v: agg.npv, s: "eur" }],
    ["Project IRR", { f: `IFERROR(IRR(B5:${last}5),"n/a")`, v: agg.irr ?? "n/a", s: "pct" }],
    ["Equity IRR", { f: `IFERROR(IRR(B6:${last}6),"n/a")`, v: agg.equityIrr ?? "n/a", s: "pct" }],
    ["Lowest DSCR", { f: `IF(COUNT(C4:${last}4)=0,"n/a",MIN(C4:${last}4))`, v: agg.dscrMin ?? "n/a", s: "x" }],
    ["Average DSCR", { f: `IF(COUNT(C4:${last}4)=0,"n/a",AVERAGE(C4:${last}4))`, v: agg.dscrAvg ?? "n/a", s: "x" }],
  ];

  // ---- Summary reads from the sheets above
  const summary = [
    [{ v: `VoltMira portfolio model: ${model.portfolio?.name || ""}`, s: "bold" }],
    [{ v: `${pt("all_eur", lang)} ${meta.generatedAt ? "Generated " + meta.generatedAt + "." : ""}`, s: "note" }],
    [],
    [pt("k_assets", lang), { f: `COUNTA(Assets!A2:A${aEnd})`, v: n }],
    [pt("k_capacity", lang) + " (kWp)", { f: `SUM(Assets!D2:D${aEnd})`, v: agg.kwp, s: "eur" }],
    [pt("k_capex", lang), { f: `SUM(Assets!E2:E${aEnd})`, v: agg.capexEur, s: "eur" }],
    [pt("k_grant", lang), { f: `SUM(Assets!F2:F${aEnd})`, v: agg.grantEur, s: "eur" }],
    [pt("k_debt", lang), { f: `SUM(Assets!G2:G${aEnd})`, v: agg.loanEur, s: "eur" }],
    [pt("k_equity", lang), { f: `SUM(Assets!H2:H${aEnd})`, v: agg.equityEur, s: "eur" }],
    [pt("k_energy", lang) + ` (${mwhUnit(lang)})`, { f: `SUM(Assets!I2:I${aEnd})`, v: agg.year1Mwh, s: "eur" }],
    [pt("k_npv", lang), { f: "Cashflow!B8", v: agg.npv, s: "eur" }],
    [pt("k_irr", lang), { f: "Cashflow!B9", v: agg.irr ?? "n/a", s: "pct" }],
    [pt("k_eirr", lang), { f: "Cashflow!B10", v: agg.equityIrr ?? "n/a", s: "pct" }],
    [pt("k_dscr", lang), { f: "Cashflow!B11", v: agg.dscrMin ?? "n/a", s: "x" }],
    [pt("k_dscr_avg", lang), { f: "Cashflow!B12", v: agg.dscrAvg ?? "n/a", s: "x" }],
    [],
    [{ v: "Change a figure on the Assumptions or asset sheets and the Cashflow and this sheet recalculate. Stress cases are separate runs of the whole model.", s: "note" }],
  ];

  // ---- stress results
  const base = model.suite[0]?.agg;
  const market = model.portfolio?.market || "MD";
  const stress = [
    ["Case", "Yield level", "Min DSCR", "Project IRR", "NPV EUR", "NPV change", "Equity IRR"].map((v) => ({ v, s: "head" })),
    ...model.suite.map((s, i) => [
      caseLabel(s.id, lang, market), s.exceed, { v: s.agg.dscrMin, s: "x" }, { v: s.agg.irr, s: "pct" }, { v: s.agg.npv, s: "eur" },
      { f: `E${i + 2}-E$2`, v: s.agg.npv - (base?.npv || 0), s: "eur" }, { v: s.agg.equityIrr, s: "pct" },
    ]),
    [],
    [{ v: pt("st_h", lang), s: "note" }],
  ];

  const risk = [["Risk", "Level", "Rated on", "Rule"].map((v) => ({ v, s: "head" })), ...riskRows(model, lang).map((r) => [r[0], r[1], r[2], { v: r[3], s: "wrap" }])];
  const docs = documentRows(model, lang).map((r, i) => (i === 0 ? r.map((v) => ({ v, s: "head" })) : r));
  const es = esRows(model, lang).map((r, i) => (i === 0 ? r.map((v) => ({ v, s: "head" })) : [r[0], { v: r[1], s: "wrap" }, r[2], { v: r[3], s: "wrap" }]));
  const imp = model.es?.impact || {};
  const esFull = [
    ...es,
    [],
    [{ v: pt("es_impact", lang), s: "bold" }],
    [pt("k_co2", lang) + " (t)", Math.round(model.co2.tPerYear)],
    ["CO2 avoided over the life (t)", Math.round(model.co2.tLifetime)],
    [pt("es_factor", lang), model.markets.map((m) => `${m} ${GRID_EMISSION_FACTOR[m]?.tPerMwh} t/MWh`).join(", ")],
    [pt("es_jobs_c", lang), num(imp.jobsConstruction) ?? "not entered"],
    [pt("es_jobs_p", lang), num(imp.jobsPermanent) ?? "not entered"],
    [pt("es_women", lang), num(imp.womenPct) ?? "not entered"],
  ];

  const readme = [
    [{ v: pt("r_limits", lang), s: "bold" }],
    [{ v: pt("r_limits_p", lang), s: "wrap" }],
    [],
    [{ v: "Method", s: "bold" }],
    [{ v: "Energy value comes from the VoltMira quote engine; yield uncertainty 7.1% gives P50 and P90. Overlays add: tariff and escalation, curtailment of exported energy, construction delay, net local-currency loss, war-risk insurance and fixed-price sales. Debt is amortised year by year with an optional stepped rate, a grant on capex and a one-off state repayment of principal.", s: "wrap" }],
    [],
    [{ v: "Sources", s: "bold" }],
    ...model.markets.map((m) => [{ v: `${m} grid emission factor ${GRID_EMISSION_FACTOR[m]?.tPerMwh} t/MWh: ${GRID_EMISSION_FACTOR[m]?.source}`, s: "wrap" }]),
  ];

  return buildXlsx([
    { name: "Summary", rows: summary, widths: [44, 18] },
    { name: "Assumptions", rows: assumptions, widths: [52, 20, 20] },
    { name: "Assets", rows: assetsSheet, widths: [30, 9, 24, 10, 14, 14, 14, 14, 12, 12, 14, 14], freeze: { row: 1 } },
    { name: "AssetCFADS", rows: series("cfads", "CFADS EUR"), widths, freeze: { row: 1, col: 1 } },
    { name: "AssetDebt", rows: series("debtService", "Debt service EUR"), widths, freeze: { row: 1, col: 1 } },
    { name: "Cashflow", rows: cf, widths, freeze: { row: 1, col: 1 } },
    { name: "Stress", rows: stress, widths: [44, 12, 12, 12, 14, 14, 12] },
    { name: "Risks", rows: risk, widths: [26, 12, 12, 100] },
    { name: "Documents", rows: docs, widths: [30, 22, 22, 22, 22, 22, 22] },
    { name: "E&S", rows: esFull, widths: [22, 90, 14, 40] },
    { name: "Read me", rows: readme, widths: [120] },
  ], { date: meta.date });
}

/** The data room: report, model, registers and a manifest. `pdf` is optional (null if it could not be built). */
export function buildDataRoom(model, { lang = "en", pdf = null, xlsx = null, company = "", generatedAt = new Date().toISOString().slice(0, 10), date } = {}) {
  const name = (model.portfolio?.name || "portfolio").replace(/[^\w.-]+/g, "-").slice(0, 60);
  const files = [];
  const add = (path, data, what) => files.push({ path, data, what });
  if (pdf) add("01-bankability-report.pdf", pdf, "Bankability report: summary, technical basis, financial model, sensitivity, risk matrix, screening, document register.");
  add("02-financial-model.xlsx", xlsx || buildWorkbook(model, lang, { generatedAt, date }), "Excel model with live formulas: assumptions, assets, cash flow, stress results.");
  add("03-assets.csv", toCsv([["Asset", "Market", "Grid area", "kWp", "Capex EUR", "Grant EUR", "Debt EUR", "Equity EUR", "Year-1 MWh", "Project IRR", "NPV EUR", "Min DSCR"], ...assetRows(model)]), "One row per asset.");
  add("04-document-register.csv", toCsv(documentRows(model, lang)), "Status of the papers per asset: missing, draft or done. The files themselves are not included.");
  add("05-es-screening.csv", toCsv(esRows(model, lang)), "Environmental and social screening answers.");
  add("06-stress-tests.csv", toCsv([["Case", "Yield level", "Min DSCR", "Project IRR", "NPV EUR", "Equity IRR"],
    ...model.suite.map((s) => [caseLabel(s.id, lang, model.portfolio?.market || "MD"), s.exceed, s.agg.dscrMin?.toFixed(2) ?? "", s.agg.irr == null ? "" : (s.agg.irr * 100).toFixed(1) + "%", Math.round(s.agg.npv), s.agg.equityIrr == null ? "" : (s.agg.equityIrr * 100).toFixed(1) + "%"])]), "The stress cases run on the whole portfolio.");
  const manifest = [
    `Data room: ${model.portfolio?.name || ""}`,
    `Prepared by: ${company || "n/a"}   Generated: ${generatedAt}   Tool: VoltMira`,
    "",
    "Contents",
    ...files.map((f) => `  ${f.path}\n      ${f.what}`),
    ...(pdf ? [] : ["", "NOTE: the bankability report (PDF) could not be built this time and is NOT in this archive. Download it from the portfolio page and add it before sending."]),
    "",
    "Not included: land, grid, permit, design and offtake documents and any signed agreements. Keep them in your own folder and add them here; the register shows which exist.",
    "",
    pt("r_limits_p", "en"),
    "",
    "What a given fund or lender requires differs. Ask it for its checklist and map these files to it; this package is a starting structure, not a certified submission.",
  ].join("\r\n");
  add("00-MANIFEST.txt", manifest, "");
  const out = zip(files.sort((a, b) => a.path.localeCompare(b.path)).map((f) => ({ name: `${name}/${f.path}`, data: f.data })), { date });
  return { bytes: out, filename: `${name}-data-room.zip`, files: files.map((f) => f.path) };
}
