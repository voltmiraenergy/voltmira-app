import { test } from "node:test";
import assert from "node:assert/strict";
import { vatBreakdown } from "./invoiceMath.js";

test("vatBreakdown backs the net/VAT out of a VAT-inclusive gross, not on top of it", () => {
  const r = vatBreakdown(1200, 20);
  assert.equal(r.gross, 1200);
  assert.ok(Math.abs(r.net - 1000) < 1e-9);
  assert.ok(Math.abs(r.vat - 200) < 1e-9);
  assert.ok(Math.abs(r.net + r.vat - r.gross) < 1e-9);
  assert.equal(r.showVat, true);
});

test("vatBreakdown at rate 0 shows no VAT line, net equals gross", () => {
  const r = vatBreakdown(1200, 0);
  assert.equal(r.showVat, false);
  assert.equal(r.net, 1200);
  assert.equal(r.vat, 0);
});

test("vatBreakdown never throws or goes negative on missing/garbage input", () => {
  assert.deepEqual(vatBreakdown(), { net: 0, vat: 0, gross: 0, rate: 0, showVat: false });
  assert.equal(vatBreakdown(-500, 20).gross, 0);
  assert.equal(vatBreakdown(1000, -20).rate, 0);
});

import { invoiceAmounts } from "./invoiceMath.js";

test("a proforma converts the euro price as it is, so it lands within a unit of the offer", () => {
  // 11,299.6 EUR at 19.8: the offer prints 223,732 lei; rounding to a whole euro first printed 223,740
  assert.equal(invoiceAmounts({ grossEur: 11299.6, fx: 19.8 }).gross, 223732);
  assert.equal(invoiceAmounts({ grossEur: 11300, fx: 19.8 }).gross, 223740);
});

test("net + VAT and deposit + balance still add up to the total", () => {
  const a = invoiceAmounts({ grossEur: 11299.6, fx: 19.8, vatRatePct: 20, depositPct: 30 });
  assert.equal(a.net + a.vat, a.gross);
  assert.equal(a.deposit + a.balance, a.gross);
});
