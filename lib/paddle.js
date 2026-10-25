// lib/paddle.js — client helper for Paddle Billing (Merchant of Record), for a developer's bank pack only
// (lib/packPricing.js). Lazy-loads Paddle.js and opens an overlay checkout; fulfilment happens in the webhook.
// Installers have no plans or credits since 2026-10-24: their one charge is a fee per won project (lib/jobFees.js).
//
// Env (optional until the pack is sold; the button says so otherwise):
//   NEXT_PUBLIC_PADDLE_CLIENT_TOKEN   client-side token (Paddle → Developer tools → Authentication)
//   NEXT_PUBLIC_PADDLE_ENV            "sandbox" (default) | "production"
//   NEXT_PUBLIC_PADDLE_PRICE_PACK_CI, _UTILITY, _PORTFOLIO (and each with _RENEWAL): the pack's one-time prices

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
