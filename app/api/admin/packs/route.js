// app/api/admin/packs/route.js — the bank packs waiting to be paid by bank
// transfer, and unlocking one. Platform admins only (PLATFORM_ADMIN_EMAILS).
//   GET                                -> { requests: the open invoice requests }
//   POST { requestId }                 -> the transfer arrived: unlock the pack
//   POST { requestId, cancel: true }   -> close the request without unlocking
import { NextResponse } from "next/server";
import { currentUser } from "../../../../lib/session.js";
import { isPlatformAdmin } from "../../../../lib/platformAdmin.js";
import { supabaseAdmin } from "../../../../lib/supabase.js";
import { unlockExpiry } from "../../../../lib/packPricing.js";
import { openPackRequests } from "../../../../lib/packAdmin.js";

export const dynamic = "force-dynamic";

async function admin() {
  const user = await currentUser();
  return isPlatformAdmin(user?.email) ? user : null;
}

export async function GET() {
  if (!(await admin())) return NextResponse.json({ error: "not_found" }, { status: 404 });
  return NextResponse.json({ requests: await openPackRequests() }, { headers: { "cache-control": "no-store" } });
}

export async function POST(req) {
  const user = await admin();
  if (!user) return NextResponse.json({ error: "not_found" }, { status: 404 });
  let body = {};
  try { body = await req.json(); } catch { /* an empty body */ }
  const db = supabaseAdmin();
  const { data: r } = await db.from("pack_requests").select("*").eq("id", String(body.requestId || "")).eq("status", "open").maybeSingle();
  if (!r) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const now = new Date().toISOString();
  if (body.cancel) {
    await db.from("pack_requests").update({ status: "cancelled", closed_at: now }).eq("id", r.id);
    return NextResponse.json({ ok: true, cancelled: true });
  }
  const { error } = await db.from("pack_unlocks").insert({
    company_id: r.company_id, portfolio_id: r.portfolio_id, plant_id: r.plant_id, tier: r.tier,
    amount_eur: r.amount_eur, source: "invoice", note: `request ${r.id}`, unlocked_by: user.email, expires_at: unlockExpiry(Date.now()),
  });
  if (error) return NextResponse.json({ error: "unlock_failed" }, { status: 500 });
  await db.from("pack_requests").update({ status: "unlocked", closed_at: now }).eq("id", r.id);
  return NextResponse.json({ ok: true, unlocked: true });
}
