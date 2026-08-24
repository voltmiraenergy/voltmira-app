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
//   NEXT_PUBLIC_PADDLE_PRICE_ENTERPRISE  Enterprise is quoted per deal (no public
//                                        price) until SSO and the API ship, so this
//                                        stays unset and the tier is sales-led.

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

export function priceIdFor(plan) {
  if (plan === "team") return process.env.NEXT_PUBLIC_PADDLE_PRICE_TEAM;
  if (plan === "enterprise") return process.env.NEXT_PUBLIC_PADDLE_PRICE_ENTERPRISE;
  return process.env.NEXT_PUBLIC_PADDLE_PRICE_PRO;
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
export async function openCheckout({ plan, email, companyId, successUrl }) {
  const priceId = priceIdFor(plan);
  if (!priceId) throw new Error("This plan isn't configured yet.");
  const Paddle = await initPaddle();
  Paddle.Checkout.open({
    items: [{ priceId, quantity: 1 }],
    customer: email ? { email } : undefined,
    customData: { company_id: companyId, plan },
    settings: successUrl ? { successUrl, displayMode: "overlay", theme: "light" } : undefined,
  });
}
