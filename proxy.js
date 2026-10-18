// proxy.js (Next 16's name for middleware.js) — refresh the Supabase session,
// gate the app, keep /p/* public, and send the Content-Security-Policy
// (lib/csp.js): a fresh nonce for every page, which Next reads from the
// request and puts on its own scripts.
import { createServerClient } from "@supabase/ssr";
import { NextResponse } from "next/server";
import { aiOn, isAiPath } from "./lib/featureFlags.js";
import { buildCsp, makeNonce, scriptHash } from "./lib/csp.js";
import { APP_INLINE_SCRIPTS } from "./lib/inlineScripts.js";
import { AUTH_COOKIE_MAX_AGE } from "./lib/authCookie.js";

// The public site lives on voltmira.com only. app.voltmira.com serves the same
// Next app (it is where email links point), so without this its copies of the
// marketing and legal pages compete with the real ones in Google's index.
const SITE = "https://voltmira.com";
// the free solar design funnel, one URL per language like the homepage (app/solar)
const PUBLIC_PAGES = new Set(["/", "/ro", "/ru", "/uk", "/privacy", "/terms", "/refunds", "/cookies", "/credits", "/solar", "/ro/solar", "/ru/solar", "/uk/solar"]);
const LANG_PATH = { en: "/", ro: "/ro", ru: "/ru", uk: "/uk" };
// The homepage is built once and served from the CDN, so it carries its own
// policy, by hash (lib/landing.js); a nonce here would not match its scripts.
const LANDING = new Set(["/", "/ro", "/ru", "/uk"]);
const DEV = process.env.NODE_ENV !== "production";

// The hashes of the app's own inline scripts, worked out once per server.
let appHashes = null;
const hashesOnce = () => (appHashes ||= Promise.all(APP_INLINE_SCRIPTS.map(scriptHash)));

/** The policy for this path, and the nonce it carries ("" for the homepage, which sends its own). */
async function policyFor(path) {
  if (LANDING.has(path)) return { csp: "", nonce: null };
  // route handlers (API, the demo door) render no Next page: no nonce to hand out
  const page = !path.startsWith("/api/") && path !== "/demo";
  const nonce = page ? makeNonce() : null;
  const frameAncestors = path === "/widget" || path.startsWith("/widget/") ? "*" : "'none'";
  return { csp: buildCsp({ nonce, hashes: await hashesOnce(), dev: DEV, frameAncestors }), nonce };
}

export async function proxy(req) {
  const path = req.nextUrl.pathname;
  const host = (req.headers.get("host") || "").toLowerCase();

  const { csp, nonce } = await policyFor(path);
  const reqHeaders = new Headers(req.headers);
  if (csp) reqHeaders.set("content-security-policy", csp);
  if (nonce) reqHeaders.set("x-nonce", nonce);
  const withCsp = (r) => { if (csp) r.headers.set("Content-Security-Policy", csp); return r; };
  const res = withCsp(NextResponse.next({ request: { headers: reqHeaders } }));

  // AI and widgets are hidden until NEXT_PUBLIC_VOLTMIRA_AI=on (lib/featureFlags.js):
  // their pages and routes answer a plain 404, as if they did not exist.
  if (!aiOn() && isAiPath(path)) {
    return path.startsWith("/api/")
      ? NextResponse.json({ error: "not_found" }, { status: 404 })
      : withCsp(NextResponse.rewrite(new URL("/_not-found", req.url), { status: 404, request: { headers: reqHeaders } }));
  }

  // an installer's public profile (app/i) is a public page too, on voltmira.com only
  if (path.startsWith("/i/") && host === "app.voltmira.com") return NextResponse.redirect(SITE + path, 301);

  if (PUBLIC_PAGES.has(path)) {
    // Old homepage URLs: each language was once /?lang=xx. Google still has
    // them on file, and they answered 200 with the English page.
    const lang = req.nextUrl.searchParams.get("lang");
    if (path === "/" && lang) {
      const url = req.nextUrl.clone();
      url.pathname = LANG_PATH[lang] || "/";
      url.search = "";
      return NextResponse.redirect(url, 301);
    }
    if (host === "app.voltmira.com") {
      return NextResponse.redirect(SITE + path, 301);
    }
    return res;
  }

  // Only the signed-in app surfaces require a session. Everything else — public
  // marketing/legal pages, /login, /p/* proposals, the /widget embed, API routes
  // (which authorize themselves), AND genuinely unknown URLs — falls through to
  // Next. That last part matters: an unknown path now renders the branded 404
  // (app/not-found.jsx) instead of bouncing to /login, so stale links and
  // crawlers get a real 404 rather than a 307 redirect.
  const isProtected = path.startsWith("/dashboard") || path.startsWith("/projects")
    || path.startsWith("/settings") || path.startsWith("/team") || path.startsWith("/leads")
    || path.startsWith("/guide") || path.startsWith("/catalog") || path.startsWith("/profile")
    || path.startsWith("/activity") || path.startsWith("/documents")
    || path.startsWith("/studio") || path.startsWith("/traction") || path.startsWith("/portfolios")
    || path.startsWith("/energy") || path.startsWith("/admin") || path.startsWith("/marketplace");
  // a homeowner's own pages (app/home): signed in, as a homeowner
  const isHome = (path === "/home" || path.startsWith("/home/")) && path !== "/home/login" && path !== "/home/enter";

  if (!isProtected && !isHome) return res;

  // If Supabase isn't configured yet (fresh deploy without env vars), don't
  // crash the whole site: send protected routes to /login.
  const url_ = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url_ || !anon) {
    const url = req.nextUrl.clone(); url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  const supabase = createServerClient(url_, anon, {
    // Persistent auth cookies (30 days, lib/authCookie.js) so users stay signed
    // in across restarts; getSession() below refreshes the token as needed.
    cookieOptions: { maxAge: AUTH_COOKIE_MAX_AGE },
    cookies: {
      getAll: () => req.cookies.getAll(),
      setAll: (list) => list.forEach(({ name, value, options }) =>
        res.cookies.set(name, value, options)),
    },
  });
  // getSession() reads/refreshes the token from the cookie WITHOUT a network
  // round-trip to the auth server (getUser() makes one on every request). This
  // runs on every navigation, so that hop was pure per-click latency. Security
  // is unaffected: this only gates routing — the server components still call
  // getUser() (validated) for data, and the database enforces RLS regardless.
  const { data: { session } } = await supabase.auth.getSession();

  if (!session) {
    const url = req.nextUrl.clone(); url.pathname = isHome ? "/home/login" : "/login";
    return NextResponse.redirect(url);
  }
  // the two kinds of account never cross: a homeowner (app_metadata.role, set
  // only by the server) has no workspace, and an installer has no /home
  const homeowner = session.user?.app_metadata?.role === "homeowner";
  if (isHome !== homeowner) {
    const url = req.nextUrl.clone(); url.pathname = homeowner ? "/home" : "/dashboard"; url.search = "";
    return NextResponse.redirect(url);
  }
  return res;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|robots\\.txt|sitemap\\.xml|.*\\.(?:png|jpg|svg|ico|txt|xml)).*)"],
};
