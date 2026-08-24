/** @type {import('next').NextConfig} */

// Security headers applied to every response. The CSP is intentionally
// permissive enough for the inline styles/scripts the marketing homepage uses
// and the Supabase/PVGIS/Stripe endpoints the app calls, while blocking
// framing (clickjacking) and enforcing HTTPS.
// Shared directives. `frame-ancestors` is appended per-context: 'none' everywhere
// so the app can't be clickjacked, but the /widget lead form is MEANT to be
// embedded on installers' own sites, so it must allow any ancestor.
const cspCommon = [
  "default-src 'self'",
  // Paddle Billing: paddle.js is served from cdn.paddle.com; the overlay checkout
  // runs in a buy.paddle.com iframe and calls *.paddle.com endpoints. Allow both
  // sandbox and production Paddle subdomains via the wildcard.
  // plausible.io was missing here, so the analytics script the landing page
  // loads was blocked before the request was even made — no pageview has ever
  // been recorded. Both directives are needed: one to load script.js, one for
  // the beacon it POSTs to /api/event.
  "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://challenges.cloudflare.com https://*.paddle.com https://plausible.io",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://*.paddle.com",
  "font-src 'self' https://fonts.gstatic.com data:",
  "img-src 'self' data: https:",
  "connect-src 'self' https://*.supabase.co https://re.jrc.ec.europa.eu https://nominatim.openstreetmap.org https://*.paddle.com https://plausible.io",
  "frame-src https://challenges.cloudflare.com https://*.paddle.com",
  "base-uri 'self'",
  "form-action 'self'",
  // No plugins/embeds anywhere — closes the object-src gap flagged by scanners.
  "object-src 'none'",
];
const csp = [...cspCommon, "frame-ancestors 'none'"].join("; ");
const cspWidget = [...cspCommon, "frame-ancestors *"].join("; ");

// Pages that must never appear in search results. Sent as a HEADER rather than
// a robots.txt Disallow on purpose: Disallow stops the crawl, which means the
// crawler never sees a noindex directive, and a URL discovered elsewhere can
// stay indexed as a bare listing. noindex has to be served to be obeyed.
const noIndexHeaders = [{ key: "X-Robots-Tag", value: "noindex, nofollow" }];

const commonHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
];
// Everything except /widget: block framing entirely.
const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  { key: "X-Frame-Options", value: "DENY" },
  ...commonHeaders,
];
// /widget: no X-Frame-Options (legacy header can't say "any"), CSP allows framing.
const widgetHeaders = [
  { key: "Content-Security-Policy", value: cspWidget },
  ...commonHeaders,
];

export default {
  transpilePackages: ["@voltmira/engine"],
  // Don't advertise the framework/version in a response header (fingerprinting).
  poweredByHeader: false,
  // The homepage route reads app/_landing/landing.html with fs at runtime;
  // make sure Vercel's file tracer bundles it into the serverless function.
  experimental: {
    outputFileTracingIncludes: {
      "/": ["./app/_landing/**"],
      // The PDF route shells out to a real Chromium binary that ships brotli-
      // compressed inside the package's bin/ directory. Nothing imports those
      // files, so the tracer has no reason to keep them and the function
      // deployed without them ("The input directory .../bin does not exist").
      "/api/proposal/[code]/pdf": ["./node_modules/@sparticuz/chromium/bin/**"],
    },
    // Leave these two unbundled: webpack relocates the package and then
    // chromium can no longer find its own binary relative to __dirname.
    serverComponentsExternalPackages: ["@sparticuz/chromium", "puppeteer-core"],
  },
  async headers() {
    return [
      // /widget is embeddable — give it the framing-friendly header set.
      // It is also meaningless as a search result, so keep it out of the index.
      { source: "/widget", headers: [...widgetHeaders, ...noIndexHeaders] },
      { source: "/widget/:path*", headers: [...widgetHeaders, ...noIndexHeaders] },

      // Client proposals carry a homeowner's NAME, ADDRESS, CONSUMPTION and
      // PRICE. They were fully indexable: no metadata, no noindex, HTTP 200 to
      // any crawler. Indexing one is a GDPR exposure and the exact opposite of
      // what a trust-based product should do with a client's data.
      { source: "/p/:path*", headers: noIndexHeaders },

      // Auth surfaces and the signed-in app: thin, duplicate, or private.
      { source: "/login", headers: noIndexHeaders },
      { source: "/reset-password", headers: noIndexHeaders },
      { source: "/dashboard/:path*", headers: noIndexHeaders },
      { source: "/projects/:path*", headers: noIndexHeaders },
      { source: "/leads/:path*", headers: noIndexHeaders },
      { source: "/activity/:path*", headers: noIndexHeaders },
      { source: "/catalog/:path*", headers: noIndexHeaders },
      { source: "/team/:path*", headers: noIndexHeaders },
      { source: "/settings/:path*", headers: noIndexHeaders },
      { source: "/profile/:path*", headers: noIndexHeaders },
      { source: "/refer/:path*", headers: noIndexHeaders },
      { source: "/guide/:path*", headers: noIndexHeaders },
      // Everything else (the negative lookahead keeps /widget from also matching
      // here and inheriting X-Frame-Options: DENY).
      { source: "/((?!widget).*)", headers: securityHeaders },
    ];
  },
  async rewrites() {
    // Serve the RFC 9116 security.txt at its well-known path.
    return [{ source: "/.well-known/security.txt", destination: "/api/security-txt" }];
  },
  async redirects() {
    // Canonicalize www → apex with a permanent 308 (preserves method + body).
    return [{
      source: "/:path*",
      has: [{ type: "host", value: "www.voltmira.com" }],
      destination: "https://voltmira.com/:path*",
      permanent: true,
    }];
  },
};
