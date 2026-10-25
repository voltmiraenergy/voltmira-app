// lib/jobFeeServer.js — SERVER only. The fee per won project in the database (supabase/add-job-fees.sql): created
// when a job is won, voided or turned into credit when it is lost, and the gate in front of the job's paperwork. The
// rules themselves are lib/jobFees.js; this reads and writes the rows, with the service role, and audits each change.
//
// Fees are created from every place a job is won (lib/acceptProposal.js, markProjectWon, bulkUpdateStatus,
// cycleProjectStatus) and, as a safety net for any path that changes a status without them, by the gate itself: a
// won job with no fee gets one the first time its paperwork is asked for.
import { feeOnWin, feeOnLost, creditOnCancel, jobAccess, feePaywallOn, feeFor, FREE_JOBS, reclaimFreeSlots } from "./jobFees.js";
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

/** How many free jobs the company has had: counted on its tax id across its workspaces, else on the workspace. */
export async function freeJobsUsed(db, co) {
  const scope = co?.idno ? `company_id.eq.${co.id},idno.eq.${co.idno}` : `company_id.eq.${co.id}`;
  const { count, error } = await db.from("job_fees").select("id", { count: "exact", head: true }).or(scope).not("free_slot", "is", null);
  return error ? null : count || 0;
}

/**
 * The workspace just gave its tax id: free jobs it had counted on its own while it had none are measured against
 * the company's other workspaces, and those past FREE_JOBS become due (lib/jobFees.js reclaimFreeSlots), audited.
 * @returns {Promise<{ reclaimed: number }>}
 */
export async function reconcileFreeSlots(db, co, { actor = null, now = Date.now() } = {}) {
  if (!co?.id || !co?.idno) return { reclaimed: 0 };
  const [{ data: own }, { count: other }] = await Promise.all([
    db.from("job_fees").select("*").eq("company_id", co.id).eq("status", "free"),
    db.from("job_fees").select("id", { count: "exact", head: true }).eq("idno", co.idno).neq("company_id", co.id).not("free_slot", "is", null),
  ]);
  const turn = reclaimFreeSlots(own || [], other || 0, now);
  for (const f of turn) {
    const { error } = await db.from("job_fees").update({ status: f.status, free_slot: null, amount_minor: f.amount_minor, tier: f.tier, grace_ends_at: f.grace_ends_at, updated_at: new Date(now).toISOString() })
      .eq("id", f.id).eq("status", "free");
    if (error) continue;
    await writeAudit(db, { companyId: co.id, actor, action: "job_fee.free_reclaimed", entity: "job_fee", entityId: f.id, before: { status: "free" }, after: { status: "due", amount_minor: f.amount_minor, idno: co.idno } });
  }
  return { reclaimed: turn.length };
}

/**
 * The daily safety net: a job marked signed by any path that made no fee (a status written straight to the
 * database, a failed write) gets one now, so no signed job is ever left off the statements. Only jobs signed since
 * add-fee-lockdown.sql (projects.won_at, stamped by the database); demo workspaces and sample jobs are skipped.
 * Read in pages of 1,000.
 * @param {{ skipCompany?: (id: string) => Promise<boolean> }} [o]
 * @returns {Promise<{ checked: number, made: number }>}
 */
