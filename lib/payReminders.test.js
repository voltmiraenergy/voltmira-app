import { test } from "node:test";
import assert from "node:assert/strict";
import { fakeDb } from "./fakeDb.testutil.js";
import { sendPayReminders } from "./payReminders.js";

const M = { id: "M1", company_id: "C1", project_id: "P1", status: "issued", amount_minor: 12500000, paid_minor: 0, currency: "MDL", invoice_no: "PF-2026-0042", due_on: "2026-11-01", pay_token: "tok_abcdefghijklmnopqrstu", reminders_paused: false };
const at = (day) => Date.parse(day + "T07:00:00Z");
const setup = (m = {}, p = {}) => {
  const db = fakeDb({
    pay_milestones: [{ ...M, ...m }], pay_milestone_reminders: [],
    projects: [{ id: "P1", title: "Casa Rusu", client_name: "Andrei Rusu", client_email: "andrei@example.md", client_lang: "ru", ...p }],
    companies: [{ id: "C1", name: "SolarTech", lang: "ro" }], profiles: [{ company_id: "C1", role: "owner", email: "owner@st.md" }],
  }, { pay_milestone_reminders: [["milestone_id", "step"]] });
  const sent = [], acts = [];
  const io = { sendEmail: async (x) => { sent.push([x.to, x.subject, x.replyTo]); return { sent: true }; }, emailConfigured: () => true, ownerAlertEmail: (a) => ({ html: a.cta?.href || "" }), logActivity: async (_d, a) => acts.push(a.key) };
  return { db, sent, acts, io };
};

test("each step once, to the client in their language with the pay link; the installer told at 3 days late", async () => {
  const { db, sent, acts, io } = setup();
  await sendPayReminders(db, { io, now: at("2026-10-25"), appUrl: "https://app.test" });
  await sendPayReminders(db, { io, now: at("2026-10-26") });
  assert.equal(sent.length, 1);
  assert.match(sent[0][1], /^Счёт PF-2026-0042 от SolarTech: 125\s000 лей$/);
  assert.equal(sent[0][2], "owner@st.md", "the installer is the reply-to");
  await sendPayReminders(db, { io, now: at("2026-10-29") });
  await sendPayReminders(db, { io, now: at("2026-11-01") });
  await sendPayReminders(db, { io, now: at("2026-11-04") });
  assert.deepEqual(db.T.pay_milestone_reminders.map((r) => r.step), ["issued", "before3", "due", "late3"]);
  assert.equal(sent.at(-1)[0], "owner@st.md", "the installer, at 3 days late");
  assert.match(sent.at(-1)[1], /întârzie cu 3 zile plata PF-2026-0042/);
  assert.deepEqual(acts, ["act_ms_late"]);
});

test("nothing when paused, paid, or with no client email (the step is still marked)", async () => {
  let s = setup({ reminders_paused: true });
  await sendPayReminders(s.db, { io: s.io, now: at("2026-11-04") });
  assert.equal(s.sent.length, 0);
  s = setup({ paid_minor: 12500000 });
  await sendPayReminders(s.db, { io: s.io, now: at("2026-11-04") });
  assert.equal(s.sent.length, 0);
  s = setup({}, { client_email: "" });
  const r = await sendPayReminders(s.db, { io: s.io, now: at("2026-10-25") });
  assert.deepEqual([s.sent.length, r.skipped], [0, 1]);
});
