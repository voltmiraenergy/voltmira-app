// lib/dialCodes.js — the countries a sign-up's phone can be in, with their calling codes (ITU-T E.164), Moldova first
// and its neighbours next, then Europe and the places installers' families work. Names come from the browser in the
// page's language (Intl.DisplayNames), so nothing here is translated by hand. Pure.

// [ISO 3166 code, calling code without +]
export const DIAL = [
  ["MD", "373"], ["RO", "40"], ["UA", "380"],
  ["IT", "39"], ["DE", "49"], ["FR", "33"], ["ES", "34"], ["PT", "351"], ["GB", "44"], ["IE", "353"],
  ["PL", "48"], ["CZ", "420"], ["SK", "421"], ["HU", "36"], ["BG", "359"], ["GR", "30"], ["TR", "90"],
  ["AT", "43"], ["CH", "41"], ["BE", "32"], ["NL", "31"], ["LU", "352"], ["DK", "45"], ["SE", "46"],
  ["NO", "47"], ["FI", "358"], ["IS", "354"], ["EE", "372"], ["LV", "371"], ["LT", "370"], ["SI", "386"],
  ["HR", "385"], ["RS", "381"], ["BA", "387"], ["ME", "382"], ["MK", "389"], ["AL", "355"], ["CY", "357"],
  ["MT", "356"], ["GE", "995"], ["AM", "374"], ["AZ", "994"], ["BY", "375"], ["RU", "7"], ["KZ", "7"],
  ["IL", "972"], ["AE", "971"], ["SA", "966"], ["QA", "974"], ["EG", "20"], ["ZA", "27"],
  ["US", "1"], ["CA", "1"], ["MX", "52"], ["BR", "55"], ["AR", "54"],
  ["CN", "86"], ["IN", "91"], ["JP", "81"], ["KR", "82"], ["AU", "61"],
];

const LOC = { en: "en-GB", ro: "ro-RO", ru: "ru-RU", uk: "uk-UA" };

/** The country's name in the page's language ("Republica Moldova"), else its code. */
export function countryLabel(iso, lang = "ro") {
  try { return new Intl.DisplayNames([LOC[lang] || "ro-RO"], { type: "region" }).of(iso) || iso; } catch { return iso; }
}

/** The countries matching what was typed: "+373", "373", "mold", "MD". An empty query gives them all. */
export function searchDial(q, lang = "ro") {
  const s = String(q || "").trim().toLowerCase();
  if (!s) return DIAL;
  const digits = s.replace(/^\+/, "").replace(/\s+/g, "");
  if (/^\d+$/.test(digits)) return DIAL.filter(([, code]) => code.startsWith(digits) || digits.startsWith(code));
  return DIAL.filter(([iso]) => iso.toLowerCase() === s || countryLabel(iso, lang).toLowerCase().includes(s) || countryLabel(iso, "en").toLowerCase().includes(s));
}

/** The default country by the page's language: Ukrainian means Ukraine, everything else Moldova. */
export const defaultIso = (lang) => (lang === "uk" ? "UA" : "MD");

/**
 * A number typed or pasted with its code ("+40 721 234 567", "0040...") read into the country and the rest;
 * null when it carries no code. The longest code wins (+373 before +37...).
 */
export function splitIntl(raw) {
  const s = String(raw || "").trim();
  let d = s.replace(/\D/g, "");
  if (s.startsWith("+")) { /* digits as they are */ } else if (d.startsWith("00")) d = d.slice(2); else return null;
  const hit = [...DIAL].sort((a, b) => b[1].length - a[1].length).find(([, code]) => d.startsWith(code));
  return hit ? { iso: hit[0], national: d.slice(hit[1].length) } : null;
}

/**
 * The phone as it is stored: "+37369123456". A national number written the local way loses its leading 0.
 * Empty when nothing is typed; null when what is typed cannot be a phone (fewer than 6 or more than 12 digits).
 */
export function toE164(iso, national) {
  const code = (DIAL.find(([i]) => i === iso) || DIAL[0])[1];
  const d = String(national || "").replace(/\D/g, "").replace(/^0+/, "");
  if (!d) return "";
  if (d.length < 6 || d.length > 12) return null;
  return "+" + code + d;
}
