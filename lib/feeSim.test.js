import { test } from "node:test";
import assert from "node:assert/strict";
import { simDates, simState } from "./feeSim.js";

const NOW = Date.parse("2026-10-25T10:00:00Z");
const d = simDates(NOW);
const DAY = 864e5;
const base = { d, kw: 8, free: false, papers: true, paidAt: null, gaveUpAt: null };

test("the example's dates follow the real calendar: signed the 12th, statement the 1st, pay by the 14th", () => {
  assert.equal(new Date(d.signed).toISOString(), "2026-10-12T08:00:00.000Z");
  assert.equal(new Date(d.issued).toISOString(), "2026-11-01T07:00:00.000Z");
  assert.equal(new Date(d.due).toISOString(), "2026-11-14T22:00:00.000Z");
});

test("unpaid: this month's job, then on the statement, then held step by step with an email at each step", () => {
  const at = (t) => simState({ ...base, at: t });
  assert.deepEqual([at(d.signed).status, at(d.issued).status, at(d.due).status], ["month", "open", "late"]);
  assert.equal(at(d.signed).amountMinor, 160000);
  assert.deepEqual([d.due, d.hold30 - DAY, d.hold30, d.hold60].map((t) => at(t).level), [1, 1, 2, 3]);
  assert.deepEqual(at(d.end).emails.map((e) => e.step), ["issued", "week", "last_day", "locked", "warn30", "hold30", "warn60", "hold60"]);
  assert.equal(at(d.issued - DAY).canPay, false, "nothing to pay before the statement");
});

test("the transfer arrives late: everything opens and no more emails", () => {
  const paidAt = d.hold30 + 2 * DAY;
  const s = simState({ ...base, at: d.end, paidAt });
  assert.deepEqual([s.status, s.level, s.owed], ["paid", 0, false]);
  assert.deepEqual(s.emails.map((e) => e.step), ["issued", "week", "last_day", "locked", "warn30", "hold30"]);
});

test("the client gives up: free before any paperwork, kept after it", () => {
  const gaveUpAt = d.issued + 2 * DAY;
  const before = simState({ ...base, papers: false, gaveUpAt, at: d.end });
  assert.deepEqual([before.status, before.level, before.emails.map((e) => e.step)], ["void", 0, ["issued"]]);
  const after = simState({ ...base, gaveUpAt, at: d.hold30 });
  assert.deepEqual([after.status, after.level, after.owed], ["kept", 2, true]);
});

test("a free job: nothing to pay, nothing held, no statement email", () => {
  const s = simState({ ...base, free: true, at: d.end });
  assert.deepEqual([s.status, s.amountMinor, s.level, s.emails.length, s.canPay], ["free", 0, 0, 0, false]);
});
