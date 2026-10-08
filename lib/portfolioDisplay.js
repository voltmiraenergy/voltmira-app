// lib/portfolioDisplay.js — sentences built from the model, shared by the page,
// the PDF report and the investor teaser so they say the same thing in the
// same words: the readiness steps, the key messages, the exchange-rate note,
// the labels of the sensitivity drivers and of the financing structures. Pure.
import { pt } from "./portfolioText.js";
import { dscr, pct, fxRate, num } from "./portfolioFormat.js";
import { FINANCING_PRESETS } from "./financingPresets.js";

/**
 * "School", "School and Winery", "School, Winery and 3 more". Names that carry
 * their own comma ("Casa Rusu, Chișinău") are separated by semicolons instead,
 * so the list still reads as a list.
 */
export function namesList(names, lang = "en", max = 2) {
  const list = (names || []).filter(Boolean);
  if (list.length <= 1) return list[0] || "";
  const sep = list.some((n) => n.includes(",")) ? "; " : ", ";
  if (list.length <= max + 1) return `${list.slice(0, -1).join(sep)} ${pt("and", lang)} ${list[list.length - 1]}`;
  return pt("names_more", lang, { list: list.slice(0, max).join(sep), k: list.length - max });
}

/** One readiness step as a sentence. */
export function actionText(a, lang = "en") {
  const v = a.vars || {};
  return pt(a.key, lang, {
    a: namesList(a.names, lang),
    n: a.n ?? "",
    x: v.x != null ? dscr(v.x, lang) : "",
    t: v.t != null ? dscr(v.t, lang) : "",
    g: v.g != null ? num(v.g, lang, 1) : "",
  });
}

/** The exchange-rate statement for a display currency, or the plain "all in EUR". */
export function fxNote(lang, cur, fx) {
  if (!cur || cur === "EUR") return pt("all_eur", lang);
  const r = fx?.rates?.[cur];
  const m = fx?.meta?.[cur] || {};
  if (m.live && m.asOf) return pt("fx_note", lang, { cur, rate: fxRate(r, lang), src: m.source || "", date: m.asOf });
  return pt("fx_note_static", lang, { cur, rate: fxRate(r, lang) });
}

/** A tornado driver's label, with the size of its flex. */
export const driverLabel = (id, size, lang = "en") => pt("drv_" + id, lang, { n: size });

/** A financing structure's name: the programme's, the variant's own label, or "Current". */
export function structureName(s, lang = "en") {
  if (s.id === "current") return pt("cmp_current", lang);
  const p = FINANCING_PRESETS.find((x) => x.id === s.preset);
  if (s.label) return s.label;
  return p ? p.name[lang] || p.name.en : pt("cmp_custom", lang);
}

/** The corporate income tax terms in one line: "12% of profit; straight-line over 20 years; losses carried forward 5 years". */
export function taxLine(fin, lang = "en") {
  if (!(fin.taxPct > 0)) return pt("tax_none", lang);
  const loss = fin.taxLossYears > 0 ? pt("tax_loss_n", lang, { n: fin.taxLossYears }) : pt("tax_loss_any", lang);
  return pt("tax_line", lang, { p: num(fin.taxPct, lang, 1), y: fin.taxLifeYears, loss });
}

/** The loan and grant terms of a structure, in one line. */
export function termsLine(fin, lang = "en") {
  const parts = [];
  parts.push(fin.gearingPct > 0 ? pt("cmp_terms_v", lang, { g: num(fin.gearingPct, lang, 1), r: num(fin.ratePct, lang, 2), t: fin.tenorYears }) : pt("cmp_no_loan", lang));
  if (fin.gearingPct > 0 && fin.rateSteps) parts.push(pt("steps_short", lang, { s: fin.rateSteps.join("/") }));
  if (fin.gearingPct > 0 && fin.debtCurrency === "local") parts.push(pt("local_short", lang));
  if (fin.grantPct > 0) parts.push(pt("grant_short", lang, { n: num(fin.grantPct, lang, 1) }));
  if (fin.gearingPct > 0 && fin.principalCompensationPct > 0) parts.push(pt("comp_short", lang, { n: num(fin.principalCompensationPct, lang, 1) }));
  if (fin.constructionMonths > 0) parts.push(pt("build_short", lang, { n: fin.constructionMonths }));
  if (fin.gearingPct > 0 && fin.graceYears > 0) parts.push(pt("grace_short", lang, { n: fin.graceYears }));
  if (fin.gearingPct > 0 && fin.dsraMonths > 0) parts.push(pt("dsra_short", lang, { n: num(fin.dsraMonths, lang, 1) }));
  return parts.join(", ");
}

/**
 * The few sentences a credit officer reads first, each from a model number.
 * @param {object} model  buildModel() output
 * @param {string} lang
 * @param {{full:Function}} money  display-currency formatter
 */
export function keyMessages(model, lang, money) {
  const { agg, p90, sizing, fin, suite, readiness } = model;
  if (!agg.count) return [];
  const out = [];
  const pctCap = sizing.capacityPct == null ? "" : num(sizing.capacityPct, lang, 0);
  const vars = { x: money.full(sizing.capacityEur), pct: pctCap, t50: dscr(sizing.p50Dscr, lang), t90: dscr(sizing.p90Dscr, lang), y: fin.tenorYears };
  if (fin.gearingPct > 0) {
    out.push(pt("msg_capacity", lang, vars) + " " + (sizing.withinCapacity
      ? pt("msg_within", lang, { d: money.full(sizing.currentLoanEur), h: money.full(sizing.headroomEur) })
      : pt("msg_over", lang, { d: money.full(sizing.currentLoanEur), h: money.full(-sizing.headroomEur), g: num(sizing.recommendedGearingPct, lang, 1) })));
    out.push(pt("msg_cover", lang, { p50: agg.dscrMin == null ? pt("na", lang) : dscr(agg.dscrMin, lang), p90: p90.dscrMin == null ? pt("na", lang) : dscr(p90.dscrMin, lang) }));
  } else {
    out.push(pt("msg_nodebt", lang, vars));
  }
  out.push(pt("msg_returns", lang, {
    irr: agg.irr == null ? pt("na", lang) : pct(agg.irr, lang), eirr: agg.equityIrr == null ? pt("na", lang) : pct(agg.equityIrr, lang),
    npv: money.full(agg.npv), d: num(fin.discPct, lang, 1),
  }));
  const combined = suite.find((s) => s.id === "combined");
  if (fin.gearingPct > 0 && combined?.agg.dscrMin != null) out.push(pt("msg_stress", lang, { x: dscr(combined.agg.dscrMin, lang) }));
  if (readiness?.actions?.length) out.push(pt("msg_ready", lang, { s: Math.round(readiness.score), a: actionText(readiness.actions[0], lang) }));
  return out;
}
