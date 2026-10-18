// app/api/cron/nudges/route.js — once a day, the follow-up emails for every
// proposal the client has not accepted yet (day 3, 7 and 14), for each company
// that turned follow-ups on in Settings. No Make.com scenario needed; the
// Make.com endpoints still work for installers who built one. Runs on a Vercel
// cron (vercel.json), same guard as the other crons.
import { NextResponse } from "next/server";
import { supabaseAdmin } from "../../../../lib/supabase.js";
import { dueNudges, sendNudge } from "../../../../lib/nudgeRun.js";
import { sendOpenDigests } from "../../../../lib/openDigest.js";
import { sweepOffers } from "../../../../lib/marketFlow.js";
import { marketIo } from "../../../../lib/marketServer.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(req) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const db = supabaseAdmin();
  const started = Date.now();
  // the morning "offers opened" email, for companies that chose it or keep quiet hours
  const digests = await sendOpenDigests(db, { budgetMs: 15_000 });
  // marketplace offers past their answer time pass to the next installer; the
  // pages sweep too, this catches the days nobody opens one (lib/marketFlow.js)
  const market = await sweepOffers(db, { io: marketIo(db) }).catch(() => null);
  const due = await dueNudges(db);
  const tally = { due: due.length, sent: 0, skipped: 0, failed: 0 };
  for (const n of due) {
    if (Date.now() - started > 50_000) break; // the rest go out tomorrow
    const r = await sendNudge(db, n);
    if (r.sent) tally.sent++;
    else if (r.skipped) tally.skipped++;
    else tally.failed++;
  }
  return NextResponse.json({ ok: true, ...tally, digests, market });
}
