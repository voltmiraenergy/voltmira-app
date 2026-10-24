import { test } from "node:test";
import assert from "node:assert/strict";
import { fakeDb } from "./fakeDb.testutil.js";
import { reminderStep, sendFeeReminders } from "./feeReminders.js";
import { FT } from "./feeText.js";

const WON = Date.parse("2026-10-01T10:00:00Z");
const DAY = 864e5;
const fee = { id: "F1", company_id: "C1", project_id: "P1", status: "due", amount_minor: 39000, won_at: new Date(WON).toISOString(), grace_ends_at: new Date(WON + 14 * DAY).toISOString() };

test("the step a due fee is at: won, a week later, the last day, locked", () => {
  assert.equal(reminderStep(fee, WON + DAY), "won");
  assert.equal(reminderStep(fee, WON + 7 * DAY), "week");
  assert.equal(reminderStep(fee, WON + 13.5 * DAY), "last_day");
  assert.equal(reminderStep(fee, WON + 14 * DAY), "locked");
  for (const s of ["free", "paid", "void", "waived"]) assert.equal(reminderStep({ ...fee, status: s }, WON + 20 * DAY), null);
  for (const s of ["won", "week", "last_day", "locked"]) assert.ok(FT["rem_s_" + s] && FT["rem_l_" + s], s);
});

test("each step goes out once, to the owner and in Activity; nothing while fees are off", async () => {
  const db = fakeDb({
    job_fees: [{ ...fee }], job_fee_reminders: [], companies: [{ id: "C1", lang: "ro" }],
    profiles: [{ company_id: "C1", role: "owner", email: "owner@st.md" }], projects: [{ id: "P1", client_name: "Ion Bivol" }],
  }, { job_fee_reminders: [["fee_id", "step"]] });
  const sent = [], acts = [];
  const io = {
    sendEmail: async (m) => { sent.push(m.subject); return { sent: true }; }, emailConfigured: () => true,
    ownerAlertEmail: () => ({ html: "<p>x</p>" }), logActivity: async (_db, a) => acts.push(a.key),
  };
  assert.equal((await sendFeeReminders(db, { io, now: WON + DAY, on: false })).off, true);
  assert.equal(sent.length, 0);
  await sendFeeReminders(db, { io, now: WON + DAY, on: true });
  await sendFeeReminders(db, { io, now: WON + 2 * DAY, on: true });
  assert.deepEqual(sent, ["Ion Bivol a semnat: 390 lei de plătit în 14 zile"]);
  await sendFeeReminders(db, { io, now: WON + 14 * DAY, on: true });
  assert.deepEqual(acts, ["act_fee_won", "act_fee_locked"]);
  assert.equal(db.T.job_fee_reminders.length, 2);
});
