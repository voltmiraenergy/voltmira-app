import { test } from "node:test";
import assert from "node:assert/strict";
import { feeOverview } from "./feeOverview.js";

const NOW = Date.parse("2026-11-20T10:00:00Z");
const f = (id, won_at, o = {}) => ({ id, won_at, status: "due", kw: 10, amount_minor: 200000, ...o });

test("this month's jobs, then each earlier month with its statement: paid, open, late, coming or nothing", () => {
  const fees = [
    f("N1", "2026-11-03T10:00:00Z"), f("N2", "2026-11-12T10:00:00Z", { status: "free", amount_minor: 0 }),
    f("O1", "2026-10-02T10:00:00Z"), f("O2", "2026-10-20T10:00:00Z", { status: "void" }),
    f("S1", "2026-09-05T10:00:00Z", { status: "paid", payment_method: "transfer" }),
    f("A1", "2026-08-05T10:00:00Z", { status: "free", amount_minor: 0 }),
  ];
  const invoices = [
    { id: "I10", month: "2026-10", number: "VMF-2026-000002", total_minor: 400000, fee_ids: ["O1", "O2"], due_at: "2026-11-14T22:00:00.000Z", paid_at: null },
    { id: "I9", month: "2026-09", number: "VMF-2026-000001", total_minor: 200000, fee_ids: ["S1"], due_at: "2026-10-14T21:00:00.000Z", paid_at: "2026-10-08T10:00:00Z" },
  ];
  const o = feeOverview({ fees, invoices, now: NOW });
  assert.equal(o.month, "2026-11");
  assert.deepEqual(o.current.map((x) => x.id), ["N2", "N1"], "newest first");
  assert.deepEqual([o.summary.signed, o.summary.free, o.summary.dueMinor], [2, 1, 200000]);
  assert.deepEqual(o.months.map((m) => [m.month, m.state]), [["2026-10", "late"], ["2026-09", "paid"], ["2026-08", "none"]]);
  assert.equal(o.months[0].statement.leftMinor, 200000, "the cancelled job is not owed");
  assert.equal(feeOverview({ fees, invoices: [], now: NOW }).months[0].state, "coming");
  assert.equal(feeOverview({ fees, invoices: [], now: NOW }).months[1].state, "settled", "paid without a statement row");
  assert.equal(feeOverview({ fees, invoices, now: Date.parse("2026-11-10T10:00:00Z") }).months[0].state, "open");
});
