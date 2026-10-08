// lib/portfolioReadiness.js — how ready this portfolio is to show a lender,
// as one score out of 100, and the concrete steps that raise it, biggest gain
// first. Pure; no I/O. Every point comes from data the portfolio holds; nothing
// is estimated, and the rule is shown beside the score.
//
// THE RULE. Four parts, each scored 0 to 1, weighted:
//   papers      35  the document register: done = 1, draft = half, missing = 0,
//                   averaged over every asset and every paper
//   debt cover  25  half for the lowest P50 DSCR at or above its target, half
//                   for the lowest P90 DSCR at or above its target
//                   (left out when the portfolio carries no debt)
//   screening   20  E&S questions answered Yes or Not applicable, over all the
//                   questions; an open question or a No scores nothing
//   inputs      20  the average of the checks that apply: site yield looked up,
//                   the contractor's own capex entered, the site located on the
//                   map (each as a share of the assets), loan terms from a
//                   published programme or a term sheet (when there is debt or a
//                   grant), and a war-risk insurance premium entered (when an
//                   asset is in Ukraine)
// A part that does not apply is left out and the rest are rescaled to 100.
// The thresholds are this tool's, not a lender's: a lender has its own list.
import { DOC_KEYS, docReadiness } from "./portfolio.js";

export const READINESS_WEIGHTS = { papers: 35, cover: 25, screening: 20, inputs: 20 };

const share = (list, fn) => (list.length ? list.filter(fn).length / list.length : 0);

/**
 * @param {object} a
 * @param {Array} a.assets       model assets (docs, kw, market, hasSiteYield, capexOverrideEur, lat, lon, name)
 * @param {object} a.fin         normalised finance (gearingPct, grantPct)
 * @param {object} a.scenario    normalised scenario (warRiskPremiumPct)
 * @param {{p50:number|null, p90:number|null}} a.dscr   lowest pooled DSCR at P50 and P90
 * @param {{p50Dscr:number, p90Dscr:number, recommendedGearingPct?:number|null}} a.sizing
 * @param {{total:number, yes:number, na:number, no:number, open:number}} a.screening
 * @param {boolean} a.termsSourced  terms come from a published programme or a term sheet
 */
export function readiness({ assets = [], fin = {}, scenario = {}, dscr = {}, sizing = {}, screening = {}, termsSourced = false }) {
  const n = assets.length;
  const parts = [];
  const actions = [];

  // ---- papers
  const papers = n ? assets.reduce((s, a) => s + docReadiness(a.docs), 0) / n : null;
  parts.push({ id: "papers", weight: READINESS_WEIGHTS.papers, value: papers });

  // ---- debt cover
  const hasDebt = Number(fin.gearingPct) > 0;
  const p50ok = dscr.p50 != null && dscr.p50 >= sizing.p50Dscr - 1e-9;
  const p90ok = dscr.p90 != null && dscr.p90 >= sizing.p90Dscr - 1e-9;
  parts.push({ id: "cover", weight: READINESS_WEIGHTS.cover, value: n && hasDebt ? (p50ok ? 0.5 : 0) + (p90ok ? 0.5 : 0) : null });

  // ---- screening
  const total = Number(screening.total) || 0;
  parts.push({ id: "screening", weight: READINESS_WEIGHTS.screening, value: total ? ((screening.yes || 0) + (screening.na || 0)) / total : null });

  // ---- inputs
  const checks = [];
  if (n) {
    checks.push({ id: "yield", value: share(assets, (a) => a.hasSiteYield), missing: assets.filter((a) => !a.hasSiteYield) });
    checks.push({ id: "capex", value: share(assets, (a) => a.capexOverrideEur > 0), missing: assets.filter((a) => !(a.capexOverrideEur > 0)) });
    checks.push({ id: "location", value: share(assets, (a) => a.lat != null && a.lon != null), missing: assets.filter((a) => a.lat == null || a.lon == null) });
    if (hasDebt || Number(fin.grantPct) > 0) checks.push({ id: "terms", value: termsSourced ? 1 : 0, missing: [] });
    if (assets.some((a) => a.market === "UA")) checks.push({ id: "war", value: Number(scenario.warRiskPremiumPct) > 0 ? 1 : 0, missing: [] });
  }
  parts.push({ id: "inputs", weight: READINESS_WEIGHTS.inputs, value: checks.length ? checks.reduce((s, c) => s + c.value, 0) / checks.length : null, checks: checks.map(({ id, value }) => ({ id, value })) });

  const live = parts.filter((p) => p.value != null);
  const wSum = live.reduce((s, p) => s + p.weight, 0);
  const pts = (weight) => (wSum ? (weight / wSum) * 100 : 0);       // what a whole part is worth on the 100 scale
  for (const p of parts) {
    p.max = p.value == null ? 0 : pts(p.weight);
    p.points = p.value == null ? 0 : p.value * p.max;
  }
  const score = wSum ? live.reduce((s, p) => s + p.value * p.weight, 0) / wSum * 100 : 0;

  // ---- actions, each with the points it would add
  if (n) {
    const perDoc = pts(READINESS_WEIGHTS.papers) / (DOC_KEYS.length * n);
    for (const k of DOC_KEYS) {
      for (const state of ["missing", "draft"]) {
        const which = assets.filter((a) => (a.docs?.[k] === "draft" ? "draft" : a.docs?.[k] === "done" ? "done" : "missing") === state);
        if (!which.length) continue;
        actions.push({ id: `doc_${k}_${state}`, key: state === "draft" ? "act_draft_" + k : "act_doc_" + k, names: which.map((a) => a.name), n: which.length,
          gain: which.length * perDoc * (state === "draft" ? 0.5 : 1) });
      }
    }
    if (hasDebt) {
      const half = pts(READINESS_WEIGHTS.cover) / 2;
      if (!p50ok && dscr.p50 != null) actions.push({ id: "cover_p50", key: "act_cover_p50", vars: { x: dscr.p50, t: sizing.p50Dscr, g: sizing.recommendedGearingPct }, gain: half });
      if (!p90ok && dscr.p90 != null) actions.push({ id: "cover_p90", key: "act_cover_p90", vars: { x: dscr.p90, t: sizing.p90Dscr, g: sizing.recommendedGearingPct }, gain: half });
    }
    if (total) {
      const per = pts(READINESS_WEIGHTS.screening) / total;
      if (screening.open > 0) actions.push({ id: "es_open", key: "act_es_open", n: screening.open, gain: screening.open * per });
      if (screening.no > 0) actions.push({ id: "es_no", key: "act_es_no", n: screening.no, gain: screening.no * per });
    }
    const perCheck = checks.length ? pts(READINESS_WEIGHTS.inputs) / checks.length : 0;
    for (const c of checks) {
      if (c.value >= 1 - 1e-9) continue;
      actions.push({ id: "in_" + c.id, key: "act_in_" + c.id, names: c.missing.map((a) => a.name), n: c.missing.length, gain: (1 - c.value) * perCheck });
    }
  }
  actions.sort((a, b) => b.gain - a.gain);
  return { score, parts, actions, weightSum: wSum };
}
