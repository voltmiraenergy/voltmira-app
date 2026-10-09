// lib/bankPack.js — the bank submission pack for one utility plant: the
// plant modelled as its own facility (the portfolio's terms, this plant
// alone), the loan life cover, how much of the loan the contract covers, what
// the bank is still waiting for, and the ZIP: the credit summary in Romanian
// and English (rendered by app/api/portfolios/[id]/bankpack), the plant's
// Excel model, the permit checklist as CSV, the documents filed on the
// checklist (one folder per item, lib/dealRoom.js) and a manifest in both
// languages.
// A summary that could not be rendered is named in the manifest, never left
// out quietly. Pure; no I/O.
import { normalizeFinance } from "./projectFinance.js";
import { normalizePlant, plantEnergy, plantHeadroom } from "./plantFinance.js";
import { permitProgress } from "./plantPermits.js";
import { siteDrift } from "./sitePick.js";
import { chosenPoint, gridSummary, connectionEstimate } from "./gridNear.js";
import { num, pct, dscr, mwhUnit } from "./portfolioFormat.js";
import { pt } from "./portfolioText.js";
import { layoutFor } from "./plantLayout.js";
import { PLANTS_KEY } from "./portfolioModel.js";
import { toCsv, buildWorkbook, caseLabel, riskRows } from "./portfolioExport.js";
import { plt } from "./plantText.js";
import { bt } from "./bankText.js";
import { zip } from "./zip.js";
import { ITEM_IDS, packPaths, docCounts } from "./dealRoom.js";
import { sha256 } from "./sha256.js";
import { reportId } from "./reportId.js";
import { preflight } from "./preflight.js";
import { checkText } from "./preflightText.js";
import { buildDocx } from "./docx.js";

/** The languages the pack ships in: the Moldovan banks' and the co-lenders'. */
export const PACK_LANGS = ["ro", "en"];

/** The stored plant with this id, or null. */
export function findPlant(portfolio, plantId) {
  const list = Array.isArray(portfolio?.assets?.[PLANTS_KEY]) ? portfolio.assets[PLANTS_KEY] : [];
  return list.find((x) => x && typeof x === "object" && x.id && String(x.id) === String(plantId)) || null;
}

/**
 * The portfolio as if it held this plant alone, for buildModel(): the same
 * terms, scenario and screening, no quotes and no other plant. A bank lends to
 * the plant's project company, so its cover is the plant's own.
 */
export function plantOnly(portfolio, plantId) {
  const raw = findPlant(portfolio, plantId);
  if (!raw) return null;
  return { ...portfolio, project_ids: [], assets: { [PLANTS_KEY]: [raw] } };
}

/**
 * Loan life cover ratio: the CFADS of the loan's years, discounted at the
 * loan's rate for each year, over the loan at financial close.
 * @returns {number|null}  null without a loan
 */
export function llcr(cfads, loanEur, fin) {
  const f = normalizeFinance(fin);
  if (!(Number(loanEur) > 0) || !Array.isArray(cfads)) return null;
  let pv = 0, df = 1;
  for (let y = 1; y <= f.tenorYears; y++) {
    const r = (f.rateSteps && f.rateSteps[y - 1] != null ? f.rateSteps[y - 1] : f.ratePct) / 100;
    df /= 1 + r;
    pv += (Number(cfads[y - 1]) || 0) * df;
  }
  return pv / Number(loanEur);
}

/** How many of the loan's years the revenue contract covers (none when sold on the market only). */
export function contractYears(plant, fin) {
  const pl = normalizePlant(plant);
  const tenor = normalizeFinance(fin).tenorYears;
  return { years: pl.revenue.kind === "merchant" ? 0 : Math.min(pl.revenue.years, tenor), tenor };
}

const closed = (s) => s === "done" || s === "na";

/**
 * What the bank still waits for: each checklist item that is not done or
 * marked not needed, in checklist order, and what the plant's own record
 * lacks (no borrower named; a yield study marked done whose P50 and P90 were
 * never entered, so the figures still come from public data; public figures
 * looked up for another point than the site, after the plant was moved).
 * @param {object} plant
 * @param {string} todayKey  "YYYY-MM-DD", for what is overdue
 */
