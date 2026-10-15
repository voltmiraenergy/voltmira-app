// lib/studyPages.js — which pages of an energy yield study to read. A wind or
// solar study runs to a hundred pages or more; its figures sit on a few of
// them (the summary, the results table, the uncertainty). The browser reads
// the PDF's text (components/portfolio/StudyReader.jsx), this picks the first
// page (the consultant and the date) and the pages that talk about P50, P90,
// net energy and uncertainty, and only their text is sent to be read. Also:
// checking that a quote the reader gives back is really on its page, and that
// the number it reports is in that quote. Pure; runs in the browser and on
// the server.

/** Words that mark the results pages, in English, Romanian, Russian and Ukrainian, with a weight each. */
const MARKERS = [
  [/\bP\s?50\b/gi, 3],
  [/\bP\s?90\b/gi, 3],
  [/\bP\s?(75|95|99)\b/gi, 1],
  [/\b(AEP|annual energy|energy yield|net (energy|yield|production|output)|long[- ]term (mean )?(energy|production))\b/gi, 2],
  [/(produc[țţ]i[ae] (anual[ăa]|net[ăa])|energi[ae] anual[ăa]|evaluarea produc[țţ]iei)/gi, 2],
  [/(выработк|годово\w* производств|производств\w* энерги)/gi, 2],
  [/(вироблен|річн\w* виробіт|виробіт\w* енергі)/gi, 2],
  [/(uncertaint|incertitudin|неопредел[её]нност|невизначеніст)/gi, 1.5],
  [/\b(GWh|MWh)\b|ГВт|МВт/gi, 1],
  [/(executive summary|summary of results|results summary|rezumat|concluzi|резюме|висновк)/gi, 1.5],
  [/(hub height|[îi]n[ăa]l[țţ]ime\w* butuc|высот\w* ступиц|висот\w* маточин)/gi, 1],
  [/\b(loss(es)?|pierderi|потер|втрат)/gi, 0.5],
];

/** How strongly a page reads like a results page; each marker counts at most 5 times. */
export function scorePage(text) {
  const s = String(text || "");
  let score = 0;
  for (const [re, w] of MARKERS) score += Math.min(5, (s.match(re) || []).length) * w;
  return score;
}

/** Below this many characters a page has no real text layer (a scan, a drawing, a blank page). */
const PAGE_MIN_CHARS = 80;

/** True when the PDF has text to read; false for a scan, where the pages must be chosen by hand. */
export function hasTextLayer(pages) {
  const list = Array.isArray(pages) ? pages : [];
  const withText = list.filter((t) => String(t || "").replace(/\s+/g, "").length >= PAGE_MIN_CHARS).length;
  return list.length > 0 && withText >= Math.max(1, Math.ceil(list.length * 0.3));
}

export const MAX_PAGES = 12;
export const MAX_PAGE_CHARS = 7000;

/**
 * The pages to send, in page order: the first page (who wrote it, when) and
 * the best results pages, up to `max`. Page numbers start at 1.
 * @param {string[]} pages  the text of each page
 */
export function pickPages(pages, { max = MAX_PAGES } = {}) {
  const list = Array.isArray(pages) ? pages : [];
  if (!list.length) return [];
  const scored = list.map((t, i) => ({ n: i + 1, s: scorePage(t) })).filter((x) => x.n !== 1 && x.s > 0)
    .sort((a, b) => b.s - a.s || a.n - b.n);
  const out = new Set([1]);
  for (const x of scored) { if (out.size >= max) break; out.add(x.n); }
  return [...out].sort((a, b) => a - b);
}

/** The picked pages as one text, each opened by its marker, as the reader is told to cite them. */
export function pagesText(pages) {
  return pages.map((p) => `=== Page ${p.n} ===\n${String(p.text || "").slice(0, MAX_PAGE_CHARS)}`).join("\n\n");
}

/**
 * Pages typed by hand for a scan: "4-9, 12" -> [4,5,6,7,8,9,12], within the
 * document, at most `max`. Null when nothing valid was typed.
 */
export function parseRange(s, total, max = 15) {
  const out = new Set();
  for (const part of String(s || "").split(/[,;\s]+/).filter(Boolean)) {
    const m = part.match(/^(\d+)(?:[-–](\d+))?$/);
    if (!m) return null;
    const a = Number(m[1]), b = Number(m[2] || m[1]);
    if (!(a >= 1) || b < a) return null;
    for (let n = a; n <= b && n <= total; n++) out.add(n);
  }
  const list = [...out].sort((x, y) => x - y);
  return list.length && list.length <= max ? list : null;
}

/** Text compared without spaces, case, or the typographic variants a PDF's text layer brings. */
const flat = (s) => String(s || "").toLowerCase()
  .replace(/[‘’‚‛]/g, "'").replace(/[“”„‟]/g, '"')
  .replace(/[‐-―−]/g, "-").replace(/[ţ]/g, "ț").replace(/[ş]/g, "ș")
  .replace(/\s+/g, "");

/** The reader's quote is really printed on that page. */
export function quoteOnPage(quote, pageText) {
  const q = flat(quote);
  return q.length >= 4 && flat(pageText).includes(q);
}

/** Every number in a piece of text, read with either decimal mark and any thousands separator. */
export function numbersIn(text) {
  const out = [];
  for (const m of String(text || "").matchAll(/\d[\d\s.,'  ]*\d|\d/g)) {
    let s = m[0].replace(/[\s'  ]/g, "");
    const lastDot = s.lastIndexOf("."), lastComma = s.lastIndexOf(",");
    const cands = new Set();
    // the last mark as the decimal point, the others as thousands separators
    if (lastDot > lastComma) cands.add(s.replace(/,/g, ""));
    else if (lastComma > lastDot) cands.add(s.replace(/\./g, "").replace(",", "."));
    else cands.add(s);
    // "153,300" or "153.300" may be thousands too
    if (/^\d{1,3}([.,]\d{3})+$/.test(s)) cands.add(s.replace(/[.,]/g, ""));
    for (const c of cands) { const n = Number(c); if (Number.isFinite(n)) out.push(n); }
  }
  return out;
}

/** The value the reader reports is one of the numbers in its quote (within 0.5%). */
export function valueInQuote(value, quote) {
  const v = Number(value);
  if (!Number.isFinite(v)) return false;
  return numbersIn(quote).some((n) => (v === 0 ? n === 0 : Math.abs(n - v) / Math.abs(v) <= 0.005));
}
