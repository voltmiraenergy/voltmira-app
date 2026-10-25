import { test } from "node:test";
import assert from "node:assert/strict";
import { fakeDb } from "./fakeDb.testutil.js";
import { createRequest, moveRequest, ensureServiceToken, sendServiceReminders, tellClientResolved } from "./serviceServer.js";

const PROJECT = { id: "P1", company_id: "C1", title: "Casa Rusu", client_name: "Andrei Rusu", client_email: "andrei@example.md", client_lang: "ro", status: "won", install_progress: { commission: "2025-11-10" }, service_token: null };
const db0 = (extra = {}) => fakeDb({
  projects: [{ ...PROJECT }], companies: [{ id: "C1", name: "SolarTech", lang: "ro", service_reply_days: 2, maintenance_months: 12, maintenance_client_reminder: true }],
  profiles: [{ company_id: "C1", role: "owner", email: "owner@st.md" }],
  service_requests: [], service_request_events: [], maintenance_checks: [], service_reminders: [], audit_log: [], ...extra,
}, { service_reminders: [["key"]] });
const io = () => {
  const sent = [], acts = [], owners = [];
  return { sent, acts, owners, emailConfigured: () => true, ownerAlertEmail: (a) => ({ html: a.cta?.href || "" }), sendEmail: async (m) => { sent.push([m.to, m.subject, m.html]); return { sent: true }; }, logActivity: async (_d, a) => acts.push(a.key), notifyOwner: async ({ request }) => owners.push(request.kind) };
};

test("the client reports a problem: a new request with its history; the installer's own counts as answered", async () => {
  const db = db0(), x = io();
  const bad = await createRequest(db, { project: PROJECT, input: { kind: "inverter_error", description: "Eroare" }, source: "client", io: x });
  assert.deepEqual([bad.ok, bad.fields], [false, ["phone"]]);
  const r = await createRequest(db, { project: PROJECT, input: { kind: "inverter_error", description: "Lumină roșie pe invertor", contact_phone: "+37369123456", contact_name: "Andrei" }, source: "client", io: x });
  assert.deepEqual([r.ok, r.request.status, r.request.source, r.request.first_reply_at ?? null], [true, "new", "client", null]);
  assert.deepEqual(db.T.service_request_events.map((e) => [e.to_status, e.actor]), [["new", "Andrei"]]);
  assert.deepEqual([x.acts, x.owners], [["act_sv_request"], ["inverter_error"]]);
  const own = await createRequest(db, { project: PROJECT, input: { kind: "other", description: "Clientul a sunat" }, source: "installer", actor: { id: "U1", email: "a@st.md" }, io: x });
  assert.ok(own.request.first_reply_at);
  assert.deepEqual(x.owners, ["inverter_error"], "the installer is not told of their own request");
});

test("a request moves only along its statuses, once, with the resolution kept", async () => {
  const db = db0(), x = io();
  const { request } = await createRequest(db, { project: PROJECT, input: { kind: "no_production", description: "Nu produce nimic", contact_phone: "069123456" }, source: "client", io: x });
  assert.equal((await moveRequest(db, { request, to: "new" })).error, "bad_status");
  const r1 = await moveRequest(db, { request, to: "planned", visitId: "V1", now: Date.parse("2026-10-26T08:00:00Z") });
  assert.deepEqual([r1.request.status, r1.request.visit_id, r1.request.first_reply_at], ["planned", "V1", "2026-10-26T08:00:00.000Z"]);
  assert.equal((await moveRequest(db, { request, to: "in_progress" })).error, "changed", "the old copy no longer stands");
  const r2 = await moveRequest(db, { request: r1.request, to: "resolved", note: "Siguranța înlocuită" });
  assert.deepEqual([r2.request.status, r2.request.resolution], ["resolved", "Siguranța înlocuită"]);
  assert.deepEqual(db.T.service_request_events.map((e) => e.to_status), ["new", "planned", "resolved"]);
  const ok = await tellClientResolved({ co: db.T.companies[0], project: { ...PROJECT, service_token: "tok" }, request: r2.request, ownerEmail: "owner@st.md", appUrl: "https://x", io: x });
  assert.equal(ok, true);
  assert.equal(x.sent[0][1], "Cererea dumneavoastră către SolarTech a fost rezolvată");
  assert.equal(x.sent[0][2], "/s/tok");
});

test("the client's link is made once", async () => {
  const db = db0();
  const t1 = await ensureServiceToken(db, db.T.projects[0]);
  assert.ok(t1.length >= 20);
  assert.equal(await ensureServiceToken(db, { ...PROJECT }), t1, "a second call finds the first");
});

test("reminders: the client 14 days before a check, once; the installer's digest on Mondays", async () => {
  const db = db0({ service_requests: [{ company_id: "C1", status: "new", created_at: "2026-10-19T08:00:00Z", first_reply_at: null }] });
  const x = io();
  // the check is due 10 November 2026 (a year after going live); 27 October is 14 days before
  await sendServiceReminders(db, { io: x, now: Date.parse("2026-10-27T08:00:00Z") });
  await sendServiceReminders(db, { io: x, now: Date.parse("2026-10-28T08:00:00Z") });
  assert.deepEqual(x.sent.map((m) => m[0]), ["andrei@example.md"], "once");
  assert.match(x.sent[0][1], /^Verificarea anuală a sistemului solar este pe 10 noiembrie$/);
  // Monday 2 November: the digest
  await sendServiceReminders(db, { io: x, now: Date.parse("2026-11-02T08:00:00Z") });
  assert.equal(x.sent.at(-1)[0], "owner@st.md");
  assert.match(x.sent.at(-1)[1], /verificări de planificat 1, cereri în așteptare 1/);
  await sendServiceReminders(db, { io: x, now: Date.parse("2026-11-02T09:00:00Z") });
  assert.equal(x.sent.filter((m) => m[0] === "owner@st.md").length, 1);
});
