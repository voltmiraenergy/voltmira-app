// lib/supabase-browser.js — CLIENT-side only. RLS applies via user session.
import { createBrowserClient } from "@supabase/ssr";

// ~400 days (Chrome's max) so the auth cookies are PERSISTENT, not session
// cookies — the user stays signed in across browser restarts (tokens refresh
// automatically). Keep in sync with the server + middleware clients.
export const AUTH_COOKIE_MAX_AGE = 60 * 60 * 24 * 400;

export function supabaseBrowser() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    { cookieOptions: { maxAge: AUTH_COOKIE_MAX_AGE } }
  );
}
