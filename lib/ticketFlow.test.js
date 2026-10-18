import { test } from "node:test";
import assert from "node:assert/strict";
import { fakeDb } from "./fakeDb.testutil.js";
import { openTicket, updateTicket, openFromMonitoring } from "./ticketFlow.js";

const PROJECT = { id: "P1", company_id: "C1", title: "Casa Rusu" };
const db0 = () => fakeDb({ maintenance_tickets: [], ticket_events: [], audit_log: [] }, { maintenance_tickets: [["project_id", "alert_key"]] });
const io0 = () => { const told = []; return { told, io: { notify: async (c) => { told.push([c.from, c.to, c.source]); } } }; };

test("a homeowner's request: open, a visit, resolved with the outcome, closed; each told and audited", async () => {
  const db = db0(); const { told, io } = io0();
  const r = await openTicket(db, { project: PROJECT, source: "homeowner", input: { kind: "fault", title: "Eroare F01 la invertor", detail: "de ieri" }, actor: { id: "U" }, io });
  assert.equal(r.ok, true);
  const ctx = { companyId: "C1", project: PROJECT, ticketId: r.ticket.id, source: "installer", io };
  const soon = new Date(Date.now() + 3 * 864e5).toISOString();
  assert.equal((await updateTicket(db, { ...ctx, to: "scheduled", visitAt: soon })).ok, true);
  assert.equal(db.T.maintenance_tickets[0].visit_at, soon);
  assert.equal((await updateTicket(db, { ...ctx, to: "resolved", outcome: "Siguranța DC înlocuită" })).ok, true);
  assert.equal((await updateTicket(db, { ...ctx, to: "closed" })).ok, true);
  assert.deepEqual(db.T.ticket_events.map((e) => e.to_status), ["open", "scheduled", "resolved", "closed"]);
  assert.deepEqual(told.map((t) => t[1]), ["open", "scheduled", "resolved", "closed"]);
  assert.deepEqual(db.T.audit_log.map((a) => a.action), ["ticket.open", "ticket.status", "ticket.status", "ticket.status"]);
});

test("tickets: what is refused", async () => {
  const db = db0(); const { io } = io0();
  assert.equal((await openTicket(db, { project: PROJECT, source: "homeowner", input: { title: "x" }, io })).error, "title");
  const { ticket } = await openTicket(db, { project: PROJECT, source: "installer", input: { title: "Curățare" }, io });
  const ctx = { companyId: "C1", project: PROJECT, ticketId: ticket.id, io };
  assert.equal((await updateTicket(db, { ...ctx, source: "installer", to: "scheduled", visitAt: "2020-01-01T10:00:00Z" })).error, "visit_at");
  assert.equal((await updateTicket(db, { ...ctx, source: "installer", to: "resolved", outcome: "" })).error, "outcome");
  assert.equal((await updateTicket(db, { ...ctx, source: "homeowner", to: "closed" })).error, "not_allowed", "a homeowner cannot close an open ticket");
  assert.equal((await updateTicket(db, { ...ctx, companyId: "C2", source: "installer", to: "closed" })).error, "not_found");
  await updateTicket(db, { ...ctx, source: "installer", to: "resolved", outcome: "Curățat" });
  assert.equal((await updateTicket(db, { ...ctx, source: "homeowner", to: "open" })).ok, true, "the homeowner reopens");
  await updateTicket(db, { ...ctx, source: "installer", to: "closed" });
  assert.equal((await updateTicket(db, { ...ctx, source: "installer", to: "open" })).error, "bad_transition");
  assert.equal((await openTicket(fakeDb({}), { project: PROJECT, source: "installer", input: { title: "ok" }, io })).error, "needs_db");
});

