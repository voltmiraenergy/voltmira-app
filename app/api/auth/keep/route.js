// app/api/auth/keep/route.js — renew this device's sign-in for another 30
// days (lib/authCookie.js). Sends the session cookies the browser already
// holds back to it from the server, unchanged but for their lifetime: Safari
// caps cookies written by a page's script at 7 days, never ones the server
// sets. Called after signing in, and once a day while the app is in use
// (components/KeepSignedIn.jsx). Only renews a session that is still valid.
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { supabaseServer } from "../../../../lib/supabase.js";
import { AUTH_COOKIE_MAX_AGE, isAuthCookie } from "../../../../lib/authCookie.js";

export const dynamic = "force-dynamic";

export async function POST() {
  const sb = await supabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ ok: false }, { status: 401 });
  const store = await cookies();
  const res = NextResponse.json({ ok: true, days: AUTH_COOKIE_MAX_AGE / 86400 });
  for (const c of store.getAll()) {
    if (!isAuthCookie(c.name)) continue;
    res.cookies.set(c.name, c.value, {
      path: "/", sameSite: "lax", maxAge: AUTH_COOKIE_MAX_AGE,
      // the browser client reads the session from this cookie, so not httpOnly
      httpOnly: false, secure: process.env.NODE_ENV === "production",
    });
  }
  return res;
}
