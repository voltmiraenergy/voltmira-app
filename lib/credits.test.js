import { test } from "node:test";
import assert from "node:assert/strict";
import { offerDecision, gridFileDecision, docDecision, DOC_KINDS, creditsFromTransaction, creditsPaywallOn, FREE_OFFERS_PER_MONTH, CREDIT_PACKS, monthStart } from "./credits.js";

const ENV = { NEXT_PUBLIC_PADDLE_PRICE_CREDITS_10: "pri_10", NEXT_PUBLIC_PADDLE_PRICE_CREDITS_50: "pri_50" };

test("nothing is limited or charged until CREDITS_PAYWALL is on", () => {
  assert.equal(creditsPaywallOn({}), false);
  assert.equal(creditsPaywallOn({ CREDITS_PAYWALL: "On" }), true);
  assert.deepEqual(offerDecision({ plan: "free", sentThisMonth: 99, balance: 0, on: false }), { allowed: true, spend: 0, reason: "off", left: null });
  assert.equal(gridFileDecision({ plan: "free", on: false }).allowed, true);
});

test("the free plan sends 5 offers a month, then needs a credit", () => {
  const d = (sent, balance) => offerDecision({ plan: "free", sentThisMonth: sent, balance, on: true });
  assert.deepEqual(d(0, 0), { allowed: true, spend: 0, reason: "included", left: 4 });
  assert.deepEqual(d(4, 0), { allowed: true, spend: 0, reason: "included", left: 0 });
  assert.equal(FREE_OFFERS_PER_MONTH, 5);
  assert.deepEqual(d(5, 3), { allowed: true, spend: 1, reason: "credit", left: 0 });
  assert.deepEqual(d(5, 0), { allowed: false, spend: 0, reason: "blocked", left: 0 });
});

test("paid plans send without limit and never spend a credit", () => {
  for (const plan of ["pro", "team", "enterprise"]) {
    assert.deepEqual(offerDecision({ plan, sentThisMonth: 500, balance: 0, on: true }), { allowed: true, spend: 0, reason: "plan", left: null });
    assert.equal(gridFileDecision({ plan, balance: 0, on: true }).spend, 0);
  }
});

test("the grid file costs a free workspace one credit per quote, once", () => {
  assert.deepEqual(gridFileDecision({ plan: "free", balance: 2, on: true }), { allowed: true, spend: 1, reason: "credit" });
  assert.deepEqual(gridFileDecision({ plan: "free", balance: 0, paidBefore: true, on: true }), { allowed: true, spend: 0, reason: "paid" });
  assert.equal(gridFileDecision({ plan: "free", balance: 0, on: true }).allowed, false);
});

test("the free plan pays one credit per Studio document per job; other documents stay free", () => {
  assert.deepEqual(DOC_KINDS, ["annex", "protocol", "performance"]);
  for (const kind of DOC_KINDS) {
    assert.deepEqual(docDecision({ plan: "free", kind, balance: 1, on: true }), { allowed: true, spend: 1, reason: "credit" });
    assert.equal(docDecision({ plan: "free", kind, balance: 0, on: true }).allowed, false);
    assert.equal(docDecision({ plan: "free", kind, balance: 0, paidBefore: true, on: true }).spend, 0);
    assert.equal(docDecision({ plan: "pro", kind, balance: 0, on: true }).allowed, true);
    assert.equal(docDecision({ plan: "free", kind, balance: 0, on: false }).allowed, true);
  }
  // the invoice, the bankability sheet and anything unnamed are never charged
  assert.deepEqual(docDecision({ plan: "free", kind: undefined, balance: 0, on: true }), { allowed: true, spend: 0, reason: "free" });
  assert.equal(docDecision({ plan: "free", kind: "invoice", balance: 0, on: true }).allowed, true);
});

test("a transaction credits the pack its PRICE paid for, not the one custom_data names", () => {
  const tx = (priceId, kind = "credits", extra = {}) => ({ id: "txn_1", custom_data: { kind, company_id: "co1", pack: "c50" }, items: [{ price: { id: priceId }, quantity: 1 }], ...extra });
  assert.deepEqual(creditsFromTransaction({ data: tx("pri_10"), env: ENV }).row, { company_id: "co1", delta: 10, reason: "purchase", ref: "c10", paddle_txn_id: "txn_1" });
  assert.equal(creditsFromTransaction({ data: tx("pri_50"), env: ENV }).row.delta, 50);
  assert.equal(creditsFromTransaction({ data: tx("pri_other"), env: ENV }).error, "price");
  assert.equal(creditsFromTransaction({ data: tx("pri_10", "pack"), env: ENV }).error, "not_credits");
  assert.equal(creditsFromTransaction({ data: tx("pri_10", "credits", { id: "" }), env: ENV }).error, "no_txn");
  assert.equal(creditsFromTransaction({ data: { id: "t", custom_data: { kind: "credits" }, items: [{ price: { id: "pri_10" } }] }, env: ENV }).error, "no_company");
  // no price ids configured: nothing is ever credited
  assert.equal(creditsFromTransaction({ data: tx("pri_10"), env: {} }).error, "price");
  assert.equal(creditsFromTransaction({ data: { ...tx("pri_10"), items: [{ price: { id: "pri_10" }, quantity: 2 }] }, env: ENV }).row.delta, 20);
});

test("packs are 10 for 25 EUR and 50 for 99 EUR; the month restarts on the 1st", () => {
  assert.deepEqual([CREDIT_PACKS.c10.credits, CREDIT_PACKS.c10.eur, CREDIT_PACKS.c50.credits, CREDIT_PACKS.c50.eur], [10, 25, 50, 99]);
  assert.equal(monthStart("2026-10-13"), "2026-10-01");
});
