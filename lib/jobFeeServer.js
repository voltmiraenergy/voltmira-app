// lib/jobFeeServer.js — SERVER only. The fee per won project in the database (supabase/add-job-fees.sql): created
// when a job is won, voided or turned into credit when it is lost, and the gate in front of the job's paperwork. The
// rules themselves are lib/jobFees.js; this reads and writes the rows, with the service role, and audits each change.
//
// Fees are created from every place a job is won (lib/acceptProposal.js, markProjectWon, bulkUpdateStatus,
// cycleProjectStatus) and, as a safety net for any path that changes a status without them, by the gate itself: a
// won job with no fee gets one the first time its paperwork is asked for.
import { feeOnWin, feeOnLost, creditOnCancel, jobAccess, feePaywallOn } from "./jobFees.js";
import { writeAudit } from "./audit.js";
import { isPlatformAdmin } from "./platformAdmin.js";
import { isDemoEmail } from "./demo.js";

const missing = (e) => !!e && (e.code === "42P01" || e.code === "PGRST205" || /job_fees|does not exist|schema cache/i.test(e.message || ""));

/** { fee, needsDb } for a project. */
export async function loadJobFee(db, projectId) {
  const { data, error } = await db.from("job_fees").select("*").eq("project_id", projectId).maybeSingle();
  if (error) return { fee: null, needsDb: missing(error) };
  return { fee: data || null, needsDb: false };
}

// the size the client signed: the accepted offer's frozen kW, else the quote's
async function signedKw(db, project) {
  const { data } = await db.from("proposals").select("snapshot").eq("project_id", project.id).not("accepted_at", "is", null)
    .order("accepted_at", { ascending: false }).limit(1).maybeSingle();
  const k = Number(data?.snapshot?.kw);
  return k > 0 ? k : Number(project.kw) || 0;
}

/**
 * The project was won: create its fee, or bring an existing one back (lib/jobFees.js feeOnWin).
 * @param {object} db       service-role client
 * @param {object} project  the projects row (status already "won")
 * @param {object} [o]
 * @param {"signed"|"manual"} [o.trigger]
 * @param {{id?:string,email?:string}|null} [o.actor]
 * @returns {Promise<{ ok: boolean, fee?: object, skipped?: string, needsDb?: boolean }>}
 */
export async function ensureJobFee(db, project, { trigger = "manual", actor = null, now = Date.now() } = {}) {
  if (!project?.id) return { ok: false, skipped: "no_project" };
  if (project.is_sample === true) return { ok: true, skipped: "sample" };
  try {
    let { fee: existing, needsDb } = await loadJobFee(db, project.id);
    if (needsDb) return { ok: false, needsDb: true };
    const { data: co } = await db.from("companies").select("id, idno").eq("id", project.company_id).maybeSingle();
    if (!co) return { ok: false, skipped: "no_company" };

    // a paid job that was cancelled and is won again: its credit goes back, or, when already spent on another
    // job, this one owes its fee again
    if (existing?.status === "paid") {
      const { data: cr } = await db.from("job_fee_credits").select("id, used_on_fee_id").eq("source_fee_id", existing.id).maybeSingle();
      if (cr && !cr.used_on_fee_id) await db.from("job_fee_credits").update({ used_on_fee_id: existing.id, used_at: new Date(now).toISOString() }).eq("id", cr.id);
      else if (cr && cr.used_on_fee_id && cr.used_on_fee_id !== existing.id) existing = { ...existing, status: "void" };
    }

    const scope = co.idno ? `company_id.eq.${co.id},idno.eq.${co.idno}` : `company_id.eq.${co.id}`;
    const { count: usedFree } = await db.from("job_fees").select("id", { count: "exact", head: true }).or(scope).not("free_slot", "is", null);
    const kw = await signedKw(db, project);
    // the smallest unused credit that covers the fee pays it; what is left of it stays as credit
    const probe = feeOnWin({ existing, kw, usedFree: usedFree || 0, trigger, now });
    let credit = null;
    if (probe.row.status === "due") {
      const { data: credits } = await db.from("job_fee_credits").select("id, amount_minor").eq("company_id", co.id).is("used_on_fee_id", null).order("amount_minor", { ascending: true });
      credit = (credits || []).find((c) => Number(c.amount_minor) >= Number(probe.row.amount_minor)) || null;
    }
    const r = credit ? feeOnWin({ existing, kw, usedFree: usedFree || 0, creditMinor: Number(credit.amount_minor), trigger, now }) : probe;
    if (!r.changed && existing) return { ok: true, fee: existing };

    const fields = {
      company_id: project.company_id, project_id: project.id, idno: co.idno || null, kw: r.row.kw, tier: r.row.tier,
      amount_minor: r.row.amount_minor, currency: "MDL", status: r.row.status, trigger: r.row.trigger || trigger,
      free_slot: r.row.free_slot ?? null, won_at: r.row.won_at, grace_ends_at: r.row.grace_ends_at,
      paid_at: r.row.paid_at ?? null, payment_method: r.row.payment_method ?? null, updated_at: new Date(now).toISOString(),
    };
    const w = existing
      ? await db.from("job_fees").update(fields).eq("id", existing.id).select("*").single()
      : await db.from("job_fees").insert(fields).select("*").single();
    if (w.error) {
      // two wins at once (the client signs as the installer marks it won): the other one made it
      if (w.error.code === "23505") return { ok: true, fee: (await loadJobFee(db, project.id)).fee };
      return { ok: false, needsDb: missing(w.error) };
    }
    if (credit && r.creditUsed) {
      await db.from("job_fee_credits").update({ used_on_fee_id: w.data.id, used_at: new Date(now).toISOString() }).eq("id", credit.id);
      const rest = Number(credit.amount_minor) - r.creditUsed;
      if (rest > 0) await db.from("job_fee_credits").insert({ company_id: co.id, amount_minor: rest, source_fee_id: w.data.id });
    }
    await writeAudit(db, {
      companyId: project.company_id, actor, entity: "job_fee", entityId: w.data.id,
      action: !existing ? "job_fee.create" : existing.status === "due" ? "job_fee.reprice" : "job_fee.rewin",
      before: existing ? { status: existing.status, amount_minor: existing.amount_minor, tier: existing.tier } : null,
      after: { status: w.data.status, amount_minor: w.data.amount_minor, tier: w.data.tier, trigger: w.data.trigger, free_slot: w.data.free_slot },
    });
    return { ok: true, fee: w.data };
  } catch (e) {
    console.error("[job_fee] not created:", e?.message);
    return { ok: false };
  }
}

