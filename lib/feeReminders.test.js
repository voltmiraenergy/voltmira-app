import { test } from "node:test";
import assert from "node:assert/strict";
import { fakeDb } from "./fakeDb.testutil.js";
import { reminderStep, sendFeeReminders, REMINDER_STEPS } from "./feeReminders.js";
import { FT } from "./feeText.js";

const DAY = 864e5;
const ISSUED = Date.parse("2026-11-01T06:00:00Z");
const DUE = Date.parse("2026-11-14T22:00:00Z");
const inv = { id: "I1", company_id: "C1", month: "2026-10", fee_ids: ["F1", "F2"], issued_at: new Date(ISSUED).toISOString(), due_at: new Date(DUE).toISOString(), paid_at: null, payment_ref: "VMF2026000001", seller: { iban: "MD00VI0000" } };

test("the step a statement is at: issued, a week before, the day before, locked; nothing once paid", () => {
  assert.equal(reminderStep(inv, ISSUED + DAY), "issued");
  assert.equal(reminderStep(inv, DUE - 7 * DAY), "week");
  assert.equal(reminderStep(inv, DUE - 0.5 * DAY), "last_day");
  assert.equal(reminderStep(inv, DUE), "locked");
  assert.equal(reminderStep({ ...inv, paid_at: "2026-11-05T10:00:00Z" }, DUE), null);
  for (const s of REMINDER_STEPS) assert.ok(FT["rem_s_" + s] && FT["rem_l_" + s], s);
});

test("each step goes out once, to the owner and in Activity, for what is still owed; nothing while fees are off", async () => {
  const db = fakeDb({
    job_fee_invoices: [{ ...inv }], job_fee_statement_reminders: [], companies: [{ id: "C1", lang: "ro" }],
    job_fees: [{ id: "F1", status: "due", amount_minor: 200000 }, { id: "F2", status: "void", amount_minor: 120000 }],
    profiles: [{ company_id: "C1", role: "owner", email: "owner@st.md" }],
  }, { job_fee_statement_reminders: [["invoice_id", "step"]] });
  const sent = [], acts = [];
  const io = {
    sendEmail: async (m) => { sent.push(m.subject); return { sent: true }; }, emailConfigured: () => true,
    ownerAlertEmail: () => ({ html: "<p>x</p>" }), logActivity: async (_db, a) => acts.push(a.key),
  };
  assert.equal((await sendFeeReminders(db, { io, now: ISSUED + DAY, on: false })).off, true);
  assert.equal(sent.length, 0);
  await sendFeeReminders(db, { io, now: ISSUED + DAY, on: true });
  await sendFeeReminders(db, { io, now: ISSUED + 2 * DAY, on: true });
  assert.deepEqual(sent, ["Extrasul VoltMira pentru octombrie 2026: 2.000 lei de plătit"], "the cancelled job is not asked for");
  await sendFeeReminders(db, { io, now: DUE + DAY, on: true });
  assert.deepEqual(acts, ["act_fee_issued", "act_fee_locked"]);
  assert.equal(db.T.job_fee_statement_reminders.length, 2);
  // every client gave up: nothing to ask for
  db.T.job_fees[0].status = "void";
  db.T.job_fee_statement_reminders.length = 0;
  assert.equal((await sendFeeReminders(db, { io, now: DUE + DAY, on: true })).sent, 0);
});