export function stillMissing(plant, todayKey) {
  const pl = normalizePlant(plant);
  const progress = permitProgress(pl.permits, todayKey);
  // the grid connection, once it has steps, is listed by its open steps: each
  // waits for the one before it, the first for what the grid item waits for
  const items = progress.rows.filter((r) => !closed(r.status)).flatMap((r) => {
    if (!r.steps) return [r];
    return r.steps.map((s, i) => ({ s, i })).filter(({ s }) => !closed(s.status)).map(({ s, i }) => {
      const prev = r.steps.slice(0, i).reverse().find((x) => !closed(x.status));
      const state = closed(s.status) ? s.status : s.status === "in_progress" ? "in_progress" : prev || r.blockedBy.length ? "waiting" : "ready";
      return { ...s, id: "grid", step: s.id, state, blockedBy: prev ? [] : r.blockedBy, waitsStep: prev ? prev.id : null };
    });
  });
  const gaps = [];
  if (!pl.borrower) gaps.push({ id: "borrower" });
  const en = plantEnergy(pl);
  const noStudy = [en.wind && en.wind.source !== "study" ? "wind" : null, en.solar && en.solar.source !== "study" ? "solar" : null].filter(Boolean);
  if (progress.rows.find((r) => r.id === "yield")?.status === "done" && noStudy.length) gaps.push({ id: "study", sources: noStudy });
  const drift = siteDrift(pl);
  for (const part of ["wind", "solar", "grid"]) if (drift[part] != null) gaps.push({ id: "moved", part, km: Math.round(drift[part] * 10) / 10 });
  return { items, gaps, progress, count: items.length + gaps.length };
}

const permitName = (id, lang) => plt("pm_" + id, lang);

/** One missing checklist item as a line: name, status, who, when, and what it waits for. */
export function missingLine(r, lang) {
  const parts = [plt("ps_" + r.status, lang)];
  if (r.by) parts.push(bt("m_by", lang, { x: r.by }));
  if (r.due) parts.push(bt("m_due", lang, { x: r.due }));
  if (r.overdue) parts.push(plt("p_overdue", lang));
  if (r.state === "waiting") parts.push(plt("p_waits", lang, { x: r.waitsStep ? plt("gs_" + r.waitsStep, lang) : r.blockedBy.map((d) => permitName(d, lang)).join(", ") }));
  else if (r.state === "ready") parts.push(plt("p_ready_one", lang));
  return `${permitName(r.id, lang)}${r.step ? `, ${plt("gs_" + r.step, lang)}` : ""}: ${parts.join(", ")}`;
}

/** A gap in the plant's own record as a sentence. */
export function gapText(g, lang) {
  if (g.id === "moved") return bt("gap_moved", lang, { x: plt(g.part === "wind" ? "c_wind" : g.part === "grid" ? "grid_word" : "c_solar", lang).toLowerCase(), km: num(g.km, lang, 1) });
  if (g.id === "study") return bt("gap_study", lang, { x: g.sources.map((s) => plt(s === "wind" ? "c_wind" : "c_solar", lang).toLowerCase()).join(", ") });
  return bt("gap_" + g.id, lang);
}

/**
 * The grid around the plant in one line, for the bank's documents: the
 * connection point (chosen, or the nearest 110 kV substation), the nearest
 * 110 kV line when it is not that point, and the connection estimate when the
 * user made one. Null without a grid lookup.
 * @param {object} plant
 * @param {(eur:number)=>string} money  formats an amount with its currency
 */
export function gridText(plant, lang, money) {
  const g = normalizePlant(plant).grid;
  const p = chosenPoint(g);
  if (!p) return null;
  const d = (v) => num(v, lang, 1);
  const name = p.name || (p.place ? bt("g_near", lang, { x: p.place }) : bt("g_unnamed", lang));
  const point = p.kind === "sub"
    ? bt("g_sub", lang, { kv: p.kvAt, name, km: d(p.km) })
    : bt("g_line", lang, { kv: p.kvAt, km: d(p.km) });
  const line = gridSummary(g).line["110"];
  const est = connectionEstimate(g);
  return [point,
    line && !(p.kind === "line" && p.id === line.id) ? bt("g_line", lang, { kv: line.kv[0], km: d(line.km) }) : null,
    est ? bt("g_est", lang, { x: money(est.totalEur) }) : null].filter(Boolean).join("; ");
}

