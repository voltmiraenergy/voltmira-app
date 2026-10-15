// lib/portfolioPrint.js — what the printed portfolio documents (the report and
// the investor teaser) share: the language, the display currency and its rate,
// the date line, and the A4 page set-up with a running footer and page numbers.
// Pure.
//
// Page numbers use CSS page-margin boxes (@page { @bottom-right { content:
// counter(page) } }), which Chromium prints since version 131; the PDF is
// rendered in Chromium, and a browser that does not support them simply prints
// without numbers.
import { moneyFmt, DISPLAY_CURRENCIES } from "./portfolioFormat.js";
import { pt } from "./portfolioText.js";

export const DOC_LANGS = ["en", "uk", "ro", "ru"];
const LOC = { en: "en-GB", ro: "ro-RO", ru: "ru-RU", uk: "uk-UA" };

/**
 * @param {object} sp  the page's search params (lang, cur, pdf)
 * @param {{fx?:{rates:object}}} d  loadPortfolio() output
 * @param {string} [saved]  the portfolio's own display currency, used when the link names none
 */
export function docSetup(sp, d, saved) {
  const lang = DOC_LANGS.includes(sp?.lang) ? sp.lang : "en";
  const asked = DISPLAY_CURRENCIES.includes(sp?.cur) ? sp.cur : DISPLAY_CURRENCIES.includes(saved) ? saved : "EUR";
  const rate = asked === "EUR" ? 1 : Number(d?.fx?.rates?.[asked]) || Number(d?.E?.fx?.[asked]) || 1;
  const money = moneyFmt(lang, { cur: rate > 0 ? asked : "EUR", rate });
  const date = new Intl.DateTimeFormat(LOC[lang], { day: "numeric", month: "long", year: "numeric" }).format(new Date());
  return { lang, pdf: sp?.pdf === "1", money, date };
}

/** A CSS string literal, safe for any portfolio name. */
const cssString = (s) => `"${String(s || "").replace(/[\\"]/g, " ").replace(/[\r\n]+/g, " ").slice(0, 90)}"`;

/** The print set-up: A4, the app chrome hidden, a footer with the title and "Page n of m", none on the cover. */
export function printCss({ lang, title }) {
  return `
    @media print {
      .sidebar, .skip-link, .demo-bar, .offline-bar, .rp-bar, .rp-fallback { display: none !important; }
      .app { display: block !important; }
      .app .main { margin: 0 !important; padding: 0 !important; width: auto !important; max-width: none !important; }
      /* the page wrapper's own bottom padding would add a blank last page to a document that fills its last sheet */
      .app .view { margin: 0 !important; padding: 0 !important; }
    }
    @page {
      size: A4; margin: 16mm 15mm 18mm;
      @bottom-left { content: ${cssString(title)}; font: 8.5px Inter, sans-serif; color: #5B6A62; }
      @bottom-right { content: ${cssString(pt("r_page", lang) + " ")} counter(page) ${cssString(" " + pt("r_of", lang) + " ")} counter(pages); font: 8.5px Inter, sans-serif; color: #5B6A62; }
    }
    @page :first {
      @bottom-left { content: none; }
      @bottom-right { content: none; }
    }
  `;
}
