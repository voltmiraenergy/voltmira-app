// lib/gridFlow.js — a quote's grid-connection file sent to the operator, and
// every status after it (docs/INTEGRATIONS.md). Written with the service role
// after the route has checked the project is the caller's.
//
//   submit   the package checked (lib/gridSubmission.js checkPackage), a
//            tracked reference, the operator reached through its adapter
//            (email, or the mock that only records), the submission and its
//            first event stored, the grid file's "applied" stage ticked
//   status   a change the operator made (the installer records it; an
//            operator channel can later post the same): the transition
//            checked, an append-only event (idempotent by event id), the
//            matching stage ticked, and the installer and the homeowner told
//   resend   after "documents requested": the package again, back to submitted
// Each one is audited. io carries the side effects: { notify(change) }.
import crypto from "node:crypto";
import { checkPackage, nextGridStatus, newGridReference, STAGE_FOR } from "./gridSubmission.js";
import { writeAudit } from "./audit.js";

const missing = (e) => e && (e.code === "42P01" || e.code === "PGRST205" || /does not exist|schema cache/i.test(e.message || ""));
// a column the database does not have yet
const newColumn = (e) => e && (e.code === "42703" || e.code === "PGRST204" || /column .* does not exist|Could not find the .* column/i.test(e.message || ""));
const OPEN = ["submitted", "docs_requested", "approved", "meter_installed"];

export async function latestGrid(db, projectId) {
  const { data, error } = await db.from("grid_submissions").select("*").eq("project_id", projectId).order("created_at", { ascending: false }).limit(1).maybeSingle();
  if (missing(error)) return { needsDb: true, row: null };
  return { needsDb: false, row: data || null };
}

/** Tick the grid file's stage for a status, on the day it happened (install_progress.gridFile). */
async function mirrorStage(db, project, operator, status, day) {
  const stage = STAGE_FOR[status];
  if (!stage) return;
  const prog = { ...(project.install_progress || {}) };
  const file = { operator: null, stages: {}, ...(prog.gridFile || {}) };
  if (file.stages?.[stage]) return;
  prog.gridFile = { ...file, operator: file.operator || operator, stages: { ...(file.stages || {}), [stage]: day } };
  await db.from("projects").update({ install_progress: prog }).eq("id", project.id);
}

/**
 * @param {object} a
 * @param {object} a.project      the projects row (the caller's)
 * @param {"premier"|"rednord"} a.operator
 * @param {"person"|"company"} [a.kind]  who applies: decides the documents asked for
 * @param {number} [a.installedKw]  the installation's power, checked against the contracted power and the ceilings
 * @param {string[]} a.missingDetails  gridMissing(applicant)
 * @param {string[]} a.attached   documents the installer confirms are attached
 * @param {boolean} a.representative
 * @param {object} a.adapter      lib/gridSubmission.js
 * @param {(ref: string) => Promise<object>} a.buildPackage  { subject, html, attachments, replyTo }
 * @param {string} a.today        YYYY-MM-DD
 */
export async function submitGrid(db, { project, operator, kind = "person", missingDetails, attached, representative = false, installedKw = null, contractedKw = null, ceilingKw = null, note = "", rules = null, docDates = {}, override = null, canOverride = false, adapter, buildPackage, actor, today, io }) {
  const pkg = checkPackage({ operator, kind, missingDetails, attached, representative, installedKw, contractedKw, ceilingKw, rules, docDates, today });
  // A file that is short of a document, has one too old or fails a power check goes only with an owner's or a
  // manager's written reason, kept on the submission, in its history and in the audit log.
  let overrides = [];
  if (!pkg.complete) {
    const incomplete = { ok: false, error: "incomplete", missingDetails: pkg.missingDetails, missingDocs: pkg.missingDocs, expiredDocs: pkg.expiredDocs, powerBlocks: pkg.powerBlocks };
    if (!override || !pkg.overridable) return incomplete;
    if (!canOverride) return { ...incomplete, error: "override_not_allowed" };
    const reason = String(override.reason || "").trim();
    if (reason.length < 10) return { ...incomplete, error: "override_reason" };
    overrides = [{ codes: pkg.blockers, reason: reason.slice(0, 500), by: String(actor?.email || "").slice(0, 200), at: new Date().toISOString() }];
  }
  const { needsDb, row: last } = await latestGrid(db, project.id);
  if (needsDb) return { ok: false, error: "needs_db" };
  if (last && OPEN.includes(last.status)) return { ok: false, error: "already_submitted", submission: last };

  const reference = newGridReference(operator);
  const content = await buildPackage(reference);
  const packageHash = crypto.createHash("sha256").update(JSON.stringify({ operator, reference, checklist: pkg.checklist, files: (content.attachments || []).map((a) => [a.filename, a.content?.length || 0]) })).digest("hex");
  const row = {
    company_id: project.company_id, project_id: project.id, operator, channel: adapter.id, reference,
    status: "submitted", checklist: pkg.checklist, package_hash: packageHash, note: String(note || "").slice(0, 1000),
  };
  // the issue dates kept, the reasons and the rules' version: columns add-grid-connection.sql adds
  const dated = Object.fromEntries(pkg.checklist.filter((c) => c.maxAgeDays && c.issued).map((c) => [c.id, c.issued]));
  let ins = await db.from("grid_submissions").insert({ ...row, overrides, doc_dates: dated, rules_version: Number(rules?.version) || 0 }).select("*").single();
  if (ins.error && newColumn(ins.error)) {
    // before that SQL: a file without an exception still goes; one with an exception cannot be recorded, so it waits
    if (overrides.length) return { ok: false, error: "needs_db" };
    ins = await db.from("grid_submissions").insert(row).select("*").single();
  }
  if (ins.error) return { ok: false, error: missing(ins.error) ? "needs_db" : "save_failed" };

  const sent = await adapter.submit(content);
  if (!sent.ok) {
    // nothing reached the operator: the record goes, so a retry starts clean
    await db.from("grid_submissions").delete().eq("id", ins.data.id);
    return { ok: false, error: sent.error, retryable: !!sent.retryable };
  }
  await db.from("grid_submission_events").insert({ submission_id: ins.data.id, company_id: project.company_id, from_status: "", to_status: "submitted", source: "adapter", event_id: `submit-${reference}`, note: sent.channel });
  if (overrides.length) {
    // the exception in the file's own history, read as "sent with an exception: <reason>"
    await db.from("grid_submission_events").insert({ submission_id: ins.data.id, company_id: project.company_id, from_status: "submitted", to_status: "submitted", source: "installer", event_id: `override-${reference}`, note: `override: ${overrides[0].reason}`.slice(0, 1000) });
    await writeAudit(db, { companyId: project.company_id, actor, action: "grid.override", entity: "grid_submission", entityId: ins.data.id, before: null, after: overrides[0] });
  }
  await mirrorStage(db, project, operator, "submitted", today);
  await writeAudit(db, { companyId: project.company_id, actor, action: "grid.submit", entity: "grid_submission", entityId: ins.data.id, before: last ? { status: last.status, reference: last.reference } : null, after: { operator, channel: adapter.id, reference, status: "submitted", packageHash, rulesVersion: Number(rules?.version) || 0, overridden: overrides.length > 0 } });
  await io.notify({ project, submission: ins.data, from: "", to: "submitted" });
  return { ok: true, submission: ins.data };
}

