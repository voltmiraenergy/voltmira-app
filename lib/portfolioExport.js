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
import { sculptWeights, unitDebtService } from "./debtSizing.js";
import { ES_ITEMS, GRID_EMISSION_FACTOR } from "./esScreening.js";
import { FINANCING_PRESETS } from "./financingPresets.js";
import { structureName, termsLine, driverLabel } from "./portfolioDisplay.js";

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

/** The asset table's columns, the same in the workbook (A to O) and the CSV. */
export const ASSET_COLUMNS = ["Asset", "Market", "Grid area", "kWp", "Capex EUR", "Grant EUR", "Debt EUR", "Equity EUR", "Year-1 MWh",
  "Project IRR", "NPV EUR", "Min DSCR (P50)", "Arrangement fee EUR", "Min DSCR (P90)", "Stand-alone debt capacity EUR",
  "Interest during construction EUR", "Reserve account at commissioning EUR"];

/** One row per asset. `round` for CSV and display; the workbook keeps full precision so its formulas match the cached totals. */
export function assetRows(model, round = true) {
  const r = (v) => (v == null ? null : round ? Math.round(v) : v);
  return model.assets.map((a) => [
    a.name, a.market, a.regionName || "", a.kw, r(a.result.capexEur), r(a.result.grantEur), r(a.result.loanEur),
    r(a.result.equityEur), round ? Math.round(a.result.year1Kwh / 1000) : a.result.year1Kwh / 1000, a.result.irr, r(a.result.npv), a.result.dscrMin,
    r(a.result.feeEur || 0), a.dscrMinP90 ?? null, r(a.capacityEur),
    r(a.result.idcEur || 0), r(a.result.dsraEur || 0),
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

/** The financing programmes the terms came from, with their links, for a "Sources" list. */
export function presetSources(finance, lang = "en") {
  const f = finance && typeof finance === "object" ? finance : {};
  const ids = [f.preset, ...(Array.isArray(f.compare) ? f.compare.map((c) => c && c.preset) : [])].filter(Boolean);
  return [...new Set(ids)].map((id) => FINANCING_PRESETS.find((p) => p.id === id)).filter((p) => p && p.source)
    .map((p) => `${p.name[lang] || p.name.en}: ${p.source.label}, ${p.source.url}${p.alsoSee ? `; ${p.alsoSee.label}, ${p.alsoSee.url}` : ""}`);
}

/** The Excel model. English by default: it is what lenders read. */
export function buildWorkbook(model, lang = "en", meta = {}) {
  const { agg, fin, scenario, assets } = model;
  const sz = model.sizing;
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
    [pt("f_fee", lang), fin.feePct],
    [pt("f_repay", lang), pt(fin.repayment === "sculpted" ? "f_repay_sculpted" : "f_repay_annuity", lang)],
    [pt("f_build", lang), fin.constructionMonths],
    [pt("f_grace", lang), fin.graceYears],
    [pt("f_dsra", lang), fin.dsraMonths],
    [pt("f_tax", lang), fin.taxPct],
    [pt("f_tax_life", lang), fin.taxLifeYears],
    [pt("f_tax_loss", lang) + " (0 = no limit)", fin.taxLossYears],
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
    ASSET_COLUMNS.map((v) => ({ v, s: "head" })),
    ...assetRows(model, false).map((r) => r.map((v, i) => (i === 9 ? { v, s: "pct" } : i === 11 || i === 13 ? { v, s: "x" } : i >= 4 ? { v, s: "eur" } : v))),
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
    ["Project cash flow (after grant, after the tax it would pay without the loan)", { f: `-(SUM(Assets!E2:E${aEnd})-SUM(Assets!F2:F${aEnd}))`, v: agg.projectCf[0], s: "eur" },
      ...Array.from({ length: H }, (_, i) => ({ f: `${colName(i + 2)}2+${colName(i + 2)}16-${colName(i + 2)}17`, v: agg.projectCf[i + 1], s: "eur" }))],
    ["Equity cash flow (after the arrangement fee and the reserve account)", { f: `-(SUM(Assets!H2:H${aEnd})+SUM(Assets!M2:M${aEnd})+SUM(Assets!Q2:Q${aEnd}))`, v: -(agg.equityEur + agg.feeEur + agg.dsraEur), s: "eur" },
      ...Array.from({ length: H }, (_, i) => ({ f: `${colName(i + 2)}2-${colName(i + 2)}3+${colName(i + 2)}14`, v: agg.cfads[i] - agg.debtService[i] + (agg.reserveNet[i] || 0), s: "eur" }))],
    [],
    ["NPV at the discount rate", { f: `NPV(${discRef}/100,C5:${last}5)+B5`, v: agg.npv, s: "eur" }],
    ["Project IRR", { f: `IFERROR(IRR(B5:${last}5),"n/a")`, v: agg.irr ?? "n/a", s: "pct" }],
    ["Equity IRR", { f: `IFERROR(IRR(B6:${last}6),"n/a")`, v: agg.equityIrr ?? "n/a", s: "pct" }],
    ["Lowest DSCR", { f: `IF(COUNT(C4:${last}4)=0,"n/a",MIN(C4:${last}4))`, v: agg.dscrMin ?? "n/a", s: "x" }],
    ["Average DSCR, over the years that repay principal (row 19)", { f: `IF(COUNT(C19:${last}19)>0,AVERAGE(C19:${last}19),IF(COUNT(C4:${last}4)=0,"n/a",AVERAGE(C4:${last}4)))`, v: agg.dscrAvg ?? "n/a", s: "x" }],
    [],
    ["Reserve account: draws and releases to the sponsor (+), top-ups (-)", null, ...Array.from({ length: H }, (_, i) => ({ f: `SUM(AssetReserve!${colName(i + 2)}2:${colName(i + 2)}${aEnd})`, v: agg.reserveNet[i] || 0, s: "eur" }))],
    ["Shortfall the reserve could not cover (the sponsor pays it)", null, ...Array.from({ length: H }, (_, i) => ({ v: agg.reserveUnmet[i] || 0, s: "eur" }))],
    ["Corporate income tax paid (with the loan's interest deducted; already out of CFADS)", null, ...Array.from({ length: H }, (_, i) => ({ f: `SUM(AssetTax!${colName(i + 2)}2:${colName(i + 2)}${aEnd})`, v: agg.tax[i] || 0, s: "eur" }))],
    ["Corporate income tax the project would pay without the loan (for its own IRR and NPV)", null, ...Array.from({ length: H }, (_, i) => ({ f: `SUM(AssetTaxUnlevered!${colName(i + 2)}2:${colName(i + 2)}${aEnd})`, v: agg.taxUnlevered[i] || 0, s: "eur" }))],
    ["Repays principal this year (1 = yes; 0 = interest only or no loan)", null, ...Array.from({ length: H }, (_, i) => ({ v: agg.repays[i] ? 1 : 0, s: "num" }))],
    ["DSCR in the years that repay principal", null, ...Array.from({ length: H }, (_, i) => ({ f: `IF(${colName(i + 2)}18=1,${colName(i + 2)}4,"")`, v: agg.repays[i] && agg.dscrByYear[i] != null ? agg.dscrByYear[i] : "", s: "x" }))],
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
    ["Lowest pooled DSCR, P90 (a separate P90 run)", { v: model.p90.dscrMin ?? "n/a", s: "x" }],
    [pt("su_fee", lang), { f: `SUM(Assets!M2:M${aEnd})`, v: agg.feeEur, s: "eur" }],
    [],
    [{ v: pt("s_debt", lang), s: "bold" }],
    [pt("ds_capacity", lang), { f: "DebtSizing!B17", v: sz.capacityEur, s: "eur" }],
    ["Recommended debt share, %", { f: "DebtSizing!B18", v: sz.recommendedGearingPct ?? "n/a", s: "num" }],
    [pt("ds_headroom", lang) + " (negative: over capacity)", { f: "DebtSizing!B20", v: sz.capacityEur - agg.loanEur, s: "eur" }],
    [],
    [{ v: "Change a figure on the Assumptions or asset sheets and the Cashflow and this sheet recalculate. Change a target on the DebtSizing sheet and the capacity follows. Stress, sensitivity and structure results are separate runs of the whole model.", s: "note" }],
  ];

  // ---- debt sizing: targets are inputs, the capacity is formulas on the
  // Cashflow sheet's CFADS and the service of 1 EUR borrowed
  const yc = (i) => colName(i + 2);              // the column of year i+1 (C is year 1, as on Cashflow)
  const allow = (cfv, i, t) => (sz.unit[i] > 0 ? cfv / (t * sz.unit[i]) : "");
  // sculpted repayment: each year's allowed service is CFADS / target, and the
  // capacity is its present value at the loan rate (rows 26 to 28 below)
  const sculpted = fin.repayment === "sculpted";
  const sw = sculptWeights(fin, scenario, H);
  const sAllow = (cfv, i, t) => (sw.weights[i] > 0 ? Math.max(0, cfv) / t : "");
  const yearRows = sculpted ? [
    ["Discount factor of each repayment year at the loan rate (0 after the term)", null, ...Array.from({ length: H }, (_, i) => ({ v: sw.weights[i] ?? 0, s: "num4" }))],
    ["Debt service the P50 test allows (CFADS / target)", null, ...Array.from({ length: H }, (_, i) => ({ f: `IF(${yc(i)}10>0,MAX(0,${yc(i)}8)/$B$2,"")`, v: sAllow(sz.cfadsP50[i] ?? 0, i, sz.p50Dscr), s: "eur" }))],
    ["Debt service the P90 test allows (CFADS / target)", null, ...Array.from({ length: H }, (_, i) => ({ f: `IF(${yc(i)}10>0,MAX(0,${yc(i)}9)/$B$3,"")`, v: sAllow(sz.cfadsP90[i] ?? 0, i, sz.p90Dscr), s: "eur" }))],
  ] : [
    ["Debt service of 1 EUR borrowed (from the loan schedule)", null, ...Array.from({ length: H }, (_, i) => ({ v: sz.unit[i] ?? 0, s: "num4" }))],
    ["Debt the P50 test allows", null, ...Array.from({ length: H }, (_, i) => ({ f: `IF(${yc(i)}10>0,${yc(i)}8/($B$2*${yc(i)}10),"")`, v: allow(sz.cfadsP50[i] ?? 0, i, sz.p50Dscr), s: "eur" }))],
    ["Debt the P90 test allows", null, ...Array.from({ length: H }, (_, i) => ({ f: `IF(${yc(i)}10>0,${yc(i)}9/($B$3*${yc(i)}10),"")`, v: allow(sz.cfadsP90[i] ?? 0, i, sz.p90Dscr), s: "eur" }))],
  ];
  // a sculpted loan with interest-only years is also tested on each of them
  // (rows 29 and 30): the debt CFADS / (target x interest on 1 EUR) allows
  const unitG = unitDebtService(fin, scenario, H);
  const graceCols = Array.from({ length: fin.graceYears || 0 }, (_, i) => i).filter((i) => unitG[i] > 0);
  const sculptGrace = sculpted && graceCols.length > 0;
  const graceCap = (row, t) => graceCols.map((i) => `${yc(i)}${row}/($B$${t}*${unitG[i]})`).join(",");
  const capP50 = sculpted ? { f: sculptGrace ? `MIN(SUM(C26:${last}26)*B28,${graceCap(8, 2)})` : `SUM(C26:${last}26)*B28`, v: sz.p50.loanEur ?? 0, s: "eur" } : { f: `MAX(0,MIN(C11:${last}11))`, v: sz.p50.loanEur ?? 0, s: "eur" };
  const capP90 = sculpted ? { f: sculptGrace ? `MIN(SUM(C27:${last}27)*B28,${graceCap(9, 3)})` : `SUM(C27:${last}27)*B28`, v: sz.p90.loanEur ?? 0, s: "eur" } : { f: `MAX(0,MIN(C12:${last}12))`, v: sz.p90.loanEur ?? 0, s: "eur" };
  const pvRow = (row, label) => [label, null, ...Array.from({ length: H }, (_, i) => {
    const a = row === 11 ? sAllow(sz.cfadsP50[i] ?? 0, i, sz.p50Dscr) : sAllow(sz.cfadsP90[i] ?? 0, i, sz.p90Dscr);
    return { f: `IF(${yc(i)}10>0,${yc(i)}${row}*${yc(i)}10,0)`, v: sw.weights[i] > 0 ? a * sw.weights[i] : 0, s: "eur" };
  })];
  const sizingSheet = [
    [{ v: pt("s_debt", lang), s: "bold" }],
    [pt("ds_p50", lang), { v: sz.p50Dscr, s: "x" }],
    [pt("ds_p90", lang), { v: sz.p90Dscr, s: "x" }],
    [pt("ds_cap", lang), sz.maxGearingPct],
    ["Capex after grant EUR", { f: `SUM(Assets!E2:E${aEnd})-SUM(Assets!F2:F${aEnd})`, v: agg.capexEur - agg.grantEur, s: "eur" }],
    ["Interest during construction on 1 EUR of debt (first-year rate x construction months / 24)", { v: sz.idcFactor || 0, s: "num4" }],
    yearHead("EUR"),
    // with tax the capacity is found on CFADS at the sized loan (its interest is deducted), so these are values
    fin.taxPct > 0
      ? ["CFADS, P50, at the debt this sheet finds (tax with that loan's interest deducted)", null, ...Array.from({ length: H }, (_, i) => ({ v: sz.cfadsP50[i] ?? 0, s: "eur" }))]
      : ["CFADS, P50", null, ...Array.from({ length: H }, (_, i) => ({ f: `Cashflow!${yc(i)}2`, v: agg.cfads[i], s: "eur" }))],
    ["CFADS, P90 (a separate P90 run of every asset" + (fin.taxPct > 0 ? ", at the debt this sheet finds)" : ")"), null, ...Array.from({ length: H }, (_, i) => ({ v: sz.cfadsP90[i] ?? 0, s: "eur" }))],
    ...yearRows,
    [],
    ["Capacity on the P50 test", capP50],
    ["Capacity on the P90 test", capP90],
    ["Cap on the debt share EUR", { f: "B5*B4/100/(1-B4/100*B6)", v: sz.gearingCapEur, s: "eur" }],
    [pt("ds_capacity", lang), { f: "MIN(B14:B16)", v: sz.capacityEur, s: "eur" }],
    ["Recommended debt share, % of the cost after grant plus the interest during construction (rounded down to 0.5)", { f: 'IF(B5>0,INT(B17/(B5+B17*B6)*200+1E-9)/2,"n/a")', v: sz.recommendedGearingPct ?? "n/a", s: "num" }],
    [pt("ds_current", lang), { f: `SUM(Assets!G2:G${aEnd})`, v: agg.loanEur, s: "eur" }],
    [pt("ds_headroom", lang) + " (negative: over capacity)", { f: "B17-B19", v: sz.capacityEur - agg.loanEur, s: "eur" }],
    [],
    [{ v: pt(sculpted ? "ds_rule_s" : "ds_rule", lang), s: "note" }],
    [{ v: pt("ds_targets_h", lang), s: "note" }],
    [{ v: sculpted
      ? "Repayment is sculpted: each year's service follows the base-case P50 CFADS. The discount factors come from the Assumptions terms (rate, rate steps, term, currency); change those and download the model again; change a target here and the capacity recalculates."
      : "The service of 1 EUR borrowed comes from the year-by-year loan schedule on the Assumptions terms (rate, rate steps, term, currency, the programme's one-off repayment). Change those and download the model again; change a target here and the capacity recalculates.", s: "note" }],
    ...(sculpted ? [
      [{ v: "Sculpted repayment: present values", s: "bold" }],
      pvRow(11, "Present value of the P50 allowance"),
      pvRow(12, "Present value of the P90 allowance"),
      ["Multiplier for the programme's one-off repayment of principal", { v: sw.multiplier, s: "num4" }],
      ...(sculptGrace ? [[{ v: `The first ${fin.graceYears} year(s) pay interest only: each is tested on its own (CFADS / (target x the interest on 1 EUR)), inside the capacity formulas above.`, s: "note" }]] : []),
    ] : []),
  ];

  // ---- sources and uses, from the Assets sheet
  const su = model.sourcesUses;
  const share = (num, den, a, b) => ({ f: `IF(${den}>0,${num}/${den},"")`, v: b > 0 ? a / b : "", s: "pct" });
  const suSheet = [
    [{ v: pt("s_su", lang) + " (EUR)", s: "bold" }],
    [pt("su_uses", lang), "EUR", pt("su_share", lang)].map((v) => ({ v, s: "head" })),
    [pt("su_capex", lang), { f: `SUM(Assets!E2:E${aEnd})`, v: su.uses.capexEur, s: "eur" }, share("B3", "B7", su.uses.capexEur, su.uses.totalEur)],
    [pt("su_idc", lang), { f: `SUM(Assets!P2:P${aEnd})`, v: su.uses.idcEur, s: "eur" }, share("B4", "B7", su.uses.idcEur, su.uses.totalEur)],
    [pt("su_fee", lang), { f: `SUM(Assets!M2:M${aEnd})`, v: su.uses.feeEur, s: "eur" }, share("B5", "B7", su.uses.feeEur, su.uses.totalEur)],
    [pt("su_dsra", lang), { f: `SUM(Assets!Q2:Q${aEnd})`, v: su.uses.dsraEur, s: "eur" }, share("B6", "B7", su.uses.dsraEur, su.uses.totalEur)],
    [pt("su_total", lang), { f: "B3+B4+B5+B6", v: su.uses.totalEur, s: "eur" }],
    [],
    [pt("su_sources", lang), "EUR", pt("su_share", lang)].map((v) => ({ v, s: "head" })),
    [pt("k_grant", lang), { f: `SUM(Assets!F2:F${aEnd})`, v: su.sources.grantEur, s: "eur" }, share("B10", "B13", su.sources.grantEur, su.sources.totalEur)],
    [pt("k_debt", lang), { f: `SUM(Assets!G2:G${aEnd})`, v: su.sources.debtEur, s: "eur" }, share("B11", "B13", su.sources.debtEur, su.sources.totalEur)],
    [pt("su_equity", lang), { f: `SUM(Assets!H2:H${aEnd})+SUM(Assets!M2:M${aEnd})+SUM(Assets!Q2:Q${aEnd})`, v: su.sources.equityEur, s: "eur" }, share("B12", "B13", su.sources.equityEur, su.sources.totalEur)],
    [pt("su_total", lang), { f: "B10+B11+B12", v: su.sources.totalEur, s: "eur" }],
    [],
    ["Sources less uses (0 when they balance)", { f: "B13-B7", v: su.sources.totalEur - su.uses.totalEur, s: "eur" }],
    [],
    [{ v: pt("su_h", lang), s: "note" }],
  ];

  // ---- structures compared: separate runs of the whole model
  const structSheet = [
    ["Structure", "Terms", "Grant EUR", "Debt EUR", "Sponsor equity EUR", "Min DSCR P50", "Min DSCR P90", "Project IRR", "Equity IRR", "NPV EUR", "Debt capacity EUR", "Debt within capacity"].map((v) => ({ v, s: "head" })),
    ...model.structures.map((s) => [
      structureName(s, lang), termsLine(s.fin, lang), { v: s.grantEur, s: "eur" }, { v: s.loanEur, s: "eur" }, { v: s.equityEur, s: "eur" },
      { v: s.dscrMin, s: "x" }, { v: s.dscrMinP90, s: "x" }, { v: s.irr, s: "pct" }, { v: s.equityIrr, s: "pct" }, { v: s.npv, s: "eur" },
      { v: s.capacityEur, s: "eur" }, s.loanEur > 0 ? (s.withinCapacity ? "Yes" : "No") : "",
    ]),
    [],
    [{ v: pt("cmp_h", lang), s: "note" }],
  ];

  // ---- sensitivity (the tornado's numbers)
  const sens = model.sensitivity;
  const sensSheet = [
    ["Driver", "Min DSCR, down", "Min DSCR, up", "Equity IRR, down", "Equity IRR, up", "Project IRR, down", "Project IRR, up", "NPV EUR, down", "NPV EUR, up"].map((v) => ({ v, s: "head" })),
    ...(sens?.base ? [["Base case", { v: sens.base.dscrMin, s: "x" }, { v: sens.base.dscrMin, s: "x" }, { v: sens.base.equityIrr, s: "pct" }, { v: sens.base.equityIrr, s: "pct" },
      { v: sens.base.irr, s: "pct" }, { v: sens.base.irr, s: "pct" }, { v: sens.base.npv, s: "eur" }, { v: sens.base.npv, s: "eur" }]] : []),
    ...(sens?.rows || []).map((r) => [
      driverLabel(r.id, r.size, lang),
      { v: r.lo?.dscrMin, s: "x" }, { v: r.hi?.dscrMin, s: "x" }, { v: r.lo?.equityIrr, s: "pct" }, { v: r.hi?.equityIrr, s: "pct" },
      { v: r.lo?.irr, s: "pct" }, { v: r.hi?.irr, s: "pct" }, { v: r.lo?.npv, s: "eur" }, { v: r.hi?.npv, s: "eur" },
    ]),
    [],
    [{ v: pt("tor_h", lang), s: "note" }],
    [{ v: "Curtailment and construction delay are flexed one way (the adverse one), so their 'down' cells are empty.", s: "note" }],
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
    [{ v: "Energy value comes from the VoltMira quote engine; yield uncertainty 7.1% gives P50 and P90. Overlays add: tariff and escalation, curtailment of exported energy, construction delay, net local-currency loss, war-risk insurance and fixed-price sales. Debt is amortised year by year with an optional stepped rate, a grant on capex and a one-off state repayment of principal, in equal instalments or sculpted to the base-case cash flow (Assumptions: Repayment).", s: "wrap" }],
    [],
    [{ v: (fin.repayment === "sculpted"
      ? "Debt sizing: the largest loan whose sculpted repayments (each year's CFADS divided by the target DSCR) the CFADS covers, on P50 and on P90, capped at a share of the capex after grant."
      : "Debt sizing: the largest loan whose level repayments the CFADS covers in every repayment year by the target DSCR, on P50 and on P90, capped at a share of the capex after grant. A sculpted profile is set on the Assumptions (Repayment).")
      + " Sources and uses run to commissioning; the arrangement fee and the reserve account are paid by the sponsor.", s: "wrap" }],
    [],
    [{ v: "Timeline: Year 0 is commissioning. The construction months (Assumptions) add the interest on the loan drawn evenly over them to the loan, and the debt share is taken of the cost after grant plus that interest; the spending itself is placed at Year 0, so the IRRs leave out the time value of the construction months. Interest-only years after commissioning pay interest only, inside the term. The reserve account holds the set months of the next year's debt service: the sponsor funds it at commissioning, a short year draws on it, later surpluses refill it, and it is released as the service falls and when the loan is repaid (Cashflow rows 14 and 15; each asset keeps its own reserve, AssetReserve).", s: "wrap" }],
    [],
    [{ v: fin.taxPct > 0
      ? `Tax: corporate income tax of ${fin.taxPct}% on the profit left after a straight-line depreciation over ${fin.taxLifeYears} years (of the cost after grant plus the interest during construction) and the loan's interest; a loss lowers later profits, oldest first, ${fin.taxLossYears > 0 ? `for ${fin.taxLossYears} years, then lapses` : "without a time limit"}. It is worked out asset by asset (AssetTax) and CFADS is after it. The project IRR and NPV use the tax the project would pay without the loan (AssetTaxUnlevered), as an unlevered return should. With tax the loan changes the cash flow, so the DebtSizing sheet lists the CFADS at the debt it finds. VAT and local taxes are not modelled.`
      : "Tax: no corporate income tax is charged (rate 0 on the Assumptions). VAT and local taxes are not modelled.", s: "wrap" }],
    [],
    [{ v: "Sources", s: "bold" }],
    ...model.markets.map((m) => [{ v: `${m} grid emission factor ${GRID_EMISSION_FACTOR[m]?.tPerMwh} t/MWh: ${GRID_EMISSION_FACTOR[m]?.source}`, s: "wrap" }]),
    ...presetSources(model.portfolio?.finance, lang).map((t) => [{ v: t, s: "wrap" }]),
  ];

  return buildXlsx([
    { name: "Summary", rows: summary, widths: [44, 18] },
    { name: "Assumptions", rows: assumptions, widths: [52, 20, 20] },
    { name: "Assets", rows: assetsSheet, widths: [30, 9, 24, 10, 14, 14, 14, 14, 12, 12, 14, 14, 14, 14, 18, 16, 18], freeze: { row: 1 } },
    { name: "AssetCFADS", rows: series("cfads", "CFADS EUR"), widths, freeze: { row: 1, col: 1 } },
    { name: "AssetDebt", rows: series("debtService", "Debt service EUR"), widths, freeze: { row: 1, col: 1 } },
    { name: "AssetReserve", rows: series("reserveNet", "Reserve account to the sponsor EUR"), widths, freeze: { row: 1, col: 1 } },
    { name: "AssetTax", rows: series("tax", "Corporate income tax paid EUR"), widths, freeze: { row: 1, col: 1 } },
    { name: "AssetTaxUnlevered", rows: series("taxUnlevered", "Tax without the loan EUR"), widths, freeze: { row: 1, col: 1 } },
    { name: "Cashflow", rows: cf, widths, freeze: { row: 1, col: 1 } },
    { name: "DebtSizing", rows: sizingSheet, widths: [52, ...Array.from({ length: H + 1 }, () => 13)], freeze: { col: 1 } },
    { name: "SourcesUses", rows: suSheet, widths: [44, 16, 10] },
    { name: "Structures", rows: structSheet, widths: [40, 46, 14, 14, 16, 12, 12, 12, 12, 14, 16, 12] },
    { name: "Sensitivity", rows: sensSheet, widths: [36, 14, 14, 14, 14, 14, 14, 14, 14] },
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
  add("03-assets.csv", toCsv([ASSET_COLUMNS, ...assetRows(model)]), "One row per asset.");
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
