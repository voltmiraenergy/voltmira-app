"use server";
// lib/cashActions.js — the installer's side of the client's payments in stages (lib/milestones.js): the "Încasări"
// tab in Lucrări (every stage invoiced or still to come, the tiles, the months), marking a stage received, pausing a
// job's reminders, seeing the client's proof of transfer, and the payment plans (the workspace's default, a job's
// own). Reads go through the signed-in session (row security, and a Sales member sees only the jobs they own);
// writes through the service role once that is checked.
import { revalidatePath } from "next/cache";
import { supabaseServer, supabaseAdmin } from "./supabase.js";
import { currentCompany, currentUser, currentActor } from "./session.js";
import { projectVisibility } from "./projectAccess.js";
import { cashTiles, cashHistory, stateOf, cleanSchedule, scheduleOf } from "./milestones.js";
import { recordMilestonePayment, setJobPlan, syncMilestones, loadMilestones } from "./milestoneServer.js";
import { parseAmountMinor } from "./billing.js";
import { mdDayKey } from "./tz.js";
import { logActivity } from "./activity.js";
import { writeAudit } from "./audit.js";

const missing = (e) => !!e && (e.code === "42P01" || e.code === "PGRST205" || e.code === "42703" || /pay_milestones|pay_schedule|does not exist|schema cache/i.test(e.message || ""));
const UUID = /^[0-9a-f-]{36}$/i;

async function who() {
  const [user, co] = await Promise.all([currentUser(), currentCompany()]);
  if (!user || !co) return null;
  const sb = await supabaseServer();
  const { data: me } = await sb.from("profiles").select("role").eq("id", user.id).maybeSingle();
  return { user, co, sb, isOwner: me?.role === "owner", canSee: await projectVisibility(user, co) };
}

async function myProject(w, projectId) {
  if (!UUID.test(String(projectId || ""))) return null;
  const { data: p } = await w.sb.from("projects").select("*").eq("id", projectId).maybeSingle();
  return p && p.company_id === w.co.id && w.canSee(p) ? p : null;
}

async function myMilestone(w, milestoneId) {
  if (!UUID.test(String(milestoneId || ""))) return null;
  const { data: m } = await w.sb.from("pay_milestones").select("*").eq("id", milestoneId).maybeSingle();
  if (!m || m.company_id !== w.co.id) return null;
  return (await myProject(w, m.project_id)) ? m : null;
}

/** The "Încasări" tab: every stage of the jobs the person may see, the tiles and the months, in the main currency. */
export async function loadCash() {
  const w = await who();
  if (!w) return { error: "unauthorized" };
  const { sb, co } = w;
  const today = mdDayKey(Date.now());
  const { data: ms, error } = await sb.from("pay_milestones").select("*").order("due_on", { ascending: true }).limit(2000);
  if (error) return { needsDb: missing(error), rows: [], today };
  const pids = [...new Set((ms || []).map((m) => m.project_id))];
  const { data: projects } = pids.length ? await sb.from("projects").select("id, title, client_name, owner_id, company_id").in("id", pids) : { data: [] };
  const seen = new Map((projects || []).filter((p) => w.canSee(p)).map((p) => [p.id, p]));
  const mine = (ms || []).filter((m) => seen.has(m.project_id));
  // the payments of the six months shown, and this one
  const since = mdDayKey(Date.now() - 200 * 864e5);
  const { data: pays } = await sb.from("payments").select("amount_minor, currency, paid_at, project_id").gte("paid_at", since).limit(5000);
  const payments = (pays || []).filter((p) => seen.has(p.project_id));
  // the main currency: the workspace's, unless its jobs are all invoiced in another
  const counts = new Map();
  for (const m of mine) counts.set(m.currency, (counts.get(m.currency) || 0) + 1);
  const main = counts.has(co.currency) || !counts.size ? co.currency || "MDL" : [...counts].sort((a, b) => b[1] - a[1])[0][0];
  const total = new Map();
  for (const m of mine) total.set(m.project_id, (total.get(m.project_id) || 0) + 1);
  return {
    needsDb: false, today, currency: main, other: [...counts.keys()].filter((c) => c !== main),
    tiles: cashTiles(mine, payments, main, today),
    history: cashHistory(mine, payments, main, 6, today),
    rows: mine.map((m) => ({
      id: m.id, projectId: m.project_id, job: seen.get(m.project_id)?.title || "", client: seen.get(m.project_id)?.client_name || "",
      seq: m.seq, of: total.get(m.project_id), trigger: m.trigger, pct: Number(m.pct), amount_minor: Number(m.amount_minor), paid_minor: Number(m.paid_minor) || 0,
      currency: m.currency, invoice_no: m.invoice_no, issued_at: m.issued_at, due_on: m.due_on, paid_at: m.paid_at, token: m.pay_token,
      paused: !!m.reminders_paused, proof: !!m.proof_at, state: stateOf(m, today),
    })),
  };
}

