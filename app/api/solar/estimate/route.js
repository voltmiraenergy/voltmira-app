// app/api/solar/estimate/route.js — the funnel's instant estimate
// (lib/solarFunnel.js): a Moldovan address and a bill or a yearly
// consumption in; the system, production, price, saving and payback out,
// priced with today's tariff rule. Public; rate-limited; stores nothing.
// POST { address, monthlyBill?, consKwhYear? }
import { NextResponse } from "next/server";
import { supabaseAdmin } from "../../../../lib/supabase.js";
import { isRateLimited, clientIp } from "../../../../lib/ratelimit.js";
import { funnelEstimate } from "../../../../lib/solarFunnel.js";
import { EstimateError } from "../../../../lib/estimateCore.js";

export const maxDuration = 30;

export async function POST(req) {
  if (await isRateLimited(`solar-est:${clientIp(req)}`, 12, 60_000)) return NextResponse.json({ error: "rate" }, { status: 429 });
  let b;
  try { b = await req.json(); } catch { return NextResponse.json({ error: "bad_json" }, { status: 400 }); }
  try {
    const est = await funnelEstimate({ address: String(b.address || "").slice(0, 200), monthlyBill: Number(b.monthlyBill) || null, consKwhYear: Number(b.consKwhYear) || null, admin: supabaseAdmin() });
    // outside Moldova there is no district and no installer to route to
    if (!est.raion) return NextResponse.json({ error: "md_only" }, { status: 422 });
    return NextResponse.json({ ok: true, estimate: est });
  } catch (e) {
    if (e instanceof EstimateError) return NextResponse.json({ error: e.code }, { status: e.status || 502 });
    console.error("[solar estimate]", e?.message);
    return NextResponse.json({ error: "upstream" }, { status: 502 });
  }
}
