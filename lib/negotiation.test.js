// The limits the proposal assistant negotiates within. These are the checks
// that stand between a persuasive client and the installer's margin, so each
// one is pinned.
import { test } from "node:test";
import assert from "node:assert/strict";
import { normalizePolicy, evaluateDiscount, evaluateOption, priceWithOffer, offerStanding, HARD_MAX_DISCOUNT_PCT } from "./negotiation.js";

const on = { enabled: true, maxDiscountPct: 5 };

test("negotiation is off unless the installer turns it on", () => {
  assert.equal(normalizePolicy(undefined).enabled, false);
  assert.equal(normalizePolicy({ enabled: "yes", maxDiscountPct: 5 }).enabled, false);
  assert.deepEqual(evaluateDiscount({ policy: {}, requestedPct: 1, totalEur: 10000 }), { ok: false, reason: "disabled" });
  assert.equal(evaluateDiscount({ policy: { enabled: true, maxDiscountPct: 0 }, requestedPct: 1, totalEur: 10000 }).reason, "disabled");
});

test("the ceiling is capped, whatever settings say", () => {
  assert.equal(normalizePolicy({ enabled: true, maxDiscountPct: 80 }).maxDiscountPct, HARD_MAX_DISCOUNT_PCT);
  assert.equal(normalizePolicy({ enabled: true, maxDiscountPct: -3 }).maxDiscountPct, 0);
  assert.equal(normalizePolicy({ enabled: true, maxDiscountPct: "4.26" }).maxDiscountPct, 4.3);
});

test("a discount within the limit is priced exactly", () => {
  assert.deepEqual(evaluateDiscount({ policy: on, requestedPct: 3, totalEur: 9876.5 }),
    { ok: true, pct: 3, discountEur: 296.3, newTotalEur: 9580.2, replaces: false });
});

test("above the limit is refused, and says where the limit is", () => {
  assert.deepEqual(evaluateDiscount({ policy: on, requestedPct: 5.1, totalEur: 10000 }),
    { ok: false, reason: "above_limit", maxPct: 5, currentPct: 0 });
  assert.equal(evaluateDiscount({ policy: on, requestedPct: 5, totalEur: 10000 }).ok, true);
});

test("discounts replace each other and never stack or shrink", () => {
  // 3% already offered: 4% replaces it (4% in total, not 7%).
  const up = evaluateDiscount({ policy: on, requestedPct: 4, totalEur: 10000, currentPct: 3 });
  assert.equal(up.ok, true);
  assert.equal(up.pct, 4);
  assert.equal(up.replaces, true);
  assert.equal(up.newTotalEur, 9600);
  // Asking for 3 + 3 still hits the 5% ceiling as a total.
  assert.equal(evaluateDiscount({ policy: on, requestedPct: 6, totalEur: 10000, currentPct: 3 }).reason, "above_limit");
  assert.equal(evaluateDiscount({ policy: on, requestedPct: 2, totalEur: 10000, currentPct: 3 }).reason, "not_higher");
});

test("nonsense amounts are refused", () => {
  for (const bad of [0, -2, NaN, "lots", Infinity]) {
    assert.equal(evaluateDiscount({ policy: on, requestedPct: bad, totalEur: 10000 }).ok, false);
  }
  assert.equal(evaluateDiscount({ policy: on, requestedPct: 2, totalEur: 0 }).reason, "invalid");
});

test("only the installer's own attached options can be chosen", () => {
  const options = [{ label: "8 kW", kw: 8 }, { label: "8 kW + battery", kw: 8, battKwh: 10 }];
  assert.equal(evaluateOption({ policy: on, index: 1, options }).ok, true);
  assert.deepEqual(evaluateOption({ policy: on, index: 2, options }), { ok: false, reason: "no_such_option", count: 2 });
  assert.equal(evaluateOption({ policy: on, index: 0.5, options }).ok, false);
  assert.equal(evaluateOption({ policy: { ...on, allowOptions: false }, index: 0, options }).reason, "disabled");
});

test("price with an open offer, and how long it stands", () => {
  assert.deepEqual(priceWithOffer(12000, { pct: 2.5 }), { totalEur: 11700, discountEur: 300, pct: 2.5 });
  assert.deepEqual(priceWithOffer(12000, null), { totalEur: 12000, discountEur: 0, pct: 0 });
  const now = Date.UTC(2026, 8, 26);
  assert.equal(offerStanding(new Date(now - 13 * 864e5).toISOString(), now), true);
  assert.equal(offerStanding(new Date(now - 15 * 864e5).toISOString(), now), false);
});
