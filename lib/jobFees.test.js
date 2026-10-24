import { test } from "node:test";
import assert from "node:assert/strict";
import { feeFor, feeOnWin, feeOnLost, creditOnCancel, jobAccess, feePaywallOn, feeLei, feeMonth, nextMonth, statementDue, monthSummary, FEE_CAP_MINOR } from "./jobFees.js";

const NOW = Date.parse("2026-10-24T10:00:00Z");
const DAY = 864e5;

test("200 lei a kW in whole lei, at most 8,000 lei a job", () => {
  assert.deepEqual(feeFor(10), { minorMdl: 200000, capped: false, tier: 0 });
  assert.equal(feeFor(6.5).minorMdl, 130000);
  assert.equal(feeFor(8.37).minorMdl, 167400, "1,674 lei: rounded to the lei");
  assert.deepEqual(feeFor(62), { minorMdl: FEE_CAP_MINOR, capped: true, tier: 1 });
  assert.equal(feeFor(40).minorMdl, 800000, "exactly at the cap");
  assert.equal(feeFor(undefined).minorMdl, 0);
  assert.equal(feeLei(800000, "ro"), "8.000 lei");
});

test("the month's statement: due by the 15th of the next month, Chișinău", () => {
  assert.equal(feeMonth("2026-10-31T22:30:00Z"), "2026-11", "00:30 on 1 November in Chișinău");
  assert.equal(nextMonth("2026-12"), "2027-01");
  assert.equal(statementDue("2026-10"), "2026-11-14T22:00:00.000Z", "midnight of 15 November, Chișinău (winter time)");
});

test("the first two signed jobs are free; then 200 lei a kW, payable with the month's statement", () => {
  const first = feeOnWin({ kw: 6, usedFree: 0, trigger: "signed", now: NOW }).row;
  assert.deepEqual([first.status, first.free_slot, first.amount_minor], ["free", 1, 0]);
  assert.equal(feeOnWin({ kw: 6, usedFree: 1, now: NOW }).row.status, "free");
  const third = feeOnWin({ kw: 9, usedFree: 2, trigger: "manual", now: NOW }).row;
  assert.deepEqual([third.status, third.amount_minor, third.trigger], ["due", 180000, "manual"]);
  assert.equal(third.grace_ends_at, statementDue("2026-10"));
});

test("credit from a cancelled paid job pays the next fee", () => {
  const r = feeOnWin({ kw: 10, usedFree: 2, creditMinor: 200000, now: NOW });
  assert.deepEqual([r.row.status, r.row.payment_method, r.creditUsed], ["paid", "credit", 200000]);
  assert.equal(feeOnWin({ kw: 10, usedFree: 2, creditMinor: 100000, now: NOW }).row.status, "due");
});

test("repricing only goes up while unpaid, never down, and never once settled", () => {
  const due = feeOnWin({ kw: 8, usedFree: 2, now: NOW }).row;
  const bigger = feeOnWin({ existing: due, kw: 25, now: NOW + DAY });
  assert.deepEqual([bigger.row.amount_minor, bigger.changed], [500000, true]);
  assert.equal(bigger.row.grace_ends_at, due.grace_ends_at);
  assert.equal(feeOnWin({ existing: bigger.row, kw: 4, now: NOW }).changed, false);
  assert.equal(feeOnWin({ existing: { ...due, status: "paid" }, kw: 200, now: NOW }).row.amount_minor, 160000);
});

test("the client gives up: nothing is owed and nothing locks; signed again, it is due again in that month", () => {
  const due = { ...feeOnWin({ kw: 8, usedFree: 2, now: NOW }).row, id: "F1" };
  const lost = feeOnLost(due);
  assert.deepEqual([lost.row.status, lost.changed], ["void", true]);
  assert.equal(jobAccess({ fee: lost.row, on: true, now: NOW + 60 * DAY }).locked, false);
  const again = feeOnWin({ existing: lost.row, kw: 8, usedFree: 0, now: Date.parse("2026-12-03T10:00:00Z") }).row;
  assert.equal(again.status, "due", "a free job is not given back");
  assert.equal(again.grace_ends_at, statementDue("2026-12"));
  assert.deepEqual(creditOnCancel({ id: "F2", status: "paid", amount_minor: 160000 }), { amount_minor: 160000, source_fee_id: "F2" });
  assert.equal(creditOnCancel({ id: "F3", status: "free", amount_minor: 0 }), null);
});

test("who may open the paperwork: locked only while due after the statement's date", () => {
  const due = feeOnWin({ kw: 8, usedFree: 2, now: NOW }).row;   // due by 15 Nov
  const at = (iso) => jobAccess({ fee: due, on: true, now: Date.parse(iso) });
  assert.deepEqual([at("2026-11-10T10:00:00Z").locked, at("2026-11-10T10:00:00Z").reason], [false, "grace"]);
  assert.deepEqual([at("2026-11-15T10:00:00Z").locked, at("2026-11-15T10:00:00Z").reason], [true, "due"]);
  assert.equal(jobAccess({ fee: due, on: false, now: Date.parse("2027-01-01") }).locked, false, "switch off");
  assert.equal(jobAccess({ fee: due, on: true, sample: true, now: Date.parse("2027-01-01") }).locked, false);
  assert.equal(jobAccess({ fee: due, on: true, admin: true, now: Date.parse("2027-01-01") }).locked, false);
  assert.equal(jobAccess({ fee: null, on: true }).locked, false);
  assert.equal(feePaywallOn({ JOB_FEES: "on" }), true);
});

test("a month's summary, as the statement shows it", () => {
  const s = monthSummary([
    { status: "due", kw: 40, amount_minor: 800000 }, { status: "paid", kw: 9, amount_minor: 180000, payment_method: "transfer" },
    { status: "void", kw: 6.5, amount_minor: 130000 }, { status: "free", kw: 6, amount_minor: 0 },
    { status: "paid", kw: 5, amount_minor: 100000, payment_method: "credit" },
  ]);
  assert.deepEqual(s, { signed: 4, free: 1, cancelled: 1, kw: 60, feesMinor: 980000, paidMinor: 180000, dueMinor: 800000 });
});
