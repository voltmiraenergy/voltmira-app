// lib/supabase.js — SERVER-side clients only (imports next/headers).
// For client components use lib/supabase-browser.js instead.
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

const URL_ = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

/** Server components / route handlers acting AS the user: RLS applies. */
export function supabaseServer() {
  const store = cookies();
  return createServerClient(URL_, ANON, {
    cookies: {
      getAll: () => store.getAll(),
      setAll: (list) => list.forEach(({ name, value, options }) => {
        try { store.set(name, value, options); } catch {}
      }),
    },
  });
}

/**
 * Service role: BYPASSES RLS. Only for public proposal reads (filtered by
 * capability code), tracking inserts, widget leads, Stripe webhooks.
 * Never import into anything that ships to the browser.
 */
export function supabaseAdmin() {
  return createClient(URL_, process.env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
    // Next patches global fetch and caches GETs. These reads back public,
    // per-request pages (proposal snapshots, the widget's company language), so
    // a cached row means serving a stale answer after the installer changed it.
    global: { fetch: (url, opts = {}) => fetch(url, { ...opts, cache: "no-store" }) },
  });
}
