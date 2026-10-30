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
import { opsAlert } from "./opsAlert.js";

const missing = (e) => !!e && (e.code === "42P01" || e.code === "PGRST205" || /job_fees|does not exist|schema cache/i.test(e.message || ""));
// the database refused a third free job for the company (supabase/add-fee-integrity.sql job_fees_free_guard)
const freeRefused = (e) => !!e && /free_jobs_used/.test(e.message || "");
// a function the database does not have yet (an older install, before add-fee-integrity.sql)
const noFunction = (e) => !!e && (e.code === "PGRST202" || e.code === "42883" || /function .* does not exist|could not find the function/i.test(e.message || ""));

/** { fee, needsDb, error } for a project: error is true for any failed read (the fee is then unknown, not absent). */
export async function loadJobFee(db, projectId) {
  const { data, error } = await db.from("job_fees").select("*").eq("project_id", projectId).maybeSingle();
  if (error) return { fee: null, needsDb: missing(error), error: true };
  return { fee: data || null, needsDb: false, error: false };
}

/** How many free jobs the company has had: counted on its tax id across its workspaces, else on the workspace.
 *  null when the count could not be read: the caller must not take that as zero. */
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
  if (!co?.id || !co?.idno) return { ok: true, reclaimed: 0 };
  const [{ data: own, error: e1 }, { count: other, error: e2 }] = await Promise.all([
    db.from("job_fees").select("*").eq("company_id", co.id).eq("status", "free"),
    db.from("job_fees").select("id", { count: "exact", head: true }).eq("idno", co.idno).neq("company_id", co.id).not("free_slot", "is", null),
  ]);
  // an unread count would keep every free job: stop instead (the caller says the tax id could not be saved)
  if (e1 || e2) return { ok: false, reclaimed: 0 };
  const turn = reclaimFreeSlots(own || [], other || 0, now);
  let done = 0;
  for (const f of turn) {
    const { data, error } = await db.from("job_fees").update({ status: f.status, free_slot: null, amount_minor: f.amount_minor, tier: f.tier, grace_ends_at: f.grace_ends_at, updated_at: new Date(now).toISOString() })
      .eq("id", f.id).eq("status", "free").select("id");
    if (error) return { ok: false, reclaimed: done };
    if (!(data || []).length) continue;
    done++;
    await writeAudit(db, { companyId: co.id, actor, action: "job_fee.free_reclaimed", entity: "job_fee", entityId: f.id, before: { status: "free" }, after: { status: "due", amount_minor: f.amount_minor, idno: co.idno } });
  }
  return { ok: true, reclaimed: done };
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
// null when the signed offer could not be read: a fee priced without it could come out too low
async function signedKw(db, project) {
  const { data, error } = await db.from("proposals").select("snapshot").eq("project_id", project.id).not("accepted_at", "is", null)
    .order("accepted_at", { ascending: false }).limit(1).maybeSingle();
  if (error) return null;
  return Math.max(Number(data?.snapshot?.kw) || 0, Number(project.kw) || 0);
}

/**
 * Paperwork was made for a signed job (a contract, an invoice, the grid file, the handover...): the first time is
 * kept on its fee (`docs_at`), with each kind. From then on the client giving up no longer cancels the fee
 * (lib/jobFees.js feeOnLost).
 *
 * It must be on record before the document is handed out: the caller gives no document unless this says ok. The
 * write is conditional on the fee not being void, so a job cancelled at the same moment either keeps its fee (the
 * paperwork landed first) or gets no document (the cancellation landed first), never both. In one statement in the
 * database (add-fee-integrity.sql job_fee_record_paperwork); an older database without it gets the same conditional
 * update from here.
 * @returns {Promise<{ ok: boolean, error?: string }>}
 */
export async function recordPaperwork(db, fee, kind, now = Date.now()) {
  if (!fee?.id || !kind) return { ok: false, error: "no_fee" };
  if (fee.status === "void") return { ok: false, error: "void" };
  const kinds = Array.isArray(fee.docs_kinds) ? fee.docs_kinds : [];
  if (fee.docs_at && kinds.includes(kind)) return { ok: true };
  if (typeof db.rpc === "function") {
    const r = await db.rpc("job_fee_record_paperwork", { p_fee: fee.id, p_kind: String(kind) });
    if (!r.error) return r.data === true ? { ok: true } : { ok: false, error: "void" };
    if (!noFunction(r.error)) return { ok: false, error: "save_failed" };
  }
  const set = { docs_kinds: [...new Set([...kinds, kind])] };
  if (!fee.docs_at) set.docs_at = new Date(now).toISOString();
  const { data, error } = await db.from("job_fees").update(set).eq("id", fee.id).neq("status", "void").select("id");
  if (error) return { ok: false, error: "save_failed" };
  return (data || []).length ? { ok: true } : { ok: false, error: "void" };
}

