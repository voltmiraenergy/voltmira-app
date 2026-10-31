// lib/milestoneServer.js — SERVER only. The client's payments in stages in the database (supabase/add-milestones.sql):
// the stages created when a job is signed, each issued (an invoice number from the installer's own series, its due
// day) when its step is reached, void when the client gives up, and the payments recorded against them. The rules
// are lib/milestones.js; this reads and writes the rows with the service role and audits each change.
//
// syncMilestones is the one entry point: called after every change that can sign a job, tick an install step or
// lose a job (lib/acceptIo.js, lib/actions.js, lib/jobActions.js), and safe to call any number of times.
import { randomBytes } from "node:crypto";
import { planFor, reached, dueOn, scheduleOf, replan } from "./milestones.js";
import { mdDayKey } from "./tz.js";
import { writeAudit } from "./audit.js";

// the job's price as its invoice prints it; loaded when needed, so this file also runs under node --test (no Next)
const invoicePrice = async ({ project, co }) => (await import("./invoiceServer.js")).projectInvoice(project, co);
const missing = (e) => !!e && (e.code === "42P01" || e.code === "PGRST205" || e.code === "42703" || /pay_milestones|pay_schedule|does not exist|schema cache/i.test(e.message || ""));
export const newPayToken = () => randomBytes(18).toString("base64url");

/** { rows, needsDb } for a job, in their order. */
export async function loadMilestones(db, projectId) {
  const { data, error } = await db.from("pay_milestones").select("*").eq("project_id", projectId).order("seq", { ascending: true });
  if (error) return { rows: [], needsDb: missing(error) };
  return { rows: data || [], needsDb: false };
}

/** The installer's next invoice number, "PF-2026-0043": its own series, drawn by the server. */
export async function drawInvoiceNo(db, co, now = Date.now()) {
  const { data: seq, error } = await db.rpc("next_invoice_no_srv", { p_company: co.id });
  if (error || !seq) return null;
  const prefix = String(co.invoice_prefix || "PF").slice(0, 6);
  return `${prefix}-${mdDayKey(now).slice(0, 4)}-${String(seq).padStart(4, "0")}`;
}

/**
 * Bring a job's stages in line with it: created when it is signed, issued as their steps are reached, void when the
 * client gave up. Never touches a stage already paid.
 * @param {object} [o]
 * @param {(a: object) => Promise<any>} [o.price]  the job's price, { grossMinor, cur } (projectInvoice by default)
 * @returns {Promise<{ ok: boolean, issued?: object[], needsDb?: boolean, skipped?: string }>}
 */
