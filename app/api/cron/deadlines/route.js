// app/api/cron/deadlines/route.js — Mondays, the weekly permits and deadlines
// email (lib/deadlineRun.js). Runs on a Vercel cron (vercel.json), same guard
// as the other crons.
import { NextResponse } from "next/server";
import { supabaseAdmin } from "../../../../lib/supabase.js";
import { sendDeadlineDigests } from "../../../../lib/deadlineRun.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(req) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  return NextResponse.json({ ok: true, ...(await sendDeadlineDigests(supabaseAdmin())) });
}
