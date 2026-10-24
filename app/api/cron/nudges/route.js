// app/api/cron/nudges/route.js — once a day, the follow-up emails for every
// proposal the client has not accepted yet (day 3, 7 and 14), for each company
// that turned follow-ups on in Settings. No Make.com scenario needed; the
// Make.com endpoints still work for installers who built one. Runs on a Vercel
// cron (vercel.json), same guard as the other crons.
import { NextResponse } from "next/server";
import { supabaseAdmin } from "../../../../lib/supabase.js";
import { dueNudges, sendNudge } from "../../../../lib/nudgeRun.js";
import { sendOpenDigests } from "../../../../lib/openDigest.js";
import { sendFeeReminders } from "../../../../lib/feeReminders.js";
import { monthlyStatements, sellerDetails, feeVatRate } from "../../../../lib/jobFeePay.js";
import { feePaywallOn } from "../../../../lib/jobFees.js";
import { sendEmail, emailConfigured, ownerAlertEmail } from "../../../../lib/email.js";
import { logActivity } from "../../../../lib/activity.js";

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
  // reading time per section and the options looked at are kept 12 months (the notice on the offer says what is
  // recorded; docs/features/phase1.md the retention), then removed
  const { error: purgeErr } = await db.from("proposal_events").delete().in("kind", ["section", "option"])
    .lt("created_at", new Date(started - 365 * 86_400_000).toISOString());
  if (purgeErr && !/kind|check|constraint/i.test(purgeErr.message || "")) console.error("[cron nudges] reading purge failed:", purgeErr.message);
  // the morning "offers opened" email, for companies that chose it or keep quiet hours
  const digests = await sendOpenDigests(db, { budgetMs: 15_000 });
  // VoltMira's fee for signed jobs: last month's statements (lib/jobFeePay.js), first issued on the 1st and asked for
  // again each day, so a missed run still issues them (one per workspace and month), then their reminders
  // (lib/feeReminders.js). Nothing while JOB_FEES is off.
  const statements = feePaywallOn() ? await monthlyStatements(db, { seller: sellerDetails(), vatRate: feeVatRate() }) : null;
  const fees = await sendFeeReminders(db, { io: { sendEmail, emailConfigured, ownerAlertEmail, logActivity }, budgetMs: 10_000 });
  const due = await dueNudges(db);
  const tally = { due: due.length, sent: 0, skipped: 0, failed: 0 };
  for (const n of due) {
    if (Date.now() - started > 50_000) break; // the rest go out tomorrow
    const r = await sendNudge(db, n);
    if (r.sent) tally.sent++;
    else if (r.skipped) tally.skipped++;
    else tally.failed++;
  }
  return NextResponse.json({ ok: true, ...tally, digests, fees, statements });
}
