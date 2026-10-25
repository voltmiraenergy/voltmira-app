import { test } from "node:test";
import assert from "node:assert/strict";
import { fakeDb } from "./fakeDb.testutil.js";
import { submitGrid, updateGridStatus, resendGrid } from "./gridFlow.js";
import { gridMockAdapter, gridEmailAdapter } from "./gridSubmission.js";

const PROJECT = { id: "P1", company_id: "C1", client_name: "Ion Popescu", client_email: "ion@x.md", install_progress: { gridFile: { operator: null, stages: {} } } };
const ALL = ["signed", "id_copy", "property"];
const db0 = () => fakeDb({ projects: [structuredClone(PROJECT)], grid_submissions: [], grid_submission_events: [], audit_log: [] },
  { grid_submission_events: [["submission_id", "event_id"]] });
const io0 = () => { const told = []; return { told, io: { notify: async (c) => { told.push([c.from, c.to]); } } }; };
const build = async (ref) => ({ subject: `Cerere racordare ${ref}`, html: "<p>x</p>", attachments: [{ filename: "cerere.pdf", content: Buffer.from("%PDF") }] });
const base = (db, io, over = {}) => ({ project: PROJECT, operator: "premier", missingDetails: [], attached: ALL, adapter: gridMockAdapter(), buildPackage: build, actor: { id: "U1" }, today: "2026-10-18", io, ...over });

test("grid, happy path: submitted with a reference, then approved and connected; each step ticks the file and tells both sides", async () => {
  const db = db0(); const { told, io } = io0();
  const r = await submitGrid(db, base(db, io));
  assert.equal(r.ok, true);
  assert.match(r.submission.reference, /^VM-P-\d{6}-[0-9A-F]{4}$/);
  assert.equal(db.T.projects[0].install_progress.gridFile.stages.applied, "2026-10-18");
  assert.equal(db.T.projects[0].install_progress.gridFile.operator, "premier");
  const ctx = { companyId: "C1", project: PROJECT, submissionId: r.submission.id, actor: { id: "U1" }, today: "2026-10-25", io };
  assert.equal((await updateGridStatus(db, { ...ctx, to: "approved", eventId: "e1" })).ok, true);
  assert.equal((await updateGridStatus(db, { ...ctx, project: db.T.projects[0], to: "connected", eventId: "e2", today: "2026-11-20" })).ok, true);
  assert.equal(db.T.grid_submissions[0].status, "connected");
  assert.deepEqual(db.T.grid_submission_events.map((e) => [e.from_status, e.to_status]), [["", "submitted"], ["submitted", "approved"], ["approved", "connected"]]);
  assert.equal(db.T.projects[0].install_progress.gridFile.stages.meter, "2026-11-20");
  assert.deepEqual(told, [["", "submitted"], ["submitted", "approved"], ["approved", "connected"]]);
  assert.deepEqual(db.T.audit_log.map((a) => a.action), ["grid.submit", "grid.status", "grid.status"]);
});

test("grid, failure paths: incomplete, email down, a skipped status, a repeated event, a second open submission", async () => {
  const { io } = io0();
  {
    const db = db0();
    const r = await submitGrid(db, base(db, io, { attached: ["id_copy"], missingDetails: ["cadastral"] }));
    assert.deepEqual([r.ok, r.error, r.missingDetails, r.missingDocs], [false, "incomplete", ["cadastral"], ["signed", "property"]]);
    assert.equal(db.T.grid_submissions.length, 0);
  }
  {
    const db = db0();
    const down = gridEmailAdapter({ sendEmail: async () => ({ sent: false, error: "smtp" }), emailConfigured: () => true, to: "op@x.md" });
    const r = await submitGrid(db, base(db, io, { adapter: down }));
    assert.deepEqual([r.ok, r.error, r.retryable], [false, "smtp", true]);
    assert.equal(db.T.grid_submissions.length, 0, "nothing recorded as sent when nothing was sent");
    assert.equal(db.T.projects[0].install_progress.gridFile.stages.applied, undefined);
  }
  {
    const db = db0();
    const r = await submitGrid(db, base(db, io));
    assert.equal((await submitGrid(db, base(db, io))).error, "already_submitted");
    const ctx = { companyId: "C1", project: PROJECT, submissionId: r.submission.id, actor: null, today: "2026-10-20", io };
    assert.equal((await updateGridStatus(db, { ...ctx, to: "connected", eventId: "x" })).error, "bad_transition");
    assert.equal((await updateGridStatus(db, { ...ctx, companyId: "C2", to: "approved", eventId: "y" })).error, "not_found", "another workspace");
    await updateGridStatus(db, { ...ctx, to: "docs_requested", eventId: "op-1", source: "operator" });
    const again = await updateGridStatus(db, { ...ctx, to: "docs_requested", eventId: "op-1", source: "operator" });
    assert.equal(again.already, true);
    assert.equal(db.T.grid_submission_events.length, 2, "the same event twice is stored once");
    const re = await resendGrid(db, { ...ctx, adapter: gridMockAdapter(), buildPackage: build });
    assert.equal(re.ok, true);
    assert.equal(db.T.grid_submissions[0].status, "submitted");
    assert.equal((await submitGrid(fakeDb({ projects: [], audit_log: [] }), base(db, io))).error, "needs_db");
  }
});

