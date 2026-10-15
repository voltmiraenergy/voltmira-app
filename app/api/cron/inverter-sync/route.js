// app/api/cron/inverter-sync/route.js — nightly pull of monthly production from
// every connected inverter portal (lib/inverterSync.js). Runs on a Vercel cron
// (vercel.json); oldest-synced accounts go first, so a run that hits the time
// budget picks up where it stopped the next night.
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { keyFromEnv } from "../../../../lib/secretBox.js";
import { syncAll } from "../../../../lib/inverterSync.js";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(req) {
  const secret = process.env.CRON_SECRET;
  // Same guard as reap-demo: no secret configured means no unauthenticated runs.
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return NextResponse.json({ error: "not_configured" }, { status: 503 });
  if (!keyFromEnv()) return NextResponse.json({ error: "no_secret_key" }, { status: 503 });

  const admin = createClient(url, key, { auth: { persistSession: false } });
  const out = await syncAll(admin, { key: keyFromEnv(), budgetMs: 50_000 });
  return NextResponse.json(out, { status: out.error ? 503 : 200 });
}
