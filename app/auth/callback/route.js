// app/auth/callback/route.js — OAuth / email-link landing.
//
// @supabase/ssr uses the PKCE flow: Google sign-in and password-reset / invite
// email links all come back here with a one-time `?code=`. This handler
// exchanges that code for a real session (writing the auth cookies) and then
// forwards the user on. WITHOUT this route the code was never exchanged, so
// "Continue with Google" bounced straight back to /login with no session.
import { NextResponse } from "next/server";
import { supabaseServer } from "../../../lib/supabase.js";

export const dynamic = "force-dynamic";

export async function GET(req) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  // only allow same-site relative paths — never an open redirect
  const nextParam = url.searchParams.get("next") || "/dashboard";
  const next = nextParam.startsWith("/") && !nextParam.startsWith("//") ? nextParam : "/dashboard";

  // OAuth error (e.g. user cancelled the Google consent screen)
  if (url.searchParams.get("error")) {
    return NextResponse.redirect(new URL("/login", url.origin));
  }

  if (code) {
    const sb = supabaseServer();
    const { error } = await sb.auth.exchangeCodeForSession(code);
    if (error) {
      console.error("auth callback exchange failed:", error.message);
      return NextResponse.redirect(new URL("/login?error=auth", url.origin));
    }
  }
  return NextResponse.redirect(new URL(next, url.origin));
}
