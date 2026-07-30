// middleware.js — refresh Supabase session; gate the app; keep /p/* public.
import { createServerClient } from "@supabase/ssr";
import { NextResponse } from "next/server";

export async function middleware(req) {
  const res = NextResponse.next({ request: req });

  const path = req.nextUrl.pathname;

  // Only the signed-in app surfaces require a session. Everything else — public
  // marketing/legal pages, /login, /p/* proposals, the /widget embed, API routes
  // (which authorize themselves), AND genuinely unknown URLs — falls through to
  // Next. That last part matters: an unknown path now renders the branded 404
  // (app/not-found.jsx) instead of bouncing to /login, so stale links and
  // crawlers get a real 404 rather than a 307 redirect.
  const isProtected = path.startsWith("/dashboard") || path.startsWith("/projects")
    || path.startsWith("/settings") || path.startsWith("/team") || path.startsWith("/leads")
    || path.startsWith("/guide");

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
