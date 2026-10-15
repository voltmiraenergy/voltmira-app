// lib/paddle.js — client helper for Paddle Billing (Merchant of Record).
// Lazy-loads Paddle.js and opens an overlay checkout. The customer pays by card
// right there (no Paddle account needed); Paddle is the seller of record, handles
// EU VAT, and pays out to the Moldova account. Fulfilment happens in the webhook.
//
// Env (all optional until you go live — the buttons no-op with a message otherwise):
//   NEXT_PUBLIC_PADDLE_CLIENT_TOKEN   client-side token (Paddle → Developer tools → Authentication)
//   NEXT_PUBLIC_PADDLE_ENV            "sandbox" (default) | "production"
//   NEXT_PUBLIC_PADDLE_PRICE_PRO         price id for the €49 Pro plan
//   NEXT_PUBLIC_PADDLE_PRICE_TEAM        price id for the €119 Team plan
//   NEXT_PUBLIC_PADDLE_PRICE_PRO_YEARLY  the €490 a year Pro price (2 months free)
//   NEXT_PUBLIC_PADDLE_PRICE_TEAM_YEARLY the €1,190 a year Team price
//   NEXT_PUBLIC_PADDLE_PRICE_CREDITS_10, _CREDITS_50   one-time credit packs, 25 and 99 EUR
//                                        (lib/credits.js)
//   NEXT_PUBLIC_PADDLE_PRICE_PACK_CI, _UTILITY, _PORTFOLIO (and each with
//                                        _RENEWAL) one-time prices of the bank pack
//                                        (lib/packPricing.js)
//   NEXT_PUBLIC_PADDLE_PRICE_ENTERPRISE  Enterprise is quoted per deal (no public
//                                        price) until SSO and the API ship, so this
//                                        stays unset and the tier is sales-led.

import { creditPriceId } from "./credits.js";

let readyPromise = null;

function loadScript() {
  return new Promise((resolve, reject) => {
    if (typeof window === "undefined") return reject(new Error("no window"));
    if (window.Paddle) return resolve(window.Paddle);
    const s = document.createElement("script");
    s.src = "https://cdn.paddle.com/paddle/v2/paddle.js";
    s.async = true;
    s.onload = () => (window.Paddle ? resolve(window.Paddle) : reject(new Error("Paddle.js loaded but unavailable")));
    s.onerror = () => reject(new Error("Failed to load Paddle.js"));
    document.head.appendChild(s);
  });
}

export function paddleConfigured() {
  return !!process.env.NEXT_PUBLIC_PADDLE_CLIENT_TOKEN;
}

/** The price id of a plan, monthly or yearly. A yearly price that is not set yet is "not configured", never silently the monthly one. */
export function priceIdFor(plan, interval = "month") {
  if (plan === "enterprise") return process.env.NEXT_PUBLIC_PADDLE_PRICE_ENTERPRISE;
  const yearly = interval === "year";
  if (plan === "team") return yearly ? process.env.NEXT_PUBLIC_PADDLE_PRICE_TEAM_YEARLY : process.env.NEXT_PUBLIC_PADDLE_PRICE_TEAM;
  return yearly ? process.env.NEXT_PUBLIC_PADDLE_PRICE_PRO_YEARLY : process.env.NEXT_PUBLIC_PADDLE_PRICE_PRO;
}

/** Whether a plan can be paid yearly yet (its yearly price id is set). */
export function yearlyReady(plan) {
  return paddleConfigured() && !!priceIdFor(plan, "year");
}

async function initPaddle() {
  if (readyPromise) return readyPromise;
  const token = process.env.NEXT_PUBLIC_PADDLE_CLIENT_TOKEN;
  if (!token) throw new Error("Billing isn't configured yet.");
  readyPromise = loadScript().then((Paddle) => {
    Paddle.Environment.set(process.env.NEXT_PUBLIC_PADDLE_ENV === "production" ? "production" : "sandbox");
    Paddle.Initialize({ token });
    return Paddle;
  });
  return readyPromise;
}

/**
 * Open the Paddle overlay checkout for a plan.
 * companyId + plan travel in custom_data → the webhook uses them to set the plan.
 */
export async function openCheckout({ plan, interval = "month", email, companyId, successUrl }) {
  const priceId = priceIdFor(plan, interval);
  if (!priceId) throw new Error("This plan isn't configured yet.");
  const Paddle = await initPaddle();
  Paddle.Checkout.open({
    items: [{ priceId, quantity: 1 }],
    customer: email ? { email } : undefined,
    customData: { company_id: companyId, plan, interval },
    settings: successUrl ? { successUrl, displayMode: "overlay", theme: "light" } : undefined,
  });
}

// the one-time prices of the bank pack, read by name so Next.js inlines them
const PACK_PRICE = {
  ci: process.env.NEXT_PUBLIC_PADDLE_PRICE_PACK_CI,
  utility: process.env.NEXT_PUBLIC_PADDLE_PRICE_PACK_UTILITY,
  portfolio: process.env.NEXT_PUBLIC_PADDLE_PRICE_PACK_PORTFOLIO,
  ci_renewal: process.env.NEXT_PUBLIC_PADDLE_PRICE_PACK_CI_RENEWAL,
  utility_renewal: process.env.NEXT_PUBLIC_PADDLE_PRICE_PACK_UTILITY_RENEWAL,
  portfolio_renewal: process.env.NEXT_PUBLIC_PADDLE_PRICE_PACK_PORTFOLIO_RENEWAL,
};

/** Whether card payment of a pack tier is set up. */
export function packCheckoutReady(tier, renewal = false) {
  // a renewal is paid at its own (half) price, never silently at the full one
  return paddleConfigured() && !!PACK_PRICE[renewal ? `${tier}_renewal` : tier];
}

/**
 * Open the Paddle overlay checkout for one bank pack. The ids travel in
 * custom_data; the webhook checks them against the portfolio and the price
 * paid against the plant's own tier before it unlocks anything.
 */
export async function openPackCheckout({ tier, renewal = false, email, companyId, portfolioId, plantId = null, successUrl }) {
  const priceId = PACK_PRICE[renewal ? `${tier}_renewal` : tier];
  if (!priceId) throw new Error("Card payment for this pack isn't set up yet.");
  const Paddle = await initPaddle();
  Paddle.Checkout.open({
    items: [{ priceId, quantity: 1 }],
    customer: email ? { email } : undefined,
    customData: { kind: "pack", company_id: companyId, portfolio_id: portfolioId, plant_id: plantId || "", tier },
    settings: { displayMode: "overlay", theme: "light", ...(successUrl ? { successUrl } : {}) },
  });
}

/** Whether a credit pack can be paid by card yet. */
export function creditsCheckoutReady(packId) {
  return paddleConfigured() && !!creditPriceId(packId);
}

/**
 * Open the Paddle overlay checkout for a pack of credits. The webhook credits
 * the pack the PRICE paid for (lib/credits.js creditsFromTransaction), never
 * the one custom_data names.
 */
export async function openCreditsCheckout({ pack, email, companyId, successUrl }) {
  const priceId = creditPriceId(pack);
  if (!priceId) throw new Error("Credits aren't set up for card payment yet.");
  const Paddle = await initPaddle();
  Paddle.Checkout.open({
    items: [{ priceId, quantity: 1 }],
    customer: email ? { email } : undefined,
    customData: { kind: "credits", company_id: companyId, pack },
    settings: { displayMode: "overlay", theme: "light", ...(successUrl ? { successUrl } : {}) },
  });
}