export async function sweepWonWithoutFee(db, { skipCompany = null, now = Date.now(), budgetMs = 8_000 } = {}) {
  const started = Date.now();
  const tally = { checked: 0, made: 0 };
  for (let from = 0; ; from += 1000) {
    // won_at is stamped by the database the moment a job turns signed (add-fee-lockdown.sql): a job signed before
    // fees existed has none and is never charged after the fact
    const { data: won, error } = await db.from("projects").select("id").eq("status", "won").not("won_at", "is", null).order("id").range(from, from + 999);
    if (error || !won?.length) break;
    tally.checked += won.length;
    const ids = won.map((p) => p.id);
    const { data: have } = await db.from("job_fees").select("project_id").in("project_id", ids);
    const has = new Set((have || []).map((f) => f.project_id));
    for (const id of ids.filter((x) => !has.has(x))) {
      if (Date.now() - started > budgetMs) return tally;   // the rest tomorrow
      const { data: p } = await db.from("projects").select("*").eq("id", id).maybeSingle();
      if (!p || p.status !== "won" || p.is_sample === true || (skipCompany && (await skipCompany(p.company_id)))) continue;
      const r = await ensureJobFee(db, p, { trigger: "manual", now });
      if (r.ok && r.fee) tally.made++;
    }
    if (won.length < 1000) break;
  }
  return tally;
}

/**
 * Before a fee goes on a statement: priced again from its job as it is now (the fee only ever goes up), so a system
 * grown after the paperwork was opened is billed at its real size. A fee whose job was deleted keeps its price.
 */
export async function repriceForStatement(db, fee, { now = Date.now() } = {}) {
  if (!fee?.project_id || fee.status !== "due") return fee;
  const { data: p } = await db.from("projects").select("*").eq("id", fee.project_id).maybeSingle();
  if (!p || p.status !== "won") return fee;
  const r = await ensureJobFee(db, p, { trigger: fee.trigger || "manual", now });
  return r.fee && r.fee.status === "due" ? r.fee : fee;
}

/** What a job not signed yet will cost when it is: its fee, or free while the company has free jobs left. */
export async function feePreview(db, project, co) {
  const kw = Number(project?.kw) || 0;
  const used = await freeJobsUsed(db, co);
  const { minorMdl, capped } = feeFor(kw);
  return { kw, minorMdl, capped, free: used != null && used < FREE_JOBS };
}

// the size the fee is for: the larger of the accepted offer's frozen kW and the quote's own now, so a quote shrunk
// before it is marked signed and grown again after cannot keep a small fee (the fee only ever goes up)
async function signedKw(db, project) {
  const { data } = await db.from("proposals").select("snapshot").eq("project_id", project.id).not("accepted_at", "is", null)
    .order("accepted_at", { ascending: false }).limit(1).maybeSingle();
  return Math.max(Number(data?.snapshot?.kw) || 0, Number(project.kw) || 0);
}

/**
 * Paperwork was made for a signed job (a contract, an invoice, the grid file, the handover...): the first time is
 * kept on its fee (`docs_at`), with each kind. From then on the client giving up no longer cancels the fee
 * (lib/jobFees.js feeOnLost). Before add-fee-lockdown.sql it does nothing.
 */
export async function recordPaperwork(db, fee, kind, now = Date.now()) {
  if (!fee?.id || !kind) return;
  const kinds = Array.isArray(fee.docs_kinds) ? fee.docs_kinds : [];
  if (fee.docs_at && kinds.includes(kind)) return;
  const set = { docs_kinds: [...new Set([...kinds, kind])] };
  if (!fee.docs_at) set.docs_at = new Date(now).toISOString();
  await db.from("job_fees").update(set).eq("id", fee.id);
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

    const usedFree = await freeJobsUsed(db, co);
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
      // kept on the fee, so it still reads right if the job is deleted (the fee outlives it: add-fee-lockdown.sql)
      project_title: String(project.title || "").slice(0, 200), client_name: String(project.client_name || "").slice(0, 200),
    };
    const write = (f) => (existing
      ? db.from("job_fees").update(f).eq("id", existing.id).select("*").single()
      : db.from("job_fees").insert(f).select("*").single());
    let w = await write(fields);
    if (w.error && /project_title|client_name/.test(w.error.message || "")) {
      const { project_title: _t, client_name: _c, ...rest } = fields;
      w = await write(rest);
    }
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

