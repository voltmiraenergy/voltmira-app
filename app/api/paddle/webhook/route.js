// app/api/paddle/webhook/route.js — a developer's bank pack paid by card (lib/packPricing.js unlockFromTransaction).
// Setup: Paddle dashboard → Notifications → New destination → this URL (https://voltmira.com/api/paddle/webhook),
// subscribed to transaction.completed. Copy the destination's signing secret into PADDLE_WEBHOOK_SECRET.
//
// Since 2026-10-24 installers have no plans and no credits (their one charge is a fee per won project, paid through
// the bank's gateway: lib/jobFees.js), so subscription and credit notifications are acknowledged and ignored.
import { NextResponse } from "next/server";
import crypto from "node:crypto";
import { supabaseAdmin } from "../../../../lib/supabase.js";
import { unlockFromTransaction } from "../../../../lib/packPricing.js";
import { PLANTS_KEY } from "../../../../lib/portfolioModel.js";

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

  // no plans and no credits any more: nothing else to act on
  return NextResponse.json({ received: true, note: "ignored" });
}