test("each change tells the installer (Activity, CRM, email when not their own) and the homeowner", async () => {
  const { gridNotifier } = await import("./gridServer.js");
  const log = { act: [], crm: [], mail: [] };
  const io = { logActivity: async (db, r) => { log.act.push(r.key); }, sendCrmWebhook: async (c, ev, d) => { log.crm.push([ev, d.to]); }, sendEmail: async (m) => { log.mail.push([m.to, m.subject]); return { sent: true }; }, emailConfigured: () => true };
  const co = { name: "SolarTech", lang: "ro" };
  const sub = { operator: "rednord", reference: "VM-R-261018-AB12" };
  await gridNotifier({ db: null, co, ownerEmail: "owner@st.md", source: "installer", io }).notify({ project: PROJECT, submission: sub, from: "", to: "submitted" });
  assert.deepEqual(log.act, ["act_grid_submitted"]);
  assert.deepEqual(log.crm, [["grid.status", "submitted"]]);
  assert.deepEqual(log.mail, [["ion@x.md", "Dosarul dumneavoastră de racordare a fost trimis la RED Nord"]], "the installer made it: only the homeowner is emailed");
  await gridNotifier({ db: null, co, ownerEmail: "owner@st.md", source: "operator", io }).notify({ project: { ...PROJECT, client_email: "" }, submission: sub, from: "submitted", to: "approved" });
  assert.deepEqual(log.mail.slice(1), [["owner@st.md", "RED Nord: Aprobat pentru Ion Popescu"]], "the operator made it: the owner hears; no homeowner address, no homeowner email");
  const broken = { ...io, sendCrmWebhook: async () => { throw new Error("down"); } };
  await gridNotifier({ db: null, co, io: broken }).notify({ project: PROJECT, submission: sub, from: "", to: "submitted" });
});

test("in test mode nothing was sent, so the homeowner is not told their file was; the later steps they are", async () => {
  const { gridNotifier } = await import("./gridServer.js");
  const mail = [];
  const io = { logActivity: async () => {}, sendCrmWebhook: async () => {}, sendEmail: async (m) => { mail.push(m.subject); return { sent: true }; }, emailConfigured: () => true };
  const n = gridNotifier({ db: null, co: { name: "SolarTech", lang: "ro" }, ownerEmail: "", source: "installer", io });
  const sub = { operator: "premier", reference: "VM-P-261018-AB12", channel: "mock" };
  await n.notify({ project: PROJECT, submission: sub, from: "", to: "submitted" });
  assert.deepEqual(mail, [], "nothing left VoltMira");
  await n.notify({ project: PROJECT, submission: sub, from: "submitted", to: "approved" });
  assert.equal(mail.length, 1, "an answer the installer recorded is still told");
  await n.notify({ project: PROJECT, submission: { ...sub, channel: "email" }, from: "", to: "submitted" });
  assert.equal(mail.length, 2, "by email it really was sent");
});

