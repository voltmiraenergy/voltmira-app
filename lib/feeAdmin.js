// lib/feeAdmin.js — SERVER only. The platform admin's side of the fee per won project (/traction): every fee of the
// real workspaces with the names to read it by, and the two things only an admin does by hand: mark a fee paid when
// a bank transfer arrives, and waive one, each with a reason, each audited.
import { supabaseAdmin } from "./supabase.js";
import { markFeePaid } from "./jobFeePay.js";
import { writeAudit } from "./audit.js";

/** { fees, companies: Map(id -> name), projects: Map(id -> title), needsDb } for the given workspaces. */
export async function loadFeeAdmin(companyIds) {
  const db = supabaseAdmin();
  const ids = [...new Set(companyIds || [])];
  if (!ids.length) return { fees: [], companies: new Map(), projects: new Map(), needsDb: false };
  const { data: fees, error } = await db.from("job_fees").select("*").in("company_id", ids).order("won_at", { ascending: false }).limit(2000);
  if (error) return { fees: [], companies: new Map(), projects: new Map(), needsDb: /job_fees|does not exist|schema cache/i.test(error.message || "") };
  const pids = [...new Set((fees || []).map((f) => f.project_id))];
  const [{ data: cos }, { data: ps }] = await Promise.all([
    db.from("companies").select("id, name").in("id", ids),
    pids.length ? db.from("projects").select("id, title, client_name").in("id", pids) : { data: [] },
  ]);
  return {
    fees: fees || [], needsDb: false,
    companies: new Map((cos || []).map((c) => [c.id, c.name || ""])),
    projects: new Map((ps || []).map((p) => [p.id, p.title || p.client_name || ""])),
  };
}

/**
 * @param {{ feeId: string, action: "paid"|"waive", reason: string, ref?: string, actor: object }} a
 * paid: a transfer arrived (the reference it carried); waive: no fee owed after all (the reason why).
 */
export async function adminSetFee(db, { feeId, action, reason = "", ref = "", actor }) {
  const why = String(reason || "").trim().slice(0, 500);
  if (why.length < 3) return { ok: false, error: "reason" };
  if (action === "paid") {
    const r = await markFeePaid(db, { feeId, method: "transfer", ref: String(ref || why).slice(0, 120), actor });
    if (r.ok && !r.already) await db.from("job_fees").update({ note: why }).eq("id", feeId);
    return r;
  }
  if (action !== "waive") return { ok: false, error: "bad_action" };
  const { data: fee } = await db.from("job_fees").select("*").eq("id", feeId).maybeSingle();
  if (!fee) return { ok: false, error: "not_found" };
  if (!["due", "void"].includes(fee.status)) return { ok: false, error: "not_due" };
  const { error } = await db.from("job_fees").update({ status: "waived", note: why, payment_method: "admin", updated_at: new Date().toISOString() }).eq("id", feeId).eq("status", fee.status);
  if (error) return { ok: false, error: "save_failed" };
  await writeAudit(db, { companyId: fee.company_id, actor, action: "job_fee.waive", entity: "job_fee", entityId: fee.id, before: { status: fee.status }, after: { status: "waived", reason: why } });
  return { ok: true };
}
