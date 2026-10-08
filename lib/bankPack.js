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
import { normalizePlant, plantEnergy } from "./plantFinance.js";
import { permitProgress } from "./plantPermits.js";
import { siteDrift } from "./sitePick.js";
import { chosenPoint, gridSummary, connectionEstimate } from "./gridNear.js";
import { num } from "./portfolioFormat.js";
import { PLANTS_KEY } from "./portfolioModel.js";
import { toCsv, buildWorkbook } from "./portfolioExport.js";
import { plt } from "./plantText.js";
import { bt } from "./bankText.js";
import { zip } from "./zip.js";
import { ITEM_IDS, packPaths, docCounts } from "./dealRoom.js";
import { sha256 } from "./sha256.js";
import { reportId } from "./reportId.js";
import { preflight } from "./preflight.js";
import { checkText } from "./preflightText.js";

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
  const manifest = packManifest({ plant: pl, files, failed, company, generatedAt, todayKey, docs, docFailed, reportId: reportId(model, generatedAt), checks });
  const all = [{ path: "00-MANIFEST.txt", data: manifest }, ...files];
  const bytes = zip(all.map((f) => ({ name: `${name}/${f.path}`, data: f.data })), { date });
  return { bytes, filename: `${name}-bank-pack.zip`, files: all.map((f) => f.path), failed };
}
