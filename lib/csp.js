// lib/csp.js — the site's Content-Security-Policy, built in one place.
//
// Scripts run only when the policy names them: our own files ('self'), the
// few outside services listed below, and inline scripts that carry the
// page's nonce or match a known hash. There is no 'unsafe-inline' (an
// injected <script> or onclick="" would run) and, in production, no
// 'unsafe-eval' (code built from strings). Who sends which policy:
//   - every app page: proxy.js, with a fresh nonce per request. Next reads
//     the nonce from the request's policy and puts it on its own scripts;
//     the root layout makes every page render per request so it can.
//   - the homepage (/, /ro, /ru, /uk): lib/landing.js, by hash, because the
//     page is built once and served from the CDN, where no nonce can change.
//   - the app's own two inline scripts (theme, language): by hash, from
//     lib/inlineScripts.js, so they need no nonce passed down to them.
// Styles keep 'unsafe-inline': React writes style="" attributes everywhere,
// and an inline style cannot run code.

// Outside scripts the app loads, each from its own feature:
//   challenges.cloudflare.com  Turnstile on sign-up (app/login/LoginForm.jsx)
//   *.paddle.com               Paddle checkout (lib/paddle.js)
//   plausible.io               page analytics
//   maps.googleapis.com        Google address search and satellite, only with
//                              the installer's own key (components/AddressField.jsx,
//                              lib/googleSatellite.js)
const SCRIPT_HOSTS = ["https://challenges.cloudflare.com", "https://*.paddle.com", "https://plausible.io", "https://maps.googleapis.com"];

// server.arcgisonline.com: the offline worker (public/app-sw.js) fetches the
// map tiles it keeps. *.sentry.io: error reports (inert without a DSN).
const CONNECT_HOSTS = [
  "https://server.arcgisonline.com", "https://*.supabase.co", "https://re.jrc.ec.europa.eu",
  "https://nominatim.openstreetmap.org", "https://*.paddle.com", "https://plausible.io",
  "https://*.ingest.sentry.io", "https://*.sentry.io", "https://maps.googleapis.com",
];

/**
 * The policy as a header value.
 * @param {object} o
 * @param {string|null} [o.nonce]        this response's nonce, for Next's own inline scripts
 * @param {string[]} [o.hashes]          "sha256-..." of inline scripts allowed by content
 * @param {boolean} [o.dev]              `next dev` needs eval for fast refresh
 * @param {string} [o.frameAncestors]    "'none'", or "*" for the embeddable widget
 */
export function buildCsp({ nonce = null, hashes = [], dev = false, frameAncestors = "'none'" } = {}) {
  const script = [
    "'self'",
    ...(nonce ? [`'nonce-${nonce}'`] : []),
    ...hashes.map((h) => `'${h}'`),
    ...(dev ? ["'unsafe-eval'"] : []),
    ...SCRIPT_HOSTS,
  ];
  return [
    "default-src 'self'",
    `script-src ${script.join(" ")}`,
    // no script in an attribute (onclick="...") ever, whatever else changes
    "script-src-attr 'none'",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://*.paddle.com",
    "font-src 'self' https://fonts.gstatic.com data:",
    "img-src 'self' data: https:",
    `connect-src 'self' ${CONNECT_HOSTS.join(" ")}`,
    "frame-src https://challenges.cloudflare.com https://*.paddle.com",
    "base-uri 'self'",
    "form-action 'self'",
    "object-src 'none'",
    `frame-ancestors ${frameAncestors}`,
  ].join("; ");
}

/** "sha256-<base64>" of a script's exact text, as a CSP source wants it. */
export async function scriptHash(text) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  let bin = "";
  for (const b of new Uint8Array(digest)) bin += String.fromCharCode(b);
  return "sha256-" + btoa(bin);
}

/** A fresh nonce: 128 random bits, base64. */
export function makeNonce() {
  const b = crypto.getRandomValues(new Uint8Array(16));
  let bin = "";
  for (const x of b) bin += String.fromCharCode(x);
  return btoa(bin);
}

/**
 * Inline scripts in an HTML document: the text of every <script> with no src
 * and a JavaScript type, with line breaks as a browser reads them (CR LF and
 * CR become LF) since that is the text whose hash it checks.
 */
export function inlineScriptsOf(html) {
  html = String(html).replace(/\r\n?/g, "\n");
  const out = [];
  for (const m of html.matchAll(/<script(\s[^>]*)?>([\s\S]*?)<\/script>/gi)) {
    const attrs = m[1] || "";
    if (/\ssrc\s*=/i.test(attrs)) continue;
    const type = (/\stype\s*=\s*"([^"]*)"/i.exec(attrs) || [])[1];
    if (type && !/^(text\/javascript|module|application\/javascript)$/i.test(type)) continue;   // JSON-LD and data blocks never run
    out.push(m[2]);
  }
  return out;
}
