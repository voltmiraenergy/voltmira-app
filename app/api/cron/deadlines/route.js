// app/api/cron/deadlines/route.js — Mondays, the weekly permits and deadlines
// email (lib/deadlineRun.js) and the "no reading for 30 days" email
// (lib/readingAlerts.js). Runs on a Vercel cron (vercel.json), same guard as
// the other crons.
import { NextResponse } from "next/server";
import { supabaseAdmin } from "../../../../lib/supabase.js";
import { sendDeadlineDigests } from "../../../../lib/deadlineRun.js";
import { sendReadingAlerts } from "../../../../lib/readingAlerts.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(req) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const db = supabaseAdmin();
  const deadlines = await sendDeadlineDigests(db, { budgetMs: 30_000 });
  const readings = await sendReadingAlerts(db, { budgetMs: 20_000 });
  return NextResponse.json({ ok: true, ...deadlines, readings });
}
