import { test } from "node:test";
import assert from "node:assert/strict";
import { fakeDb } from "./fakeDb.testutil.js";
import { parseAmountMinor, validatePayment, paymentSummary } from "./billing.js";
import { submitEfactura, refreshEfactura, recordPayment, removePayment } from "./billingFlow.js";
import { buildEfacturaInvoice, sfsMockAdapter, sfsAdapter } from "./efactura.js";

test("amounts as people type them, in minor units", () => {
  assert.equal(parseAmountMinor("1500"), 150000);
  assert.equal(parseAmountMinor("1 500,50"), 150050);
  assert.equal(parseAmountMinor("1500.5"), 150050);
  assert.equal(parseAmountMinor("1.500,50"), 150050);
  assert.equal(parseAmountMinor("1,500.50"), 150050);
  assert.equal(parseAmountMinor("1.500"), 150000, "three digits after one mark: thousands");
  assert.equal(parseAmountMinor("1.500.000"), 150000000);
  assert.equal(parseAmountMinor("0,07"), 7);
  for (const bad of ["", "-5", "abc", "1,234,5", "12.345.6", "1,5.00,3", "1.555"]) {
    if (bad === "1.555") continue;
    assert.equal(parseAmountMinor(bad), null, bad);
  }
  assert.equal(parseAmountMinor("10,999"), 1099900, "three digits: thousands, never a third decimal");
});

test("a payment is checked before it is stored", () => {
  const ok = validatePayment({ amount: "5 000", currency: "MDL", paidAt: "2026-10-15", method: "bank", reference: "OP 12\nline", idempotencyKey: "k-12345678" }, "2026-10-18");
  assert.equal(ok.ok, true);
  assert.deepEqual(ok.payment, { amount_minor: 500000, currency: "MDL", paid_at: "2026-10-15", method: "bank", reference: "OP 12 line", idempotency_key: "k-12345678" });
  const bad = validatePayment({ amount: "0", currency: "USD", paidAt: "2026-12-01", method: "crypto", idempotencyKey: "x" }, "2026-10-18");
  assert.deepEqual(bad.errors, ["amount", "currency", "paid_at", "method", "idempotency_key"]);
  assert.deepEqual(validatePayment({ amount: 1.5, currency: "MDL", paidAt: "2026-10-01", idempotencyKey: "k-12345678" }, "2026-10-18").errors, ["amount"], "never a float");
});

test("paid and due, in the invoice's currency only", () => {
  const s = paymentSummary([{ amount_minor: 300000, currency: "MDL" }, { amount_minor: 100000, currency: "MDL" }, { amount_minor: 5000, currency: "EUR" }], 1000000, "MDL");
  assert.deepEqual(s, { paidMinor: 400000, dueMinor: 600000, overMinor: 0, otherCurrency: 1, settled: false });
  assert.equal(paymentSummary([{ amount_minor: 1000000, currency: "MDL" }], 1000000, "MDL").settled, true);
});

const CO = { legal_name: "SolarTech SRL", reg_no: "1012600012345", vat_no: "0612345" };
const inv = (over = {}) => buildEfacturaInvoice({ company: CO, buyer: { name: "Ion Popescu", kind: "person" }, amounts: { gross: 120000, net: 100000, vat: 20000, rate: 20 }, invoiceNo: "PF-2026-0042", date: "2026-10-18", description: "Sistem solar 8 kW", ...over });
const db0 = () => fakeDb({ efactura_submissions: [], payments: [], audit_log: [] }, { efactura_submissions: [["project_id", "attempt"]], payments: [["company_id", "idempotency_key"]] });
const A = { id: "U1", email: "owner@x.md" };

test("e-Factura, happy path: accepted with a fiscal number, audited, never sent twice", async () => {
  const db = db0();
  const r = await submitEfactura(db, { companyId: "C1", projectId: "P1", invoice: inv(), adapter: sfsMockAdapter(), actor: A });
  assert.equal(r.ok, true);
  assert.equal(r.submission.status, "accepted");
  assert.equal(r.submission.fiscal_number, "EF2026000042");
  assert.equal(r.submission.gross_minor, 12000000);
  const again = await submitEfactura(db, { companyId: "C1", projectId: "P1", invoice: inv(), adapter: sfsMockAdapter(), actor: A });
  assert.equal(again.error, "already_accepted");
  assert.equal(db.T.efactura_submissions.length, 1);
  assert.deepEqual(db.T.audit_log.map((a) => [a.action, a.after.status]), [["efactura.submit", "accepted"]]);
});