export async function syncMilestones(db, projectId, { actor = null, now = Date.now(), price = null, io = {} } = {}) {
  try {
    const { data: p } = await db.from("projects").select("*").eq("id", projectId).maybeSingle();
    if (!p) return { ok: false, skipped: "no_project" };
    let { rows, needsDb } = await loadMilestones(db, p.id);
    if (needsDb) return { ok: false, needsDb: true };

    // the client gave up: what is not paid is not asked for any more
    if (p.status === "lost") {
      const open = rows.filter((r) => r.status === "planned" || (r.status === "issued" && !(Number(r.paid_minor) > 0)));
      if (open.length) {
        await db.from("pay_milestones").update({ status: "void", updated_at: new Date(now).toISOString() }).in("id", open.map((r) => r.id));
        await writeAudit(db, { companyId: p.company_id, actor, action: "milestone.void", entity: "project", entityId: p.id, before: { ids: open.map((r) => r.id) }, after: { status: "void" } });
      }
      return { ok: true, issued: [] };
    }
    if (p.status !== "won") return { ok: true, skipped: "not_won" };

    const { data: co } = await db.from("companies").select("*").eq("id", p.company_id).maybeSingle();
    if (!co) return { ok: false, skipped: "no_company" };

    // signed again after the client gave up: the void stages come back as they were
    if (rows.length && rows.every((r) => r.status === "void" || r.status === "paid")) {
      const back = rows.filter((r) => r.status === "void");
      if (back.length) {
        await db.from("pay_milestones").update({ status: "planned", invoice_no: null, issued_at: null, due_on: null, updated_at: new Date(now).toISOString() }).in("id", back.map((r) => r.id)).eq("status", "void");
        rows = rows.map((r) => (r.status === "void" ? { ...r, status: "planned", invoice_no: null, issued_at: null, due_on: null } : r));
      }
    }

    if (!rows.length) {
      const pr = await (price || invoicePrice)({ project: p, co });
      const grossMinor = Math.round(Number(pr.grossMinor) || 0);
      if (!(grossMinor > 0)) return { ok: true, skipped: "no_price" };
      const plan = planFor({ grossMinor, currency: pr.cur, schedule: scheduleOf(p.pay_schedule, co.pay_schedule) });
      const ins = await db.from("pay_milestones").insert(plan.map((r) => ({ ...r, company_id: p.company_id, project_id: p.id, pay_token: newPayToken() }))).select("*");
      if (ins.error) {
        // two syncs at once (the client signs as the installer marks it signed): the other one made them
        if (ins.error.code === "23505") rows = (await loadMilestones(db, p.id)).rows;
        else return { ok: false, needsDb: missing(ins.error) };
      } else rows = ins.data || [];
    }

    // issue every planned stage whose step is reached, in order
    const issued = [];
    for (const r of rows.sort((a, b) => a.seq - b.seq)) {
      if (r.status !== "planned" || !reached(r.trigger, { won: true, progress: p.install_progress })) continue;
      const no = await drawInvoiceNo(db, co, now);
      if (!no) return { ok: false, needsDb: true, issued };
      const at = new Date(now).toISOString();
      const set = { status: "issued", invoice_no: no, issued_at: at, due_on: dueOn(at, r.term_days), updated_at: at };
      const { data: up } = await db.from("pay_milestones").update(set).eq("id", r.id).eq("status", "planned").select("*");
      const row = Array.isArray(up) ? up[0] : up;
      if (!row) continue;   // issued by another call meanwhile
      issued.push(row);
      await writeAudit(db, { companyId: p.company_id, actor, action: "milestone.issue", entity: "pay_milestone", entityId: r.id, before: { status: "planned" }, after: { invoice_no: no, amount_minor: r.amount_minor, currency: r.currency, due_on: set.due_on } });
      if (io.logActivity) {
        await io.logActivity(db, { companyId: p.company_id, kind: "sys", key: "act_ms_issued", params: { b: p.title || p.client_name || "", n: no }, text: `Invoice ${no} issued for ${p.title || ""}`, link: `/jobs?view=cash` });
      }
    }
    return { ok: true, issued };
  } catch (e) {
    console.error("[milestones] not synced:", e?.message);
    return { ok: false };
  }
}

/**
 * A payment against a stage: recorded with the job's payments, and the stage paid once it is covered.
 * @param {{ milestoneId: string, companyId: string, amountMinor?: number, paidAt?: string, method?: string, reference?: string, actor?: object }} a
 */
export async function recordMilestonePayment(db, { milestoneId, companyId, amountMinor = null, paidAt = null, method = "bank", reference = "", actor = null, now = Date.now() }) {
  const { data: m } = await db.from("pay_milestones").select("*").eq("id", milestoneId).eq("company_id", companyId).maybeSingle();
  if (!m) return { ok: false, error: "not_found" };
  if (m.status !== "issued") return { ok: false, error: m.status === "paid" ? "already" : "not_issued" };
  const owed = Math.max(0, Number(m.amount_minor) - Number(m.paid_minor || 0));
  const amount = amountMinor == null ? owed : Math.round(Number(amountMinor));
  if (!(amount > 0)) return { ok: false, error: "amount" };
  const day = paidAt && /^\d{4}-\d{2}-\d{2}$/.test(paidAt) ? paidAt : mdDayKey(now);
  const pay = await db.from("payments").insert({
    company_id: companyId, project_id: m.project_id, milestone_id: m.id, amount_minor: amount, currency: m.currency, paid_at: day,
    method: ["bank", "cash", "card"].includes(method) ? method : "bank", reference: String(reference || m.invoice_no || "").slice(0, 120),
    idempotency_key: `ms-${m.id}-${Number(m.paid_minor || 0)}`, created_by: actor?.id || null,
  }).select("id").single();
  if (pay.error && pay.error.code !== "23505") return { ok: false, error: missing(pay.error) ? "needs_db" : "save_failed" };
  // the same click twice: the payment is already there; the stage is still brought in line below, so a first try
  // that saved the payment but not the stage is finished by the second
  const again = !!pay.error;
  const sync = await syncMilestonePaid(db, m, { day, now });
  if (!sync.ok) return { ok: false, error: "save_failed" };
  if (!again) await writeAudit(db, { companyId, actor, action: "milestone.paid", entity: "pay_milestone", entityId: m.id, before: { paid_minor: m.paid_minor, status: m.status }, after: { ...sync.set, amount_minor: amount } });
  return again ? { ok: true, already: true, milestone: { ...m, ...sync.set } } : { ok: true, milestone: { ...m, ...sync.set } };
}

