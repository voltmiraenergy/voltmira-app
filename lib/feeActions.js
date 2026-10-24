"use server";
// lib/feeActions.js — Settings, "Pay per job" (app/(app)/settings/FeesPanel.jsx): the workspace's signed jobs and
// their fees month by month (lib/feeOverview.js), VoltMira's statements, credit from cancelled jobs and the company
// tax id (IDNO); and, from a job's fee card, "the client gave up". Read and written with the service role after
// checking who asks; the tax id is the owner's, and cannot be changed once a fee carries it (a new one would hand out
// more free jobs).
import { supabaseAdmin, supabaseServer } from "./supabase.js";
import { currentCompany, currentUser, currentActor } from "./session.js";
import { feePaywallOn, FREE_JOBS } from "./jobFees.js";
import { feeOverview } from "./feeOverview.js";
import { onProjectLost } from "./jobFeeServer.js";
import { syncMilestones } from "./milestoneServer.js";
import { projectVisibility } from "./projectAccess.js";
import { logActivity } from "./activity.js";
import { escapeHtml } from "./safe.js";
import { writeAudit } from "./audit.js";

const missing = (e) => !!e && (e.code === "42P01" || e.code === "PGRST205" || e.code === "42703" || /does not exist|schema cache|column/i.test(e.message || ""));

async function who() {
  const [user, co] = await Promise.all([currentUser(), currentCompany()]);
  if (!user || !co) return null;
  const db = supabaseAdmin();
  const { data: me } = await db.from("profiles").select("role").eq("id", user.id).maybeSingle();
  return { user, co, db, isOwner: me?.role === "owner" };
}

export async function loadFeeOverview() {
  const w = await who();
  if (!w) return { error: "unauthorized" };
  const { db, co, isOwner } = w;
  const base = { isOwner, on: feePaywallOn(), freeJobs: FREE_JOBS, creditMinor: 0, freeUsed: 0, ...feeOverview({}) };
  const { data: c, error: cErr } = await db.from("companies").select("idno").eq("id", co.id).maybeSingle();
  if (missing(cErr)) return { ...base, needsDb: true };
  const { data: fees, error } = await db.from("job_fees").select("*").eq("company_id", co.id).order("won_at", { ascending: false }).limit(1000);
  if (missing(error)) return { ...base, needsDb: true, idno: c?.idno || "" };
  const ids = (fees || []).map((f) => f.project_id);
  const [{ data: projects }, { data: credits }, { data: invoices }] = await Promise.all([
    ids.length ? db.from("projects").select("id, title, client_name").in("id", ids) : { data: [] },
    db.from("job_fee_credits").select("amount_minor").eq("company_id", co.id).is("used_on_fee_id", null),
    db.from("job_fee_invoices").select("id, number, month, total_minor, issued_at, due_at, paid_at, fee_ids").eq("company_id", co.id).order("issued_at", { ascending: false }).limit(60),
  ]);
  // the free jobs are counted on the tax id, across the company's workspaces
  const scope = c?.idno ? `company_id.eq.${co.id},idno.eq.${c.idno}` : `company_id.eq.${co.id}`;
  const { count: freeUsed } = await db.from("job_fees").select("id", { count: "exact", head: true }).or(scope).not("free_slot", "is", null);
  const pr = new Map((projects || []).map((p) => [p.id, p]));
  const rows = (fees || []).map((f) => ({
    id: f.id, projectId: f.project_id, client: pr.get(f.project_id)?.client_name || "", title: pr.get(f.project_id)?.title || "",
    status: f.status, capped: Number(f.tier) === 1, kw: Number(f.kw) || 0, amount_minor: Number(f.amount_minor) || 0,
    free_slot: f.free_slot, won_at: f.won_at, trigger: f.trigger, payment_method: f.payment_method,
  }));
  return {
    ...base, needsDb: false, idno: c?.idno || "",
    ...feeOverview({ fees: rows, invoices: invoices || [] }),
    creditMinor: (credits || []).reduce((s, x) => s + (Number(x.amount_minor) || 0), 0),
    freeUsed: Math.min(FREE_JOBS, freeUsed || 0),
  };
}

/** The company tax id: 13 digits, the owner's to set; fixed once a fee carries it. */
export async function setCompanyIdno(value) {
  const w = await who();
  if (!w) return { ok: false, error: "unauthorized" };
  if (!w.isOwner) return { ok: false, error: "owner_only" };
  const idno = String(value || "").replace(/\s+/g, "");
  if (!/^[0-9]{13}$/.test(idno)) return { ok: false, error: "bad_idno" };
  const { db, co } = w;
  const { data: c, error } = await db.from("companies").select("idno").eq("id", co.id).maybeSingle();
  if (missing(error)) return { ok: false, error: "needs_db" };
  if (c?.idno === idno) return { ok: true };
  if (c?.idno) {
    const { count } = await db.from("job_fees").select("id", { count: "exact", head: true }).eq("company_id", co.id).not("idno", "is", null);
    if (count) return { ok: false, error: "idno_locked" };
  }
  const { error: uErr } = await db.from("companies").update({ idno }).eq("id", co.id);
  if (uErr) return { ok: false, error: "save_failed" };
  // the fees recorded before it now carry it, so the free jobs count across the company's workspaces
  await db.from("job_fees").update({ idno }).eq("company_id", co.id).is("idno", null);
  await writeAudit(db, { companyId: co.id, actor: { id: w.user.id, email: w.user.email }, action: "company.idno", entity: "company", entityId: co.id, before: { idno: c?.idno || null }, after: { idno } });
  return { ok: true };
}

/** The client gave up a signed job: it is marked lost and its fee follows (void, or credit when already paid). */
export async function clientGaveUp(projectId) {
  if (!/^[0-9a-f-]{36}$/i.test(String(projectId))) return { ok: false, error: "bad_id" };
  const [user, co] = await Promise.all([currentUser(), currentCompany()]);
  if (!user || !co) return { ok: false, error: "unauthorized" };
  const sb = await supabaseServer();
  const { data: p } = await sb.from("projects").select("id, status, title, company_id, owner_id").eq("id", projectId).maybeSingle();
  if (!p || !(await projectVisibility(user, co))(p)) return { ok: false, error: "not_found" };
  if (p.status !== "won") return { ok: true, already: true };
  const { error } = await sb.from("projects").update({ status: "lost" }).eq("id", projectId);
  if (error) return { ok: false, error: "save_failed" };
  const actor = await currentActor();
  await onProjectLost(supabaseAdmin(), projectId, { actor });
  await syncMilestones(supabaseAdmin(), projectId, { actor });
  await logActivity(sb, {
    companyId: p.company_id, kind: "sys", key: "act_gave_up", params: { b: p.title || "" },
    text: `The client gave up <b>${escapeHtml(p.title || "")}</b>`, actor, link: `/projects/${projectId}`,
  });
  return { ok: true };
}
