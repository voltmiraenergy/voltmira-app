// lib/nudgeRun.js — the day-3/7/14 follow-up emails for proposals the client
// has not accepted, shared by the daily cron (app/api/cron/nudges) and the
// Make.com endpoint (app/api/automation/nudges/send). Before the cron, the
// emails only went out for installers who had built their own Make.com
// scenario; now every company that turns follow-ups on in Settings gets them.
//
// Every number is re-derived here from the frozen proposal (then) and the
// company's current settings (now); the send is claimed atomically before
// emailing, so a retry can never email a client twice.
import { nextNudgeTier, cleanNudgeDays } from "./nudgeTiers.js";
import { quote } from "@voltmira/engine";
import { snapshotEngine, companyEngine } from "./engineSettings.js";
import { offerQuoteInput } from "./offerInput.js";
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

/** The address a client's reply should reach: the quote's author, else the company's owner. */
export async function installerEmail(db, companyId, ownerId) {
  if (ownerId) {
    const { data: me } = await db.from("profiles").select("email").eq("id", ownerId).eq("company_id", companyId).maybeSingle();
    if (me?.email) return me.email;
  }
  const { data: owner } = await db.from("profiles").select("email").eq("company_id", companyId).eq("role", "owner").not("email", "eq", "").limit(1).maybeSingle();
  return owner?.email || undefined;
}

// A select that may name columns add-quote-fast.sql adds (the workspace's follow-up days, an offer's own switch):
// without them, the same select without those columns, so follow-ups keep their standard days until it runs.
async function selectOr(build, cols, fallback) {
  const r = await build(cols);
  return r.error ? build(fallback) : r;
}

/** Proposals due a follow-up today, across every company that opted in, on each company's own days. */
export async function dueNudges(db) {
  const { data: companies } = await selectOr((c) => db.from("companies").select(c).eq("nudge_enabled", true), "id, nudge_days", "id");
  if (!companies?.length) return [];
  const days = new Map(companies.map((c) => [c.id, c.nudge_days]));
  const { data: proposals } = await selectOr((c) => db.from("proposals").select(c)
    .in("company_id", companies.map((x) => x.id))
    .is("accepted_at", null), "code, company_id, accepted_at, created_at, nudge_count, nudges_off", "code, company_id, accepted_at, created_at, nudge_count");
  return (proposals || [])
    .map((p) => ({ code: p.code, tier: nextNudgeTier(p, days.get(p.company_id)) }))
    .filter((p) => p.tier != null);
}

/**
 * Send one follow-up if it is still due. Never throws for an expected reason;
 * returns { ok, sent } or { ok, skipped, reason } or { error }.
 */
export async function sendNudge(db, { code, tier, toneLine = "" }) {
  const { data: prop } = await selectOr((c) => db.from("proposals").select(c).eq("code", code).single(),
    "code, project_id, company_id, snapshot, accepted_at, created_at, nudge_count, nudges_off",
    "code, project_id, company_id, snapshot, accepted_at, created_at, nudge_count");
  if (!prop) return { error: "not_found" };
  if (prop.accepted_at) return { ok: true, skipped: true, reason: "accepted" };
  if (prop.nudges_off === true) return { ok: true, skipped: true, reason: "off_for_offer" };

  const { data: co } = await selectOr((c) => db.from("companies").select(c).eq("id", prop.company_id).single(),
    "id, name, lang, engine, currency, nudge_enabled, subsidy_amount_ron, nudge_days",
    "id, name, lang, engine, currency, nudge_enabled, subsidy_amount_ron");
  if (!co?.nudge_enabled) return { ok: true, skipped: true, reason: "not_enabled" };
  // eligibility re-derived here, on the company's own days: another tier may have been claimed meanwhile
  const days = cleanNudgeDays(co.nudge_days);
  if (nextNudgeTier(prop, days) !== tier) return { ok: true, skipped: true, reason: "tier_mismatch" };

  let proj = null;
  if (prop.project_id) {
    ({ data: proj } = await db.from("projects").select("title, client_name, owner_id").eq("id", prop.project_id).maybeSingle());
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
    then = quote(offerQuoteInput(prop.snapshot), snapshotEngine(prop.snapshot?.engine, co)).e;
    now = quote(offerQuoteInput(prop.snapshot), await companyEngine(co)).e;
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
  // a client who answers writes to the installer who made the quote (else the
  // company's owner), never to VoltMira's sending address
  const result = await sendEmail({ to: clientEmail, subject, html, replyTo: await installerEmail(db, prop.company_id, proj?.owner_id) });

  await logActivity(db, {
    companyId: prop.company_id, kind: "proposal", key: "act_followup_sent",
    params: { b: proj?.client_name || prop.snapshot?.client || "", n: days[tier] },
    text: `Follow-up sent for <b>${proj?.client_name || prop.snapshot?.client || ""}</b> (day ${days[tier]})`,
    link: prop.project_id ? `/projects/${prop.project_id}` : "",
  });
  return { ok: true, sent: !!result.sent };
}