test("an incomplete file goes only with an owner's or a manager's written reason, kept on it, in its history and the audit", async () => {
  const { latestGridRules } = await import("./gridRules.js");
  const rules = latestGridRules([], "premier");
  const { io } = io0();
  const short = { attached: ["signed", "id_copy"], rules, actor: { id: "U1", email: "owner@st.md" } };   // no proof of property
  {
    const db = db0();
    assert.equal((await submitGrid(db, base(db, io, short))).error, "incomplete");
    assert.equal((await submitGrid(db, base(db, io, { ...short, override: { reason: "Cadastral extract comes Monday" } }))).error, "override_not_allowed");
    assert.equal((await submitGrid(db, base(db, io, { ...short, override: { reason: "soon" }, canOverride: true }))).error, "override_reason");
    assert.equal(db.T.grid_submissions.length, 0);
  }
  {
    const db = db0();
    const r = await submitGrid(db, base(db, io, { ...short, override: { reason: "Cadastral extract comes Monday" }, canOverride: true }));
    assert.equal(r.ok, true);
    const sub = db.T.grid_submissions[0];
    assert.deepEqual(sub.overrides.map((o) => [o.codes, o.reason, o.by]), [[["doc:property"], "Cadastral extract comes Monday", "owner@st.md"]]);
    assert.equal(sub.rules_version, 0);
    assert.deepEqual(db.T.grid_submission_events.map((e) => e.note), ["mock", "override: Cadastral extract comes Monday"]);
    assert.deepEqual(db.T.audit_log.map((a) => a.action), ["grid.override", "grid.submit"]);
  }
});

test("a register extract older than the operator takes blocks the file; its issue date is kept when it goes", async () => {
  const { latestGridRules } = await import("./gridRules.js");
  const rules = latestGridRules([], "premier");
  const { io } = io0();
  const company = { kind: "company", attached: ["signed", "registry_extract", "property", "site_sketch"], rules, today: "2026-10-24" };
  const db = db0();
  const r = await submitGrid(db, base(db, io, { ...company, docDates: { registry_extract: "2026-05-01" } }));
  assert.deepEqual([r.error, r.expiredDocs.map((x) => x.id)], ["incomplete", ["registry_extract"]]);
  const ok = await submitGrid(db, base(db, io, { ...company, docDates: { registry_extract: "2026-10-02" } }));
  assert.equal(ok.ok, true);
  assert.deepEqual(db.T.grid_submissions[0].doc_dates, { registry_extract: "2026-10-02" });
});

test("the meter step: it ticks the file's meter stage, and the connection after it closes the file", async () => {
  const db = db0(); const { told, io } = io0();
  const r = await submitGrid(db, base(db, io));
  const ctx = { companyId: "C1", project: PROJECT, submissionId: r.submission.id, actor: { id: "U1" }, io };
  await updateGridStatus(db, { ...ctx, to: "approved", eventId: "a", today: "2026-10-28" });
  assert.equal((await updateGridStatus(db, { ...ctx, project: db.T.projects[0], to: "meter_installed", eventId: "m", today: "2026-11-12" })).ok, true);
  assert.equal(db.T.projects[0].install_progress.gridFile.stages.meter, "2026-11-12");
  assert.equal((await updateGridStatus(db, { ...ctx, project: db.T.projects[0], to: "connected", eventId: "c", today: "2026-11-20" })).ok, true);
  assert.equal(db.T.projects[0].install_progress.gridFile.stages.meter, "2026-11-12", "the meter's day stays");
  assert.deepEqual(told.map((t) => t[1]), ["submitted", "approved", "meter_installed", "connected"]);
  assert.equal((await submitGrid(db, base(db, io))).ok, true, "a connected file is closed: a new one may start");
});

test("the homeowner's email is in their own language when the quote has one", async () => {
  const { gridNotifier } = await import("./gridServer.js");
  const mail = [];
  const io = { logActivity: async () => {}, sendCrmWebhook: async () => {}, sendEmail: async (m) => { mail.push(m.subject); return { sent: true }; }, emailConfigured: () => true };
  const sub = { operator: "premier", reference: "VM-P-261024-AB12", channel: "email" };
  await gridNotifier({ db: null, co: { name: "SolarTech", lang: "ro" }, io }).notify({ project: { ...PROJECT, client_lang: "ru" }, submission: sub, from: "approved", to: "meter_installed" });
  assert.deepEqual(mail, ["Premier Energy установил двунаправленный счётчик"]);
});
