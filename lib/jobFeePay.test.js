import { test } from "node:test";
import assert from "node:assert/strict";
import { fakeDb } from "./fakeDb.testutil.js";
import { startCardPayment, settleCallback, markFeePaid, invoiceForFee, feeRef, sellerDetails } from "./jobFeePay.js";
import { mockGateway, victoriaBankGateway, gatewayFor, newOrderId } from "./paymentGateway.js";

const FEE = { id: "F1", company_id: "C1", project_id: "P1", status: "due", amount_minor: 79000, grace_ends_at: "2026-11-07T10:00:00Z" };
const db0 = () => {
  const db = fakeDb({ job_fees: [{ ...FEE }], job_fee_payments: [], job_fee_invoices: [], audit_log: [], activity: [] }, { job_fee_payments: [["order_id"]] });
  let n = 0;
  db.rpc = async (name) => (name === "next_job_fee_invoice_no" ? { data: `VMF-2026-${String(++n).padStart(6, "0")}`, error: null } : { data: null, error: { message: "no" } });
  return db;
};

test("the test gateway pays a due fee at once; the payment and the audit are recorded", async () => {
  const db = db0();
  const acts = [];
  const r = await startCardPayment(db, { fee: FEE, gateway: mockGateway(), io: { logActivity: async (_db, a) => acts.push(a.key) } });
  assert.deepEqual([r.ok, r.paid, r.test], [true, true, true]);
  assert.equal(db.T.job_fees[0].status, "paid");
  assert.equal(db.T.job_fees[0].payment_method, "card");
  assert.equal(db.T.job_fee_payments[0].status, "paid");
  assert.equal(db.T.job_fee_payments[0].amount_minor, 79000, "the fee row's amount");
  assert.deepEqual(db.T.audit_log.map((a) => a.action), ["job_fee.paid"]);
  assert.deepEqual(acts, ["act_fee_paid"]);
  assert.equal((await startCardPayment(db, { fee: db.T.job_fees[0], gateway: mockGateway() })).error, "not_due");
});

test("the bank before its keys: not configured, nothing paid", async () => {
  const db = db0();
  const r = await startCardPayment(db, { fee: FEE, gateway: victoriaBankGateway({}) });
  assert.deepEqual([r.ok, r.error], [false, "not_configured"]);
  assert.equal(db.T.job_fees[0].status, "due");
  assert.equal(db.T.job_fee_payments[0].status, "failed");
  assert.equal(gatewayFor({ NODE_ENV: "production" }).id, "victoriabank", "never the test gateway in production");
  assert.equal(gatewayFor({ NODE_ENV: "development" }).id, "mock");
  assert.equal(gatewayFor({ NODE_ENV: "production", VB_MERCHANT_ID: "m", VB_TERMINAL_ID: "t", VB_KEY: "k" }).ready, true);
  assert.match(newOrderId(Date.parse("2026-10-24T10:00:00Z"), () => 0.5), /^VMF[0-9A-Z]+$/);
});

test("the bank's callback: once per order, and only for the amount asked", async () => {
  const db = db0();
  db.T.job_fee_payments.push({ id: "PY1", fee_id: "F1", company_id: "C1", order_id: "VMFAAA1", amount_minor: 79000, status: "started" });
  assert.equal((await settleCallback(db, { orderId: "VMFAAA1", amountMinor: 100, approved: true })).error, "amount_mismatch");
  assert.equal(db.T.job_fees[0].status, "due");
  db.T.job_fee_payments[0].status = "started";
  assert.equal((await settleCallback(db, { orderId: "VMFAAA1", amountMinor: 79000, approved: true })).ok, true);
  assert.equal(db.T.job_fees[0].status, "paid");
  assert.equal((await settleCallback(db, { orderId: "VMFAAA1", amountMinor: 79000, approved: true })).already, true);
  assert.equal(db.T.audit_log.filter((a) => a.action === "job_fee.paid").length, 1, "paid once");
  assert.equal((await settleCallback(db, { orderId: "nope", approved: true })).error, "unknown_order");
});

test("a void fee is not paid; a paid one answers already", async () => {
  const db = db0();
  db.T.job_fees[0].status = "void";
  assert.equal((await markFeePaid(db, { feeId: "F1", method: "admin" })).error, "not_due");
  db.T.job_fees[0].status = "paid";
  assert.equal((await markFeePaid(db, { feeId: "F1", method: "admin" })).already, true);
});

test("VoltMira's invoice for a fee: once, numbered, with the transfer reference and VAT from the setting", async () => {
  const db = db0();
  const seller = sellerDetails({ VOLTMIRA_LEGAL_NAME: "VoltMira SRL", VOLTMIRA_IDNO: "1020600000001", VOLTMIRA_ADDRESS: "Chișinău", VOLTMIRA_IBAN: "MD00VI000000000000000000" });
  assert.equal(sellerDetails({}), null);
  const co = { name: "SolarTech", legal_name: "SolarTech SRL", idno: "1003600123456", legal_address: "Chișinău" };
  assert.equal((await invoiceForFee(db, { fee: FEE, company: co, seller: null })).error, "seller");
  const r = await invoiceForFee(db, { fee: FEE, company: co, seller, vatRate: 20 });
  assert.equal(r.invoice.number, "VMF-2026-000001");
  assert.deepEqual([r.invoice.net_minor, r.invoice.vat_minor, r.invoice.total_minor], [79000, 15800, 94800]);
  assert.equal(r.invoice.payment_ref, feeRef("F1"));
  assert.equal(r.invoice.buyer.idno, "1003600123456");
  const again = await invoiceForFee(db, { fee: db.T.job_fees[0], company: co, seller });
  assert.deepEqual([again.already, db.T.job_fee_invoices.length], [true, 1]);
});
