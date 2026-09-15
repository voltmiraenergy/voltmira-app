// lib/landing.js — renders the marketing homepage in a given language ON THE
// SERVER, so search engines receive real Romanian and Russian documents.
//
// THE PROBLEM THIS SOLVES. The page declared hreflang alternates for en / ro /
// ru, but translation happened entirely in the browser: setLang() swapped
// data-i18n text after load. Fetching ?lang=ro returned byte-identical English
// HTML with <html lang="en">. Verified before this change — same MD5, same
// title. So Googlebot saw three URLs holding one English page: it cannot rank
// the Romanian copy that does not exist in the response, and hreflang pointing
// at non-distinct documents risks the whole cluster being ignored.
//
// Romanian and Moldovan installers are the entire market, and they search in
// Romanian and Russian. This was the single biggest SEO defect on the site.
import fs from "node:fs";
import path from "node:path";
import { I18N_V2 } from "../app/_landing/i18n-v2.mjs";

export const LANGS = ["en", "ro", "ru"];
/** Locale path prefix per language. English stays at the root. */
export const PATH_FOR = { en: "/", ro: "/ro", ru: "/ru" };
const OG_LOCALE = { en: "en_US", ro: "ro_RO", ru: "ru_RU" };
const SITE = "https://voltmira.com";

/**
 * All three languages now render from the v2 document.
 *
 * It carries [data-i18n] markers and i18n-v2.mjs carries ro/ru for them, so
 * /ro and /ru are real translated documents again rather than three URLs
 * holding one English page — the defect described at the top of this file.
 * English has no dictionary entries beyond the metadata: substituteElements
 * leaves an element alone when its key is absent, so the authored copy stands.
 */
const SOURCE = "app/_landing/landing-en-v2.html";

const cachedHtml = {};
function source(file) {
  // Read once in production; always re-read in development. The landing HTML is
  // data, not a module, so editing it does not invalidate anything Next watches
  // — with the cache on, changes to landing-en-v2.html simply do not appear
  // until the dev server restarts, which is a genuinely confusing half hour.
  if (process.env.NODE_ENV !== "production") {
    return fs.readFileSync(path.join(process.cwd(), file), "utf8");
  }
  if (!cachedHtml[file]) {
    cachedHtml[file] = fs.readFileSync(path.join(process.cwd(), file), "utf8");
  }
  return cachedHtml[file];
}

const escAttr = (s) => String(s).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
const escText = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/**
 * Replace the inner HTML of every [data-i18n] element.
 *
 * Deliberately not a regex like <tag ...>(.*?)</tag>: several translated blocks
 * contain nested markup (<b>, <span>), and a lazy match would close on the
 * first inner tag. This walks forward counting same-name opens and closes to
 * find the element's real end, which is the only way to get it right without
 * pulling in a parser.
 */
function substituteElements(html, dict, attr, mode) {
  const marker = ` ${attr}="`;
  let out = "", cursor = 0;

  for (;;) {
    const at = html.indexOf(marker, cursor);
    if (at === -1) break;

    // The opening tag containing this attribute.
    const tagStart = html.lastIndexOf("<", at);
    const tagEnd = html.indexOf(">", at);
    if (tagStart === -1 || tagEnd === -1) break;

    const nameMatch = /^<([a-zA-Z][a-zA-Z0-9]*)/.exec(html.slice(tagStart, tagEnd + 1));
    const keyMatch = new RegExp(`${attr}="([^"]+)"`).exec(html.slice(tagStart, tagEnd + 1));
    if (!nameMatch || !keyMatch) { out += html.slice(cursor, tagEnd + 1); cursor = tagEnd + 1; continue; }

    const tag = nameMatch[1];
    const value = dict[keyMatch[1]];

    if (mode === "placeholder") {
      // Attribute swap: rewrite placeholder="..." inside this one tag.
      let open = html.slice(tagStart, tagEnd + 1);
      if (value != null) {
        open = /\splaceholder="[^"]*"/.test(open)
          ? open.replace(/\splaceholder="[^"]*"/, ` placeholder="${escAttr(value)}"`)
          : open.replace(/\s*\/?>$/, (m) => ` placeholder="${escAttr(value)}"${m}`);
      }
      out += html.slice(cursor, tagStart) + open;
      cursor = tagEnd + 1;
      continue;
    }

    // Self-closing or void: nothing to replace inside.
    if (html[tagEnd - 1] === "/") { out += html.slice(cursor, tagEnd + 1); cursor = tagEnd + 1; continue; }

    // Find the matching close, counting nested same-name tags.
    let depth = 1, scan = tagEnd + 1;
    const openRe = new RegExp(`<${tag}(\\s|>|/)`, "g");
    const closeRe = new RegExp(`</${tag}\\s*>`, "g");
    let closeStart = -1, closeEnd = -1;
    while (depth > 0) {
      closeRe.lastIndex = scan;
      const c = closeRe.exec(html);
      if (!c) break;
      openRe.lastIndex = scan;
      let o, opens = 0;
      while ((o = openRe.exec(html)) && o.index < c.index) opens++;
      depth += opens - 1;
      scan = c.index + c[0].length;
      if (depth === 0) { closeStart = c.index; closeEnd = scan; }
    }
    if (closeStart === -1) { out += html.slice(cursor, tagEnd + 1); cursor = tagEnd + 1; continue; }

    out += html.slice(cursor, tagEnd + 1);
    // Translations legitimately contain markup (<b>, <br>), so they are copied
    // verbatim — exactly what innerHTML does client-side. The dictionary is our
    // own authored content, not user input.
    out += value != null ? value : html.slice(tagEnd + 1, closeStart);
    out += html.slice(closeStart, closeEnd);
    cursor = closeEnd;
  }
  return out + html.slice(cursor);
}

