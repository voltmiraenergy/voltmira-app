// lib/portfolioLoad.js — server-side loading of one portfolio and the quotes it
// can draw on, shared by the page, the PDF report page and the export routes so
// they all see exactly what the caller may see. Server-only (reads the session).
//
// RLS scopes every read to the caller's company. On top of that, when an owner
// has turned RBAC on, a Sales title sees only their own quotes (lib/rbac.js), so
// a portfolio cannot be used to read colleagues' quotes they could not open.
import { supabaseServer, supabaseAdmin } from "./supabase.js";
import { currentCompany, currentUser } from "./session.js";
import { companyEngine } from "./engineSettings.js";
import { normLang } from "./i18n.js";
import { canViewAllProjects } from "./rbac.js";
import { getFxRates } from "./fx.js";

// What a portfolio needs from a quote row; the rest (BOM, roof drawings) stays on the server.
// lat/lon (supabase/add-project-coords.sql) place the asset on the map; a
// database without those columns simply gives null.
const KEEP = ["id", "title", "client_name", "address", "kw", "price", "cons", "market", "batt", "batt_kwh", "use_monthly",
  "cons_monthly", "afm_subsidy", "yield_per_kwp", "monthly_yield_shape", "status", "created_at", "owner_id", "lat", "lon"];

const UUID = /^[0-9a-f-]{36}$/i;
const DB_MISSING = /portfolios|schema cache|does not exist/i;

/**
 * @returns {Promise<{state:"ok"|"needs_db"|"missing"|"error"|"unauthorized", lang:string, co?:object, portfolio?:object,
 *   quotes?:object[], E?:object, fx?:{rates:object, meta:object}, schemeLimitKw?:object}>}
 */
export async function loadPortfolio(id) {
  const co = await currentCompany();
  const lang = normLang(co?.lang);
  const user = await currentUser();
  if (!user || !co) return { state: "unauthorized", lang };
  if (!UUID.test(String(id))) return { state: "missing", lang };

  const sb = await supabaseServer();
  const { data: portfolio, error } = await sb.from("portfolios").select("*").eq("id", id).maybeSingle();
  if (error) return { state: DB_MISSING.test(error.message || "") ? "needs_db" : "error", lang };
  if (!portfolio) return { state: "missing", lang };

  const { data: me } = await supabaseAdmin().from("profiles").select("id, role, title").eq("id", user.id).maybeSingle();
  let { data: rows } = await sb.from("projects").select("*").in("market", ["MD", "UA"])
    .order("created_at", { ascending: false }).limit(500);
  if (!canViewAllProjects(me, co.rbac_enabled)) rows = (rows || []).filter((r) => r.owner_id === user.id);

  // a quote whose proposal the client accepted (signed) counts as signed even
  // before anyone marks it won; a failed lookup only loses that hint
  let signed = new Set();
  const ids = (rows || []).map((r) => r.id);
  if (ids.length) {
    const { data: props, error: pErr } = await sb.from("proposals").select("project_id").in("project_id", ids).not("accepted_at", "is", null);
    if (!pErr) signed = new Set((props || []).map((p) => p.project_id));
  }
  const quotes = (rows || []).map((r) => ({ ...Object.fromEntries(KEEP.map((k) => [k, r[k] ?? null])), signed: signed.has(r.id) }));
  const E = { ...(await companyEngine(co)), subsidyAmountRon: Number(co.subsidy_amount_ron ?? 20000) };

  // where the display-currency rates come from: the same memoised lookup the
  // engine used, with its source and date
  let fx = { rates: { EUR: 1, MDL: Number(E.fx?.MDL) || null, UAH: Number(E.fx?.UAH) || null }, meta: {} };
  try {
    const live = await getFxRates();
    fx = { rates: live.rates, meta: live.meta };
  } catch { /* the engine's rates stand, shown as not live */ }
  return { state: "ok", lang, co, portfolio, quotes, E, fx, schemeLimitKw: { MD: Number(co.prosumer_limit_kw ?? 10.8) } };
}