/** The permit checklist as CSV, Romanian and English side by side. */
export function permitCsv(plant, todayKey, docs = []) {
  const pl = normalizePlant(plant);
  const both = (k) => `${plt(k, "ro")} / ${plt(k, "en")}`;
  // the documents on file under each item, by name
  const names = (id) => docs.filter((d) => d.item_id === id).map((d) => d.name).join("; ");
  const head = ["Element", "Item", both("p_status"), both("pf_by"), both("pf_ref"), both("pf_submitted"), both("pf_due"), "Așteaptă / Waits for", "Documente / Documents"];
  const rows = permitProgress(pl.permits, todayKey).rows.flatMap((r) => [[
    permitName(r.id, "ro"), permitName(r.id, "en"),
    both("ps_" + r.status) + (r.overdue ? `, ${both("p_overdue")}` : ""),
    r.by, r.ref, r.submitted, r.due,
    r.blockedBy.map((d) => `${permitName(d, "ro")} / ${permitName(d, "en")}`).join("; "),
    names(r.id),
  ], ...(r.steps || []).map((s) => [
    `  ${plt("gs_" + s.id, "ro")}`, `  ${plt("gs_" + s.id, "en")}`,
    both("ps_" + s.status) + (s.overdue ? `, ${both("p_overdue")}` : ""),
    s.by, s.ref, s.submitted, s.due, "", "",
  ])]);
  if (docs.some((d) => d.item_id === "other")) rows.push([permitName("other", "ro"), permitName("other", "en"), "", "", "", "", "", "", names("other")]);
  return toCsv([head, ...rows]);
}

/**
 * The manifest: Romanian first, then English. What is in the archive, a
 * summary that could not be built, what the bank is still waiting for, what
 * the archive does not hold, and what this document is not.
 */
export function packManifest({ plant, files, failed = [], company = "", generatedAt = "", todayKey = "", docs = null, docFailed = [], reportId: rid = "", checks = [] }) {
  const pl = normalizePlant(plant);
  const miss = stillMissing(pl, todayKey);
  // the items that need a paper (not marked "not needed") and have none on file
  const counts = docCounts(docs || []);
  const rows = permitProgress(pl.permits, todayKey).rows;
  const without = rows.filter((r) => r.status !== "na" && !counts[r.id]).map((r) => r.id);
  const block = (l) => {
    const out = [bt("mf_title", l, { name: pl.name }), bt("mf_by", l, { co: company || "VoltMira", date: generatedAt }), ...(rid ? [bt("rid", l, { x: rid })] : []), ""];
    if (pl.sample) out.push(plt("sample_note", l), "");
    out.push(bt("mf_contents", l));
    for (const f of files) out.push(`  ${f.path}`, `      ${f.what[l]}`);
    for (const fl of failed) out.push("", bt("mf_pdf_fail", l, { l: bt("lang_" + fl, l) }));
    for (const n of docFailed) out.push("", bt("mf_doc_fail", l, { x: n }));
    out.push("", bt("missing_h", l));
    if (!miss.count) out.push(`  ${bt("missing_none", l)}`);
    for (const g of miss.gaps) out.push(`  - ${gapText(g, l)}`);
    for (const r of miss.items) out.push(`  - ${missingLine(r, l)}`);
    // the points a careful reader would raise, stated rather than left out
    if (checks.length) {
      out.push("", bt("pf_h", l));
      for (const c of checks) out.push(`  - ${checkText(c, l)}`);
    }
    if (docs && docs.length) {
      out.push("", bt("mf_docs", l));
      if (without.length) out.push(bt("mf_docs_without", l, { x: without.map((id) => permitName(id, l)).join(", ") }));
    } else {
      out.push("", bt("mf_not_included", l));
    }
    out.push("", bt("disclaimer", l));
    return out;
  };
  // a fingerprint per file, once: the bank can check any of them against the archive
  const prints = files.filter((f) => f && f.data != null).map((f) => `  ${sha256(f.data)}  ${f.path}`);
  const tail = prints.length ? ["", "-".repeat(60), "", bt("mf_hash_h", "ro"), bt("mf_hash_h", "en"), "", ...prints] : [];
  return "﻿" + [...block("ro"), "", "-".repeat(60), "", ...block("en"), ...tail].join("\r\n") + "\r\n";
}