/** Swap a <meta>/<link> attribute value by a matching selector-ish pattern. */
function setTag(html, pattern, attr, value) {
  return html.replace(pattern, (m) =>
    new RegExp(`${attr}="[^"]*"`).test(m)
      ? m.replace(new RegExp(`${attr}="[^"]*"`), `${attr}="${escAttr(value)}"`)
      : m);
}

/**
 * The homepage, fully rendered in `lang`.
 * @param {"en"|"ro"|"ru"} lang
 */
export function renderLanding(lang) {
  const code = LANGS.includes(lang) ? lang : "en";
  const dict = I18N_V2[code] || I18N_V2.en;
  const url = SITE + (code === "en" ? "/" : PATH_FOR[code]);

  let html = source(SOURCE);

  // 1. The copy itself.
  html = substituteElements(html, dict, "data-i18n", "html");
  html = substituteElements(html, dict, "data-i18n-ph", "placeholder");

  // 2. Document language — the signal a crawler reads first.
  html = html.replace(/<html([^>]*)\slang="[^"]*"/, `<html$1 lang="${code}"`);

  // 3. Title + description in the served HTML, not applied later by script.
  if (dict.meta_title) html = html.replace(/<title>[\s\S]*?<\/title>/, `<title>${escText(dict.meta_title)}</title>`);
  if (dict.meta_desc) html = setTag(html, /<meta\s+name="description"[^>]*>/i, "content", dict.meta_desc);

  // 4. Each language is its own canonical, or they collapse into one another.
  html = setTag(html, /<link\s+rel="canonical"[^>]*>/i, "href", url);
  html = setTag(html, /<meta\s+property="og:url"[^>]*>/i, "content", url);
  html = setTag(html, /<meta\s+property="og:locale"[^>]*>/i, "content", OG_LOCALE[code]);
  if (dict.meta_title) {
    html = setTag(html, /<meta\s+property="og:title"[^>]*>/i, "content", dict.meta_title);
    html = setTag(html, /<meta\s+name="twitter:title"[^>]*>/i, "content", dict.meta_title);
  }
  if (dict.meta_desc) {
    html = setTag(html, /<meta\s+property="og:description"[^>]*>/i, "content", dict.meta_desc);
    html = setTag(html, /<meta\s+name="twitter:description"[^>]*>/i, "content", dict.meta_desc);
  }

  // 5. hreflang on real paths. It pointed at ?lang= query params that served
  //    identical content — the annotation Google was most likely to discard.
  html = html.replace(/<link[^>]*hreflang="[^"]*"[^>]*>\s*/gi, "");
  const alts = LANGS.map((l) =>
    `<link rel="alternate" hreflang="${l}" href="${SITE}${l === "en" ? "/" : PATH_FOR[l]}">`
  ).join("\n") + `\n<link rel="alternate" hreflang="x-default" href="${SITE}/">`;
  html = html.replace(/<link\s+rel="canonical"[^>]*>/i, (m) => m + "\n" + alts);

  // 6. Give the browser the same dictionary so the on-page toggle still works
  //    without a reload, and tell it which language was served.
  // JSON.stringify alone is not safe inside <script>: a "</script>" anywhere in
  // the copy would close the tag early and dump the rest as markup. Escaping the
  // sequence (and U+2028/29, which are literal newlines to a JS parser) is the
  // standard guard for inlining data into a script element.
  const inline = (o) => JSON.stringify(o)
    .replace(/<\//g, "<\\/")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");
  // Injected as STATEMENTS, not as a new <script>. The dictionary sits inside an
  // IIFE — (function(){ "use strict"; ... })() — so emitting </script> here cut
  // that function in half and the page died with "Unexpected end of input".
  // Writing the same `var I18N = {...};` the file used to contain keeps the
  // original structure byte-for-byte apart from the data.
  // v2 has no client-side translation: each language is a separate server-
  // rendered document and the switcher navigates between them. Only the
  // served language is exposed, for the switcher to read if it wants it.
  html = html.replace("/*__I18N_INJECTED__*/", `window.__SSR_LANG=${inline(code)};`);

  return html;
}

/** Shared Response builder for the three route handlers. */
export function landingResponse(lang) {
  return new Response(renderLanding(lang), {
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "public, max-age=0, must-revalidate",
    },
  });
}
