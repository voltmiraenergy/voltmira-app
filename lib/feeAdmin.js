// lib/feeAdmin.js — SERVER only. The platform admin's side of the fee for signed jobs (/traction): every fee and
// statement of the real workspaces with the names to read them by, and the two things only an admin does by hand:
// mark a statement paid when its bank transfer arrives, and waive a fee, each with a reference or reason, audited.
import { supabaseAdmin } from "./supabase.js";
import { markStatementPaid } from "./jobFeePay.js";
import { writeAudit } from "./audit.js";

/** { fees, invoices, companies: Map(id -> name), projects: Map(id -> title), needsDb } for the given workspaces. */
export async function loadFeeAdmin(companyIds) {
  const db = supabaseAdmin();
  const ids = [...new Set(companyIds || [])];
  const none = { fees: [], invoices: [], companies: new Map(), projects: new Map(), needsDb: false };
  if (!ids.length) return none;
  const { data: fees, error } = await db.from("job_fees").select("*").in("company_id", ids).order("won_at", { ascending: false }).limit(5000);
  if (error) return { ...none, needsDb: /job_fees|does not exist|schema cache/i.test(error.message || "") };
  const pids = [...new Set((fees || []).map((f) => f.project_id))];
  const [{ data: invoices }, { data: cos }, { data: ps }] = await Promise.all([
    db.from("job_fee_invoices").select("id, company_id, number, month, total_minor, fee_ids, payment_ref, issued_at, due_at, paid_at").in("company_id", ids).limit(5000),
    db.from("companies").select("id, name").in("id", ids),
    pids.length ? db.from("projects").select("id, title, client_name").in("id", pids) : { data: [] },
  ]);
  return {
    fees: fees || [], invoices: invoices || [], needsDb: false,
    companies: new Map((cos || []).map((c) => [c.id, c.name || ""])),
    projects: new Map((ps || []).map((p) => [p.id, p.title || p.client_name || ""])),
  };
}

/**
 * @param {{ action: "statement_paid"|"waive", invoiceId?: string, feeId?: string, reason?: string, ref?: string, actor: object }} a
 * statement_paid: its transfer arrived (the reference it carried); waive: no fee owed for one job after all (why).
 */
export async function adminSetFee(db, { action, invoiceId = "", feeId = "", reason = "", ref = "", actor }) {
  if (action === "statement_paid") {
    if (!invoiceId) return { ok: false, error: "not_found" };
    return markStatementPaid(db, { invoiceId, ref: String(ref || "").trim().slice(0, 120), actor });
  }
  if (action !== "waive") return { ok: false, error: "bad_action" };
  const why = String(reason || "").trim().slice(0, 500);
  if (why.length < 3) return { ok: false, error: "reason" };
  const { data: fee } = await db.from("job_fees").select("*").eq("id", feeId).maybeSingle();
  if (!fee) return { ok: false, error: "not_found" };
  if (fee.status !== "due") return { ok: false, error: "not_due" };
  const { error } = await db.from("job_fees").update({ status: "waived", note: why, payment_method: "admin", updated_at: new Date().toISOString() }).eq("id", feeId).eq("status", "due");
  if (error) return { ok: false, error: "save_failed" };
  await writeAudit(db, { companyId: fee.company_id, actor, action: "job_fee.waive", entity: "job_fee", entityId: fee.id, before: { status: "due" }, after: { status: "waived", reason: why } });
  return { ok: true };
}