/**
 * @param {object} a
 * @param {string} a.submissionId
 * @param {string} a.to
 * @param {"installer"|"operator"|"adapter"} a.source
 * @param {string} a.eventId   unique per change: a repeat is answered, not applied again
 */
export async function updateGridStatus(db, { companyId, project, submissionId, to, note = "", source = "installer", eventId, actor, today, io }) {
  const { data: sub, error } = await db.from("grid_submissions").select("*").eq("id", submissionId).maybeSingle();
  if (missing(error)) return { ok: false, error: "needs_db" };
  if (!sub || sub.company_id !== companyId || sub.project_id !== project.id) return { ok: false, error: "not_found" };
  const step = nextGridStatus(sub.status, to);
  if (!step.ok) return { ok: false, error: step.error, submission: sub };
  if (step.same) return { ok: true, already: true, submission: sub };
  // "meter installed" is a status the database takes from add-grid-connection.sql on; asked before, so the
  // append-only history never records a step the file itself could not take
  if (to === "meter_installed") {
    const probe = await db.from("grid_submissions").select("rules_version").eq("id", sub.id).maybeSingle();
    if (newColumn(probe.error)) return { ok: false, error: "needs_db" };
  }

  const ev = await db.from("grid_submission_events").insert({ submission_id: sub.id, company_id: companyId, from_status: sub.status, to_status: to, source, event_id: String(eventId || "").slice(0, 120), note: String(note || "").slice(0, 1000) });
  if (ev.error) return ev.error.code === "23505" ? { ok: true, already: true, submission: sub } : { ok: false, error: "save_failed" };
  const now = new Date().toISOString();
  await db.from("grid_submissions").update({ status: to, updated_at: now, ...(note ? { note: String(note).slice(0, 1000) } : {}) }).eq("id", sub.id).eq("status", sub.status);
  await mirrorStage(db, project, sub.operator, to, today);
  await writeAudit(db, { companyId, actor, action: "grid.status", entity: "grid_submission", entityId: sub.id, before: { status: sub.status }, after: { status: to, source, reference: sub.reference } });
  const fresh = { ...sub, status: to, updated_at: now };
  await io.notify({ project, submission: fresh, from: sub.status, to, note });
  return { ok: true, submission: fresh };
}

/** After "documents requested": the package again through the same channel, then back to submitted. */
export async function resendGrid(db, { companyId, project, submissionId, adapter, buildPackage, actor, today, io }) {
  const { data: sub } = await db.from("grid_submissions").select("*").eq("id", submissionId).maybeSingle();
  if (!sub || sub.company_id !== companyId || sub.project_id !== project.id) return { ok: false, error: "not_found" };
  if (sub.status !== "docs_requested") return { ok: false, error: "bad_transition" };
  const sent = await adapter.submit(await buildPackage(sub.reference));
  if (!sent.ok) return { ok: false, error: sent.error, retryable: !!sent.retryable };
  return updateGridStatus(db, { companyId, project, submissionId, to: "submitted", source: "adapter", eventId: `resend-${Date.now()}`, note: "", actor, today, io });
}