/**
 * Take one unused credit for a fee, atomically: the credit is marked used only if nobody took it meanwhile
 * (`used_on_fee_id is null` in the same update), so two jobs signed at once cannot spend the same credit.
 * @returns {Promise<object|null>} the credit taken, or null
 */
async function claimCredit(db, companyId, feeId, needMinor, now) {
  const { data: credits, error } = await db.from("job_fee_credits").select("id, amount_minor").eq("company_id", companyId).is("used_on_fee_id", null).order("amount_minor", { ascending: true });
  if (error) return null;
  for (const c of (credits || []).filter((x) => Number(x.amount_minor) >= needMinor)) {
    const { data: got, error: e2 } = await db.from("job_fee_credits").update({ used_on_fee_id: feeId, used_at: new Date(now).toISOString() })
      .eq("id", c.id).is("used_on_fee_id", null).select("id, amount_minor");
    if (!e2 && (got || []).length) return got[0];
  }
  return null;
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
    // every read below decides money: one that fails stops here (ok: false) rather than counting as empty, so a
    // database hiccup never hands out a free job or prices a fee from a partial picture
    let { fee: existing, needsDb, error: readErr } = await loadJobFee(db, project.id);
    if (needsDb) return { ok: false, needsDb: true };
    if (readErr) return { ok: false, error: "read_failed" };
    const { data: co, error: coErr } = await db.from("companies").select("id, idno").eq("id", project.company_id).maybeSingle();
    if (coErr) return { ok: false, error: "read_failed" };
    if (!co) return { ok: false, skipped: "no_company" };

    // a paid job that was cancelled and is won again: its credit goes back (only if still unused: the update is
    // conditional, so it cannot be taken back after another job spent it), or this one owes its fee again
    if (existing?.status === "paid") {
      const { data: cr, error: crErr } = await db.from("job_fee_credits").select("id, used_on_fee_id").eq("source_fee_id", existing.id).maybeSingle();
      if (crErr) return { ok: false, error: "read_failed" };
      if (cr && !cr.used_on_fee_id) {
        const { data: took, error: tookErr } = await db.from("job_fee_credits").update({ used_on_fee_id: existing.id, used_at: new Date(now).toISOString() })
          .eq("id", cr.id).is("used_on_fee_id", null).select("id");
        if (tookErr) return { ok: false, error: "save_failed" };
        if (!(took || []).length) existing = { ...existing, status: "void" };   // spent elsewhere a moment ago
      } else if (cr && cr.used_on_fee_id && cr.used_on_fee_id !== existing.id) existing = { ...existing, status: "void" };
    }

    const usedFree = await freeJobsUsed(db, co);
    if (usedFree == null) return { ok: false, error: "read_failed" };
    const kw = await signedKw(db, project);
    if (kw == null) return { ok: false, error: "read_failed" };
    let r = feeOnWin({ existing, kw, usedFree, trigger, now });
    if (!r.changed && existing) return { ok: true, fee: existing };

    const fieldsOf = (row) => ({
      company_id: project.company_id, project_id: project.id, idno: co.idno || null, kw: row.kw, tier: row.tier,
      amount_minor: row.amount_minor, currency: "MDL", status: row.status, trigger: row.trigger || trigger,
      free_slot: row.free_slot ?? null, won_at: row.won_at, grace_ends_at: row.grace_ends_at,
      paid_at: row.paid_at ?? null, payment_method: row.payment_method ?? null, updated_at: new Date(now).toISOString(),
      // kept on the fee, so it still reads right if the job is deleted (the fee outlives it: add-fee-lockdown.sql)
      project_title: String(project.title || "").slice(0, 200), client_name: String(project.client_name || "").slice(0, 200),
    });
    const write = async (f) => {
      const q = (x) => (existing
        ? db.from("job_fees").update(x).eq("id", existing.id).select("*").single()
        : db.from("job_fees").insert(x).select("*").single());
      let w = await q(f);
      if (w.error && /project_title|client_name/.test(w.error.message || "")) {
        const { project_title: _t, client_name: _c, ...rest } = f;
        w = await q(rest);
      }
      return w;
    };
    let w = await write(fieldsOf(r.row));
    // the database counted the company's free jobs under a lock and refused a third (two jobs signed at once, or
    // from two workspaces of one company): this one is a paid job
    if (w.error && freeRefused(w.error)) {
      r = feeOnWin({ existing, kw, usedFree: FREE_JOBS, trigger, now });
      w = await write(fieldsOf(r.row));
    }
    if (w.error) {
      // two wins at once (the client signs as the installer marks it won): the other one made it
      if (w.error.code === "23505") {
        const again = await loadJobFee(db, project.id);
        return again.fee ? { ok: true, fee: again.fee } : { ok: false, error: "read_failed" };
      }
      return { ok: false, needsDb: missing(w.error), error: "save_failed" };
    }
    let fee = w.data;
    // credit from a cancelled paid job pays a new due fee: the credit is claimed first, atomically, then the fee is
    // marked paid only if it is still due; what is left of the credit stays as credit (one rest per fee: unique)
    if (fee.status === "due" && Number(fee.amount_minor) > 0) {
      const credit = await claimCredit(db, co.id, fee.id, Number(fee.amount_minor), now);
      if (credit) {
        const at = new Date(now).toISOString();
        const { data: paid, error: pErr } = await db.from("job_fees").update({ status: "paid", payment_method: "credit", paid_at: at, updated_at: at })
          .eq("id", fee.id).eq("status", "due").select("*");
        if (pErr || !(paid || []).length) {
          // the fee changed under us: the credit goes back untouched
          await db.from("job_fee_credits").update({ used_on_fee_id: null, used_at: null }).eq("id", credit.id).eq("used_on_fee_id", fee.id);
        } else {
          fee = paid[0];
          const rest = Number(credit.amount_minor) - Number(fee.amount_minor);
          if (rest > 0) {
            const { error: restErr } = await db.from("job_fee_credits").insert({ company_id: co.id, amount_minor: rest, source_fee_id: fee.id });
            if (restErr && restErr.code !== "23505") console.error("[job_fee] credit rest not kept:", restErr.message);
          }
          await writeAudit(db, { companyId: project.company_id, actor, entity: "job_fee", entityId: fee.id, action: "job_fee.credit_used", before: { status: "due" }, after: { status: "paid", credit_id: credit.id, amount_minor: fee.amount_minor } });
        }
      }
    }
    await writeAudit(db, {
      companyId: project.company_id, actor, entity: "job_fee", entityId: fee.id,
      action: !existing ? "job_fee.create" : existing.status === "due" ? "job_fee.reprice" : "job_fee.rewin",
      before: existing ? { status: existing.status, amount_minor: existing.amount_minor, tier: existing.tier } : null,
      after: { status: fee.status, amount_minor: fee.amount_minor, tier: fee.tier, trigger: fee.trigger, free_slot: fee.free_slot },
    });
    return { ok: true, fee };
  } catch (e) {
    console.error("[job_fee] not created:", e?.message);
    return { ok: false, error: "exception" };
  }
}