/** The plant's parts in a line: "wind 40 MW, solar 20 MWp, battery storage 10 MW / 20 MWh". */
export function mixLine(pl, lang) {
  const mw = lang === "ru" || lang === "uk" ? "МВт" : "MW";
  const mwp = { ru: "МВт пик", uk: "МВт пік" }[lang] || "MWp";
  const parts = [];
  if (pl.wind) parts.push(`${plt("c_wind", lang).toLowerCase()} ${num(pl.wind.mw, lang, 1)} ${mw}`);
  if (pl.solar) parts.push(`${plt("c_solar", lang).toLowerCase()} ${num(pl.solar.mwp, lang, 1)} ${mwp}`);
  if (pl.bess) parts.push(`${plt("c_bess", lang).toLowerCase()} ${num(pl.bess.mw, lang, 1)} ${mw} / ${num(pl.bess.mwh, lang, 0)} ${mwhUnit(lang)}`);
  return parts.join(", ");
}

const RISK_LEVEL = { high: 0, medium: 1, low: 2, unknown: 3 };

/**
 * The pack's summary as a Word document, the file a credit officer opens
 * first and can edit: in each language (Romanian, then English, a page
 * apart) the request in one paragraph, the key figures, the proposed terms,
 * the plant and its site, the revenue and the room before the cover target,
 * the stress tests and the main risks, the permit checklist with who and
 * when, what is still missing, the checks before sending, and what the pack
 * holds; then the SHA-256 of every file. Every figure is the plant's own
 * model (the same as the credit summary and the Excel workbook), with the
 * credit summary's own labels. Without a model (a pack built from files
 * alone) the figure sections are left out, never invented.
 */
