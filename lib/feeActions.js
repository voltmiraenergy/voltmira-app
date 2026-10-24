"use server";
// lib/feeActions.js — Settings, "Pay per job" (app/(app)/settings/FeesPanel.jsx): the workspace's won jobs and their
// fees, credit, VoltMira's invoices, the company tax id (IDNO) and the one-invoice-a-month switch. Read and written
// with the service role after checking who asks; the tax id and the switch are the owner's, and the tax id cannot be
// changed once a fee carries it (a new one would hand out three more free projects).
import { supabaseAdmin } from "./supabase.js";
import { currentCompany, currentUser } from "./session.js";
import { feePaywallOn, FREE_JOBS } from "./jobFees.js";
import { gatewayFor } from "./paymentGateway.js";
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
  const base = { isOwner, on: feePaywallOn(), test: gatewayFor().test === true, freeJobs: FREE_JOBS };
  const { data: c, error: cErr } = await db.from("companies").select("idno, fee_monthly_invoice").eq("id", co.id).maybeSingle();
  if (missing(cErr)) return { ...base, needsDb: true, fees: [], invoices: [], creditMinor: 0, freeUsed: 0 };
  const { data: fees, error } = await db.from("job_fees").select("*").eq("company_id", co.id).order("won_at", { ascending: false }).limit(300);
  if (missing(error)) return { ...base, needsDb: true, fees: [], invoices: [], creditMinor: 0, freeUsed: 0 };
  const ids = (fees || []).map((f) => f.project_id);
  const [{ data: projects }, { data: credits }, { data: invoices }] = await Promise.all([
    ids.length ? db.from("projects").select("id, title, client_name").in("id", ids) : { data: [] },
    db.from("job_fee_credits").select("amount_minor").eq("company_id", co.id).is("used_on_fee_id", null),
    db.from("job_fee_invoices").select("id, number, total_minor, issued_at, due_at, fee_ids").eq("company_id", co.id).order("issued_at", { ascending: false }).limit(60),
  ]);
  // the free projects are counted on the tax id, across the company's workspaces
  const scope = c?.idno ? `company_id.eq.${co.id},idno.eq.${c.idno}` : `company_id.eq.${co.id}`;
  const { count: freeUsed } = await db.from("job_fees").select("id", { count: "exact", head: true }).or(scope).not("free_slot", "is", null);
  const name = new Map((projects || []).map((p) => [p.id, p.client_name || p.title || ""]));
  return {
    ...base, needsDb: false, idno: c?.idno || "", monthly: !!c?.fee_monthly_invoice,
    fees: (fees || []).map((f) => ({
      id: f.id, projectId: f.project_id, client: name.get(f.project_id) || "", status: f.status, tier: f.tier, kw: Number(f.kw) || 0,
      amount_minor: Number(f.amount_minor) || 0, free_slot: f.free_slot, won_at: f.won_at, grace_ends_at: f.grace_ends_at,
      paid_at: f.paid_at, payment_method: f.payment_method, invoice_id: f.invoice_id,
    })),
    creditMinor: (credits || []).reduce((s, x) => s + (Number(x.amount_minor) || 0), 0),
    invoices: (invoices || []).map((i) => ({ id: i.id, number: i.number, total_minor: Number(i.total_minor) || 0, issued_at: i.issued_at, due_at: i.due_at, count: (i.fee_ids || []).length })),
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
  // the fees recorded before it now carry it, so the free projects count across the company's workspaces
  await db.from("job_fees").update({ idno }).eq("company_id", co.id).is("idno", null);
  await writeAudit(db, { companyId: co.id, actor: { id: w.user.id, email: w.user.email }, action: "company.idno", entity: "company", entityId: co.id, before: { idno: c?.idno || null }, after: { idno } });
  return { ok: true };
}

/** One invoice a month instead of one per fee: from 3 paid fees on. */
export async function setMonthlyInvoice(on) {
  const w = await who();
  if (!w) return { ok: false, error: "unauthorized" };
  if (!w.isOwner) return { ok: false, error: "owner_only" };
  const { db, co } = w;
  if (on) {
    const { count } = await db.from("job_fees").select("id", { count: "exact", head: true }).eq("company_id", co.id).eq("status", "paid");
    if ((count || 0) < 3) return { ok: false, error: "monthly_early" };
  }
  const { error } = await db.from("companies").update({ fee_monthly_invoice: !!on }).eq("id", co.id);
  if (error) return { ok: false, error: missing(error) ? "needs_db" : "save_failed" };
  return { ok: true };
}
