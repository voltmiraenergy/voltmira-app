// app/api/automation/nudges/send/route.js — Make.com calls this once per
// eligible proposal (after its own AI step phrases a short toneLine from the
// real numbers /pending returned). Everything else, re-deriving the numbers,
// the atomic claim and the email, lives in lib/nudgeRun.js, which the daily
// cron (app/api/cron/nudges) uses too. See docs/MAKE_AUTOMATIONS.md.
import { NextResponse } from "next/server";
import { supabaseAdmin } from "../../../../../lib/supabase.js";
import { verifyAutomationBearer } from "../../../../../lib/automationAuth.js";
import { NUDGE_TIERS_DAYS } from "../../../../../lib/nudgeTiers.js";
import { sendNudge } from "../../../../../lib/nudgeRun.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function POST(req) {
  if (!verifyAutomationBearer(req))
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  let body;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "bad_request" }, { status: 400 }); }
  const code = String(body?.code || "");
  const tier = Number(body?.tier);
  if (!code || !Number.isInteger(tier) || tier < 0 || tier >= NUDGE_TIERS_DAYS.length)
    return NextResponse.json({ error: "bad_request" }, { status: 400 });

  const out = await sendNudge(supabaseAdmin(), { code, tier, toneLine: body?.toneLine });
  if (out.error === "not_found") return NextResponse.json(out, { status: 404 });
  if (out.error) return NextResponse.json(out, { status: 500 });
  return NextResponse.json(out);
}
