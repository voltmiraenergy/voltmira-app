// components/fees/feeFormat.js — numbers, units, months and days as the
// pay-per-signed-job screens print them, in the reader's language.
import { num } from "../../lib/portfolioFormat.js";
import { LOCALE } from "../../lib/relTime.js";
import { fmtDate } from "../../lib/tz.js";

export const leiU = (lang) => (lang === "ru" || lang === "uk" ? "лей" : "lei");
export const kwU = (lang) => (lang === "ru" || lang === "uk" ? "кВт" : "kW");
/** "1.680" in Romanian, "1,680" in English: whole lei. */
export const n0 = (v, lang) => num(Math.round(Number(v) || 0), lang, 0);
export const lei = (v, lang) => `${n0(v, lang)} ${leiU(lang)}`;
export const kw = (v, lang) => `${num(Number(v) || 0, lang, 1)} ${kwU(lang)}`;
/** "8,4": a size without its unit, for a column headed kW. */
export const k1 = (v, lang) => (Number(v) > 0 ? num(Number(v), lang, 1) : "");
/** An exchange rate, four decimals at most. */
export const rate4 = (v, lang) => num(Number(v) || 0, lang, 4);
export const eur2 = (v, lang) => (Number(v) || 0).toLocaleString(LOCALE[lang] || "en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
/** "octombrie 2026" for "2026-10". */
export const monthLabel = (period, lang) => (period
  ? new Date(`${period}-15T12:00:00Z`).toLocaleDateString(LOCALE[lang] || "en-GB", { month: "long", year: "numeric", timeZone: "UTC" })
  : "");
/** "19 oct. 2026", Chisinau time. */
export const dayLabel = (iso, lang) => (iso ? fmtDate(iso, LOCALE[lang] || "en-GB", { day: "numeric", month: "short", year: "numeric" }) : "");
