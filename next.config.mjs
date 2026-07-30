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
  "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://challenges.cloudflare.com",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com data:",
  "img-src 'self' data: https:",
  "connect-src 'self' https://*.supabase.co https://re.jrc.ec.europa.eu https://nominatim.openstreetmap.org",
  "frame-src https://challenges.cloudflare.com",
  "base-uri 'self'",
  "form-action 'self'",
];
const csp = [...cspCommon, "frame-ancestors 'none'"].join("; ");
const cspWidget = [...cspCommon, "frame-ancestors *"].join("; ");

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
  // The homepage route reads app/_landing/landing.html with fs at runtime;
  // make sure Vercel's file tracer bundles it into the serverless function.
  experimental: {
    outputFileTracingIncludes: {
      "/": ["./app/_landing/**"],
    },
  },
  async headers() {
    return [
      // /widget is embeddable — give it the framing-friendly header set.
      { source: "/widget", headers: widgetHeaders },
      { source: "/widget/:path*", headers: widgetHeaders },
      // Everything else (the negative lookahead keeps /widget from also matching
      // here and inheriting X-Frame-Options: DENY).
      { source: "/((?!widget).*)", headers: securityHeaders },
    ];
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
