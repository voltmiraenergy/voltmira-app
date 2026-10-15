// lib/pageTitle.js — the browser-tab title of an app page, in the workspace's
// language. Every page used to export a fixed English title ("Quotes |
// VoltMira"), so a Romanian or Ukrainian installer read English in every tab.
//
//   export const generateMetadata = appTitle("nav_leads");
//   export const generateMetadata = appTitle((lang) => pt("nav", lang));
//
// currentCompany() is React-cached per request, so the page and its title share
// one lookup. A failed lookup falls back to English rather than breaking the page.
import { t, normLang } from "./i18n.js";
import { currentCompany } from "./session.js";

export function appTitle(label, extra = {}) {
  return async function generateMetadata() {
    let lang = "en";
    try { lang = normLang((await currentCompany())?.lang); } catch { /* English */ }
    const text = typeof label === "function" ? label(lang) : t(label, lang);
    return { title: `${text} | VoltMira`, ...extra };
  };
}