/** The client gave up (the project is marked lost): an unpaid fee is void and nothing is owed for it, also when it
 *  is already on a statement (the statement then asks only for the rest); a paid one leaves a credit. */
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
    if (lost.kept) {
      // paperwork was made for it: the fee stays (the installer can ask VoltMira to waive it)
      await writeAudit(db, { companyId: fee.company_id, actor, action: "job_fee.kept", entity: "job_fee", entityId: fee.id, before: { status: "due" }, after: { status: "due", docs_at: fee.docs_at } });
      return { ok: true, kept: true };
    }
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
 * Is this work for a signed job only, and the job not signed? The install steps and the crew's install, service
 * and maintenance visits are the job itself: run on a quote never marked signed, they were a way to do the whole job
 * in VoltMira without its fee. A survey visit stays open before signing. Off with the switch, for demo and sample
 * jobs and for platform admins, as jobGate.
 */
export function signedWorkOnly(project, user) {
  if (!feePaywallOn() || project?.is_sample === true || isDemoEmail(user?.email) || isPlatformAdmin(user?.email)) return false;
  return project?.status !== "won";
}

/**
 * May the person open this job's paperwork? The switch, demo and sample jobs, platform admins, the company's tax id,
 * then the fee (lib/jobFees.js jobAccess). A won job with no fee yet gets one here.
 * @returns {Promise<{ locked: boolean, error?: string, fee: object|null, access: object }>}
 */
export async function jobGate(db, { project, co, user, now = Date.now(), produce = null }) {
  const on = feePaywallOn();
  const sample = project?.is_sample === true || isDemoEmail(user?.email);
  const admin = isPlatformAdmin(user?.email);
  if (!on || sample || admin) return { locked: false, fee: null, access: jobAccess({ fee: null, on, sample, admin, now }) };
  // the paperwork is for signed jobs only: a job kept "sent", or marked lost, gets none (lib/jobFees.js jobAccess)
  if (project?.status !== "won") return { locked: true, error: "not_signed", fee: null, access: jobAccess({ fee: null, on, signed: false, now }) };
  let { fee } = await loadJobFee(db, project.id);
  // no fee yet: made now; an unpaid one: priced again on the job as it is now (only ever upward)
  if (!fee || fee.status === "due") fee = (await ensureJobFee(db, project, { trigger: fee?.trigger || "manual", now })).fee || fee || null;
  const access = jobAccess({ fee, on, now });
  // a won job's paperwork needs the company's tax id first: the free projects and the invoices are counted on it
  if (fee && !co?.idno) return { locked: true, error: "needs_idno", fee, access };
  if (access.locked) return { locked: true, error: "job_fee_due", fee, access };
  // a document is being made: kept on the fee (cancelling is free only before the first one)
  if (produce && fee) await recordPaperwork(db, fee, produce, now);
  return { locked: false, fee, access };
}

/** What a locked document sends the quote page as ?fee=: the tax id missing, the job not signed, or the fee owed. */
export const feeParam = (error) => (error === "needs_idno" ? "idno" : error === "not_signed" ? "sign" : "locked");

/** The installer asks VoltMira to waive a fee kept after the client gave up (paperwork had been made). */
export async function requestWaiver(db, { projectId, reason, actor = null, now = Date.now() }) {
  const why = String(reason || "").trim().slice(0, 500);
  if (why.length < 5) return { ok: false, error: "reason" };
  const { fee } = await loadJobFee(db, projectId);
  if (!fee || fee.status !== "due") return { ok: false, error: "not_due" };
  const { error } = await db.from("job_fees").update({ waiver_reason: why, waiver_requested_at: new Date(now).toISOString() }).eq("id", fee.id);
  if (error) return { ok: false, error: missing(error) || /waiver/.test(error.message || "") ? "needs_db" : "save_failed" };
  await writeAudit(db, { companyId: fee.company_id, actor, action: "job_fee.waiver_request", entity: "job_fee", entityId: fee.id, before: null, after: { reason: why } });
  return { ok: true };
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
