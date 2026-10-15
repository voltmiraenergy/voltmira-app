// lib/packPricing.js — what a developer pays for a plant's bank pack, and
// whether a pack is paid for. VoltMira sells the lender-ready pre-feasibility
// and credit application pack per project: the credit summary in Romanian and
// English, the Excel model, the checklist and the deal room. The price
// follows the plant's size, never the outcome of the loan (a pack paid only
// when a bank lends would not be independent, and a bank would discount it).
//
// The tiers:
//   ci         a plant up to 2 MW (a factory roof, a small ground plant)
//   utility    a plant above 2 MW
//   portfolio  the data room of a portfolio that holds plants
// The prices are the pilot prices, kept here and nowhere else.
//
// An unlock covers one plant (or one portfolio's data room) for 90 days:
// re-running the pack after a change in that time is included. After it, a
// new pack is half the price.
//
// The gate is off until PACK_PAYWALL is "on" (Vercel env), so the code can
// ship before the Paddle prices and the table exist. A sample plant is always
// open, so the demo keeps working. Pure; no I/O.
import { normalizePlant } from "./plantFinance.js";

export const PACK_TIERS = ["ci", "utility", "portfolio"];
export const PACK_PRICES_EUR = { ci: 600, utility: 2900, portfolio: 9000 };
/** Above this capacity, MW, a plant is utility scale. */
export const CI_MAX_MW = 2;
export const UNLOCK_DAYS = 90;
export const RENEWAL_SHARE = 0.5;
const DAY = 24 * 60 * 60 * 1000;

/** Whether the pack gate is on. */
export function paywallOn(env = process.env) {
  return String(env.PACK_PAYWALL || "").toLowerCase() === "on";
}

/**
 * Two switches for trying the gate on a local machine, never in a production
 * build (NODE_ENV "production" turns both off, whatever the env says):
 *   PACK_LOCK_SAMPLES=on  a sample plant is locked too, so the demo shows the gate
 *   PACK_TEST_PAY=on      "Pay by card (test)" unlocks the pack as a paid card
 *                         payment would, without Paddle (app/api/portfolios/[id]/pack/test-pay)
 */
export function localSwitch(name, env = process.env) {
  return env.NODE_ENV !== "production" && String(env[name] || "").toLowerCase() === "on";
}

/** The plant's generating capacity, MW: wind plus solar (storage does not generate). */
export function plantMw(plant) {
  const pl = normalizePlant(plant);
  return (pl.wind?.mw || 0) + (pl.solar?.mwp || 0);
}

/** The tier of a plant's pack. */
export function packTier(plant) {
  return plantMw(plant) > CI_MAX_MW ? "utility" : "ci";
}

/**
 * The unlock that covers this plant (or, with plantId null, this portfolio's
 * data room) at `now`, or null.
 * @param {Array<{portfolio_id:string, plant_id:string|null, expires_at:string}>} unlocks
 */
export function activeUnlock(unlocks, { portfolioId, plantId = null }, now = Date.now()) {
  const t = now instanceof Date ? now.getTime() : Number(now);
  return (unlocks || [])
    .filter((u) => u && String(u.portfolio_id) === String(portfolioId) && (u.plant_id || null) === (plantId || null))
    .filter((u) => new Date(u.expires_at).getTime() > t)
    .sort((a, b) => new Date(b.expires_at) - new Date(a.expires_at))[0] || null;
}

/** Whether the plant had an unlock before that has since run out: the next pack is a renewal. */
export function hadUnlock(unlocks, { portfolioId, plantId = null }) {
  return (unlocks || []).some((u) => u && String(u.portfolio_id) === String(portfolioId) && (u.plant_id || null) === (plantId || null));
}

/** The price of a tier, EUR, at the renewal share when it renews. */
export function packPrice(tier, renewal = false) {
  const base = PACK_PRICES_EUR[tier];
  if (base == null) throw new Error(`unknown pack tier: ${tier}`);
  return renewal ? Math.round(base * RENEWAL_SHARE) : base;
}

/** When an unlock made at `from` runs out. */
export function unlockExpiry(from = Date.now()) {
  const t = from instanceof Date ? from.getTime() : Number(from);
  return new Date(t + UNLOCK_DAYS * DAY).toISOString();
}

