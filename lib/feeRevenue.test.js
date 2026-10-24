import { test } from "node:test";
import assert from "node:assert/strict";
import { feeRevenue, feesCsv } from "./feeRevenue.js";

const NOW = Date.parse("2026-10-24T10:00:00Z");
const fees = [
  { id: "a", company_id: "C1", project_id: "P1", status: "paid", amount_minor: 39000, kw: 6, won_at: "2026-09-02T10:00:00Z", paid_at: "2026-09-10T10:00:00Z", payment_method: "card" },
  { id: "b", company_id: "C1", project_id: "P2", status: "paid", amount_minor: 79000, kw: 14, won_at: "2026-10-01T10:00:00Z", paid_at: "2026-10-05T10:00:00Z", payment_method: "transfer" },
  { id: "c", company_id: "C2", project_id: "P3", status: "due", amount_minor: 39000, kw: 5, won_at: "2026-10-01T10:00:00Z", grace_ends_at: "2026-10-15T10:00:00Z" },
  { id: "d", company_id: "C2", project_id: "P4", status: "due", amount_minor: 159000, kw: 40, won_at: "2026-10-20T10:00:00Z", grace_ends_at: "2026-11-03T10:00:00Z" },
  { id: "e", company_id: "C2", project_id: "P5", status: "free", amount_minor: 0, kw: 5, won_at: "2026-08-20T10:00:00Z" },
  { id: "f", company_id: "C2", project_id: "P6", status: "paid", amount_minor: 39000, kw: 5, won_at: "2026-10-22T10:00:00Z", paid_at: "2026-10-22T10:00:00Z", payment_method: "credit" },
];

test("income month by month, what is due and locked, per job and per kW; credit is not new money", () => {
  const r = feeRevenue({ fees, months: 3, now: NOW });
  assert.deepEqual(r.months.map((m) => m.month), ["2026-08", "2026-09", "2026-10"]);
  assert.deepEqual(r.months[1].paid, { n: 1, minor: 39000 });
  assert.deepEqual(r.months[2].paid, { n: 1, minor: 79000 });
  assert.deepEqual(r.months[2].due, { n: 2, minor: 198000 });
  assert.equal(r.months[0].free, 1);
  assert.deepEqual([r.totals.paidN, r.totals.paidMinor, r.totals.dueMinor, r.totals.lockedN, r.totals.creditN], [2, 118000, 198000, 1, 1]);
  assert.equal(r.perJobMinor, 59000);
  assert.equal(r.perKwMinor, Math.round(118000 / 20));
});

test("the CSV for the accountant", () => {
  const csv = feesCsv(fees.slice(0, 1), { companies: new Map([["C1", "SolarTech, SRL"]]), projects: new Map([["P1", "Casa Rusu"]]) });
  const [head, line] = csv.trim().split("\r\n");
  assert.match(head, /^fee_id,workspace,idno,job,kw/);
  assert.equal(line, 'a,"SolarTech, SRL",,Casa Rusu,6,,390.00,paid,2026-09-02,,2026-09-10,card,,');
});