test("monitoring opens one ticket per system, problem and month", async () => {
  const db = db0(); const { told, io } = io0();
  const items = [
    { project: PROJECT, month: "2026-09", assessment: { status: "critical", cause: "sudden_drop", last: { ratio: 0.6 } }, title: () => "Producție sub ofertă" },
    { project: { ...PROJECT, id: "P2" }, month: "2026-09", assessment: { status: "ok" }, title: () => "x" },
    { project: { ...PROJECT, id: "P3" }, month: "2026-09", assessment: { status: "critical", cause: "no_reading" }, title: () => "Nicio citire" },
  ];
  assert.deepEqual(await openFromMonitoring(db, items, { io }), { opened: 2 });
  assert.deepEqual(await openFromMonitoring(db, items, { io }), { opened: 0 }, "the nightly run again: nothing new");
  assert.deepEqual(db.T.maintenance_tickets.map((t) => [t.project_id, t.kind, t.alert_key, t.source]), [["P1", "underproduction", "under-2026-09", "monitoring"], ["P3", "no_data", "no_data-2026-09", "monitoring"]]);
  assert.equal(told.length, 2);
});

test("who hears about a ticket: the side that did not make the change", async () => {
  const { ticketNotifier } = await import("./ticketServer.js");
  const log = { act: [], crm: [], mail: [] };
  const io = { logActivity: async (db, r) => { log.act.push(r.key); }, sendCrmWebhook: async (c, ev, d) => { log.crm.push(d.to); }, sendEmail: async (m) => { log.mail.push([m.to, m.subject, !!m.attachments]); return { sent: true }; }, emailConfigured: () => true };
  const db = fakeDb({ profiles: [{ company_id: "C1", role: "owner", email: "owner@st.md" }], homeowner_links: [{ project_id: "P1", email: "ion@x.md" }, { project_id: "P1", email: "ana@x.md" }] });
  const n = ticketNotifier({ db, co: { name: "SolarTech", lang: "ro" }, io });
  const project = { id: "P1", company_id: "C1", client_name: "Ion Rusu", client_email: "old@x.md" };
  await n.notify({ project, ticket: { id: "T", title: "Eroare F01", kind: "fault" }, from: "", to: "open", source: "homeowner" });
  assert.deepEqual(log.act, ["act_ticket_open"]);
  assert.deepEqual(log.mail, [["owner@st.md", "Ion Rusu: Eroare F01", false]], "the homeowner made it: only the installer is emailed");
  log.mail.length = 0;
  await n.notify({ project, ticket: { id: "T", title: "Eroare F01", kind: "fault", visit_at: "2026-10-22T07:00:00Z" }, from: "open", to: "scheduled", source: "installer" });
  assert.equal(log.mail.length, 2, "both linked homeowners");
  assert.ok(log.mail[0][1].startsWith("O vizită este programată pe"));
  assert.equal(log.mail[0][2], true, "with the calendar file");
  assert.deepEqual(log.crm, ["open", "scheduled"]);
});

test("a system's calendar for the nightly check", async () => {
  const { systemCalendar } = await import("./monitorTickets.js");
  const now = new Date("2026-10-18T03:00:00Z");
  const shape = Array(12).fill(1);
  const c = systemCalendar({ readings: [{ month: "2026-08-01", kwh: 500 }, { month: "2025-12-01", kwh: 99 }], annualKwh: 12000, shape, commissioned: "2026-03-10", now });
  assert.equal(c.asOf, 8, "September is the last complete month");
  assert.equal(c.month, "2026-09");
  assert.equal(c.firstMonth, 3, "April, the first full month after commissioning");
  assert.equal(c.p50[0], 1000);
  assert.equal(c.actual[7], 500);
  assert.equal(c.actual[11], null, "last year's December is not this year's");
  assert.equal(systemCalendar({ annualKwh: 1000, shape, now: new Date("2026-01-10T00:00:00Z") }), null, "January: nothing complete yet");
  assert.equal(systemCalendar({ annualKwh: 0, shape, now }), null);
  assert.equal(systemCalendar({ annualKwh: 1000, shape, commissioned: "2025-05-01", now }).firstMonth, 0);
});
