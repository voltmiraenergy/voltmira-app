// lib/publicPage.js — the installer's public estimate page (/estimate/[slug]): its address and its colour.
// Pure, no I/O.

const RESERVED = new Set(["admin", "api", "app", "demo", "estimate", "login", "new", "settings", "voltmira", "widget", "www"]);

/** A page address as kept: lowercase letters, digits and single hyphens, 3 to 40 long, or "" when it cannot be one. */
export function cleanSlug(raw) {
  const s = String(raw || "")
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40).replace(/-+$/, "");
  if (s.length < 3 || RESERVED.has(s)) return "";
  return s;
}

/** A first page address from the company name ("SolarTech Chișinău SRL" -> "solartech-chisinau"). */
export function slugFromName(name) {
  const base = String(name || "").replace(/\b(s\.?r\.?l\.?|ii|s\.?a\.?|ltd|llc)\b/gi, " ");
  return cleanSlug(base);
}

/** A colour as kept: "#rrggbb", or "" when it is not one. */
export function cleanColor(raw) {
  const s = String(raw || "").trim();
  return /^#[0-9a-fA-F]{6}$/.test(s) ? s.toLowerCase() : "";
}

/** Dark or light text on a colour, whichever reads better (WCAG relative luminance). */
export function textOn(hex) {
  const c = cleanColor(hex);
  if (!c) return "#ffffff";
  const ch = [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  const lum = 0.2126 * ch[0] + 0.7152 * ch[1] + 0.0722 * ch[2];
  // contrast against white vs against the app's ink
  return (1.05 / (lum + 0.05)) >= ((lum + 0.05) / 0.0367) ? "#ffffff" : "#142A21";
}

/** The page's language: an explicit ?lang, else the browser's first supported one, else the installer's. */
export function pageLang({ asked, acceptLanguage, fallback, langs = ["ro", "ru", "en", "uk"] }) {
  if (langs.includes(asked)) return asked;
  const wanted = String(acceptLanguage || "").split(",").map((p) => p.trim().split(";")[0].slice(0, 2).toLowerCase());
  return wanted.find((l) => langs.includes(l)) || (langs.includes(fallback) ? fallback : "ro");
}
