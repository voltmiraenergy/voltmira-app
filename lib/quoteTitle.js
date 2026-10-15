// lib/quoteTitle.js — the title a quote starts with.
//
// It used to be the table default, "New quote", in English whatever language the workspace
// speaks, so a Romanian installer saw an English title on every fresh quote. A new quote now
// starts with the workspace language's own words, and the proposal and the PDF still treat
// the default, in any language, as "no title yet" (they describe the system instead).
import { t, normLang } from "./i18n.js";

const LANGS = ["en", "ro", "ru", "uk"];

/** The title a new quote gets in this workspace language. */
export function defaultQuoteTitle(lang) {
  return t("btn_new_quote", normLang(lang));
}

/** True for an empty title or the default one, in any of the four languages. */
export function isPlaceholderTitle(title) {
  const s = String(title || "").trim().toLowerCase();
  if (!s) return true;
  return s === "new quote" || LANGS.some((l) => t("btn_new_quote", l).trim().toLowerCase() === s);
}
