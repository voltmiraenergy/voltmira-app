import { test } from "node:test";
import assert from "node:assert/strict";
import { packTier, plantMw, packPrice, packAccess, activeUnlock, unlockExpiry, paywallOn, paidForTier, packPriceId, PACK_PRICES_EUR, UNLOCK_DAYS } from "./packPricing.js";

const ON = { PACK_PAYWALL: "on" };
const SMALL = { id: "s1", name: "Roof", solar: { mwp: 0.8, yieldKwhKwp: 1250 } };
const BIG = { id: "b1", name: "Park", wind: { mw: 40, turbines: 8 }, solar: { mwp: 20, yieldKwhKwp: 1250 }, bess: { mw: 10, mwh: 20 } };
const NOW = Date.parse("2026-10-10T12:00:00Z");

test("the tier follows the generating capacity: wind plus solar, storage left out", () => {
  assert.equal(plantMw(BIG), 60);
  assert.equal(packTier(SMALL), "ci");
  assert.equal(packTier(BIG), "utility");
  assert.equal(packTier({ id: "x", solar: { mwp: 2 } }), "ci", "2 MW is still C&I");
  assert.equal(packTier({ id: "x", solar: { mwp: 2.01 } }), "utility");
});

test("prices come from one table; a renewal is half", () => {
  assert.equal(packPrice("ci"), PACK_PRICES_EUR.ci);
  assert.equal(packPrice("utility", true), Math.round(PACK_PRICES_EUR.utility / 2));
  assert.throws(() => packPrice("gold"));
});

test("the gate is off unless PACK_PAYWALL is on", () => {
  assert.equal(paywallOn({}), false);
  assert.equal(paywallOn({ PACK_PAYWALL: "ON" }), true);
  const a = packAccess({ plant: BIG, portfolioId: "p", unlocks: [], env: {}, now: NOW });
  assert.equal(a.open, true);
  assert.equal(a.reason, "off");
  assert.equal(a.tier, "utility");
});

test("with the gate on: locked until paid, open for a sample and for a platform admin", () => {
  assert.deepEqual(
    (({ open, reason, priceEur }) => ({ open, reason, priceEur }))(packAccess({ plant: BIG, portfolioId: "p", unlocks: [], env: ON, now: NOW })),
    { open: false, reason: "locked", priceEur: PACK_PRICES_EUR.utility });
  assert.equal(packAccess({ plant: { ...BIG, sample: true }, portfolioId: "p", env: ON, now: NOW }).reason, "sample");
  assert.equal(packAccess({ plant: BIG, portfolioId: "p", admin: true, env: ON, now: NOW }).reason, "admin");
});

test("an unlock covers its own plant for 90 days, then the next pack is a renewal at half price", () => {
  const at = new Date(NOW);
  const u = { portfolio_id: "p", plant_id: "b1", expires_at: unlockExpiry(at) };
  assert.equal(new Date(u.expires_at) - at, UNLOCK_DAYS * 24 * 3600 * 1000);
  assert.equal(packAccess({ plant: BIG, portfolioId: "p", unlocks: [u], env: ON, now: NOW + 1000 }).reason, "paid");
  // another plant, another portfolio: not covered
  assert.equal(packAccess({ plant: { ...BIG, id: "b2" }, portfolioId: "p", unlocks: [u], env: ON, now: NOW }).open, false);
  assert.equal(packAccess({ plant: BIG, portfolioId: "q", unlocks: [u], env: ON, now: NOW }).open, false);
  // after 90 days
  const late = packAccess({ plant: BIG, portfolioId: "p", unlocks: [u], env: ON, now: NOW + (UNLOCK_DAYS + 1) * 24 * 3600 * 1000 });
  assert.equal(late.open, false);
  assert.equal(late.renewal, true);
  assert.equal(late.priceEur, Math.round(PACK_PRICES_EUR.utility / 2));
});

