// lib/signupsAdmin.js — turns the sign-up log (supabase/add-signup-log.sql) into what the admin tab shows. Pure.
const DAY = 864e5;

/** Who this account is: a person who started a workspace, an invited teammate, or someone who never finished. */
export function signupKind(profile) {
  if (!profile) return "unfinished";
  return profile.role === "owner" ? "owner" : "teammate";
}

/** "MD" -> "Moldova" (English, the admin page is English); an unknown or empty code reads "Unknown". */
export function countryName(code) {
  const c = String(code || "").toUpperCase();
  if (!/^[A-Z]{2}$/.test(c)) return "Unknown";
  try { return new Intl.DisplayNames(["en"], { type: "region" }).of(c) || c; } catch { return c; }
}

/**
 * @param {object[]} log        signup_log rows
 * @param {Map<string, object>} profiles  user_id -> { role, name, company_id }
 * @param {Map<string, object>} companies company_id -> { name, lang, ... }
 * @param {Map<string, number>} quotes    company_id -> number of real quotes
 * @param {number} now
 */
export function buildSignups(log, profiles, companies, quotes, now = Date.now()) {
  const rows = (log || []).map((r) => {
    const p = profiles.get(r.user_id) || null;
    const co = p ? companies.get(p.company_id) || null : null;
    return {
      id: r.user_id, email: r.email, name: r.name || p?.name || "", company: co?.name || "",
      kind: signupKind(p), country: countryName(r.country), countryCode: r.country || "", city: r.city || "",
      lang: co?.lang || "", provider: r.provider || "email", at: r.signed_up_at, seen: r.first_seen_at,
      quotes: p ? quotes.get(p.company_id) || 0 : 0,
    };
  }).sort((a, b) => Date.parse(b.at) - Date.parse(a.at));
  const people = rows.filter((r) => r.kind !== "teammate");
  const since = (d) => people.filter((r) => now - Date.parse(r.at) < d * DAY).length;
  const byCountry = new Map();
  for (const r of people) byCountry.set(r.country, (byCountry.get(r.country) || 0) + 1);
  return {
    rows,
    totals: {
      people: people.length, today: since(1), week: since(7), month: since(30),
      unfinished: rows.filter((r) => r.kind === "unfinished").length,
      withQuote: people.filter((r) => r.quotes > 0).length,
    },
    countries: [...byCountry.entries()].sort((a, b) => b[1] - a[1]),
  };
}
