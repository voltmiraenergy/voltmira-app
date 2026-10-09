// lib/energyBasis.js — the one-line account of where a plant's P90 spread
// comes from, for the credit summary and the editor: the study's own P50 and
// P90, the site's measured weather variability with the assumed parts around
// it, every part assumed, or the screening estimate's assumption. The full
// table is components/portfolio/EnergyBasis.jsx. Pure.
import { plt } from "./plantText.js";
import { num, dscr } from "./portfolioFormat.js";
import { plantExport } from "./plantFinance.js";

const pct = (v, lang) => num(v, lang, 1);

/**
 * @param {{wind: object|null, solar: object|null}} en  lib/plantFinance.js plantEnergy()
 * @param {{variabilityPct?:number, variabilityDb?:string, variabilityYears?:string}|null} [solar]  the plant's solar part, for the site's figures
 * @returns {string}
 */
export function basisLine(en, lang = "en", solar = null) {
  const one = (label, key, vars) => `${label}: ${plt(key, lang, vars)}`;
  const out = [];
  if (en?.wind && en.wind.p50Mwh > 0) {
    const w = en.wind;
    out.push(w.source === "study" ? one(plt("c_wind", lang), "p90_line_study", { x: pct(w.sigmaPct, lang) })
      : one(plt("c_wind", lang), "p90_line_screen", { x: pct(w.sigmaPct, lang) }));
  }
  if (en?.solar && en.solar.p50Mwh > 0) {
    const s = en.solar;
    const label = plt("c_solar", lang);
    out.push(s.sigmaBasis === "study" ? one(label, "p90_line_study", { x: pct(s.sigmaPct, lang) })
      : s.sigmaBasis === "site" ? one(label, "p90_line_site", { x: pct(s.sigmaPct, lang), sd: pct(solar?.variabilityPct, lang), db: solar?.variabilityDb || "", years: solar?.variabilityYears || "" })
        : one(label, "p90_line_assumed", { x: pct(s.sigmaPct, lang) }));
  }
  return out.join("; ");
}

