// proxy.js (Next 16's name for middleware.js) — refresh the Supabase session,
// gate the app, keep /p/* public.
import { createServerClient } from "@supabase/ssr";
import { NextResponse } from "next/server";

// The public site lives on voltmira.com only. app.voltmira.com serves the same
// Next app (it is where email links point), so without this its copies of the
// marketing and legal pages compete with the real ones in Google's index.
const SITE = "https://voltmira.com";
const PUBLIC_PAGES = new Set(["/", "/ro", "/ru", "/uk", "/privacy", "/terms", "/refunds", "/cookies", "/credits"]);
const LANG_PATH = { en: "/", ro: "/ro", ru: "/ru", uk: "/uk" };

export async function proxy(req) {
  const res = NextResponse.next({ request: req });

  const path = req.nextUrl.pathname;
  const host = (req.headers.get("host") || "").toLowerCase();

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
    || path.startsWith("/energy");

  if (!isProtected) return res;

  // If Supabase isn't configured yet (fresh deploy without env vars), don't
  // crash the whole site: send protected routes to /login.
  const url_ = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url_ || !anon) {
    const url = req.nextUrl.clone(); url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  const supabase = createServerClient(url_, anon, {
    // Persistent auth cookies (~400 days) so users stay signed in across browser
    // restarts; getSession() below refreshes the token as needed.
    cookieOptions: { maxAge: 60 * 60 * 24 * 400 },
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
    const url = req.nextUrl.clone(); url.pathname = "/login";
    return NextResponse.redirect(url);
  }
  return res;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|robots\\.txt|sitemap\\.xml|.*\\.(?:png|jpg|svg|ico|txt|xml)).*)"],
};
