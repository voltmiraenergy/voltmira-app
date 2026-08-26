// lib/supabase-browser.js — CLIENT-side only. RLS applies via user session.
import { createBrowserClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";

// ~400 days (Chrome's max) so the auth cookies are PERSISTENT, not session
// cookies — the user stays signed in across browser restarts (tokens refresh
// automatically). Keep in sync with the server + middleware clients.
export const AUTH_COOKIE_MAX_AGE = 60 * 60 * 24 * 400;

/**
 * Stand-in returned while rendering on the server.
 *
 * Next executes client components on the server too, during prerendering, and
 * both /login and /reset-password build their client at render time — one in
 * the component body, one in a useState initialiser, which also runs on the
 * server. createBrowserClient throws there the moment the public env vars are
 * missing, which is every Preview deployment, since this project scopes them to
 * Production. That failed the build on pages that never touch Supabase until a
 * handler fires in a real browser.
 *
 * Throwing on access rather than returning null keeps a genuine server-side
 * misuse loud instead of surfacing later as "cannot read property of null".
 */
const SERVER_STUB = new Proxy({}, {
  get(_t, prop) {
    throw new Error(
      `supabaseBrowser() is browser-only — "${String(prop)}" was accessed during ` +
      "server rendering. Call it from an event handler or useEffect."
    );
  },
});

export function supabaseBrowser() {
  if (typeof window === "undefined") return SERVER_STUB;
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