test("a portfolio's data room is its own tier, unlocked with no plant", () => {
  const u = { portfolio_id: "p", plant_id: null, expires_at: unlockExpiry(NOW) };
  assert.equal(packAccess({ plant: null, portfolioId: "p", unlocks: [], env: ON, now: NOW }).tier, "portfolio");
  assert.equal(packAccess({ plant: null, portfolioId: "p", unlocks: [u], env: ON, now: NOW }).open, true);
  // a plant's unlock does not open the data room, nor the other way round
  assert.equal(activeUnlock([u], { portfolioId: "p", plantId: "b1" }, NOW), null);
});

test("the webhook trusts the price paid, never the tier the browser named", () => {
  const env = { NEXT_PUBLIC_PADDLE_PRICE_PACK_CI: "pri_ci", NEXT_PUBLIC_PADDLE_PRICE_PACK_UTILITY: "pri_ut", NEXT_PUBLIC_PADDLE_PRICE_PACK_UTILITY_RENEWAL: "pri_ut_r" };
  assert.equal(packPriceId("utility", false, env), "pri_ut");
  assert.equal(paidForTier([{ price: { id: "pri_ut" } }], "utility", env), true);
  assert.equal(paidForTier([{ price: { id: "pri_ut_r" } }], "utility", env), true);
  assert.equal(paidForTier([{ price: { id: "pri_ci" } }], "utility", env), false, "a C&I price does not unlock a utility plant");
  assert.equal(paidForTier([], "ci", env), false);
});

import { unlockFromTransaction } from "./packPricing.js";

test("a completed Paddle transaction unlocks only the plant it paid the right tier for", () => {
  const env = { NEXT_PUBLIC_PADDLE_PRICE_PACK_CI: "pri_ci", NEXT_PUBLIC_PADDLE_PRICE_PACK_UTILITY: "pri_ut" };
  const portfolio = { id: "pf1", company_id: "co1", assets: { plants: [BIG, SMALL] } };
  const tx = (items, custom) => ({ id: "txn_1", items, custom_data: { kind: "pack", company_id: "co1", portfolio_id: "pf1", ...custom } });
  const ok = unlockFromTransaction({ data: tx([{ price: { id: "pri_ut" } }], { plant_id: "b1" }), portfolio, plantsKey: "plants", env, now: NOW });
  assert.equal(ok.row.tier, "utility");
  assert.equal(ok.row.plant_id, "b1");
  assert.equal(ok.row.paddle_txn_id, "txn_1");
  assert.equal(ok.row.amount_eur, PACK_PRICES_EUR.utility);
  // a C&I price for the utility plant
  assert.equal(unlockFromTransaction({ data: tx([{ price: { id: "pri_ci" } }], { plant_id: "b1" }), portfolio, plantsKey: "plants", env }).error, "price");
  // another company's portfolio, an unknown plant, a subscription
  assert.equal(unlockFromTransaction({ data: tx([{ price: { id: "pri_ut" } }], { plant_id: "b1", company_id: "co2" }), portfolio, plantsKey: "plants", env }).error, "portfolio");
  assert.equal(unlockFromTransaction({ data: tx([{ price: { id: "pri_ut" } }], { plant_id: "zz" }), portfolio, plantsKey: "plants", env }).error, "plant");
  assert.equal(unlockFromTransaction({ data: { id: "t", custom_data: { company_id: "co1" } }, portfolio, plantsKey: "plants", env }).error, "not_pack");
});

import { localSwitch } from "./packPricing.js";

test("the local test switches lock a sample and allow the test payment, never in a production build", () => {
  const SAMPLE = { ...BIG, sample: true };
  const dev = { PACK_PAYWALL: "on", PACK_LOCK_SAMPLES: "on", PACK_TEST_PAY: "on", NODE_ENV: "development" };
  assert.equal(packAccess({ plant: SAMPLE, portfolioId: "p", env: dev, now: NOW }).open, false, "the demo shows the lock");
  assert.equal(localSwitch("PACK_TEST_PAY", dev), true);
  const prod = { ...dev, NODE_ENV: "production" };
  assert.equal(packAccess({ plant: SAMPLE, portfolioId: "p", env: prod, now: NOW }).reason, "sample", "a production build never locks a sample");
  assert.equal(localSwitch("PACK_TEST_PAY", prod), false, "no free unlock online");
  assert.equal(localSwitch("PACK_TEST_PAY", { NODE_ENV: "development" }), false, "off unless asked for");
});
