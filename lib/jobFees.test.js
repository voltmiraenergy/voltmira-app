import { test } from "node:test";
import assert from "node:assert/strict";
import { feeFor, feeOnWin, feeOnLost, creditOnCancel, jobAccess, feePaywallOn, feeLei, feeMonth, nextMonth, statementDue, monthSummary, FEE_CAP_MINOR, FEE_PER_KW_MINOR, FREE_JOBS, feeBillingFrom, feeBillable, pricedNow } from "./jobFees.js";

const NOW = Date.parse("2026-10-24T10:00:00Z");
const DAY = 864e5;

test("59 lei a kW in whole lei, at most 1,990 lei a job: the published examples", () => {
  assert.deepEqual([FEE_PER_KW_MINOR, FEE_CAP_MINOR, FREE_JOBS], [5900, 199000, 2]);
  const lei = (kw) => feeFor(kw).minorMdl / 100;
  assert.deepEqual([3, 5, 8, 10, 15, 20, 30, 40, 100].map(lei), [177, 295, 472, 590, 885, 1180, 1770, 1990, 1990]);
  assert.deepEqual(feeFor(10), { minorMdl: 59000, capped: false, tier: 0 });
  assert.equal(feeLei(199000, "ro"), "1.990 lei");
});

test("decimal kW round to the whole leu; the cap starts just under 33.73 kW; nothing for no size", () => {
  assert.equal(feeFor(6.5).minorMdl, 38400, "383.5 lei rounds up to 384");
  assert.equal(feeFor(8.37).minorMdl, 49400, "493.83 lei: 494");
  assert.equal(feeFor(3.3).minorMdl, 19500, "194.7 lei: 195 (no float drift)");
  assert.equal(feeFor(0.1).minorMdl, 600, "5.9 lei: 6");
  assert.deepEqual(feeFor(33.7), { minorMdl: 198800, capped: false, tier: 0 }, "1,988 lei, under the cap");
  assert.deepEqual(feeFor(33.73), { minorMdl: 199000, capped: false, tier: 0 }, "1,990.07 rounds to exactly the cap");
  assert.deepEqual(feeFor(33.8), { minorMdl: FEE_CAP_MINOR, capped: true, tier: 1 }, "1,994 lei: capped");
  assert.deepEqual(feeFor(62), { minorMdl: FEE_CAP_MINOR, capped: true, tier: 1 });
  for (const bad of [undefined, null, 0, -5, "abc", NaN]) assert.equal(feeFor(bad).minorMdl, 0, String(bad));
});

test("the month's statement: due by the 15th of the next month, Chișinău", () => {
  assert.equal(feeMonth("2026-10-31T22:30:00Z"), "2026-11", "00:30 on 1 November in Chișinău");
  assert.equal(nextMonth("2026-12"), "2027-01");
  assert.equal(statementDue("2026-10"), "2026-11-14T22:00:00.000Z", "midnight of 15 November, Chișinău (winter time)");
});

test("the first two signed jobs are free (10 kW, 20 kW); then 59 lei a kW, payable with the month's statement", () => {
  const first = feeOnWin({ kw: 10, usedFree: 0, trigger: "signed", now: NOW }).row;
  assert.deepEqual([first.status, first.free_slot, first.amount_minor], ["free", 1, 0]);
  const second = feeOnWin({ kw: 20, usedFree: 1, now: NOW }).row;
  assert.deepEqual([second.status, second.free_slot, second.amount_minor], ["free", 2, 0]);
  assert.deepEqual([feeOnWin({ kw: 10, usedFree: 2, now: NOW }).row.amount_minor, feeOnWin({ kw: 20, usedFree: 3, now: NOW }).row.amount_minor], [59000, 118000], "590 and 1,180 lei");
  const third = feeOnWin({ kw: 9, usedFree: 2, trigger: "manual", now: NOW }).row;
  assert.deepEqual([third.status, third.amount_minor, third.trigger], ["due", 53100, "manual"]);
  assert.equal(third.grace_ends_at, statementDue("2026-10"));
});

test("credit from a cancelled paid job pays the next fee", () => {
  const r = feeOnWin({ kw: 10, usedFree: 2, creditMinor: 59000, now: NOW });
  assert.deepEqual([r.row.status, r.row.payment_method, r.creditUsed], ["paid", "credit", 59000]);
  assert.equal(feeOnWin({ kw: 10, usedFree: 2, creditMinor: 30000, now: NOW }).row.status, "due");
});

