// lib/portfolioFormat.js — numbers the way a lender reads them: EUR with the
// reader's separators, percentages, and the DSCR as "1.32x". Pure.
const LOC = { en: "en-GB", ro: "ro-RO", ru: "ru-RU", uk: "uk-UA" };
const loc = (lang) => LOC[lang] || LOC.en;

/** 1234567 -> "1,234,567" (EUR is the page's one currency, so no symbol per cell). */
export function eur(v, lang = "en") {
  const n = Number(v);
  if (!Number.isFinite(n)) return "";
  const r = Math.round(n);
  // a real minus sign, as the rest of the app prints money
  return (r < 0 ? "−" : "") + Math.abs(r).toLocaleString(loc(lang));
}

/** 1234567 -> "1.2M", 85000 -> "85k": for axes and tiles. */
export function eurCompact(v, lang = "en") {
  const n = Number(v);
  if (!Number.isFinite(n)) return "";
  const a = Math.abs(n), sign = n < 0 ? "−" : "";
  const f = (x, d = 1) => x.toLocaleString(loc(lang), { maximumFractionDigits: d });
  if (a >= 1e6) return sign + f(a / 1e6, a >= 1e7 ? 0 : 1) + "M";
  if (a >= 1e3) return sign + f(a / 1e3, a >= 1e5 ? 0 : 1) + "k";
  return sign + f(a, 0);
}

export function pct(v, lang = "en", dec = 1) {
  const n = Number(v);
  if (!Number.isFinite(n)) return "";
  const s = (Math.abs(n) * 100).toLocaleString(loc(lang), { minimumFractionDigits: dec, maximumFractionDigits: dec });
  return (n < 0 && s.replace(/[0.,\s]/g, "") !== "" ? "−" : "") + s + "%";
}

export function dscr(v, lang = "en") {
  const n = Number(v);
  return Number.isFinite(n) ? n.toLocaleString(loc(lang), { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + "x" : "";
}

export function num(v, lang = "en", dec = 1) {
  const n = Number(v);
  return Number.isFinite(n) ? n.toLocaleString(loc(lang), { minimumFractionDigits: 0, maximumFractionDigits: dec }) : "";
}

/** The energy unit in the reader's language. */
export const mwhUnit = (lang) => ({ ru: "МВт·ч", uk: "МВт·год" }[lang] || "MWh");
export const kwpUnit = (lang) => (lang === "ru" || lang === "uk" ? "кВт" : "kWp");

/** low / medium / high / unknown for a DSCR-style number, by lender-style rules of thumb. */
export function dscrTone(v) {
  if (v == null || !Number.isFinite(Number(v))) return "none";
  return v >= 1.3 ? "good" : v >= 1.0 ? "warn" : "bad";
}
