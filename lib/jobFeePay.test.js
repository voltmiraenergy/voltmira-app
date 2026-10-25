import { test } from "node:test";
import assert from "node:assert/strict";
import { fakeDb } from "./fakeDb.testutil.js";
import { markFeePaid, invoiceForFees, monthlyStatements, markStatementPaid, statementRef, previousMonth, sellerDetails } from "./jobFeePay.js";

const OCT = (d) => `2026-10-${String(d).padStart(2, "0")}T10:00:00Z`;
const fee = (id, o = {}) => ({ id, company_id: "C1", project_id: "P" + id, status: "due", amount_minor: 120000, kw: 6, won_at: OCT(5), grace_ends_at: "2026-11-14T22:00:00.000Z", invoice_id: null, ...o });
const SELLER = { name: "VoltMira SRL", idno: "1020600000001", address: "Chișinău", iban: "MD00VI000000000000000000" };
const db0 = (fees) => {
  const db = fakeDb({
    job_fees: fees, job_fee_invoices: [], audit_log: [], activity: [],
    companies: [{ id: "C1", name: "SolarTech", legal_name: "SolarTech SRL", idno: "1003600123456", legal_address: "Chișinău" }, { id: "C2", name: "Soare Nord", idno: "1003600999999" }],
  }, { job_fee_invoices: [["company_id", "month"]] });
  let n = 0;
  db.rpc = async (name) => (name === "next_job_fee_invoice_no" ? { data: `VMF-2026-${String(++n).padStart(6, "0")}`, error: null } : { data: null, error: { message: "no" } });
  return db;
};

test("VoltMira's details come from the environment; the transfer reference is the statement's number", () => {
  assert.equal(sellerDetails({}), null);
  assert.equal(sellerDetails({ VOLTMIRA_LEGAL_NAME: "VoltMira SRL", VOLTMIRA_IDNO: "1", VOLTMIRA_ADDRESS: "x", VOLTMIRA_IBAN: "MD00" }).iban, "MD00");
  assert.equal(statementRef("VMF-2026-000012"), "VMF2026000012");
  assert.equal(previousMonth(Date.parse("2026-11-01T06:00:00Z")), "2026-10");
  assert.equal(previousMonth(Date.parse("2027-01-01T06:00:00Z")), "2026-12");
});

test("on the 1st: one statement per workspace for last month's due fees, due by the 15th; once", async () => {
  const db = db0([
    fee("F1"), fee("F2", { amount_minor: 800000, kw: 62 }),
    fee("F3", { status: "free", amount_minor: 0 }), fee("F4", { status: "void" }),
    fee("F5", { won_at: "2026-11-01T08:00:00Z" }),                  // signed in November: next month's
    fee("F6", { company_id: "C2", amount_minor: 180000 }),
  ]);
  const issued = [];
  const now = Date.parse("2026-11-01T06:00:00Z");
  const r = await monthlyStatements(db, { seller: SELLER, vatRate: 20, now, io: { onIssued: async ({ invoice }) => issued.push(invoice.number) } });
  assert.deepEqual([r.ok, r.issued, r.month], [true, 2, "2026-10"]);
  const [a, b] = db.T.job_fee_invoices;
  assert.deepEqual([a.company_id, a.fee_ids, a.month, a.net_minor, a.vat_minor, a.total_minor], ["C1", ["F1", "F2"], "2026-10", 920000, 184000, 1104000]);
  assert.deepEqual([a.due_at, a.payment_ref, a.buyer.idno], ["2026-11-14T22:00:00.000Z", "VMF2026000001", "1003600123456"]);
  assert.equal(b.company_id, "C2");
  assert.equal(db.T.job_fees.find((f) => f.id === "F1").invoice_id, a.id);
  assert.equal(db.T.job_fees.find((f) => f.id === "F5").invoice_id, null);
  assert.deepEqual(issued, ["VMF-2026-000001", "VMF-2026-000002"]);
  assert.equal((await monthlyStatements(db, { seller: SELLER, now })).issued, 0, "safe to run again");
  assert.equal((await monthlyStatements(db0([fee("F1")]), { seller: null, now })).issued, 0, "not without VoltMira's details");
});

test("the transfer arrives: the statement and its due fees are paid, a cancelled job's is not, once", async () => {
  const db = db0([fee("F1"), fee("F2")]);
  const r = await invoiceForFees(db, { fees: db.T.job_fees, company: db.T.companies[0], seller: SELLER, month: "2026-10", dueAt: "2026-11-14T22:00:00.000Z" });
  assert.equal(r.ok, true);
  db.T.job_fees[1].status = "void";                                 // the client gave up after the statement
  const acts = [];
  const io = { logActivity: async (_db, a) => acts.push(a.key) };
  assert.equal((await markStatementPaid(db, { invoiceId: r.invoice.id, actor: { email: "admin@voltmira.com" }, now: Date.parse("2026-11-10T09:00:00Z"), io })).ok, true);
  assert.deepEqual(db.T.job_fees.map((f) => [f.status, f.payment_method || null]), [["paid", "transfer"], ["void", null]]);
  assert.equal(db.T.job_fees[0].payment_ref, "VMF2026000001");
  assert.equal(db.T.job_fee_invoices[0].paid_at, "2026-11-10T09:00:00.000Z");
  assert.deepEqual(acts, ["act_fee_paid"]);
  assert.deepEqual(db.T.audit_log.map((a) => a.action), ["job_fee.paid", "job_fee.statement_paid"]);
  assert.equal((await markStatementPaid(db, { invoiceId: r.invoice.id })).already, true);
  assert.equal((await markStatementPaid(db, { invoiceId: "nope" })).error, "not_found");
});

test("a fee is paid only from due", async () => {
  const db = db0([fee("F1", { status: "void" })]);
  assert.equal((await markFeePaid(db, { feeId: "F1", method: "admin" })).error, "not_due");
  db.T.job_fees[0].status = "paid";
  assert.equal((await markFeePaid(db, { feeId: "F1", method: "admin" })).already, true);
});
