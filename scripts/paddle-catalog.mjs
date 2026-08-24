// scripts/paddle-catalog.mjs — create the VoltMira product catalog in Paddle.
//
// Creates 3 products (Starter / Pro / Advanced), each with a monthly + annual
// recurring price, a 7-day free trial, USD base pricing, and PPP-adjusted
// country overrides for UK (GBP), Ireland (EUR) and Australia (AUD).
//
// Amounts are in the LOWEST denomination as strings (USD 10.00 -> "1000").
//
// Run (sandbox):
//   PADDLE_API_KEY=pdl_sdbx_apikey_xxx PADDLE_ENV=sandbox node scripts/paddle-catalog.mjs
// Run (production, later):
//   PADDLE_API_KEY=pdl_live_apikey_xxx PADDLE_ENV=production node scripts/paddle-catalog.mjs
//
// The API key is the SERVER-side key: Paddle -> Developer Tools -> Authentication
// -> API keys (NOT the client-side token). Node 18+ (global fetch) required.

const KEY = process.env.PADDLE_API_KEY;
const ENV = process.env.PADDLE_ENV === "production" ? "production" : "sandbox";
const BASE = ENV === "production" ? "https://api.paddle.com" : "https://sandbox-api.paddle.com";
const TAX_CATEGORY = process.env.PADDLE_TAX_CATEGORY || "standard"; // switch to "saas" once enabled in your account

if (!KEY) { console.error("Set PADDLE_API_KEY (sandbox API key). Aborting."); process.exit(1); }

// PPP overrides applied to every price. { GB: multiplier..., } — but we just hardcode
// amounts per plan below for full control (Paddle wants lowest-denomination strings).
const TRIAL = { interval: "day", frequency: 7 };

// amounts in lowest denomination (cents/pence). [monthly, annual]
const PLANS = [
  {
    key: "starter", name: "VoltMira Starter",
    description: "Solar quoting for a single installer — honest payback bands and tracked proposals.",
    usd: { m: "1000", y: "10000" },
    gbp: { m: "800",  y: "8000"  },
    eur: { m: "900",  y: "9000"  },
    aud: { m: "1500", y: "15000" },
  },
  {
    key: "pro", name: "VoltMira Pro",
    description: "For growing installers — pipeline, catalog/BOM, branded PDFs and WhatsApp proposals.",
    usd: { m: "4000", y: "40000" },
    gbp: { m: "3200", y: "32000" },
    eur: { m: "3600", y: "36000" },
    aud: { m: "6000", y: "60000" },
  },
  {
    key: "advanced", name: "VoltMira Advanced",
    description: "For teams — multiple seats, activity log, referral program and priority support.",
    usd: { m: "12000", y: "120000" },
    gbp: { m: "9600",  y: "96000"  },
    eur: { m: "10800", y: "108000" },
    aud: { m: "18000", y: "180000" },
  },
];

async function api(path, body) {
  const r = await fetch(BASE + path, {
    method: "POST",
    headers: { Authorization: "Bearer " + KEY, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(`${path} -> ${r.status}: ${JSON.stringify(j.error || j)}`);
  return j.data;
}

function priceBody(plan, cycle) {
  const interval = cycle === "m" ? "month" : "year";
  return {
    product_id: plan.productId,
    description: `${plan.name} — ${cycle === "m" ? "Monthly" : "Annual"}`,
    type: "standard",
    billing_cycle: { interval, frequency: 1 },
    trial_period: TRIAL,
    unit_price: { amount: plan.usd[cycle], currency_code: "USD" },
    unit_price_overrides: [
      { country_codes: ["GB"], unit_price: { amount: plan.gbp[cycle], currency_code: "GBP" } },
      { country_codes: ["IE"], unit_price: { amount: plan.eur[cycle], currency_code: "EUR" } },
      { country_codes: ["AU"], unit_price: { amount: plan.aud[cycle], currency_code: "AUD" } },
    ],
    quantity: { minimum: 1, maximum: 1 },
    custom_data: { plan: plan.key, cycle: interval },
  };
}

const out = [];
for (const plan of PLANS) {
  const product = await api("/products", {
    name: plan.name, tax_category: TAX_CATEGORY, description: plan.description,
    custom_data: { plan: plan.key },
  });
  plan.productId = product.id;
  const monthly = await api("/prices", priceBody(plan, "m"));
  const annual  = await api("/prices", priceBody(plan, "y"));
  out.push({ plan: plan.key, product: product.id, monthly: monthly.id, annual: annual.id });
  console.log(`✓ ${plan.name}`);
}

console.log(`\n================  ${ENV.toUpperCase()} CATALOG CREATED  ================`);
for (const o of out) {
  console.log(`\n${o.plan.toUpperCase()}`);
  console.log(`  product  ${o.product}`);
  console.log(`  monthly  ${o.monthly}`);
  console.log(`  annual   ${o.annual}`);
}
console.log(`\n--- env vars for the app (monthly price IDs) ---`);
console.log(`NEXT_PUBLIC_PADDLE_PRICE_PRO=${out.find(o=>o.plan==="starter")?.monthly}   # Starter`);
console.log(`NEXT_PUBLIC_PADDLE_PRICE_TEAM=${out.find(o=>o.plan==="pro")?.monthly}   # Pro`);
console.log(`NEXT_PUBLIC_PADDLE_PRICE_ENTERPRISE=${out.find(o=>o.plan==="advanced")?.monthly}   # Advanced`);
