// lib/decimals.js - a number with a fixed count of decimals the way the reader writes it ("6,0" in Romanian,
// Russian and Ukrainian, "6.0" in English). toFixed() always prints a point, which sat beside "2,93 lei/kWh".
const LOC = { en: "en-GB", ro: "ro-RO", ru: "ru-RU", uk: "uk-UA" };

/** @param {number} n  @param {number} [d] decimals  @param {string} [lang] */
export function dec(n, d = 1, lang = "ro") {
  const v = Number(n);
  return Number.isFinite(v) ? v.toLocaleString(LOC[lang] || LOC.ro, { minimumFractionDigits: d, maximumFractionDigits: d }) : "";
}
