// app/api/paddle/webhook/route.js — keeps companies.plan in sync with Paddle Billing.
// Setup: Paddle dashboard → Notifications → New destination → this URL
//   (https://voltmira.com/api/paddle/webhook), subscribe to:
//   subscription.created, subscription.activated, subscription.updated,
//   subscription.canceled, subscription.paused.
// Copy the destination's signing secret into PADDLE_WEBHOOK_SECRET (Vercel env).
//
// company_id + plan arrive in custom_data (set at checkout in lib/paddle.js), so
// the webhook knows which company to upgrade without any lookup.
import { NextResponse } from "next/server";
import crypto from "node:crypto";
import { supabaseAdmin } from "../../../../lib/supabase.js";

// Paddle-Signature header looks like "ts=1700000000;h1=<hex>". The signed
// payload is `${ts}:${rawBody}`, HMAC-SHA256 with the destination secret.
function verifySignature(raw, header, secret) {
  if (!header || !secret) return false;
  const parts = {};
  header.split(";").forEach((kv) => {
    const i = kv.indexOf("=");
    if (i > 0) parts[kv.slice(0, i).trim()] = kv.slice(i + 1).trim();
  });
  if (!parts.ts || !parts.h1) return false;
  const expected = crypto.createHmac("sha256", secret).update(`${parts.ts}:${raw}`).digest("hex");
  try {
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(parts.h1));
  } catch {
    return false;
  }
}

export async function POST(req) {
  const raw = await req.text();
  const sig = req.headers.get("paddle-signature");
  if (!verifySignature(raw, sig, process.env.PADDLE_WEBHOOK_SECRET))
    return NextResponse.json({ error: "invalid signature" }, { status: 400 });

  let evt;
  try { evt = JSON.parse(raw); } catch { return NextResponse.json({ error: "bad json" }, { status: 400 }); }

  const type = evt.event_type;
  const data = evt.data || {};
  const custom = data.custom_data || {};
  const companyId = custom.company_id;
  const plan = ["pro", "team", "enterprise"].includes(custom.plan) ? custom.plan : "pro";
  if (!companyId) return NextResponse.json({ received: true, note: "no company_id" });

  const db = supabaseAdmin();
  const setPlan = (p, subId, custId) =>
    db.from("companies").update({
      plan: p,
      paddle_subscription_id: subId || null,
      paddle_customer_id: custId || null,
    }).eq("id", companyId);

  switch (type) {
    case "subscription.created":
    case "subscription.activated":
    case "subscription.updated": {
      const active = data.status === "active" || data.status === "trialing";
      await setPlan(active ? plan : "free", data.id, data.customer_id);
      break;
    }
    case "subscription.canceled":
    case "subscription.paused": {
      await setPlan("free", null, data.customer_id);
      break;
    }
    default:
      break;
  }
  return NextResponse.json({ received: true });
}