/**
 * A stage's paid amount from its payments, the source of truth (never added onto a stale figure), and its status
 * from that: paid when covered, else still issued. Checked; safe to run again; used after a payment is recorded or
 * removed.
 * @returns {Promise<{ ok: boolean, set?: object }>}
 */
export async function syncMilestonePaid(db, m, { day = null, now = Date.now() } = {}) {
  const { data: pays, error } = await db.from("payments").select("amount_minor, paid_at").eq("milestone_id", m.id);
  if (error) return { ok: false };
  const paidMinor = (pays || []).reduce((t, x) => t + (Number(x.amount_minor) || 0), 0);
  const full = paidMinor >= Number(m.amount_minor) && paidMinor > 0;
  const last = (pays || []).map((x) => x.paid_at).filter(Boolean).sort().pop() || day || null;
  const set = { paid_minor: paidMinor, paid_at: paidMinor > 0 ? last : null, status: full ? "paid" : m.status === "planned" ? "planned" : "issued", updated_at: new Date(now).toISOString() };
  const { error: uErr } = await db.from("pay_milestones").update(set).eq("id", m.id);
  return uErr ? { ok: false } : { ok: true, set };
}

/** One job's own plan for the stages not issued yet (lib/milestones.js replan); the issued ones stay. */
export async function setJobPlan(db, { project, co, steps, termDays, actor = null, price = null }) {
  const { rows, needsDb } = await loadMilestones(db, project.id);
  if (needsDb) return { ok: false, error: "needs_db" };
  const pr = await (price || invoicePrice)({ project, co });
  const grossMinor = Math.round(Number(pr.grossMinor) || 0);
  if (!rows.length) {
    // not signed yet: the plan is kept on the job and used when it is
    const r = replan({ rows: [], steps, termDays, grossMinor, currency: pr.cur });
    if (!r.ok) return r;
    const { error } = await db.from("projects").update({ pay_schedule: { steps, termDays } }).eq("id", project.id);
    return error ? { ok: false, error: missing(error) ? "needs_db" : "save_failed" } : { ok: true };
  }
  const r = replan({ rows, steps, termDays, grossMinor, currency: rows[0].currency });
  if (!r.ok) return r;
  const planned = rows.filter((x) => x.status === "planned");
  if (planned.length) await db.from("pay_milestones").delete().in("id", planned.map((x) => x.id)).eq("status", "planned");
  const ins = await db.from("pay_milestones").insert(r.rows.map((x) => ({ ...x, company_id: project.company_id, project_id: project.id, pay_token: newPayToken() }))).select("*");
  if (ins.error) return { ok: false, error: "save_failed" };
  await writeAudit(db, { companyId: project.company_id, actor, action: "milestone.replan", entity: "project", entityId: project.id, before: { steps: planned.map((x) => [x.trigger, Number(x.pct)]) }, after: { steps: steps.map((x) => [x.trigger, x.pct]), termDays } });
  // a step already reached is issued at once
  return { ok: true, sync: true };
}

/** After a status change from the app: the stages follow (signed creates or brings them back, lost voids them). */
export async function milestonesFollow(db, projectIds, status, { actor = null, io = {} } = {}) {
  if (!["won", "lost"].includes(status)) return;
  for (const id of projectIds || []) await syncMilestones(db, id, { actor, io });
}
