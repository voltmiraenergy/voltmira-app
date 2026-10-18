// lib/ticketFlow.js — maintenance tickets (docs/MARKETPLACE.md): opened by a
// monitoring alert, the homeowner or the installer; a visit scheduled; the
// outcome logged; each change an append-only event, audited, and told to the
// side that did not make it. Written with the service role after the caller's
// checks. io: { notify({ project, ticket, from, to, source }) }.
import { nextTicketStatus, cleanTicketInput, visitOk, ticketFromAssessment } from "./maintenance.js";
import { writeAudit } from "./audit.js";

const missing = (e) => e && (e.code === "42P01" || e.code === "PGRST205" || /does not exist|schema cache/i.test(e.message || ""));
const now = () => new Date().toISOString();

/**
 * @param {object} a
 * @param {object} a.project   { id, company_id, ... }
 * @param {"monitoring"|"homeowner"|"installer"} a.source
 * @param {{ kind, title, detail }} a.input
 * @param {string} [a.alertKey]  one open ticket per monitoring alert
 */
export async function openTicket(db, { project, source, input, alertKey = null, actor = null, io }) {
  const c = cleanTicketInput(input || {});
  if (!c.ok) return { ok: false, error: c.error };
  const ins = await db.from("maintenance_tickets").insert({
    company_id: project.company_id, project_id: project.id, source, ...c.value, status: "open",
    alert_key: alertKey, created_by: actor?.id || null,
  }).select("*").single();
  if (ins.error) {
    if (ins.error.code === "23505") return { ok: true, already: true };
    return { ok: false, error: missing(ins.error) ? "needs_db" : "save_failed" };
  }
  const t = ins.data;
  await db.from("ticket_events").insert({ ticket_id: t.id, company_id: t.company_id, from_status: "", to_status: "open", source, note: c.value.detail.slice(0, 500) });
  await writeAudit(db, { companyId: t.company_id, actor, action: "ticket.open", entity: "maintenance_ticket", entityId: t.id, after: { projectId: project.id, source, kind: t.kind, alertKey } });
  await io?.notify?.({ project, ticket: t, from: "", to: "open", source });
  return { ok: true, ticket: t };
}

/**
 * Move a ticket: schedule (with the visit time), resolve (with the outcome),
 * close, or reopen.
 */
export async function updateTicket(db, { companyId, project, ticketId, to, visitAt = null, outcome = "", note = "", source, actor = null, io }) {
  const { data: t, error } = await db.from("maintenance_tickets").select("*").eq("id", ticketId).maybeSingle();
  if (missing(error)) return { ok: false, error: "needs_db" };
  if (!t || t.company_id !== companyId || t.project_id !== project.id) return { ok: false, error: "not_found" };
  // a homeowner may only reopen what was resolved, or close what is theirs to close
  if (source === "homeowner" && !(to === "open" && t.status === "resolved") && !(to === "closed" && t.status === "resolved")) return { ok: false, error: "not_allowed" };
  const step = nextTicketStatus(t.status, to);
  if (!step.ok) return { ok: false, error: step.error };
  if (step.same) return { ok: true, already: true, ticket: t };
  const set = { status: to, updated_at: now() };
  if (to === "scheduled") {
    if (!visitOk(visitAt)) return { ok: false, error: "visit_at" };
    set.visit_at = new Date(visitAt).toISOString();
  }
  if (to === "resolved") {
    const o = String(outcome || "").trim().slice(0, 2000);
    if (o.length < 2) return { ok: false, error: "outcome" };
    set.outcome = o;
  }
  await db.from("maintenance_tickets").update(set).eq("id", t.id).eq("status", t.status);
  const fresh = { ...t, ...set };
  const evNote = to === "scheduled" ? set.visit_at : to === "resolved" ? set.outcome : String(note || "").slice(0, 500);
  await db.from("ticket_events").insert({ ticket_id: t.id, company_id: companyId, from_status: t.status, to_status: to, source, note: evNote });
  await writeAudit(db, { companyId, actor, action: "ticket.status", entity: "maintenance_ticket", entityId: t.id, before: { status: t.status, visitAt: t.visit_at }, after: { status: to, visitAt: fresh.visit_at, source } });
  await io?.notify?.({ project, ticket: fresh, from: t.status, to, source });
  return { ok: true, ticket: fresh };
}

/**
 * Tickets from the monitoring check, one per system, problem and month.
 * @param {Array<{ project, assessment, month, title }>} items  title: in the workspace's language
 */
export async function openFromMonitoring(db, items, { io } = {}) {
  let opened = 0;
  for (const it of items) {
    const t = ticketFromAssessment(it.assessment, it.month);
    if (!t) continue;
    const r = await openTicket(db, { project: it.project, source: "monitoring", input: { kind: t.kind, title: it.title(t), detail: it.detail ? it.detail(t) : "" }, alertKey: t.alert_key, io });
    if (r.ok && !r.already) opened++;
    if (!r.ok && r.error === "needs_db") break;
  }
  return { opened };
}
