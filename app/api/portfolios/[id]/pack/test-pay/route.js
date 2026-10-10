// app/api/portfolios/[id]/pack/test-pay/route.js — a card payment, simulated,
// for trying the pack gate on a local machine without a Paddle account:
// POST { plant } unlocks the pack the way the Paddle webhook does after a
// real payment (a pack_unlocks row for 90 days, any invoice request closed).
// Only with PACK_TEST_PAY=on and never in a production build
// (lib/packPricing.js localSwitch): anywhere else it answers 404, as if it
// did not exist. The row is marked as a local test, so it is never mistaken
// for money received.
import { NextResponse } from "next/server";
import { loadPortfolio } from "../../../../../../lib/portfolioLoad.js";
import { findPlant } from "../../../../../../lib/bankPack.js";
import { loadPackAccess } from "../../../../../../lib/packAccess.js";
import { localSwitch, unlockExpiry, paywallOn } from "../../../../../../lib/packPricing.js";
import { currentUser } from "../../../../../../lib/session.js";
import { supabaseAdmin } from "../../../../../../lib/supabase.js";

export const dynamic = "force-dynamic";

export async function POST(req, props) {
  if (!localSwitch("PACK_TEST_PAY") || !paywallOn()) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const { id } = await props.params;
  let body = {};
  try { body = await req.json(); } catch { /* an empty body */ }
  const d = await loadPortfolio(id);
  if (d.state !== "ok") return NextResponse.json({ error: "not_found" }, { status: 404 });
  const plant = body.plant ? findPlant(d.portfolio, String(body.plant)) : null;
  if (body.plant && !plant) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const user = await currentUser();
  const access = await loadPackAccess({ companyId: d.portfolio.company_id, portfolioId: id, plant, email: user?.email });
  if (access.open) return NextResponse.json({ ok: true, open: true });
  const db = supabaseAdmin();
  const plantId = plant ? String(plant.id) : null;
  const { error } = await db.from("pack_unlocks").insert({
    company_id: d.portfolio.company_id, portfolio_id: id, plant_id: plantId, tier: access.tier,
    amount_eur: access.priceEur, source: "admin", note: "local test payment, no money received",
    unlocked_by: String(user?.email || "local test").slice(0, 200), expires_at: unlockExpiry(Date.now()),
  });
  if (error) return NextResponse.json({ error: "needs_db" }, { status: 503 });
  let q = db.from("pack_requests").update({ status: "unlocked", closed_at: new Date().toISOString() })
    .eq("company_id", d.portfolio.company_id).eq("portfolio_id", id).eq("status", "open");
  q = plantId ? q.eq("plant_id", plantId) : q.is("plant_id", null);
  await q;
  return NextResponse.json({ ok: true, open: true });
}
