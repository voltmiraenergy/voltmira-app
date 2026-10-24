import { test } from "node:test";
import assert from "node:assert/strict";
import { FEE_TIERS_MDL, tierFor, feeFor, feeOnWin, feeOnLost, creditOnCancel, jobAccess, feePaywallOn, feeLei, GRACE_DAYS } from "./jobFees.js";

const NOW = Date.parse("2026-10-24T10:00:00Z");
const DAY = 864e5;

test("the tiers in lei, by the system's size", () => {
  assert.deepEqual(FEE_TIERS_MDL.map((t) => t.minor), [39000, 79000, 159000, 299000]);
  assert.deepEqual([0, 5.5, 10, 10.1, 30, 30.5, 100, 250].map(tierFor), [0, 0, 0, 1, 1, 2, 2, 3]);
  assert.deepEqual(feeFor(12), { tier: 1, minorMdl: 79000 });
  assert.equal(feeLei(159000, "ro"), "1.590 lei");
  assert.equal(feeOnWin({ kw: undefined, usedFree: 3, now: NOW }).row.amount_minor, 39000, "an unknown size is the smallest tier");
});

test("the first three won projects of a company are free; the fourth is due with 14 days to pay", () => {
  const first = feeOnWin({ kw: 6, usedFree: 0, trigger: "signed", now: NOW }).row;
  assert.deepEqual([first.status, first.free_slot, first.amount_minor], ["free", 1, 0]);
  assert.equal(feeOnWin({ kw: 6, usedFree: 2, now: NOW }).row.free_slot, 3);
  const fourth = feeOnWin({ kw: 6, usedFree: 3, trigger: "manual", now: NOW }).row;
  assert.deepEqual([fourth.status, fourth.amount_minor, fourth.trigger, fourth.currency], ["due", 39000, "manual", "MDL"]);
  assert.equal(Date.parse(fourth.grace_ends_at) - NOW, GRACE_DAYS * DAY);
});

test("a credit from a cancelled job pays the next fee", () => {
  const r = feeOnWin({ kw: 15, usedFree: 3, creditMinor: 79000, now: NOW });
  assert.deepEqual([r.row.status, r.row.payment_method, r.creditUsed], ["paid", "credit", 79000]);
  assert.equal(feeOnWin({ kw: 15, usedFree: 3, creditMinor: 39000, now: NOW }).row.status, "due", "not enough credit: due in full");
});

test("repricing only goes up while unpaid, never down, and never once settled", () => {
  const due = feeOnWin({ kw: 8, usedFree: 3, now: NOW }).row;
  const bigger = feeOnWin({ existing: due, kw: 25, now: NOW + DAY });
  assert.deepEqual([bigger.row.amount_minor, bigger.row.tier, bigger.changed], [79000, 1, true]);
  assert.equal(bigger.row.grace_ends_at, due.grace_ends_at, "repricing keeps the grace period");
  const smaller = feeOnWin({ existing: bigger.row, kw: 4, now: NOW + 2 * DAY });
  assert.deepEqual([smaller.row.amount_minor, smaller.changed], [79000, false]);
  const paid = { ...due, status: "paid" };
  assert.equal(feeOnWin({ existing: paid, kw: 200, now: NOW }).row.amount_minor, 39000);
});

test("lost: an unpaid fee is void and stays locked; won again it is due afresh, without a free slot back", () => {
  const due = { ...feeOnWin({ kw: 8, usedFree: 3, now: NOW }).row, id: "F1" };
  const lost = feeOnLost(due);
  assert.deepEqual([lost.row.status, lost.changed], ["void", true]);
  assert.equal(jobAccess({ fee: lost.row, on: true, now: NOW }).locked, true);
  const again = feeOnWin({ existing: lost.row, kw: 8, usedFree: 0, now: NOW + 30 * DAY }).row;
  assert.equal(again.status, "due", "a free slot is not given back");
  assert.equal(Date.parse(again.grace_ends_at), NOW + 30 * DAY + GRACE_DAYS * DAY);
  assert.equal(feeOnLost({ status: "free" }).changed, false);
  assert.equal(feeOnLost({ status: "paid" }).changed, false);
});

test("a cancelled paid job leaves a credit of the same amount; free and unpaid ones nothing", () => {
  assert.deepEqual(creditOnCancel({ id: "F2", status: "paid", amount_minor: 159000 }), { amount_minor: 159000, source_fee_id: "F2" });
  assert.equal(creditOnCancel({ id: "F3", status: "free", amount_minor: 0 }), null);
  assert.equal(creditOnCancel({ id: "F4", status: "due", amount_minor: 39000 }), null);
});

test("who may open the paperwork", () => {
  const due = feeOnWin({ kw: 8, usedFree: 3, now: NOW }).row;
  const at = (days) => jobAccess({ fee: due, on: true, now: NOW + days * DAY });
  assert.deepEqual([at(0).locked, at(0).reason, at(0).daysLeft], [false, "grace", 14]);
  assert.deepEqual([at(13.5).locked, at(13.5).daysLeft], [false, 1]);
  assert.deepEqual([at(14).locked, at(14).reason], [true, "due"]);
  assert.equal(jobAccess({ fee: due, on: false, now: NOW + 40 * DAY }).locked, false, "the switch is off");
  assert.equal(jobAccess({ fee: due, on: true, sample: true, now: NOW + 40 * DAY }).locked, false, "demo jobs");
  assert.equal(jobAccess({ fee: due, on: true, admin: true, now: NOW + 40 * DAY }).locked, false, "platform admins");
  for (const s of ["free", "paid", "waived"]) assert.equal(jobAccess({ fee: { ...due, status: s }, on: true, now: NOW + 40 * DAY }).locked, false, s);
  assert.equal(jobAccess({ fee: null, on: true }).locked, false, "not won");
  assert.equal(feePaywallOn({ JOB_FEES: "on" }), true);
  assert.equal(feePaywallOn({}), false);
});