/** The project was marked lost: an unpaid fee is void (its paperwork stays locked); a paid one leaves a credit. */
export async function onProjectLost(db, projectId, { actor = null, now = Date.now() } = {}) {
  try {
    const { fee, needsDb } = await loadJobFee(db, projectId);
    if (needsDb || !fee) return { ok: true, skipped: true };
    const credit = creditOnCancel(fee);
    if (credit) {
      const { error } = await db.from("job_fee_credits").insert({ company_id: fee.company_id, ...credit });
      if (!error) await writeAudit(db, { companyId: fee.company_id, actor, action: "job_fee.credit", entity: "job_fee", entityId: fee.id, before: null, after: credit });
      return { ok: true };
    }
    const lost = feeOnLost(fee);
    if (!lost.changed) return { ok: true };
    await db.from("job_fees").update({ status: "void", updated_at: new Date(now).toISOString() }).eq("id", fee.id).eq("status", "due");
    await writeAudit(db, { companyId: fee.company_id, actor, action: "job_fee.void", entity: "job_fee", entityId: fee.id, before: { status: "due" }, after: { status: "void" } });
    return { ok: true };
  } catch (e) {
    console.error("[job_fee] lost not recorded:", e?.message);
    return { ok: false };
  }
}

/** After a status change from the app: the fee follows (won creates or revives it, lost voids or credits it). */
export async function feeFollowsStatus(db, projectIds, status, { actor = null } = {}) {
  if (!["won", "lost"].includes(status) || !projectIds?.length) return;
  if (status === "lost") { for (const id of projectIds) await onProjectLost(db, id, { actor }); return; }
  const { data: rows } = await db.from("projects").select("*").in("id", projectIds);
  for (const p of rows || []) if (p.status === "won") await ensureJobFee(db, p, { trigger: "manual", actor });
}

/**
 * May the person open this job's paperwork? The switch, demo and sample jobs, platform admins, the company's tax id,
 * then the fee (lib/jobFees.js jobAccess). A won job with no fee yet gets one here.
 * @returns {Promise<{ locked: boolean, error?: string, fee: object|null, access: object }>}
 */
export async function jobGate(db, { project, co, user, now = Date.now() }) {
  const on = feePaywallOn();
  const sample = project?.is_sample === true || isDemoEmail(user?.email);
  const admin = isPlatformAdmin(user?.email);
  if (!on || sample || admin) return { locked: false, fee: null, access: jobAccess({ fee: null, on, sample, admin, now }) };
  let { fee } = await loadJobFee(db, project.id);
  if (!fee && project.status === "won") fee = (await ensureJobFee(db, project, { trigger: "manual", now })).fee || null;
  const access = jobAccess({ fee, on, now });
  // a won job's paperwork needs the company's tax id first: the free projects and the invoices are counted on it
  if (fee && !co?.idno) return { locked: true, error: "needs_idno", fee, access };
  return { locked: access.locked, error: access.locked ? "job_fee_due" : undefined, fee, access };
}

/** The 402 a locked paperwork route answers, or null when it may go on. */
export async function assertJobUnlocked(db, ctx) {
  const g = await jobGate(db, ctx);
  if (!g.locked) return null;
  const f = g.fee;
  // a plain web Response (Next routes take it as is), so this file also runs under node --test
  return Response.json({
    error: g.error, graceEndsAt: g.access?.graceEndsAt || null,
    fee: f ? { id: f.id, status: f.status, tier: f.tier, amount_minor: f.amount_minor, currency: f.currency, grace_ends_at: f.grace_ends_at } : null,
  }, { status: 402 });
}
