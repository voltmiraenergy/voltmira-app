// app/api/automation/nudges/send/route.js — Make.com calls this once per
// eligible proposal (after its own AI step phrases a short toneLine from the
// real numbers /pending returned). This route re-derives every number
// itself — it never trusts anything numeric that came back from Make — and
// claims the send atomically before emailing, so a lost HTTP response and a
// Make.com retry can never double-email a real client. See
// docs/MAKE_AUTOMATIONS.md for the full scenario and
// app/api/proposal/[code]/route.js's notifyProposalOpened for the exact
// claim-via-conditional-update pattern this mirrors.
import { NextResponse } from "next/server";
import { supabaseAdmin } from "../../../../../lib/supabase.js";
import { verifyAutomationBearer } from "../../../../../lib/automationAuth.js";
import { NUDGE_TIERS_DAYS, nextNudgeTier } from "../../../../../lib/nudgeTiers.js";
import { quote } from "@voltmira/engine";
import { snapshotEngine, companyEngine } from "../../../../../lib/engineSettings.js";
import { sendEmail, proposalNudgeEmail, emailConfigured } from "../../../../../lib/email.js";
import { logActivity } from "../../../../../lib/activity.js";
import { stripTags } from "../../../../../lib/safe.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

const MAX_TONE_LEN = 200;

/** toneLine is the one freeform field a third party (Make's AI step)
 *  controls. Reject anything that looks like it's trying to be more than a
 *  plain sentence — a real tone line has no reason to contain a URL or a
 *  tag, and this fires BEFORE the string is trusted at all, not just before
 *  it's rendered. Returns "" (never sent) rather than a half-cleaned string
 *  when it looks suspicious — the email still sends with just the numbers. */
function sanitizeToneLine(raw) {
  const s = String(raw || "").replace(/[\r\n\t\x00-\x1F]/g, " ").trim().slice(0, MAX_TONE_LEN);
  if (!s) return "";
  if (/https?:\/\/|<[a-z][\s\S]*>/i.test(s)) return "";
  return stripTags(s);
}

export async function POST(req) {
  if (!verifyAutomationBearer(req))
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  let body;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "bad_request" }, { status: 400 }); }
  const code = String(body?.code || "");
  const tier = Number(body?.tier);
  if (!code || !Number.isInteger(tier) || tier < 0 || tier >= NUDGE_TIERS_DAYS.length)
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  const toneLine = sanitizeToneLine(body?.toneLine);

  const db = supabaseAdmin();
  const { data: prop } = await db.from("proposals")
    .select("code, project_id, company_id, snapshot, accepted_at, created_at, nudge_count")
    .eq("code", code).single();
  if (!prop) return NextResponse.json({ error: "not_found" }, { status: 404 });
  if (prop.accepted_at) return NextResponse.json({ ok: true, skipped: true, reason: "accepted" });

  // Re-derive eligibility server-side — never trust that Make.com's `tier`
  // still matches reality (another tier could already have been claimed
  // between /pending and this call).
  if (nextNudgeTier(prop) !== tier)
    return NextResponse.json({ ok: true, skipped: true, reason: "tier_mismatch" });

  const { data: co } = await db.from("companies")
    .select("id, name, lang, engine, nudge_enabled").eq("id", prop.company_id).single();
  if (!co?.nudge_enabled) return NextResponse.json({ ok: true, skipped: true, reason: "not_enabled" });

  let proj = null;
  let clientEmail = null;
  if (prop.project_id) {
    ({ data: proj } = await db.from("projects").select("title, client_name").eq("id", prop.project_id).maybeSingle());
  }
  // This app never collected a client email address separately from the
  // proposal flow (the client only ever gets a link, via WhatsApp/manual
  // send) — reuse the same field the "share proposal" email already sends
  // to, if the installer recorded one when generating the link.
  clientEmail = prop.snapshot?.clientEmail || null;
  if (!clientEmail || !emailConfigured())
    return NextResponse.json({ ok: true, skipped: true, reason: "no_email_or_not_configured" });

  let preparedBy = prop.snapshot?.preparedBy || null;
  if (!preparedBy && prop.project_id) {
    const { data: pf } = await db.from("profiles").select("name, phone")
      .eq("company_id", prop.company_id).eq("role", "owner").limit(1).maybeSingle();
    if (pf?.name) preparedBy = { name: pf.name, phone: pf.phone || "" };
  }

  let then, now;
  try {
    const eThen = snapshotEngine(prop.snapshot?.engine, co);
    then = quote(prop.snapshot, eThen).e;
    const eNow = await companyEngine(co);
    now = quote(prop.snapshot, eNow).e;
  } catch (err) {
    console.error("nudges/send quote failed for", code, err?.message);
    return NextResponse.json({ error: "quote_failed" }, { status: 500 });
  }

  // Atomic claim: only proceed if THIS call moves nudge_count from exactly
  // `tier` to `tier+1`. A Make.com retry after a lost response affects 0
  // rows here and becomes a harmless no-op instead of a second email.
  const { data: claimed } = await db.from("proposals")
    .update({ nudge_count: tier + 1, last_nudge_at: new Date().toISOString() })
    .eq("code", code).eq("nudge_count", tier)
    .select("code").maybeSingle();
  if (!claimed) return NextResponse.json({ ok: true, skipped: true, reason: "already_claimed" });

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://app.voltmira.com";
  const { subject, html } = proposalNudgeEmail({
    clientName: proj?.client_name || prop.snapshot?.client || "",
    companyName: co.name || "",
    liveUrl: `${appUrl}/p/${code}`,
    lang: co.lang || "ro",
    toneLine,
    then: { paybackYears: then.payback, monthlySavings: Math.round(then.year1 / 12) },
    now: { paybackYears: now.payback, monthlySavings: Math.round(now.year1 / 12) },
    preparedBy,
  });
  const result = await sendEmail({ to: clientEmail, subject, html });

  await logActivity(db, {
    companyId: prop.company_id, kind: "proposal", key: "act_followup_sent",
    params: { b: proj?.client_name || prop.snapshot?.client || "", n: NUDGE_TIERS_DAYS[tier] },
    text: `Follow-up sent for <b>${proj?.client_name || prop.snapshot?.client || ""}</b> (day ${NUDGE_TIERS_DAYS[tier]})`,
    link: prop.project_id ? `/projects/${prop.project_id}` : "",
  });

  return NextResponse.json({ ok: true, sent: !!result.sent });
}
