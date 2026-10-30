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

/** A quote named after its client and size, "Ion Popescu, 6 kW" ("6,5 kW" outside English); null without a client. */
export function autoQuoteTitle({ client, kw }, lang = "ro") {
  const name = String(client || "").trim().replace(/\s+/g, " ").slice(0, 80);
  if (!name) return null;
  const k = Number(kw);
  if (!(k > 0)) return name;
  const n = (Math.round(k * 10) / 10).toLocaleString(normLang(lang) === "en" ? "en-GB" : "ro-RO", { maximumFractionDigits: 1 });
  return `${name}, ${n} kW`;
}

/**
 * The title after an edit of the client or the size: the new automatic name while the title is still one the
 * app chose (empty, "New quote", the client's bare name a lead gave it, or the previous automatic name), else
 * null, so a title the installer typed is never replaced.
 */
export function nextAutoTitle(prev, next, lang = "ro") {
  if (prev.client === next.client && Number(prev.kw) === Number(next.kw)) return null;
  const t0 = String(prev.title || "").trim();
  const ours = isPlaceholderTitle(t0) || t0 === String(prev.client || "").trim() || t0 === autoQuoteTitle(prev, lang);
  if (!ours) return null;
  const t1 = autoQuoteTitle(next, lang);
  return t1 && t1 !== t0 ? t1 : null;
}
