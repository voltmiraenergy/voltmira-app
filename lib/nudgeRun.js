// lib/nudgeRun.js — the day-3/7/14 follow-up emails for proposals the client
// has not accepted, shared by the daily cron (app/api/cron/nudges) and the
// Make.com endpoint (app/api/automation/nudges/send). Before the cron, the
// emails only went out for installers who had built their own Make.com
// scenario; now every company that turns follow-ups on in Settings gets them.
//
// Every number is re-derived here from the frozen proposal (then) and the
// company's current settings (now); the send is claimed atomically before
// emailing, so a retry can never email a client twice.
import { NUDGE_TIERS_DAYS, nextNudgeTier } from "./nudgeTiers.js";
import { quote } from "@voltmira/engine";
import { snapshotEngine, companyEngine } from "./engineSettings.js";
import { sendEmail, proposalNudgeEmail, emailConfigured } from "./email.js";
import { effectiveOfferCurrency } from "./offerCurrency.js";
import { logActivity } from "./activity.js";
import { stripTags } from "./safe.js";

const MAX_TONE_LEN = 200;

/** The one free-form field a third party (Make's AI step) may supply. Anything
 *  that looks like more than a plain sentence (a URL, a tag) is dropped, and
 *  the email still goes out with just the numbers. */
export function sanitizeToneLine(raw) {
  const s = String(raw || "").replace(/[\r\n\t\x00-\x1F]/g, " ").trim().slice(0, MAX_TONE_LEN);
  if (!s) return "";
  if (/https?:\/\/|<[a-z][\s\S]*>/i.test(s)) return "";
  return stripTags(s);
}

/** Proposals due a follow-up today, across every company that opted in. */
export async function dueNudges(db) {
  const { data: companies } = await db.from("companies").select("id").eq("nudge_enabled", true);
  if (!companies?.length) return [];
  const { data: proposals } = await db.from("proposals")
    .select("code, company_id, accepted_at, created_at, nudge_count")
    .in("company_id", companies.map((c) => c.id))
    .is("accepted_at", null);
  return (proposals || [])
    .map((p) => ({ code: p.code, tier: nextNudgeTier(p) }))
    .filter((p) => p.tier != null);
}

/**
 * Send one follow-up if it is still due. Never throws for an expected reason;
 * returns { ok, sent } or { ok, skipped, reason } or { error }.
 */
export async function sendNudge(db, { code, tier, toneLine = "" }) {
  const { data: prop } = await db.from("proposals")
    .select("code, project_id, company_id, snapshot, accepted_at, created_at, nudge_count")
    .eq("code", code).single();
  if (!prop) return { error: "not_found" };
  if (prop.accepted_at) return { ok: true, skipped: true, reason: "accepted" };
  // eligibility re-derived here: another tier may have been claimed meanwhile
  if (nextNudgeTier(prop) !== tier) return { ok: true, skipped: true, reason: "tier_mismatch" };

  const { data: co } = await db.from("companies")
    .select("id, name, lang, engine, currency, nudge_enabled").eq("id", prop.company_id).single();
  if (!co?.nudge_enabled) return { ok: true, skipped: true, reason: "not_enabled" };

  let proj = null;
  if (prop.project_id) {
    ({ data: proj } = await db.from("projects").select("title, client_name").eq("id", prop.project_id).maybeSingle());
  }
  // the address the installer entered when sharing the proposal by email
  const clientEmail = prop.snapshot?.clientEmail || null;
  if (!clientEmail || !emailConfigured()) return { ok: true, skipped: true, reason: "no_email_or_not_configured" };

  let preparedBy = prop.snapshot?.preparedBy || null;
  if (!preparedBy && prop.project_id) {
    const { data: pf } = await db.from("profiles").select("name, phone")
      .eq("company_id", prop.company_id).eq("role", "owner").limit(1).maybeSingle();
    if (pf?.name) preparedBy = { name: pf.name, phone: pf.phone || "" };
  }

  let then, now;
  try {
    then = quote(prop.snapshot, snapshotEngine(prop.snapshot?.engine, co)).e;
    now = quote(prop.snapshot, await companyEngine(co)).e;
  } catch (err) {
    console.error("nudge quote failed for", code, err?.message);
    return { error: "quote_failed" };
  }

  // Atomic claim: only THIS call moves nudge_count from `tier` to `tier+1`.
  const { data: claimed } = await db.from("proposals")
    .update({ nudge_count: tier + 1, last_nudge_at: new Date().toISOString() })
    .eq("code", code).eq("nudge_count", tier)
    .select("code").maybeSingle();
  if (!claimed) return { ok: true, skipped: true, reason: "already_claimed" };

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://voltmira.com";
  const { subject, html } = proposalNudgeEmail({
    clientName: proj?.client_name || prop.snapshot?.client || "",
    companyName: co.name || "",
    liveUrl: `${appUrl}/p/${code}`,
    lang: co.lang || "ro",
    toneLine: sanitizeToneLine(toneLine),
    then: { paybackYears: then.payback, monthlySavings: Math.round(then.year1 / 12) },
    now: { paybackYears: now.payback, monthlySavings: Math.round(now.year1 / 12) },
    preparedBy,
    // the currency and rate the client was shown when the offer was sent
    currency: effectiveOfferCurrency(prop.snapshot?.offerCurrency, co.currency, prop.snapshot?.market),
    fx: prop.snapshot?.engine?.fx || null,
  });
  const result = await sendEmail({ to: clientEmail, subject, html });

  await logActivity(db, {
    companyId: prop.company_id, kind: "proposal", key: "act_followup_sent",
    params: { b: proj?.client_name || prop.snapshot?.client || "", n: NUDGE_TIERS_DAYS[tier] },
    text: `Follow-up sent for <b>${proj?.client_name || prop.snapshot?.client || ""}</b> (day ${NUDGE_TIERS_DAYS[tier]})`,
    link: prop.project_id ? `/projects/${prop.project_id}` : "",
  });
  return { ok: true, sent: !!result.sent };
}
