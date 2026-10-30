// lib/signupsLoad.js — SERVER only, service role: the sign-up log with each person's profile, company and quotes,
// shaped by lib/signupsAdmin.js. For the admin pages only (call after isPlatformAdmin()). The team's own accounts
// (PLATFORM_ADMIN_EMAILS) are left out, as /traction leaves out their workspaces.
import { supabaseAdmin } from "./supabase.js";
import { buildSignups } from "./signupsAdmin.js";
import { isPlatformAdmin } from "./platformAdmin.js";

/** @returns {Promise<ReturnType<typeof buildSignups> & { needsDb: boolean }>} */
export async function loadSignups({ includeTeam = false } = {}) {
  const db = supabaseAdmin();
  const { data: log, error } = await db.from("signup_log").select("*").order("signed_up_at", { ascending: false }).limit(5000);
  if (error) return { ...buildSignups([], new Map(), new Map(), new Map()), needsDb: true };
  const rows = (log || []).filter((r) => includeTeam || !isPlatformAdmin(r.email));
  const ids = rows.map((r) => r.user_id);
  const chunk = (a, n) => Array.from({ length: Math.ceil(a.length / n) }, (_, i) => a.slice(i * n, i * n + n));
  const profs = [];
  for (const part of chunk(ids, 500)) {
    const { data } = await db.from("profiles").select("id, name, role, phone, company_id").in("id", part);
    profs.push(...(data || []));
  }
  const [{ data: cos }, { data: projs }] = await Promise.all([
    db.from("companies").select("id, name, lang"),
    db.from("projects").select("company_id").eq("sample", false).limit(50000),
  ]);
  const quotes = new Map();
  for (const p of projs || []) quotes.set(p.company_id, (quotes.get(p.company_id) || 0) + 1);
  return { ...buildSignups(rows, new Map(profs.map((p) => [p.id, p])), new Map((cos || []).map((c) => [c.id, c])), quotes), needsDb: false };
}