export function packManifestDocx({ plant, model = null, files, failed = [], company = "", generatedAt = "", todayKey = "", docs = null, docFailed = [], reportId: rid = "", checks = [] }) {
  const pl = normalizePlant(plant);
  const miss = stillMissing(pl, todayKey);
  const counts = docCounts(docs || []);
  const rows = permitProgress(pl.permits, todayKey).rows;
  const without = rows.filter((r) => r.status !== "na" && !counts[r.id]).map((r) => r.id);
  const en = plantEnergy(pl);
  const a = model?.assets?.[0] || null;
  const lay = layoutFor(pl);
  const laid = lay.result && lay.result.tables.length ? lay.result.stats : null;
  // the language-free figures, once
  const fig = model && a ? (() => {
    const { agg, fin, sizing } = model;
    return {
      agg, fin, sizing, hasDebt: fin.gearingPct > 0 && agg.loanEur > 0,
      l50: llcr(agg.cfads, agg.loanEur, fin), l90: llcr(model.p90.cfads, agg.loanEur, fin),
      cy: contractYears(pl, fin), hr: plantHeadroom(pl, model.E, model.fin, model.scenario, sizing.p50Dscr),
      p90Mwh: a.p90Year1Kwh != null ? a.p90Year1Kwh / 1000 : null, capexNet: agg.capexEur - agg.grantEur,
    };
  })() : null;

  const blocks = [];
  const section = (l) => {
    const none = pt("na", l);
    const m = (v) => (v == null ? none : `${num(v, l, 0)} EUR`);
    const fd = (v) => (v == null ? none : dscr(v, l));
    const fp = (v) => (v == null ? none : pct(v, l));
    const mwh = (v) => (v == null ? none : `${num(v, l, 0)} ${mwhUnit(l)}`);
    const pc = (v) => `${num(v, l, 1)}%`;

    blocks.push({ h1: bt("mf_title", l, { name: pl.name }) });
    blocks.push({ p: { text: [bt("mf_by", l, { co: company || "VoltMira", date: generatedAt }), rid ? bt("rid", l, { x: rid }) : ""].filter(Boolean).join(" "), color: "5B6A62" } });
    if (pl.sample) blocks.push({ note: `${plt("sample_badge", l)}. ${plt("sample_note", l)}` });

    if (fig) {
      const { agg, fin, sizing, hasDebt, l50, l90, cy, hr, p90Mwh, capexNet } = fig;
      const place = pl.locality.replace(/^(near|lângă|около|поблизу)\s+/i, "");
      const where = place ? bt("near", l, { x: place }) : "";
      const mix = mixLine(pl, l);
      blocks.push({ lead: (hasDebt
        ? bt("lead", l, { borrower: pl.borrower || bt("borrower_none", l), loan: m(agg.loanEur), t: fin.tenorYears,
          profile: bt(fin.repayment === "sculpted" ? "prof_sculpted" : "prof_annuity", l), r: num(fin.ratePct, l, 2), name: pl.name, mix, where })
        : bt("lead_nodebt", l, { name: pl.name, mix, where })) + (pl.sponsor ? ` ${bt("sponsor_line", l, { x: pl.sponsor })}` : "") });

      // the key figures, the credit summary's first page as a list
      const cap = sizing.capacityEur;
      const fit = cap == null || !hasDebt ? "" : agg.loanEur <= cap + 0.5 ? bt("fit_ok", l, { x: m(cap) }) : bt("fit_over", l, { x: m(agg.loanEur - cap) });
      blocks.push({ h2: bt("mf_key_h", l) });
      blocks.push({ table: { kv: true, widths: [0.42, 0.58], rows: [
        [bt("k_loan", l), hasDebt ? `${m(agg.loanEur)}${fit ? `, ${fit}` : ""}` : none],
        [pt("k_capex", l), `${m(agg.capexEur)}${agg.grantEur > 0 ? `, ${bt("k_net", l, { x: m(capexNet) })}` : ""}`],
        [bt("k_gear", l), capexNet > 0 && hasDebt ? `${num((agg.loanEur / capexNet) * 100, l, 0)}%, ${bt("k_gear_s", l)}` : none],
        [pt("k_dscr_p50", l), `${fd(agg.dscrMin)}, P90 ${fd(model.p90.dscrMin)}`],
        [bt("k_avg", l), fd(agg.dscrAvg)],
        [bt("k_llcr", l), `${fd(l50)}, P90 ${fd(l90)}`],
        [bt("k_pirr", l), `${fp(agg.irr)}, ${pt("k_eirr", l)} ${fp(agg.equityIrr)}`],
        [bt("p_energy", l), `${mwh(en.p50Mwh)} / ${mwh(p90Mwh)}`],
        [pt("k_co2", l), `${num(model.co2.tPerYear, l, 0)} ${pt("es_co2_t", l)}`],
      ] } });

      // the terms
      const build = [fin.constructionMonths > 0 && pt("build_short", l, { n: fin.constructionMonths }),
        hasDebt && fin.graceYears > 0 && pt("grace_short", l, { n: fin.graceYears }),
        hasDebt && fin.dsraMonths > 0 && pt("dsra_short", l, { n: num(fin.dsraMonths, l, 1) })].filter(Boolean).join(", ");
      blocks.push({ h2: bt("terms_h", l) });
      blocks.push({ table: { kv: true, widths: [0.42, 0.58], rows: [
        [bt("t_amount", l), hasDebt ? m(agg.loanEur) : none],
        [bt("t_currency", l), fin.debtCurrency === "local" ? bt("lei", l) : "EUR"],
        [pt("f_tenor", l), String(fin.tenorYears)],
        [pt("f_rate", l), num(fin.ratePct, l, 2)],
        ...(fin.rateSteps ? [[bt("t_steps", l), fin.rateSteps.map((x) => num(x, l, 2)).join(" / ")]] : []),
        [pt("f_repay", l), pt(fin.repayment === "sculpted" ? "f_repay_sculpted" : "f_repay_annuity", l)],
        ...(build ? [[bt("t_build", l), build]] : []),
        ...(fin.feePct > 0 ? [[pt("f_fee", l), num(fin.feePct, l, 2)]] : []),
        ...(fin.grantPct > 0 ? [[pt("f_grant", l), num(fin.grantPct, l, 1)]] : []),
        [pt("r_tax", l), fin.taxPct > 0 ? `${num(fin.taxPct, l, 1)}%` : pt("tax_none", l)],
        [bt("t_targets", l), `${dscr(sizing.p50Dscr, l)} / ${dscr(sizing.p90Dscr, l)}`],
      ] } });

      // the plant and its site
      const src = (s) => plt(s === "study" ? "src_study" : s === "screening" ? "src_screening" : s === "none" ? "src_none" : "src_pvgis", l);
      const srcLine = [en.wind && `${plt("c_wind", l)}: ${src(en.wind.source)}`, en.solar && `${plt("c_solar", l)}: ${src(en.solar.source)}`].filter(Boolean).join("; ");
      const grid = gridText(pl, l, m);
      const f1 = (v, d = 1) => num(v, l, d);
      blocks.push({ h2: bt("plant_h", l) });
      blocks.push({ table: { kv: true, widths: [0.42, 0.58], rows: [
        [bt("p_place", l), [pl.locality, pl.lat != null ? `${pl.lat.toFixed(4)}, ${pl.lon.toFixed(4)}` : ""].filter(Boolean).join("; ") || none],
        ...(pl.operator ? [[plt("f_operator", l), pl.operator]] : []),
        [bt("mf_mix", l), mix],
        ...(pl.wind ? [[plt("c_wind", l), `${pl.wind.turbines} x ${f1(pl.wind.mw / pl.wind.turbines, 2)} MW, ${f1(pl.wind.hubM, 0)} m`]] : []),
        ...(pl.solar?.yieldKwhKwp ? [[plt("c_solar", l), `${f1(pl.solar.yieldKwhKwp, 0)} kWh/kWp`]] : []),
        [bt("p_source", l), srcLine || none],
        ...(grid ? [[bt("p_grid", l), grid]] : []),
        ...(laid ? [
          [plt(laid.turbinesPlaced ? "ly_k_field" : "ly_k_plot", l), `${f1(laid.plotHa)} ha`],
          [plt("ly_k_tables", l), plt("ly_v_tables", l, { tables: f1(laid.placedTables, 0), per: f1(laid.modulesPerTable, 0), mods: f1(laid.modulesPlaced, 0) })],
          [plt("ly_k_pitch", l), plt("ly_v_pitch", l, { pitch: f1(laid.pitchM), gcr: f1(laid.gcr, 2) })],
          ...(laid.needTurbines > 0 ? [[plt("ly_k_turbines", l), plt("ly_v_turbines", l, { n: f1(laid.turbineCount, 0), need: f1(laid.needTurbines, 0), d: f1(laid.rotorM || 0, 0), r: f1(laid.keepoutRadiusM || 0, 0), c: f1(laid.windCableM || 0, 0) })]] : []),
        ] : []),
      ] } });

      // the revenue and the room before the target
      const r = pl.revenue;
      const t = dscr(sizing.p50Dscr, l);
      blocks.push({ h2: plt("rev_h", l) });
      blocks.push({ table: { kv: true, widths: [0.42, 0.58], rows: [
        [plt("rev_kind", l), plt("rk_" + r.kind, l)],
        [plt("rev_price", l), num(r.priceEurMwh, l, 2)],
        ...(r.kind !== "merchant" ? [[plt("rev_years", l), String(r.years)], [plt("rev_index", l), pc(r.indexPct)], [plt("rev_after", l), num(r.afterEurMwh, l, 2)]] : []),
        [pt("ds_capacity", l), m(cap)],
      ] } });
      const room = [
        hasDebt ? (cy.years > 0 ? bt("cover_years", l, { n: cy.years, t: cy.tenor }) : bt("cover_none", l)) : null,
        hr.energyHeadroomPct != null ? plt(hr.energyHeadroomPct >= 0 ? "hr_energy_pos" : "hr_energy_neg", l, { x: pc(Math.abs(hr.energyHeadroomPct)), t }) : null,
        hr.capexHeadroomPct != null ? plt(hr.capexHeadroomPct >= 0 ? "hr_capex_pos" : "hr_capex_neg", l, { x: pc(Math.abs(hr.capexHeadroomPct)), t }) : null,
      ].filter(Boolean);
      if (room.length) blocks.push({ bullets: room });

      // the stress tests
      blocks.push({ h2: pt("s_stress", l) });
      blocks.push({ table: { widths: [0.4, 0.12, 0.16, 0.16, 0.16],
        head: [pt("st_case", l), bt("col_yield", l), bt("col_dscr", l), bt("k_pirr", l), pt("k_eirr", l)],
        rows: model.suite.map((s) => [caseLabel(s.id, l, "MD"), s.exceed, fd(s.agg.dscrMin), fp(s.agg.irr), fp(s.agg.equityIrr)]) } });

      // the main risks, as the credit summary weighs them for one plant
      const rr = riskRows(model, l).map((row, i) => ({ row, id: model.risks[i].id, level: model.risks[i].level }))
        .filter((x) => x.id !== "concentration" && (x.level === "high" || x.level === "medium"))
        .sort((x, y) => RISK_LEVEL[x.level] - RISK_LEVEL[y.level]).slice(0, 5);
      if (rr.length) {
        blocks.push({ h2: pt("t_risks", l) });
        blocks.push({ table: { widths: [0.22, 0.13, 0.1, 0.55], rows: rr.map((x) => [[{ text: x.row[0], bold: true }], x.row[1], x.row[2], x.row[3]]) } });
      }
    }

    // the permit checklist: who, when, and what each waits for
    blocks.push({ h2: `${bt("docs_h", l)}, ${plt("p_progress", l, { done: miss.progress.done, total: miss.progress.total })}` });
    blocks.push({ table: { widths: [0.3, 0.14, 0.14, 0.12, 0.12, 0.18],
      head: [bt("mf_item", l), plt("p_status", l), plt("pf_by", l), plt("pf_submitted", l), plt("pf_due", l), bt("mf_waits", l)],
      rows: rows.map((r) => [
        permitName(r.id, l),
        [{ text: plt("ps_" + r.status, l) + (r.overdue ? `, ${plt("p_overdue", l)}` : ""), bold: r.status === "done", color: r.overdue ? "B4472F" : r.status === "done" ? "1E6B4E" : undefined }],
        r.by || "", r.submitted || "", r.due || "",
        r.blockedBy.map((d) => permitName(d, l)).join(", "),
      ]) } });

    blocks.push({ h2: bt("missing_h", l) });
    if (!miss.count) blocks.push({ p: bt("missing_none", l) });
    else blocks.push({ bullets: [...miss.gaps.map((g) => gapText(g, l)), ...miss.items.map((r) => missingLine(r, l))] });
    if (checks.length) {
      blocks.push({ h2: bt("pf_h", l) });
      blocks.push({ bullets: checks.map((c) => checkText(c, l)) });
    }

    // what the pack holds
    blocks.push({ h2: bt("mf_contents", l) });
    blocks.push({ table: { widths: [0.34, 0.66], head: [bt("mf_file", l), bt("mf_what", l)], rows: files.map((f) => [[{ text: f.path, bold: true }], f.what[l]]) } });
    for (const fl of failed) blocks.push({ p: { text: bt("mf_pdf_fail", l, { l: bt("lang_" + fl, l) }), bold: true, color: "B4472F" } });
    for (const n of docFailed) blocks.push({ p: { text: bt("mf_doc_fail", l, { x: n }), bold: true, color: "B4472F" } });
    if (docs && docs.length) {
      blocks.push({ p: bt("mf_docs", l) });
      if (without.length) blocks.push({ p: bt("mf_docs_without", l, { x: without.map((id) => permitName(id, l)).join(", ") }) });
    } else {
      blocks.push({ p: bt("mf_not_included", l) });
    }
    blocks.push({ note: bt("disclaimer", l) });
  };
  section("ro");
  blocks.push({ pageBreak: true });
  section("en");
  const prints = files.filter((f) => f && f.data != null).map((f) => [f.path, [{ text: sha256(f.data), mono: true, size: 16 }]]);
  if (prints.length) {
    blocks.push({ pageBreak: true });
    blocks.push({ h2: `${bt("mf_hash_t", "ro")} / ${bt("mf_hash_t", "en")}` });
    blocks.push({ p: bt("mf_hash_h", "ro") });
    blocks.push({ p: bt("mf_hash_h", "en") });
    blocks.push({ table: { widths: [0.32, 0.68], head: ["Fișier / File", "SHA-256"], rows: prints } });
  }
  return buildDocx(blocks, { title: bt("mf_title", "en", { name: pl.name }), subject: rid, creator: company || "VoltMira" });
}

