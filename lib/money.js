// lib/money.js — money and numbers the way the reader expects them.
//
// The engine calculates in EUR (engine/engine.js). A Moldovan homeowner, and
// the installer quoting them, think in lei: "224.740 lei", not "€11.300". This
// turns an EUR figure into the workspace's currency at the given rate (the
// rate frozen with a proposal, or today's), formatted for the language, with
// Romanian and Russian decimal commas ("11,4 ani").
//
// MDL, RON and UAH convert; anything else stays EUR. Pure, no I/O.
import { FX } from "../engine/engine.js";

const LOC = { en: "en-GB", ro: "ro-RO", ru: "ru-RU", uk: "uk-UA" };
const LOCAL = ["MDL", "RON", "UAH"];
// What follows the amount, per currency and reading language.
const UNITS = {
  MDL: { en: "lei", ro: "lei", ru: "лей", uk: "лей" },
  RON: { en: "lei", ro: "lei", ru: "лей", uk: "лей" },
  UAH: { en: "UAH", ro: "UAH", ru: "грн", uk: "грн" },
};
const KWH = { uk: "кВт·год", ru: "кВт·ч" };
const THOUSAND = { en: "k", ro: " mii", ru: " тыс.", uk: " тис." };
const MILLION = { en: "M", ro: " mil.", ru: " млн", uk: " млн" };

/** Lei (or EUR) per 1 EUR: the frozen/live rate when given, else the engine's table. */
export function rateFor(currency, fx) {
  if (!LOCAL.includes(currency)) return 1;
  const live = Number(fx?.[currency]);
  return live > 0 ? live : FX[currency];
}

/** A number in the reader's locale: 11.4 -> "11,4" in Romanian. */
export function numFor(lang) {
  const loc = LOC[lang] || LOC.en;
  return (n, dec = 1) => (Number.isFinite(Number(n))
    ? Number(n).toLocaleString(loc, { minimumFractionDigits: dec, maximumFractionDigits: dec })
    : "");
}

/**
 * fmt(eur) -> "224.740 lei" | "€11,300". Also:
 *   fmt.compact(eur)   "78,8 mii lei" | "€78.8k"
 *   fmt.perKwh(eur)    "4,16 lei/kWh" | "€0.210/kWh"
 *   fmt.toLocal(eur) / fmt.fromLocal(v)   for inputs typed in the local currency
 *   fmt.currency, fmt.rate, fmt.unit, fmt.local (true for lei and hryvnia)
 */
export function moneyFormatter({ currency = "EUR", lang = "en", fx = null } = {}) {
  const cur = LOCAL.includes(currency) ? currency : "EUR";
  const rate = rateFor(cur, fx);
  const loc = LOC[lang] || LOC.en;
  const local = cur !== "EUR";
  const unit = local ? (UNITS[cur][lang] || UNITS[cur].en) : "€";
  const n = (v, dec) => Math.abs(v).toLocaleString(loc, { minimumFractionDigits: dec, maximumFractionDigits: dec });
  // a minus ahead of the symbol, never "€-31"
  const sign = (v) => (v < 0 ? "−" : "");

  const fmt = (eur, { dec = 0 } = {}) => {
    const v = (Number(eur) || 0) * rate;
    return local ? `${sign(v)}${n(v, dec)} ${unit}` : `${sign(v)}€${n(v, dec)}`;
  };
  fmt.compact = (eur) => {
    const v = (Number(eur) || 0) * rate, a = Math.abs(v);
    if (a < 1000) return fmt(eur);
    const [div, suf] = a >= 1e6 ? [1e6, MILLION[lang] || MILLION.en] : [1e3, THOUSAND[lang] || THOUSAND.en];
    const s = (a / div).toLocaleString(loc, { maximumFractionDigits: a / div >= 100 ? 0 : 1 });
    return local ? `${sign(v)}${s}${suf} ${unit}` : `${sign(v)}€${s}${suf.trim()}`;
  };
  fmt.perKwh = (eur) => {
    const v = (Number(eur) || 0) * rate;
    return local ? `${n(v, 2)} ${unit}/${KWH[lang] || "kWh"}` : `€${n(v, 3)}/kWh`;
  };
  fmt.toLocal = (eur) => (Number(eur) || 0) * rate;
  fmt.fromLocal = (v) => (Number(v) || 0) / rate;
  fmt.currency = cur;
  fmt.rate = rate;
  fmt.unit = unit;
  fmt.local = local;
  return fmt;
}
