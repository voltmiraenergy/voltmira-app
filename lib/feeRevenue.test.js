import { test } from "node:test";
import assert from "node:assert/strict";
import { feeRevenue, statementsFor, feesCsv, lastMonths } from "./feeRevenue.js";

const NOW = Date.parse("2026-11-20T10:00:00Z");
const fees = [
  { id: "a", company_id: "C1", project_id: "P1", status: "paid", amount_minor: 120000, kw: 6, won_at: "2026-09-02T10:00:00Z", paid_at: "2026-10-10T10:00:00Z", payment_method: "transfer", trigger: "signed" },
  { id: "b", company_id: "C1", project_id: "P2", status: "due", amount_minor: 800000, kw: 62, tier: 1, won_at: "2026-10-01T10:00:00Z", grace_ends_at: "2026-11-14T22:00:00.000Z", invoice_id: "I1" },
  { id: "c", company_id: "C1", project_id: "P3", status: "void", amount_minor: 130000, kw: 6.5, won_at: "2026-10-03T10:00:00Z", invoice_id: "I1" },
  { id: "d", company_id: "C2", project_id: "P4", status: "paid", amount_minor: 200000, kw: 10, won_at: "2026-10-20T10:00:00Z", payment_method: "transfer", invoice_id: "I2" },
  { id: "e", company_id: "C2", project_id: "P5", status: "free", amount_minor: 0, kw: 5, won_at: "2026-10-21T10:00:00Z" },
  { id: "f", company_id: "C2", project_id: "P6", status: "paid", amount_minor: 100000, kw: 5, won_at: "2026-11-02T10:00:00Z", payment_method: "credit" },
];
const invoices = [
  { id: "I1", company_id: "C1", month: "2026-10", number: "VMF-2026-000001", total_minor: 930000, fee_ids: ["b", "c"], payment_ref: "VMF2026000001", due_at: "2026-11-14T22:00:00.000Z", paid_at: null },
  { id: "I2", company_id: "C2", month: "2026-10", number: "VMF-2026-000002", total_minor: 200000, fee_ids: ["d"], payment_ref: "VMF2026000002", due_at: "2026-11-14T22:00:00.000Z", paid_at: "2026-11-08T10:00:00Z" },
];

test("the months, by the month the jobs were signed; credit is not new money", () => {
  assert.deepEqual(lastMonths(3, NOW), ["2026-09", "2026-10", "2026-11"]);
  assert.deepEqual(lastMonths(2, Date.parse("2027-01-10T10:00:00Z")), ["2026-12", "2027-01"]);
  const r = feeRevenue({ fees, months: 3, now: NOW });
  assert.deepEqual(r.months.map((m) => [m.month, m.signed, m.feesMinor]), [["2026-09", 1, 120000], ["2026-10", 3, 1000000], ["2026-11", 1, 0]]);
  assert.deepEqual([r.totals.paidMinor, r.totals.dueMinor, r.totals.lateMinor, r.totals.lateN, r.totals.creditN], [320000, 800000, 800000, 1, 1]);
  assert.equal(r.perJobMinor, Math.round(1120000 / 3));
  assert.equal(r.perKwMinor, Math.round(1120000 / 78));
});

test("each installer's statement for a month: what is owed after a cancellation, paid or late, and the totals", () => {
  const { rows, totals } = statementsFor({ fees, invoices, month: "2026-10", now: NOW });
  assert.deepEqual(rows.map((r) => [r.companyId, r.signed, r.cancelled, r.feesMinor, r.statement.state, r.statement.leftMinor]),
    [["C1", 1, 1, 800000, "late", 800000], ["C2", 2, 0, 200000, "paid", 0]]);
  assert.deepEqual(rows[0].dueFees.map((f) => f.id), ["b"]);
  assert.deepEqual([totals.signed, totals.free, totals.cancelled, totals.kw, totals.feesMinor], [3, 1, 1, 77, 1000000]);
  assert.equal(statementsFor({ fees, invoices: [], month: "2026-10", now: NOW }).rows[0].statement, null, "not issued yet");
});

test("the CSV for the accountant", () => {
  const csv = feesCsv(fees.slice(0, 2), { companies: new Map([["C1", "SolarTech, SRL"]]), projects: new Map([["P1", "Casa Rusu"]]), invoices });
  const [head, a, b] = csv.trim().split("\r\n");
  assert.match(head, /^fee_id,workspace,idno,job,month,kw,capped/);
  assert.equal(a, 'a,"SolarTech, SRL",,Casa Rusu,2026-09,6,,1200.00,paid,2026-09-02,signed,,2026-10-10,transfer,,');
  assert.match(b, /,yes,8000\.00,due,.*VMF-2026-000001$/);
});
