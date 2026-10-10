// app/api/automation/nudges/pending/route.js — Make.com's Scheduler calls
// this once a day to get the list of proposals due a follow-up nudge today.
// Every number returned here is already real and computed server-side
// (frozen-then via snapshotEngine, live-now via companyEngine) — Make.com's
// AI step downstream is only ever asked to PHRASE these, never to invent or
// compute one. See docs/MAKE_AUTOMATIONS.md for the full scenario.
import { NextResponse } from "next/server";
import { supabaseAdmin } from "../../../../../lib/supabase.js";
import { verifyAutomationBearer } from "../../../../../lib/automationAuth.js";
import { nextNudgeTier } from "../../../../../lib/nudgeTiers.js";
import { quote } from "@voltmira/engine";
import { snapshotEngine, companyEngine } from "../../../../../lib/engineSettings.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(req) {
  if (!verifyAutomationBearer(req))
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const db = supabaseAdmin();
  // Only companies that explicitly opted in (Settings → Follow-up nudges) —
  // see add-proposal-nudges.sql's own comment for why this defaults off.
  // Deliberately not checking `error` here: before that migration has run,
  // this query itself errors (unknown column) and `companies` comes back
  // null — which the `!companies?.length` check below already treats the
  // same as "nobody's opted in yet," so the endpoint degrades to an empty
  // list instead of a 500 either way. Confirmed via direct testing, not
  // an accident to "fix" later.
  const { data: companies } = await db.from("companies")
    .select("id, name, lang, engine").eq("nudge_enabled", true);
  if (!companies?.length) return NextResponse.json({ ok: true, proposals: [] });
  const companyById = new Map(companies.map((c) => [c.id, c]));

  const { data: proposals } = await db.from("proposals")
    .select("code, project_id, company_id, snapshot, accepted_at, created_at, nudge_count, opens, seconds")
    .in("company_id", companies.map((c) => c.id))
    .is("accepted_at", null);
  if (!proposals?.length) return NextResponse.json({ ok: true, proposals: [] });

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://app.voltmira.com";
  const out = [];
  for (const prop of proposals) {
    const tier = nextNudgeTier(prop);
    if (tier == null) continue;
    const co = companyById.get(prop.company_id);
    if (!co) continue;

    let proj = null;
    if (prop.project_id) {
      ({ data: proj } = await db.from("projects").select("title, client_name").eq("id", prop.project_id).maybeSingle());
    }

    try {
      const eThen = snapshotEngine(prop.snapshot?.engine, co);
      const qThen = quote(prop.snapshot, eThen);
      const eNow = await companyEngine(co);
      const qNow = quote(prop.snapshot, eNow);

      out.push({
        code: prop.code,
        tier,
        url: `${appUrl}/p/${prop.code}`,
        lang: co.lang || "ro",
        clientName: proj?.client_name || prop.snapshot?.client || "",
        companyName: co.name || "",
        engagement: { opens: prop.opens || 0, seconds: prop.seconds || 0 },
        then: { paybackYears: qThen.e.payback, monthlySavings: Math.round(qThen.e.year1 / 12) },
        now: { paybackYears: qNow.e.payback, monthlySavings: Math.round(qNow.e.year1 / 12) },
      });
    } catch (err) {
      // One bad/legacy snapshot must never take the whole batch down.
      console.error("nudges/pending quote failed for", prop.code, err?.message);
    }
  }

  return NextResponse.json({ ok: true, proposals: out });
}
