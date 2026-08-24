// lib/supabase-browser.js — CLIENT-side only. RLS applies via user session.
import { createBrowserClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";

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

/**
 * A throwaway client used ONLY to REQUEST a password-reset email.
 *
 * The main client above runs the PKCE flow, which stashes a code_verifier in the
 * browser that asked for the link. Open that email anywhere else — request it on
 * the laptop, tap it on your phone — and there is no verifier to exchange with,
 * so /auth/callback failed and dumped the user at /login?error=auth with no
 * explanation. Asking for the link over the IMPLICIT flow makes Supabase hand
 * the session back in the URL hash instead, which /reset-password adopts
 * directly (see its setSession call) on whatever device opened it.
 *
 * Deliberately stateless: it must never write cookies or touch the real session.
 */
export function supabaseRecovery() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    { auth: { flowType: "implicit", persistSession: false, detectSessionInUrl: false, autoRefreshToken: false } }
  );
}