const LOC = { en: "en-GB", ro: "ro-RO", ru: "ru-RU", uk: "uk-UA" };
/** A month's name in the reader's language: 1 -> "December"; `short` for a column head. */
export function monthName(m, lang = "en", short = false) {
  const s = new Intl.DateTimeFormat(LOC[lang] || LOC.en, { month: short ? "short" : "long", timeZone: "UTC" }).format(new Date(Date.UTC(2026, m - 1, 15)));
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/**
 * The seasonal cover (lib/monthlyCover.js) as one sentence.
 * @param {object} mc  monthlyCover()  @param {(v:number)=>string} eur  money with its currency
 */
export function monthlyLine(mc, lang = "en", eur = (v) => String(Math.round(v))) {
  const c = (v) => dscr(v, lang).replace(/x$/, "");
  const base = { y: mc.year, mon: monthName(mc.lowMonth.m, lang), m: c(mc.lowMonth.cover), q: plt("mc_q", lang, { q: mc.lowQuarter.q }), qc: c(mc.lowQuarter.cover) };
  if (!(mc.monthsBelow > 0)) return plt("mc_line_ok", lang, base);
  const res = mc.reserveEur > 0 ? plt(mc.covered ? "mc_res_ok" : "mc_res_short", lang, { eur: eur(mc.reserveEur) }) : plt("mc_res_none", lang);
  return plt("mc_line", lang, { ...base, eur: eur(mc.bridgeEur), res });
}

/** The weather replay (lib/weatherReplay.js) as one sentence. @param {object} r  weatherReplay() */
export function replayLine(r, lang = "en") {
  return plt("wr_line", lang, {
    range: r.range, db: r.db || "PVGIS", y: r.worst.y, pct: num(r.worst.pct, lang, 1),
    worst: dscr(r.worst.dscrMin, lang).replace(/x$/, ""), base: dscr(r.base, lang).replace(/x$/, ""), n: r.below, total: r.total,
  });
}

/**
 * The public datasets behind a plant's figures, with their versions and
 * periods, one line each, for the credit summary's basis.
 * @param {object} pl  a normalised plant
 */
export function dataSourceLines(pl, lang = "en") {
  const out = [];
  if (pl?.solar && pl.solar.yieldSource === "pvgis" && pl.solar.yieldKwhKwp > 0) {
    out.push(pl.solar.variabilityDb && pl.solar.variabilityYears
      ? plt("ds_pvgis", lang, { db: pl.solar.variabilityDb, years: pl.solar.variabilityYears })
      : plt("ds_pvgis_plain", lang));
  }
  const sc = pl?.wind?.screening;
  if (sc?.hist) out.push(plt(sc.climMean ? "ds_wind" : "ds_wind_year", lang, { year: sc.year || "", at: sc.at || "" }));
  if (pl?.grid?.fetched) out.push(plt("ds_osm", lang, { at: pl.grid.fetched }));
  return out;
}

/**
 * A solar plant's export limit and what it clips, as sentences: DC/AC, the
 * limit and what sets it, the clipped energy and the revenue it costs, and
 * where the figure cannot be given, why. Nothing for a plant with no solar,
 * or (unless `hint`) with no limit set.
 * @param {object} pl  a normalised plant
 * @param {(v:number)=>string} eur  money with its currency
 * @param {{ hint?: boolean, short?: boolean }} [o]  hint: say what to enter when no limit is set; short: leave out the floor and battery remarks
 * @returns {string[]}
 */
export function exportLines(pl, lang = "en", eur = (v) => String(Math.round(v)), { hint = false, short = false } = {}) {
  const ex = plantExport(pl);
  if (!ex) return [];
  if (short) {
    // one sentence for the credit summary: DC/AC, the limit, and the clipped share where it can be given
    if (ex.limitMw == null || ex.inStudy) return ex.acMw ? [plt("ex_short_limit", lang, { r: num(ex.dcAc, lang, 2), limit: num(ex.limitMw ?? ex.acMw, lang, 1), by: plt("ex_by_ac", lang) })] : [];
    const v = { r: num(ex.dcAc, lang, 2), limit: num(ex.limitMw, lang, 1), by: plt(ex.bindsOn === "ac" ? "ex_by_ac" : "ex_by_grid", lang), pct: num(ex.clipPct ?? 0, lang, 1), mwh: num(ex.clipMwh ?? 0, lang, 0) };
    if (ex.clipPct == null) return [plt("ex_short_limit", lang, v)];
    return [plt(ex.acMw ? "ex_short" : "ex_short_nodc", lang, v)];
  }
  const out = [];
  if (ex.acMw) out.push(plt("ex_dcac", lang, { dc: num(ex.dcMw, lang, 1), ac: num(ex.acMw, lang, 1), r: num(ex.dcAc, lang, 2) }));
  if (ex.limitMw == null) {
    if (hint) out.push(plt("ex_none", lang));
    return out;
  }
  out.push(plt("ex_limit", lang, { limit: num(ex.limitMw, lang, 1), by: plt(ex.bindsOn === "ac" ? "ex_by_ac" : "ex_by_grid", lang) }));
  if (ex.inStudy) { out.push(plt("ex_study", lang)); return out; }
  if (ex.clipPct == null) { out.push(plt("ex_nocurve", lang)); return out; }
  if (ex.clipPct < 0.05) { out.push(plt("ex_clip_none", lang)); return out; }
  const price = pl.revenue?.priceEurMwh > 0 ? pl.revenue.priceEurMwh : 0;
  const v = { pct: num(ex.clipPct, lang, 1), mwh: num(ex.clipMwh, lang, 0), eur: eur(ex.clipMwh * price) };
  out.push(plt(price > 0 ? "ex_clip" : "ex_clip_noeur", lang, v));
  if (!short && ex.floor) out.push(plt("ex_floor", lang));
  if (!short && ex.clipPct >= 2 && !pl.bess) out.push(plt("ex_battery", lang));
  return out;
}

/** The basis of the clipping figure (the curve's year and database), or "" where none is taken off. */
export function exportNote(pl, lang = "en") {
  const ex = pl?.solar ? plantExport(pl) : null;
  const c = pl?.solar?.clipCurve;
  if (!ex || ex.limitMw == null || ex.inStudy || ex.clipPct == null || !c) return "";
  return plt("ex_note", lang, { db: c.db || "PVGIS", year: c.year || "" });
}
