// app/api/marketplace/respond/route.js — an installer accepts or declines a
// request offered to them (docs/MARKETPLACE.md). POST { offerId, accept, reason }
import { NextResponse } from "next/server";
import { supabaseAdmin } from "../../../../lib/supabase.js";
import { isRateLimited, clientIp } from "../../../../lib/ratelimit.js";
import { installerGuard } from "../../../../lib/marketGuard.js";
import { respondOffer, sweepOffers } from "../../../../lib/marketFlow.js";
import { marketIo } from "../../../../lib/marketServer.js";

export async function POST(req) {
  if (await isRateLimited(`mp-respond:${clientIp(req)}`, 40, 60_000)) return NextResponse.json({ error: "rate" }, { status: 429 });
  const g = await installerGuard();
  if (g instanceof Response) return g;
  let b;
  try { b = await req.json(); } catch { return NextResponse.json({ error: "bad_json" }, { status: 400 }); }
  const db = supabaseAdmin();
  const io = marketIo(db);
  await sweepOffers(db, { io }).catch(() => null);
  const r = await respondOffer(db, { companyId: g.co.id, offerId: String(b.offerId || ""), accept: b.accept === true, reason: b.reason, actor: { id: g.user.id, email: g.user.email }, io });
  const status = r.ok ? 200 : r.error === "not_found" ? 404 : r.error === "needs_db" ? 503 : 409;
  return NextResponse.json(r.ok ? { ok: true, leadId: r.offer?.lead_id || null } : r, { status });
}
