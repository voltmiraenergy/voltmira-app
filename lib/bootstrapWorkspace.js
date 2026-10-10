// lib/bootstrapWorkspace.js — create the signed-in user's workspace, in the
// language they signed up in.
//
// The three-argument bootstrap_company comes from supabase/md-launch-defaults.sql.
// Until that file has been run, only the original two-argument function exists,
// so a missing-function error falls back to it: signing up must never break
// because a migration is pending. Used by the sign-up form and by the
// self-healing company lookup in lib/session.js (Google sign-ups land there).

const LANGS = new Set(["ro", "ru", "en", "uk"]);

/** PostgREST's answer when no function matches the arguments sent. */
export function isMissingFunction(error) {
  return !!error && (error.code === "PGRST202" || /could not find the function/i.test(error.message || ""));
}

/**
 * @param {{ rpc: Function }} sb  a Supabase client acting as the new user
 * @param {{ company?: string, user?: string, lang?: string }} o
 * @returns {Promise<{ data: any, error: any }>}
 */
export async function bootstrapWorkspace(sb, { company = "", user = "", lang } = {}) {
  const base = { company_name: company, user_name: user };
  if (LANGS.has(lang)) {
    const res = await sb.rpc("bootstrap_company", { ...base, company_lang: lang });
    if (!isMissingFunction(res.error)) return res;
  }
  return sb.rpc("bootstrap_company", base);
}
