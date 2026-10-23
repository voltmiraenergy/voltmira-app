// app/api/paddle/webhook/route.js — keeps companies.plan in sync with Paddle Billing.
// Setup: Paddle dashboard → Notifications → New destination → this URL
//   (https://voltmira.com/api/paddle/webhook), subscribe to:
//   subscription.created, subscription.activated, subscription.updated,
//   subscription.canceled, subscription.paused, and transaction.completed (a
//   bank pack paid by card: lib/packPricing.js unlockFromTransaction; or a
//   pack of credits: lib/credits.js creditsFromTransaction).
// Copy the destination's signing secret into PADDLE_WEBHOOK_SECRET (Vercel env).
//
// company_id + plan arrive in custom_data (set at checkout in lib/paddle.js), so
// the webhook knows which company to upgrade without any lookup.
import { NextResponse } from "next/server";
import crypto from "node:crypto";
import { supabaseAdmin } from "../../../../lib/supabase.js";
import { unlockFromTransaction } from "../../../../lib/packPricing.js";
import { PLANTS_KEY } from "../../../../lib/portfolioModel.js";
import { creditsFromTransaction } from "../../../../lib/credits.js";

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
  // a captured, correctly signed notification cannot be played back later: the signed time must be recent
  const age = Math.abs(Date.now() / 1000 - Number(parts.ts));
  if (!Number.isFinite(age) || age > 300) return false;
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
  // The plan comes from the PRICE that was subscribed to (monthly or yearly), so
  // a checkout cannot name a dearer plan than the one it paid for; custom_data
  // is only the fallback for a price id this server does not know.
  const priceIds = (data.items || []).map((it) => it?.price?.id || it?.price_id).filter(Boolean);
  const E = process.env;
  const byPrice = priceIds.some((id) => id && (id === E.NEXT_PUBLIC_PADDLE_PRICE_TEAM || id === E.NEXT_PUBLIC_PADDLE_PRICE_TEAM_YEARLY)) ? "team"
    : priceIds.some((id) => id && (id === E.NEXT_PUBLIC_PADDLE_PRICE_PRO || id === E.NEXT_PUBLIC_PADDLE_PRICE_PRO_YEARLY)) ? "pro"
    : priceIds.some((id) => id && id === E.NEXT_PUBLIC_PADDLE_PRICE_ENTERPRISE) ? "enterprise" : null;
  // custom_data is typed by whoever opens the checkout, so it never names the dearest plan
  const plan = byPrice || (["pro", "team"].includes(custom.plan) ? custom.plan : "pro");
  if (!companyId) return NextResponse.json({ received: true, note: "no company_id" });

  const db = supabaseAdmin();

  // a bank pack paid by card: unlock the plant it paid for, once (the
  // transaction id is unique, so a retried notification adds nothing)
  if (type === "transaction.completed" && custom.kind === "pack") {
    const { data: portfolio } = await db.from("portfolios").select("id, company_id, assets").eq("id", custom.portfolio_id || "").maybeSingle();
    // the company's earlier packs for this portfolio: the renewal price only counts for a plant that had one
    let unlocks = null;
    if (portfolio) {
      const { data: had, error: uErr } = await db.from("pack_unlocks").select("portfolio_id, plant_id, expires_at").eq("company_id", portfolio.company_id).eq("portfolio_id", portfolio.id);
      if (uErr) { console.error("[paddle] pack unlocks lookup failed:", uErr.message); return NextResponse.json({ error: "unlock_failed" }, { status: 500 }); }
      unlocks = had || [];
    }
    const { row, error } = unlockFromTransaction({ data, portfolio, plantsKey: PLANTS_KEY, unlocks });
    if (error) {
      console.error("[paddle] pack not unlocked:", error, data.id);
      return NextResponse.json({ received: true, note: error });
    }
    const { error: dbErr } = await db.from("pack_unlocks").upsert(row, { onConflict: "paddle_txn_id", ignoreDuplicates: true });
    if (dbErr) {
      console.error("[paddle] pack unlock failed:", dbErr.message);
      return NextResponse.json({ error: "unlock_failed" }, { status: 500 });
    }
    // an invoice requested for the same pack is no longer waiting
    let q = db.from("pack_requests").update({ status: "unlocked", closed_at: new Date().toISOString() })
      .eq("company_id", row.company_id).eq("portfolio_id", row.portfolio_id).eq("status", "open");
    q = row.plant_id ? q.eq("plant_id", row.plant_id) : q.is("plant_id", null);
    await q;
    return NextResponse.json({ received: true, unlocked: true });
  }

  // credits paid by card: add the pack the price paid for, once (the
  // transaction id is unique, so a retried notification adds nothing)
  if (type === "transaction.completed" && custom.kind === "credits") {
    const { row, error } = creditsFromTransaction({ data });
    if (error) {
      console.error("[paddle] credits not added:", error, data.id);
      return NextResponse.json({ received: true, note: error });
    }
    const { error: dbErr } = await db.from("credit_ledger").upsert(row, { onConflict: "paddle_txn_id", ignoreDuplicates: true });
    if (dbErr) {
      console.error("[paddle] credits failed:", dbErr.message);
      return NextResponse.json({ error: "credits_failed" }, { status: 500 });
    }
    return NextResponse.json({ received: true, credited: row.delta });
  }

  // custom_data.company_id is set in the browser at checkout, so it cannot be believed about a company
  // that already has a subscription: anyone could buy a plan naming someone else's workspace and then
  // cancel it to downgrade theirs. Changes to a subscription are matched by the subscription's own id;
  // a new subscription may only attach to a workspace that has none.
  const setPlan = (id, p, subId, custId) =>
    db.from("companies").update({
      plan: p,
      paddle_subscription_id: subId || null,
      paddle_customer_id: custId || null,
    }).eq("id", id);

  switch (type) {
    case "subscription.created":
    case "subscription.activated": {
      const { data: co } = await db.from("companies").select("id, paddle_subscription_id").eq("id", companyId).maybeSingle();
      if (!co) return NextResponse.json({ received: true, note: "unknown_company" });
      if (co.paddle_subscription_id && co.paddle_subscription_id !== data.id) {
        console.error("[paddle] a second subscription named a company that has one:", data.id);
        return NextResponse.json({ received: true, note: "company_has_subscription" });
      }
      const active = data.status === "active" || data.status === "trialing";
      await setPlan(co.id, active ? plan : "free", data.id, data.customer_id);
      break;
    }
    case "subscription.updated":
    case "subscription.canceled":
    case "subscription.paused": {
      const { data: co } = await db.from("companies").select("id").eq("paddle_subscription_id", String(data.id || "")).maybeSingle();
      if (!co) return NextResponse.json({ received: true, note: "unknown_subscription" });
      if (type === "subscription.updated") {
        const active = data.status === "active" || data.status === "trialing";
        await setPlan(co.id, active ? plan : "free", data.id, data.customer_id);
      } else {
        await setPlan(co.id, "free", null, data.customer_id);
      }
      break;
    }
    default:
      break;
  }
  return NextResponse.json({ received: true });
}
