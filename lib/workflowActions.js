"use server";
// lib/workflowActions.js — the server side of the workflow rail and the
// add-to-portfolio card on a quote (components/WorkflowRail.jsx,
// components/AddToPortfolio.jsx).
//
// Everything runs on the caller's own Supabase session (supabaseServer), so
// row-level security scopes every read and write to their company. On top of
// that, when an owner has turned RBAC on, a Sales title only reaches quotes
// they own (lib/rbac.js), the same rule the editor and the portfolio loader
// apply. Each action returns a plain object and never throws for an expected
// case (no table yet, not won, wrong market), so the UI can say what happened.
import { revalidatePath } from "next/cache";
import { supabaseServer, supabaseAdmin } from "./supabase.js";
import { currentCompany } from "./session.js";
import { canViewAllProjects } from "./rbac.js";
import { mdDayKey } from "./tz.js";
import { projectWorkflow, appendUnique, PORTFOLIO_MARKETS } from "./workflow.js";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const NO_TABLE = /portfolios|schema cache|does not exist/i;

/** The signed-in user, their company and the quote, or why not. */
async function loadQuote(sb, projectId) {
  if (!UUID.test(String(projectId || ""))) return { error: "bad_id" };
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return { error: "auth" };
  const { data: p, error } = await sb.from("projects").select("*").eq("id", projectId).maybeSingle();
  if (error) return { error: "read" };
  if (!p) return { error: "missing" };
  const co = await currentCompany();
  if (co?.rbac_enabled) {
    const { data: me } = await supabaseAdmin().from("profiles").select("id, role, title").eq("id", user.id).maybeSingle();
    if (!canViewAllProjects(me, co.rbac_enabled) && p.owner_id !== user.id) return { error: "not_yours" };
  }
  return { user, co, p };
}

/** The portfolios holding a quote, or null when the table is not there yet. */
async function portfoliosHolding(sb, projectId) {
  const { data, error } = await sb.from("portfolios").select("id, name, market, project_ids").contains("project_ids", [projectId]);
  if (error) return NO_TABLE.test(error.message || "") ? null : [];
  return data || [];
}

/**
 * Where one quote stands (lib/workflow.js), computed from its rows.
 * @returns {Promise<{ ok: true, wf: object, portfolios: Array<{id:string,name:string}>, invoiceNo: string|null } | { ok: false, error: string }>}
 */
export async function getProjectWorkflow(projectId) {
  const sb = await supabaseServer();
  const q = await loadQuote(sb, projectId);
  if (q.error) return { ok: false, error: q.error };
  const { p } = q;
  const since48h = new Date(Date.now() - 2 * 864e5).toISOString();

  const [propRes, leadRes, readRes, holding] = await Promise.all([
    sb.from("proposals").select("code, opens, last_open, created_at, accepted_at").eq("project_id", p.id),
    sb.from("leads").select("*").eq("project_id", p.id).limit(1),
    sb.from("production_readings").select("project_id").eq("project_id", p.id).limit(1),
    portfoliosHolding(sb, p.id),
  ]);
  // the earliest-sent proposal, as lib/proposalStats.js keeps it
  const props = (propRes.data || []).slice().sort((a, b) => String(a.created_at).localeCompare(String(b.created_at)));
  const prop = props[0] || null;
  const stats = prop ? { code: prop.code, opens: prop.opens || 0, lastOpen: prop.last_open || null, sentAt: prop.created_at || null, acceptedAt: prop.accepted_at || null } : null;

  let recentOpens = 0;
  if (prop?.code) {
    const { data: ev } = await sb.from("proposal_events").select("created_at")
      .eq("code", prop.code).eq("kind", "open").gte("created_at", since48h).limit(200);
    recentOpens = (ev || []).length;
  }

  const now = Date.now();
  const wf = projectWorkflow({
    project: p, stats, lead: (leadRes.data || [])[0] || null,
    hasReadings: !readRes.error && (readRes.data || []).length > 0,
    inPortfolio: !!(holding && holding.length), recentOpens, now, todayKey: mdDayKey(now),
  });
  return {
    ok: true, wf,
    portfolios: (holding || []).map((x) => ({ id: x.id, name: x.name || "" })),
    invoiceNo: p.invoice_no || null,
  };
}

/**
 * The portfolios this quote could go into: same market, the caller's company.
 * @returns {Promise<{ state: "ok"|"needs_db"|"not_won"|"market"|"error", market?: string,
 *   portfolios?: Array<{id:string,name:string,n:number,has:boolean}> }>}
 */