/** The client gave up (the project is marked lost): an unpaid fee is void and nothing is owed for it, also when it
 *  is already on a statement (the statement then asks only for the rest); a paid one leaves a credit (once: the
 *  credit table's unique source_fee_id). Safe to run again. ok: false when the fee could not be read or written, so
 *  the caller can say so and try again instead of reporting a cancellation that did not happen. */
export async function onProjectLost(db, projectId, { actor = null, now = Date.now() } = {}) {
  try {
    const { fee, needsDb, error: readErr } = await loadJobFee(db, projectId);
    if (needsDb) return { ok: true, skipped: true };
    if (readErr) return { ok: false, error: "read_failed" };
    if (!fee) return { ok: true, skipped: true };
    const credit = creditOnCancel(fee);
    if (credit) {
      const { error } = await db.from("job_fee_credits").insert({ company_id: fee.company_id, ...credit });
      if (error && error.code !== "23505") return { ok: false, error: "save_failed" };
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
    // void only while no paperwork is on record, in the same update: a document recorded a moment ago keeps the fee
    const { data: voided, error } = await db.from("job_fees").update({ status: "void", updated_at: new Date(now).toISOString() })
      .eq("id", fee.id).eq("status", "due").is("docs_at", null).select("id");
    if (error) return { ok: false, error: "save_failed" };
    if (!(voided || []).length) {
      const again = await loadJobFee(db, projectId);
      if (again.error) return { ok: false, error: "read_failed" };
      if (again.fee?.status === "due" && again.fee.docs_at) {
        await writeAudit(db, { companyId: fee.company_id, actor, action: "job_fee.kept", entity: "job_fee", entityId: fee.id, before: { status: "due" }, after: { status: "due", docs_at: again.fee.docs_at } });
        return { ok: true, kept: true };
      }
      return { ok: true };
    }
    await writeAudit(db, { companyId: fee.company_id, actor, action: "job_fee.void", entity: "job_fee", entityId: fee.id, before: { status: "due" }, after: { status: "void" } });
    return { ok: true };
  } catch (e) {
    console.error("[job_fee] lost not recorded:", e?.message);
    return { ok: false, error: "exception" };
  }
}

/** After a status change from the app: the fee follows (won creates or revives it, lost voids or credits it).
 *  @returns {Promise<{ ok: boolean, failed: string[] }>} the projects whose fee could not be brought in line (the
 *  daily sweep picks up a signed one; the caller may log or retry) */
export async function feeFollowsStatus(db, projectIds, status, { actor = null } = {}) {
  const failed = [];
  if (!["won", "lost"].includes(status) || !projectIds?.length) return { ok: true, failed };
  if (status === "lost") {
    for (const id of projectIds) if (!(await onProjectLost(db, id, { actor })).ok) failed.push(id);
  } else {
    const { data: rows, error } = await db.from("projects").select("*").in("id", projectIds);
    if (error) return { ok: false, failed: [...projectIds] };
    for (const p of rows || []) if (p.status === "won" && !(await ensureJobFee(db, p, { trigger: "manual", actor })).ok) failed.push(p.id);
  }
  if (failed.length) opsAlert("billing.fee_status_mismatch", { status, projects: failed.join(",") });
  return { ok: !failed.length, failed };
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
 *
 * With billing on it fails closed: when the fee cannot be read or made ("fee_unavailable"), or the paperwork about to
 * be produced cannot be put on record ("paperwork_not_recorded"), the document is not given. Billing off, demo and
 * sample jobs and platform admins pass as before.
 * @returns {Promise<{ locked: boolean, error?: string, fee: object|null, access: object }>}
 */
export async function jobGate(db, { project, co, user, now = Date.now(), produce = null }) {
  const on = feePaywallOn();
  const sample = project?.is_sample === true || isDemoEmail(user?.email);
  const admin = isPlatformAdmin(user?.email);
  if (!on || sample || admin) return { locked: false, fee: null, access: jobAccess({ fee: null, on, sample, admin, now }) };
  // the paperwork is for signed jobs only: a job kept "sent", or marked lost, gets none (lib/jobFees.js jobAccess)
  if (project?.status !== "won") return { locked: true, error: "not_signed", fee: null, access: jobAccess({ fee: null, on, signed: false, now }) };
  const loaded = await loadJobFee(db, project.id);
  let fee = loaded.fee;
  const unavailable = () => {
    opsAlert("billing.gate_closed_unavailable", { project: project.id, produce: produce || "" });
    return { locked: true, error: "fee_unavailable", fee, access: jobAccess({ fee: null, on, now }) };
  };
  // the fee could not be read (or the billing tables are missing while billing is on): no paperwork on a guess
  if (loaded.error) return unavailable();
  // no fee yet: made now; an unpaid one: priced again on the job as it is now (only ever upward)
  if (!fee || fee.status === "due") {
    const made = await ensureJobFee(db, project, { trigger: fee?.trigger || "manual", now });
    fee = made.fee || fee || null;
  }
  if (!fee) return unavailable();
  const access = jobAccess({ fee, on, now });
  // a won job's paperwork needs the company's tax id first: the free projects and the invoices are counted on it
  if (!co?.idno) return { locked: true, error: "needs_idno", fee, access };
  if (access.locked) return { locked: true, error: "job_fee_due", fee, access };
  // a document is being made: on record before it is handed out (cancelling is free only before the first one)
  if (produce) {
    const rec = await recordPaperwork(db, fee, produce, now);
    if (!rec.ok) {
      opsAlert("billing.paperwork_not_recorded", { fee: fee.id, project: project.id, produce, reason: rec.error });
      return { locked: true, error: rec.error === "void" ? "not_signed" : "paperwork_not_recorded", fee, access };
    }
  }
  return { locked: false, fee, access };
}

/** What a locked document sends the quote page as ?fee=: the tax id missing, the job not signed, billing that could
 *  not be checked or recorded right now, or the fee owed. */
export const feeParam = (error) => (error === "needs_idno" ? "idno" : error === "not_signed" ? "sign"
  : error === "fee_unavailable" || error === "paperwork_not_recorded" ? "retry" : "locked");

/** The HTTP status for a locked gate: 503 when billing could not be checked or recorded (try again), else 402. */
export const gateStatus = (error) => (error === "fee_unavailable" || error === "paperwork_not_recorded" ? 503 : 402);

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
  }, { status: gateStatus(g.error) });
}