export const packName = (s) => String(s || "plant").replace(/[^\w.-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60) || "plant";

/**
 * The ZIP for one plant.
 * @param {object} a
 * @param {object} a.model     buildModel() of plantOnly(): the plant alone
 * @param {object} a.plant     the stored plant
 * @param {{ro?:Uint8Array, en?:Uint8Array}} [a.pdfs]  the rendered credit summaries
 * @param {string} [a.xlsxLang]  the workbook's language
 * @param {{item_id:string, name:string, data:Uint8Array}[]} [a.documents]  the files on the checklist, read from Storage
 * @param {string[]} [a.docFailed]  documents that could not be read: named in the manifest
 */
export function buildBankPack({ model, plant, pdfs = {}, xlsxLang = "ro", company = "", generatedAt = new Date().toISOString().slice(0, 10), todayKey = generatedAt, date, documents = [], docFailed = [] }) {
  const pl = normalizePlant(plant);
  const name = packName(pl.name);
  const files = [];
  const failed = [];
  const both = (k, vars) => ({ ro: bt(k, "ro", vars?.("ro")), en: bt(k, "en", vars?.("en")) });
  PACK_LANGS.forEach((l, i) => {
    if (pdfs[l]) files.push({ path: `0${i + 1}-credit-summary-${l}.pdf`, data: pdfs[l], what: both("mf_summary", (ml) => ({ l: bt("lang_" + l, ml) })) });
    else failed.push(l);
  });
  files.push({ path: "03-financial-model.xlsx", data: buildWorkbook(model, xlsxLang, { generatedAt, date }), what: both("mf_model") });
  files.push({ path: "04-permit-checklist.csv", data: permitCsv(pl, todayKey, documents), what: both("mf_permits") });
  // the documents in checklist order, each in its item's folder
  const docs = [...documents].filter((d) => d && d.data).sort((a, b) => ITEM_IDS.indexOf(a.item_id) - ITEM_IDS.indexOf(b.item_id));
  packPaths(docs).forEach((path, i) => {
    const item = ITEM_IDS.includes(docs[i].item_id) ? docs[i].item_id : "other";
    files.push({ path, data: docs[i].data, what: { ro: plt("pm_" + item, "ro"), en: plt("pm_" + item, "en") } });
  });
  const checks = preflight({ plant: pl, docs: documents.map((d) => ({ item_id: d.item_id, name: d.name, size: d.data?.length ?? 0 })), todayKey });
  const manifest = packManifestDocx({ plant: pl, model, files, failed, company, generatedAt, todayKey, docs, docFailed, reportId: reportId(model, generatedAt), checks });
  const all = [{ path: "00-MANIFEST.docx", data: manifest }, ...files];
  const bytes = zip(all.map((f) => ({ name: `${name}/${f.path}`, data: f.data })), { date });
  return { bytes, filename: `${name}-bank-pack.zip`, files: all.map((f) => f.path), failed };
}