test("repricing only goes up while unpaid, never down, and never once settled", () => {
  const due = feeOnWin({ kw: 8, usedFree: 2, now: NOW }).row;
  const bigger = feeOnWin({ existing: due, kw: 25, now: NOW + DAY });
  assert.deepEqual([bigger.row.amount_minor, bigger.changed], [147500, true]);
  assert.equal(bigger.row.grace_ends_at, due.grace_ends_at);
  assert.equal(feeOnWin({ existing: bigger.row, kw: 4, now: NOW }).changed, false);
  assert.equal(feeOnWin({ existing: { ...due, status: "paid" }, kw: 200, now: NOW }).row.amount_minor, 47200);
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
  const from = Date.parse("2026-10-01T00:00:00+03:00");   // billing started before this job was signed
  const at = (iso) => jobAccess({ fee: due, on: true, now: Date.parse(iso), from });
  assert.deepEqual([at("2026-11-10T10:00:00Z").locked, at("2026-11-10T10:00:00Z").reason], [false, "grace"]);
  assert.deepEqual([at("2026-11-15T10:00:00Z").locked, at("2026-11-15T10:00:00Z").reason], [true, "due"]);
  assert.equal(jobAccess({ fee: due, on: false, now: Date.parse("2027-01-01") }).locked, false, "switch off");
  assert.equal(jobAccess({ fee: due, on: true, sample: true, now: Date.parse("2027-01-01") }).locked, false);
  assert.equal(jobAccess({ fee: due, on: true, admin: true, now: Date.parse("2027-01-01") }).locked, false);
  // fail closed: billing on and a signed job with no fee on record is locked, not waved through ("no_fee" was a bypass)
  assert.deepEqual([jobAccess({ fee: null, on: true }).locked, jobAccess({ fee: null, on: true }).reason], [true, "no_fee"]);
  // the legitimate ways through stay: billing off, a demo or sample job, a platform admin
  assert.equal(jobAccess({ fee: null, on: false }).locked, false);
  assert.equal(jobAccess({ fee: null, on: true, sample: true }).locked, false);
  assert.equal(jobAccess({ fee: null, on: true, admin: true }).locked, false);
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

test("fees recorded under the earlier prices (200 lei a kW, at most 8,000) keep their amounts: never repriced, never lowered", () => {
  const old = { id: "F-old", status: "due", kw: 6, tier: 0, amount_minor: 120000, won_at: "2026-09-10T10:00:00Z", grace_ends_at: "2026-10-14T21:00:00.000Z" };
  assert.equal(pricedNow(old), false);
  assert.deepEqual([feeOnWin({ existing: old, kw: 6, now: NOW }).changed, feeOnWin({ existing: old, kw: 40, now: NOW }).row.amount_minor], [false, 120000], "neither recomputed nor raised with today's formula");
  for (const status of ["paid", "waived", "free"]) {
    const settled = { ...old, status, amount_minor: status === "free" ? 0 : 120000 };
    assert.deepEqual(feeOnWin({ existing: settled, kw: 30, now: NOW }).row, settled, status + " stays exactly as recorded");
  }
  // a job of the old prices that was cancelled and signed again now is priced as signed now
  const again = feeOnWin({ existing: { ...old, status: "void" }, kw: 6, usedFree: 2, now: NOW }).row;
  assert.deepEqual([again.status, again.amount_minor], ["due", 35400]);
  assert.equal(pricedNow({ kw: 10, amount_minor: 59000 }), true);
});

test("the billing start date: only jobs signed on or after JOB_FEES_FROM are billable; none without it", () => {
  assert.equal(feeBillingFrom({}), null);
  assert.equal(feeBillingFrom({ JOB_FEES_FROM: "1 December" }), null);
  const from = feeBillingFrom({ JOB_FEES_FROM: "2026-12-01" });
  assert.equal(new Date(from).toISOString(), "2026-11-30T22:00:00.000Z", "midnight in Chisinau");
  assert.equal(feeBillable({ won_at: "2026-11-30T21:59:00Z" }, from), false, "the beta's last minute");
  assert.equal(feeBillable({ won_at: "2026-11-30T22:00:00Z" }, from), true);
  assert.equal(feeBillable({ won_at: "2027-01-05T10:00:00Z" }, null), false, "no start chosen: nothing is billable");
  // a beta job is never locked for its fee, however late its statement date
  const beta = { status: "due", kw: 8, amount_minor: 160000, won_at: "2026-10-20T10:00:00Z", grace_ends_at: "2026-11-14T22:00:00.000Z" };
  const a = jobAccess({ fee: beta, on: true, now: Date.parse("2027-03-01"), from });
  assert.deepEqual([a.locked, a.reason], [false, "beta"]);
});