/** A stage received: the amount (all of what is owed when left empty) and the day. */
export async function markReceived(milestoneId, { amount = "", paidAt = "" } = {}) {
  const w = await who();
  if (!w) return { ok: false, error: "unauthorized" };
  const m = await myMilestone(w, milestoneId);
  if (!m) return { ok: false, error: "not_found" };
  const minor = String(amount).trim() ? parseAmountMinor(amount) : null;
  if (String(amount).trim() && !(minor > 0)) return { ok: false, error: "amount" };
  const day = /^\d{4}-\d{2}-\d{2}$/.test(paidAt) && paidAt <= mdDayKey(Date.now()) ? paidAt : mdDayKey(Date.now());
  const r = await recordMilestonePayment(supabaseAdmin(), { milestoneId: m.id, companyId: w.co.id, amountMinor: minor, paidAt: day, actor: { id: w.user.id, email: w.user.email } });
  revalidatePath("/jobs");
  return r.ok ? { ok: true } : { ok: false, error: r.error === "already" ? "already" : r.error || "save_failed" };
}

/** Pause or resume the client's reminders for one job. */
export async function setReminders(projectId, paused) {
  const w = await who();
  if (!w) return { ok: false, error: "unauthorized" };
  const p = await myProject(w, projectId);
  if (!p) return { ok: false, error: "not_found" };
  const db = supabaseAdmin();
  const { error } = await db.from("pay_milestones").update({ reminders_paused: !!paused }).eq("project_id", p.id).eq("company_id", w.co.id);
  if (error) return { ok: false, error: missing(error) ? "needs_db" : "save_failed" };
  await writeAudit(db, { companyId: w.co.id, actor: { id: w.user.id, email: w.user.email }, action: paused ? "milestone.pause" : "milestone.resume", entity: "project", entityId: p.id, before: null, after: { paused: !!paused } });
  return { ok: true };
}

/** A short-lived link to the client's proof of transfer. */
export async function proofLink(milestoneId) {
  const w = await who();
  if (!w) return { ok: false, error: "unauthorized" };
  const m = await myMilestone(w, milestoneId);
  if (!m?.proof_path) return { ok: false, error: "not_found" };
  const { data } = await supabaseAdmin().storage.from("pay-proofs").createSignedUrl(m.proof_path, 300);
  return data?.signedUrl ? { ok: true, url: data.signedUrl } : { ok: false, error: "not_found" };
}

/** A job's stages and its plan, for its billing page. */
export async function loadJobPlan(projectId) {
  const w = await who();
  if (!w) return { error: "unauthorized" };
  const p = await myProject(w, projectId);
  if (!p) return { error: "not_found" };
  const { rows, needsDb } = await loadMilestones(w.sb, p.id);
  const plan = scheduleOf(p.pay_schedule, w.co.pay_schedule);
  const today = mdDayKey(Date.now());
  return {
    needsDb, status: p.status, plan,
    rows: rows.map((m) => ({ id: m.id, seq: m.seq, trigger: m.trigger, pct: Number(m.pct), amount_minor: Number(m.amount_minor), paid_minor: Number(m.paid_minor) || 0, currency: m.currency, invoice_no: m.invoice_no, due_on: m.due_on, token: m.pay_token, state: stateOf(m, today), paused: !!m.reminders_paused, proof: !!m.proof_at, term_days: m.term_days })),
  };
}

/** A job's own plan for the stages not invoiced yet (or for all of them, before it is signed). */
export async function saveJobPlan(projectId, { steps, termDays }) {
  const w = await who();
  if (!w) return { ok: false, error: "unauthorized" };
  const p = await myProject(w, projectId);
  if (!p) return { ok: false, error: "not_found" };
  const db = supabaseAdmin();
  const actor = await currentActor();
  const r = await setJobPlan(db, { project: p, co: w.co, steps, termDays: Number(termDays), actor });
  if (!r.ok) return r;
  // a step already reached is invoiced at once
  if (r.sync) await syncMilestones(db, p.id, { actor, io: { logActivity } });
  revalidatePath(`/projects/${p.id}/billing`);
  return { ok: true };
}

/** The workspace's default plan, the owner's to set. */
export async function saveDefaultPlan({ steps, termDays }) {
  const w = await who();
  if (!w) return { ok: false, error: "unauthorized" };
  if (!w.isOwner) return { ok: false, error: "owner" };
  const c = cleanSchedule({ steps, termDays: Number(termDays) });
  if (!c.ok) return c;
  const db = supabaseAdmin();
  const { error } = await db.from("companies").update({ pay_schedule: c.schedule }).eq("id", w.co.id);
  if (error) return { ok: false, error: missing(error) ? "needs_db" : "save_failed" };
  await writeAudit(db, { companyId: w.co.id, actor: { id: w.user.id, email: w.user.email }, action: "company.pay_schedule", entity: "company", entityId: w.co.id, before: w.co.pay_schedule || null, after: c.schedule });
  return { ok: true };
}

/** The workspace's default plan, to show. */
export async function loadDefaultPlan() {
  const w = await who();
  if (!w) return { error: "unauthorized" };
  return { plan: scheduleOf(w.co.pay_schedule), isOwner: w.isOwner };
}