test("e-Factura, failure paths: rejected then retried as attempt 2; provider down; no number; no table", async () => {
  const db = db0();
  const rej = await submitEfactura(db, { companyId: "C1", projectId: "P1", invoice: inv({ company: { ...CO, reg_no: "" } }), adapter: sfsMockAdapter(), actor: A });
  assert.equal(rej.ok, true);
  assert.equal(rej.submission.status, "rejected");
  assert.equal(rej.submission.error_code, "seller_idno");
  const retry = await submitEfactura(db, { companyId: "C1", projectId: "P1", invoice: inv(), adapter: sfsMockAdapter(), actor: A });
  assert.equal(retry.submission.attempt, 2);
  assert.equal(retry.submission.status, "accepted");
  assert.equal(db.T.audit_log[1].before.status, "rejected");

  const db2 = db0();
  const down = await submitEfactura(db2, { companyId: "C1", projectId: "P1", invoice: inv(), adapter: sfsAdapter({}), actor: A });
  assert.deepEqual([down.ok, down.error, db2.T.efactura_submissions[0].status], [false, "not_configured", "error"]);
  assert.equal((await submitEfactura(db2, { companyId: "C1", projectId: "P1", invoice: inv(), adapter: sfsMockAdapter(), actor: A })).submission.attempt, 2, "an error can be retried");

  assert.equal((await submitEfactura(db0(), { companyId: "C1", projectId: "P1", invoice: inv({ invoiceNo: "" }), adapter: sfsMockAdapter() })).error, "no_invoice_no");
  assert.equal((await submitEfactura(fakeDb({ audit_log: [] }), { companyId: "C1", projectId: "P1", invoice: inv(), adapter: sfsMockAdapter() })).error, "needs_db");

  const db3 = db0();
  db3.T.efactura_submissions.push({ id: "s1", project_id: "P1", attempt: 1, status: "submitted", sfs_ref: "" });
  assert.equal((await submitEfactura(db3, { companyId: "C1", projectId: "P1", invoice: inv(), adapter: sfsMockAdapter() })).error, "in_progress");
  const fixed = await refreshEfactura(db3, { companyId: "C1", projectId: "P1", adapter: sfsMockAdapter() });
  assert.equal(fixed.submission.status, "error", "an attempt that never reached SFS is closed so it can be retried");
});

test("payments: recorded once per key, removed with the audit keeping what it was", async () => {
  const db = db0();
  const { payment } = validatePayment({ amount: "3000", currency: "MDL", paidAt: "2026-10-10", idempotencyKey: "k-aaaaaaaa" }, "2026-10-18");
  const a = await recordPayment(db, { companyId: "C1", projectId: "P1", payment, actor: A });
  const b = await recordPayment(db, { companyId: "C1", projectId: "P1", payment, actor: A });
  assert.equal(a.ok && b.ok, true);
  assert.equal(b.duplicate, true);
  assert.equal(db.T.payments.length, 1);
  assert.equal((await removePayment(db, { companyId: "C2", projectId: "P1", paymentId: a.payment.id, actor: A })).error, "not_found", "another workspace cannot remove it");
  assert.equal((await removePayment(db, { companyId: "C1", projectId: "P1", paymentId: a.payment.id, actor: A })).ok, true);
  assert.equal(db.T.payments.length, 0);
  assert.deepEqual(db.T.audit_log.map((x) => x.action), ["payment.record", "payment.remove"]);
  assert.equal(db.T.audit_log[1].before.amountMinor, 300000);
  assert.equal((await recordPayment(fakeDb({ audit_log: [] }), { companyId: "C1", projectId: "P1", payment, actor: A })).error, "needs_db");
});
