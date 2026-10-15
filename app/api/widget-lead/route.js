// app/api/widget-lead/route.js — PUBLIC endpoint behind the embeddable widget.
// POST { companyId, name, address?, bill?, email?, phone?, message?,
//        estKw?, estCostLocal?, estPaybackYears? }
// The est* fields are what the widget's calculator step (app/api/estimate)
// showed the homeowner, if they ran it — folded into `note` so the installer
// sees what was quoted, not just that someone asked. All optional: a
// submission that skipped the calculator behaves exactly as before.
// Heavily rate-limited + honeypot field; leads land in the installer's dashboard
// through lib/leadCapture.js (shared with the lead assistant's chat channels).
import { NextResponse } from "next/server";
import { supabaseAdmin } from "../../../lib/supabase.js";
import { isRateLimited, clientIp } from "../../../lib/ratelimit.js";
import { captureLead } from "../../../lib/leadCapture.js";

export async function POST(req) {
  const ip = clientIp(req);
  if (await isRateLimited(`widget:${ip}`, 5, 60_000))
    return NextResponse.json({ error: "rate" }, { status: 429 });

  let b; try { b = await req.json(); } catch { return NextResponse.json({ error: "bad_json" }, { status: 400 }); }
  if (b.website) return NextResponse.json({ ok: true }); // honeypot: silently drop bots
  const name = String(b.name || "").trim().slice(0, 120);
  const companyId = String(b.companyId || "");
  if (!name || !companyId) return NextResponse.json({ error: "missing" }, { status: 400 });

  const db = supabaseAdmin();
  const { data: co } = await db.from("companies").select("id").eq("id", companyId).single();
  if (!co) return NextResponse.json({ error: "unknown_company" }, { status: 404 });

  const saved = await captureLead(db, {
    companyId, name, phone: b.phone, email: b.email, address: b.address, bill: b.bill, message: b.message,
    estimate: { kw: b.estKw, costLocal: b.estCostLocal, paybackYears: b.estPaybackYears },
  });
  if (!saved.ok) return NextResponse.json({ error: "save_failed" }, { status: 500 });
  return NextResponse.json({ ok: true });
}
