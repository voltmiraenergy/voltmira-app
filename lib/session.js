// lib/session.js — one auth check + one company fetch PER REQUEST, shared by the
// layout and every page. Without this, each navigation did getUser() three times
// (middleware + layout + page) and queried companies twice — every call a network
// round trip to Supabase. React's cache() memoizes within a single server render,
// so layout and page reuse the same result instead of refetching.
import { cache } from "react";
import { cookies } from "next/headers";
import { supabaseServer, supabaseAdmin } from "./supabase.js";
import { bootstrapWorkspace } from "./bootstrapWorkspace.js";

/** The signed-in Supabase user, validated once per request. */
export const currentUser = cache(async () => {
  const { data: { user } } = await (await supabaseServer()).auth.getUser();
  return user;
});

/** Who is acting, for activity-log attribution: { id, name }. Reads the profile
 *  name via the service role (profiles RLS recurses on a session read). Cached
 *  per request so many logActivity() calls don't re-query. */
export const currentActor = cache(async () => {
  const user = await currentUser();
  if (!user) return null;
  const { data } = await supabaseAdmin().from("profiles").select("name").eq("id", user.id).maybeSingle();
  return { id: user.id, name: data?.name || user.email || "" };
});

/** The caller's company row (full columns), fetched once per request.
 *  SELF-HEALS half-created accounts: if a signed-in user has no profile
 *  (signup succeeded but workspace setup failed), bootstrap_company() is
 *  idempotent — it creates the company + owner profile, or returns the
 *  existing one. Without this, such an account renders a broken shell and
 *  crashes on New quote. */
export const currentCompany = cache(async () => {
  const sb = await supabaseServer();
  let { data } = await sb.from("companies").select("*").maybeSingle();
  if (!data) {
    // supabase-js query builders are thenable but have NO .catch()/.finally();
    // await inside try, never chain .catch on them.
    // A Google sign-up has no form; the language comes from the cookie the
    // sign-in page's language switch (and the homepage's) sets.
    let lang;
    try { lang = (await cookies()).get("voltmira_lang")?.value; } catch {}
    try { await bootstrapWorkspace(sb, { lang }); } catch {}
    ({ data } = await sb.from("companies").select("*").maybeSingle());
  }
  return data;
});
