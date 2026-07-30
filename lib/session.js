// lib/session.js — one auth check + one company fetch PER REQUEST, shared by the
// layout and every page. Without this, each navigation did getUser() three times
// (middleware + layout + page) and queried companies twice — every call a network
// round trip to Supabase. React's cache() memoizes within a single server render,
// so layout and page reuse the same result instead of refetching.
import { cache } from "react";
import { supabaseServer } from "./supabase.js";

/** The signed-in Supabase user, validated once per request. */
export const currentUser = cache(async () => {
  const { data: { user } } = await supabaseServer().auth.getUser();
  return user;
});

/** The caller's company row (full columns), fetched once per request.
 *  SELF-HEALS half-created accounts: if a signed-in user has no profile
 *  (signup succeeded but workspace setup failed), bootstrap_company() is
 *  idempotent — it creates the company + owner profile, or returns the
 *  existing one. Without this, such an account renders a broken shell and
 *  crashes on New quote. */
export const currentCompany = cache(async () => {
  const sb = supabaseServer();
  let { data } = await sb.from("companies").select("*").maybeSingle();
  if (!data) {
    // supabase-js query builders are thenable but have NO .catch()/.finally();
    // await inside try, never chain .catch on them.
    try { await sb.rpc("bootstrap_company", { company_name: "", user_name: "" }); } catch {}
    ({ data } = await sb.from("companies").select("*").maybeSingle());
  }
  return data;
});
