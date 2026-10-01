// lib/tractionData.js — load every workspace's rows for lib/traction.js.
// Server-only, service role: it reads across tenants on purpose, so only call
// it after isPlatformAdmin() has passed (app/(app)/traction, app/api/admin).
import { quote, defaultEngineSettings } from "@voltmira/engine";
import { supabaseAdmin } from "./supabase.js";
import { getFxRates } from "./fx.js";
import { rowToQuoteInput } from "./quoteInput.js";
import { isDemoEmail } from "./demo.js";
import { computeTraction } from "./traction.js";
import { isPlatformAdmin } from "./platformAdmin.js";

const PAGE = 1000;   // PostgREST's default row cap per request

/** Every row of a query, a page at a time. */
async function all(build) {
  const out = [];
  for (let from = 0; from < 500_000; from += PAGE) {
    const { data, error } = await build().range(from, from + PAGE - 1);
    if (error) throw error;
    out.push(...(data || []));
    if (!data || data.length < PAGE) break;
  }
  return out;
}

/** Try the richer column list first; fall back if a newer migration hasn't run. */
async function allWithFallback(table, colsList, tweak = (q) => q) {
  let last;
  for (const cols of colsList) {
    try { return await all(() => tweak(supabaseAdmin().from(table).select(cols))); }
    catch (e) { last = e; }
  }
  throw last;
}

export async function loadTraction({ weeks = 12, now = Date.now() } = {}) {
  const since = new Date(now - (weeks * 7 + 70) * 864e5).toISOString();
  const [companies, profiles, projects, proposals, leads, activity, fx] = await Promise.all([
    allWithFallback("companies", [
      "id, name, created_at, plan, engine, paddle_subscription_id, stripe_subscription_id",
      "id, name, created_at, plan, engine, stripe_subscription_id",
      "id, name, created_at, plan, engine",
    ]),
    allWithFallback("profiles", ["company_id, email"]),
    allWithFallback("projects", ["*"]),
    allWithFallback("proposals", ["project_id, company_id, created_at, opens, accepted_at"]),
    allWithFallback("leads", ["company_id, project_id, created_at, source, sample", "company_id, project_id, created_at, source"]),
    // Only the recent window matters for "active"; the log grows fastest.
    allWithFallback("activity", ["company_id, created_at, actor_id"], (q) => q.gte("created_at", since)).catch(() => []),
    getFxRates().then((r) => r.rates).catch(() => null),
  ]);

  // Contract value per quote, priced the way the dashboard's pipeline is.
  const engines = new Map(companies.map((c) => [c.id, { ...defaultEngineSettings(), ...(c.engine || {}), ...(fx ? { fx } : {}) }]));
  const grossCache = new Map();
  const grossOf = (p) => {
    if (grossCache.has(p.id)) return grossCache.get(p.id);
    let v = 0;
    try { v = quote(rowToQuoteInput(p), engines.get(p.company_id) || defaultEngineSettings()).e.grossCost || 0; } catch { v = 0; }
    grossCache.set(p.id, v);
    return v;
  };

  // The team's own workspaces aren't traction: any a platform admin belongs
  // to, plus any listed by id (e.g. a colleague's test account).
  const excludeIds = String(process.env.TRACTION_EXCLUDE_COMPANY_IDS || "").split(",").map((s) => s.trim()).filter(Boolean);
  return computeTraction({
    companies, profiles, projects, proposals, leads, activity, grossOf, now, weeks,
    isDemoEmail, isInternalEmail: (e) => isPlatformAdmin(e), excludeIds,
  });
}
