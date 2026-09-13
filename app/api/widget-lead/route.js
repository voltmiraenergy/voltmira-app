// app/api/widget-lead/route.js — PUBLIC endpoint behind the embeddable widget.
// POST { companyId, name, address?, bill?, email?, phone?, message?,
//        estKw?, estCostLocal?, estPaybackYears? }
// The est* fields are what the widget's calculator step (app/api/estimate)
// showed the homeowner, if they ran it — folded into `note` so the installer
// sees what was quoted, not just that someone asked. All optional: a
// submission that skipped the calculator behaves exactly as before.
// Heavily rate-limited + honeypot field; leads land in the installer's dashboard.
import { NextResponse } from "next/server";
import { supabaseAdmin } from "../../../lib/supabase.js";
import { escapeHtml } from "../../../lib/safe.js";
import { logActivity } from "../../../lib/activity.js";
import { isRateLimited, clientIp } from "../../../lib/ratelimit.js";

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

  const phone = String(b.phone || "").trim().slice(0, 40);
  const bill = String(b.bill || "").trim().slice(0, 20);
  const address = String(b.address || "").trim().slice(0, 200);
  // A structured number for "Generate a full offer" (createProjectFromLead) to
  // size a system from \u2014 `bill` above stays the display string in `note`.
  const billNum = Number(bill);
  const monthlyBill = Number.isFinite(billNum) && billNum > 0 ? billNum : null;

  // What the calculator step showed this homeowner, if they ran it \u2014 so the
  // installer isn't guessing what was promised before they even open the lead.
  const estKw = Number(b.estKw);
  const estCostLocal = Number(b.estCostLocal);
  const estPaybackYears = Number(b.estPaybackYears);
  const estimateLine = Number.isFinite(estKw) && estKw > 0
    ? `Estimate shown: ${estKw} kW` +
      (Number.isFinite(estCostLocal) && estCostLocal > 0 ? `, ${Math.round(estCostLocal).toLocaleString("en")}` : "") +
      (Number.isFinite(estPaybackYears) && estPaybackYears > 0 ? `, ~${estPaybackYears}y payback` : "")
    : null;

  const note = [
    phone && `Phone: ${phone}`,
    bill && `~${bill}/mo bill`,
    estimateLine,
    String(b.message || "").trim().slice(0, 500) || "Requested an estimate",
    address,
  ].filter(Boolean).join(" \u00B7 ");

  // `hot` used to be hardcoded true, so every website lead arrived flagged and
  // the flag told the installer nothing. Base it on an actual qualifying signal:
  // a phone number (reachable now) or a stated bill (sized and motivated).
  const hot = !!(phone || bill);

  // CHECK THIS WRITE. It used to be fire-and-forget, so a failed insert still
  // returned {ok:true}: the visitor saw "Thank you!" and the installer never
  // learned that someone had tried to reach them. Losing a lead silently is the
  // worst thing this endpoint can do.
  const base = {
    company_id: companyId, name, note, hot, source: "widget",
    email: String(b.email || "").trim().slice(0, 120), phone,
  };
  // address/monthly_bill need add-lead-details.sql; degrade to the base insert
  // (note still carries both as text) if a workspace hasn't run it yet.
  let { error: insErr } = await db.from("leads")
    .insert({ ...base, address: address || null, monthly_bill: monthlyBill });
  if (insErr && /address|monthly_bill/i.test(insErr.message || "")) {
    ({ error: insErr } = await db.from("leads").insert(base));
  }
  if (insErr) {
    console.error("[widget-lead] insert failed:", insErr.message);
    return NextResponse.json({ error: "save_failed" }, { status: 500 });
  }
  await logActivity(db, {
    companyId, kind: "lead", key: "act_lead_widget", params: { b: name },
    text: `New lead from the website widget: <b>${escapeHtml(name)}</b>`,
    link: "/leads",
  });
  return NextResponse.json({ ok: true });
}