export async function listPortfoliosFor(projectId) {
  const sb = await supabaseServer();
  const q = await loadQuote(sb, projectId);
  if (q.error) return { state: "error", error: q.error };
  const { p } = q;
  if (!PORTFOLIO_MARKETS.includes(p.market)) return { state: "market", market: p.market };
  const { data, error } = await sb.from("portfolios").select("id, name, market, project_ids, updated_at")
    .eq("market", p.market).order("updated_at", { ascending: false }).limit(100);
  if (error) return { state: NO_TABLE.test(error.message || "") ? "needs_db" : "error", market: p.market };
  const list = (data || []).map((x) => {
    const ids = Array.isArray(x.project_ids) ? x.project_ids : [];
    return { id: x.id, name: x.name || "", n: ids.length, has: ids.includes(p.id) };
  });
  return { state: p.status === "won" ? "ok" : "not_won", market: p.market, portfolios: list };
}

function revalidateAll(portfolioId, projectId) {
  revalidatePath("/portfolios");
  if (portfolioId) revalidatePath(`/portfolios/${portfolioId}`);
  revalidatePath("/dashboard");
  revalidatePath("/projects");
  if (projectId) revalidatePath(`/projects/${projectId}`);
}

/**
 * Add a won quote to an existing portfolio of the same market. The list is
 * appended without duplicates, and the write only lands if nobody saved the
 * portfolio in between (compare-and-swap on updated_at, retried a few times),
 * so a colleague's concurrent change is not overwritten.
 * @returns {Promise<{ ok: boolean, error?: string, already?: boolean, portfolio?: {id:string,name:string} }>}
 */
export async function addToPortfolio(projectId, portfolioId) {
  if (!UUID.test(String(portfolioId || ""))) return { ok: false, error: "bad_id" };
  const sb = await supabaseServer();
  const q = await loadQuote(sb, projectId);
  if (q.error) return { ok: false, error: q.error };
  const { p } = q;
  if (p.status !== "won") return { ok: false, error: "not_won" };
  if (!PORTFOLIO_MARKETS.includes(p.market)) return { ok: false, error: "market" };

  for (let attempt = 0; attempt < 4; attempt++) {
    const { data: pf, error } = await sb.from("portfolios").select("id, name, market, project_ids, updated_at").eq("id", portfolioId).maybeSingle();
    if (error) return { ok: false, error: NO_TABLE.test(error.message || "") ? "needs_db" : "read" };
    if (!pf) return { ok: false, error: "missing" };
    if (pf.market !== p.market) return { ok: false, error: "market" };
    const portfolio = { id: pf.id, name: pf.name || "" };
    const next = appendUnique(pf.project_ids, p.id);
    if (next.full) return { ok: false, error: "full" };
    if (!next.added) return { ok: true, already: true, portfolio };
    const { data: upd, error: wErr } = await sb.from("portfolios")
      .update({ project_ids: next.ids, updated_at: new Date().toISOString() })
      .eq("id", pf.id).eq("updated_at", pf.updated_at).select("id");
    if (wErr) return { ok: false, error: "write" };
    if (upd && upd.length) {
      revalidateAll(pf.id, p.id);
      return { ok: true, portfolio };
    }
    // someone saved it in between: read again and retry
  }
  return { ok: false, error: "busy" };
}

/**
 * Start a portfolio in this quote's market with the quote already in it.
 * company_id defaults to the caller's company in the database.
 * @returns {Promise<{ ok: boolean, error?: string, portfolio?: {id:string,name:string} }>}
 */
export async function createPortfolioWith(projectId, name) {
  const sb = await supabaseServer();
  const q = await loadQuote(sb, projectId);
  if (q.error) return { ok: false, error: q.error };
  const { p } = q;
  if (p.status !== "won") return { ok: false, error: "not_won" };
  if (!PORTFOLIO_MARKETS.includes(p.market)) return { ok: false, error: "market" };
  const clean = String(name || "").trim().slice(0, 160) || "Portfolio";
  const { data, error } = await sb.from("portfolios").insert({ name: clean, market: p.market, project_ids: [p.id] }).select("id, name").single();
  if (error || !data) return { ok: false, error: error && NO_TABLE.test(error.message || "") ? "needs_db" : "write" };
  revalidateAll(data.id, p.id);
  return { ok: true, portfolio: { id: data.id, name: data.name || clean } };
}

