"use server";
// lib/feeActions.js — Settings, "Pay per job" (app/(app)/settings/FeesPanel.jsx): the workspace's signed jobs and
// their fees month by month (lib/feeOverview.js), VoltMira's statements, credit from cancelled jobs and the company
// tax id (IDNO); and, from a job's fee card, "the client gave up". Read and written with the service role after
// checking who asks; the tax id is the owner's, and cannot be changed once a fee carries it (a new one would hand out
// more free jobs).
import { supabaseAdmin, supabaseServer } from "./supabase.js";
import { currentCompany, currentUser, currentActor } from "./session.js";
import { feePaywallOn, FREE_JOBS, idnoValid } from "./jobFees.js";
import { feeOverview } from "./feeOverview.js";
import { onProjectLost, jobGate, requestWaiver, reconcileFreeSlots } from "./jobFeeServer.js";
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
  const ids = (fees || []).map((f) => f.project_id).filter(Boolean);
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
    // a deleted job: the names kept on its fee (add-fee-lockdown.sql)
    id: f.id, projectId: f.project_id, client: pr.get(f.project_id)?.client_name || f.client_name || "", title: pr.get(f.project_id)?.title || f.project_title || "",
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
  // 13 digits with a valid check digit (lib/jobFees.js idnoValid): an invented tax id does not get two more free jobs
  if (!idnoValid(idno)) return { ok: false, error: "bad_idno" };
  const { db, co } = w;
  const { data: c, error } = await db.from("companies").select("idno").eq("id", co.id).maybeSingle();
  if (missing(error)) return { ok: false, error: "needs_db" };
  if (c?.idno === idno) return { ok: true };
  if (c?.idno) {
    const { count } = await db.from("job_fees").select("id", { count: "exact", head: true }).eq("company_id", co.id).not("idno", "is", null);
    if (count) return { ok: false, error: "idno_locked" };
  }
  const actor = { id: w.user.id, email: w.user.email };
  // Free jobs counted on this workspace alone, before it had a tax id, now count with the company's other workspaces:
  // past FREE_JOBS in all they become due first (lib/jobFees.js reclaimFreeSlots), THEN the fees take the tax id, so
  // the database never sees more than FREE_JOBS free under one IDNO (add-fee-integrity.sql refuses that). Every step
  // is checked; a failure leaves the tax id unsaved and the installer tries again.
  const rec = await reconcileFreeSlots(db, { id: co.id, idno }, { actor });
  if (!rec.ok) return { ok: false, error: "save_failed" };
  const { error: fErr } = await db.from("job_fees").update({ idno }).eq("company_id", co.id).is("idno", null);
  if (fErr) return { ok: false, error: "save_failed" };
  const { error: uErr } = await db.from("companies").update({ idno }).eq("id", co.id);
  if (uErr) return { ok: false, error: "save_failed" };
  await writeAudit(db, { companyId: co.id, actor, action: "company.idno", entity: "company", entityId: co.id, before: { idno: c?.idno || null }, after: { idno } });
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
  const actor = await currentActor();
  // already lost: the fee is brought in line again (idempotent), in case it did not follow the first time
  if (p.status === "lost") {
    const again = await onProjectLost(supabaseAdmin(), projectId, { actor });
    return again.ok ? { ok: true, already: true, kept: !!again.kept } : { ok: false, error: "fee_not_updated" };
  }
  if (p.status !== "won") return { ok: true, already: true };
  const { error } = await sb.from("projects").update({ status: "lost" }).eq("id", projectId);
  if (error) return { ok: false, error: "save_failed" };
  const lost = await onProjectLost(supabaseAdmin(), projectId, { actor });
  // the job is marked lost but its fee did not follow: said, so the installer tries again (it is safe to repeat)
  if (!lost.ok) return { ok: false, error: "fee_not_updated" };
  await syncMilestones(supabaseAdmin(), projectId, { actor });
  await logActivity(sb, {
    companyId: p.company_id, kind: "sys", key: "act_gave_up", params: { b: p.title || "" },
    text: `The client gave up <b>${escapeHtml(p.title || "")}</b>`, actor, link: `/projects/${projectId}`,
  });
  // kept: paperwork had been made, so the fee stays (the card then offers to ask VoltMira to waive it)
  return { ok: true, kept: !!lost?.kept };
}

/**
 * A document of the quote's documents window (contract, commissioning act, diagram) is opened: allowed only for a
 * signed job whose statement is not overdue (lib/jobFeeServer.js jobGate), and recorded on its fee, as the first
 * paperwork made for it decides whether the client giving up still cancels the fee.
 */
export async function openPaperwork(projectId, kind) {
  if (!["contract", "commissioning", "diagram"].includes(kind)) return { ok: false, error: "bad_kind" };
  if (!/^[0-9a-f-]{36}$/i.test(String(projectId))) return { ok: false, error: "bad_id" };
  const [user, co] = await Promise.all([currentUser(), currentCompany()]);
  if (!user || !co) return { ok: false, error: "unauthorized" };
  const sb = await supabaseServer();
  const { data: p } = await sb.from("projects").select("*").eq("id", projectId).maybeSingle();
  if (!p || p.company_id !== co.id || !(await projectVisibility(user, co))(p)) return { ok: false, error: "not_found" };
  const { data: idRow } = await sb.from("companies").select("idno").eq("id", co.id).maybeSingle();
  const gate = await jobGate(supabaseAdmin(), { project: p, co: { ...co, idno: idRow?.idno || null }, user, produce: kind });
  return gate.locked ? { ok: false, error: gate.error } : { ok: true };
}

/** The client gave up after paperwork was made: the fee stays, and the installer asks VoltMira to waive it. */
export async function askFeeWaiver(projectId, reason) {
  if (!/^[0-9a-f-]{36}$/i.test(String(projectId))) return { ok: false, error: "bad_id" };
  const [user, co] = await Promise.all([currentUser(), currentCompany()]);
  if (!user || !co) return { ok: false, error: "unauthorized" };
  const sb = await supabaseServer();
  const { data: p } = await sb.from("projects").select("id, company_id, owner_id").eq("id", projectId).maybeSingle();
  if (!p || p.company_id !== co.id || !(await projectVisibility(user, co))(p)) return { ok: false, error: "not_found" };
  return requestWaiver(supabaseAdmin(), { projectId, reason, actor: await currentActor() });
}