/**
 * The access to one pack: whether the caller may download it, and if not,
 * what it costs.
 * @param {object} a
 * @param {object|null} a.plant      the stored plant, or null for a portfolio's data room
 * @param {string} a.portfolioId
 * @param {Array} a.unlocks          the company's pack_unlocks rows
 * @param {boolean} [a.admin]        a platform admin
 * @param {object} [a.env]
 * @returns {{ open:boolean, reason:string, tier:string, priceEur:number, renewal:boolean, unlock:object|null }}
 */
export function packAccess({ plant = null, portfolioId, unlocks = [], admin = false, env = process.env, now = Date.now() }) {
  const plantId = plant ? String(plant.id) : null;
  const tier = plant ? packTier(plant) : "portfolio";
  const unlock = activeUnlock(unlocks, { portfolioId, plantId }, now);
  const renewal = !unlock && hadUnlock(unlocks, { portfolioId, plantId });
  const priceEur = packPrice(tier, renewal);
  const base = { tier, priceEur, renewal, unlock };
  if (!paywallOn(env)) return { ...base, open: true, reason: "off" };
  if (plant && normalizePlant(plant).sample && !localSwitch("PACK_LOCK_SAMPLES", env)) return { ...base, open: true, reason: "sample" };
  if (admin) return { ...base, open: true, reason: "admin" };
  if (unlock) return { ...base, open: true, reason: "paid" };
  return { ...base, open: false, reason: "locked" };
}

/** The Paddle one-time price id for a tier (full price; a renewal has its own id when set). */
export function packPriceId(tier, renewal = false, env = process.env) {
  const key = `NEXT_PUBLIC_PADDLE_PRICE_PACK_${tier.toUpperCase()}${renewal ? "_RENEWAL" : ""}`;
  return env[key] || null;
}

/**
 * Whether a Paddle transaction paid for this tier: one of its items is the
 * tier's price (full, or the renewal price). The checkout's custom_data comes
 * from the browser, so the webhook never trusts the tier it names.
 */
export function paidForTier(items, tier, env = process.env) {
  const ok = [packPriceId(tier, false, env), packPriceId(tier, true, env)].filter(Boolean);
  return (items || []).some((it) => ok.includes(it?.price?.id || it?.price_id));
}

/**
 * The unlock a completed Paddle transaction pays for, or why it pays for
 * none. custom_data (set at checkout) names the company, the portfolio and
 * the plant; the portfolio must be that company's, the plant must be in it,
 * and the price paid must be the plant's own tier (lib/packPricing.js
 * paidForTier), so a cheaper price cannot unlock a bigger plant.
 * @param {object} a
 * @param {object} a.data        the event's data (a Paddle transaction)
 * @param {object|null} a.portfolio  the portfolio row named in custom_data
 * @returns {{ row?: object, error?: string }}
 */
export function unlockFromTransaction({ data, portfolio, plantsKey, env = process.env, now = Date.now() }) {
  const c = data?.custom_data || {};
  if (c.kind !== "pack") return { error: "not_pack" };
  if (!data?.id) return { error: "no_txn" };
  if (!portfolio || String(portfolio.id) !== String(c.portfolio_id) || String(portfolio.company_id) !== String(c.company_id)) return { error: "portfolio" };
  let tier = "portfolio";
  let plantId = null;
  if (c.plant_id) {
    const list = Array.isArray(portfolio.assets?.[plantsKey]) ? portfolio.assets[plantsKey] : [];
    const plant = list.find((p) => p && String(p.id) === String(c.plant_id));
    if (!plant) return { error: "plant" };
    tier = packTier(plant);
    plantId = String(plant.id);
  }
  if (!paidForTier(data.items, tier, env)) return { error: "price" };
  const renewal = (data.items || []).some((it) => (it?.price?.id || it?.price_id) === packPriceId(tier, true, env));
  return {
    row: {
      company_id: c.company_id, portfolio_id: c.portfolio_id, plant_id: plantId, tier,
      amount_eur: packPrice(tier, renewal), source: "paddle", paddle_txn_id: String(data.id),
      unlocked_by: "paddle", expires_at: unlockExpiry(now),
    },
  };
}
