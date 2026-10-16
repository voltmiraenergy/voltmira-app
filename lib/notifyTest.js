"use server";
// lib/notifyTest.js — "Send me a test" in Settings, Notifications: each email
// VoltMira sends, built by its real template with sample figures in the
// workspace's language, sent to the signed-in user's own address; and a test
// event to the CRM webhook. Each answers what happened, or why it could not:
// no email service on this server, no address on the profile, the sending
// domain not verified yet, too many tests, or the webhook's own answer.
import { currentCompany, currentUser } from "./session.js";
import { sendEmail, emailConfigured, proposalOpenedEmail, proposalNudgeEmail, ownerAlertEmail } from "./email.js";
import { deadlineEmail } from "./deadlineEmail.js";
import { readingAlertEmail } from "./readingAlerts.js";
import { nt } from "./notifyText.js";
import { normLang } from "./i18n.js";
import { mdDayKey } from "./tz.js";
import { isRateLimited } from "./ratelimit.js";
import { isDemoEmail } from "./demo.js";

const TEST_KINDS = ["open", "calls", "accepted", "deadlines", "readings", "nudge"];

const appUrl = () => String(process.env.NEXT_PUBLIC_APP_URL || "https://app.voltmira.com").replace(/\/+$/, "");
const dayOffset = (n) => mdDayKey(Date.now() + n * 864e5);

/** A short notice at the top of a test, so it can never be read as real. */
function markTest(html, lang) {
  const note = `<div style="margin:0 0 12px;padding:10px 14px;border-radius:8px;background:#FFF4D6;color:#5C4400;font:600 13px/1.4 Arial,sans-serif;">${nt("test_kicker", lang)}: ${nt("test_lead", lang)}</div>`;
  return /<body[^>]*>/i.test(html) ? html.replace(/<body[^>]*>/i, (m) => m + note) : note + html;
}

/** The sample email of one kind, in `lang`. */
function sample(kind, lang, coName) {
  const client = nt("test_client", lang), title = nt("test_title", lang);
  if (kind === "open") {
    return proposalOpenedEmail({ projectTitle: title, clientName: client, code: "TEST", opens: 3, seconds: 245, appUrl: appUrl(), lang });
  }
  if (kind === "calls") {
    const { html } = ownerAlertEmail({
      lang, kicker: nt("call_kicker", lang), heading: nt("call_heading", lang, { client, title }),
      rows: [[nt("call_phone", lang), "+373 69 000 000"], [nt("call_when", lang), nt("when_morning", lang)]],
      lead: nt("call_lead", lang), cta: { label: nt("call_cta", lang), href: "/projects" }, foot: nt("foot", lang), appUrl: appUrl(),
    });
    return { subject: nt("call_subject", lang, { client }), html };
  }
  if (kind === "accepted") {
    const { html } = ownerAlertEmail({
      lang, kicker: nt("acc_kicker", lang), heading: nt("acc_heading", lang, { client, title }),
      rows: [[nt("acc_signer", lang), client], [nt("acc_when", lang), dayOffset(0)]],
      lead: nt("acc_lead", lang), cta: { label: nt("acc_cta", lang), href: "/projects" }, foot: nt("foot", lang), appUrl: appUrl(),
    });
    return { subject: nt("acc_subject", lang, { client }), html };
  }
  if (kind === "deadlines") {
    const rows = [
      { item: "quote_grid", step: "approval", status: "waiting", by: "RED Nord", ref: "", due: dayOffset(-3), days: -3, overdue: true, plantName: title },
      { item: "urbanism", step: null, status: "todo", by: "", ref: "", due: dayOffset(12), days: 12, overdue: false, plantName: nt("test_title", lang) },
    ];
    return deadlineEmail({ lang, rows, late: 1, soon: 1, url: `${appUrl()}/portfolios/deadlines` });
  }
  if (kind === "readings") {
    return readingAlertEmail({ lang, rows: [{ id: "x", title, commissioned: dayOffset(-75), last: null, days: 75 }], appUrl: appUrl() });
  }
  // the follow-up a client receives, so the installer sees what goes out under their name
  return proposalNudgeEmail({
    clientName: client, companyName: coName || "VoltMira", liveUrl: `${appUrl()}/p/TEST`, lang, toneLine: "",
    then: { paybackYears: 6.8, monthlySavings: 74 }, now: { paybackYears: 6.4, monthlySavings: 79 }, preparedBy: null,
  });
}

/**
 * Send one test email to the signed-in user.
 * @returns {Promise<{ ok: true, to: string } | { ok: false, reason: "no_key"|"no_email"|"demo"|"domain"|"rate"|"send"|"bad_kind"|"signed_out", code?: string }>}
 */
export async function sendTestEmail(kind) {
  if (!TEST_KINDS.includes(kind)) return { ok: false, reason: "bad_kind" };
  const user = await currentUser();
  if (!user) return { ok: false, reason: "signed_out" };
  if (!emailConfigured()) return { ok: false, reason: "no_key" };
  if (!user.email) return { ok: false, reason: "no_email" };
  // a demo's address is made up: a test would bounce
  if (isDemoEmail(user.email)) return { ok: false, reason: "demo" };
  if (await isRateLimited(`ntest:${user.id}`, 12, 10 * 60 * 1000)) return { ok: false, reason: "rate" };
  const co = await currentCompany();
  const lang = normLang(co?.lang);
  const { subject, html } = sample(kind, lang, co?.name);
  const r = await sendEmail({ to: user.email, subject: `[Test] ${subject}`, html: markTest(html, lang) });
  if (r.sent) return { ok: true, to: user.email };
  // Resend answers 403 when the sending domain is not verified (it then sends only to the account's own address)
  if (r.error === "resend_403") return { ok: false, reason: "domain", code: r.error };
  if (r.error === "resend_429") return { ok: false, reason: "rate", code: r.error };
  return { ok: false, reason: "send", code: r.error || "unknown" };
}

/**
 * Post a test event to the company's CRM webhook and report its answer.
 * @returns {Promise<{ ok: boolean, status?: number, reason?: "off"|"owner"|"timeout"|"http"|"network"|"signed_out" }>}
 */
export async function testWebhook() {
  const user = await currentUser();
  if (!user) return { ok: false, reason: "signed_out" };
  const co = await currentCompany();
  const url = String(co?.crm_webhook_url || "");
  if (!co?.crm_webhook_enabled || !/^https:\/\//i.test(url)) return { ok: false, reason: "off" };
  if (await isRateLimited(`wtest:${user.id}`, 12, 10 * 60 * 1000)) return { ok: false, reason: "rate" };
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 5000);
  try {
    const res = await fetch(url, {
      method: "POST", headers: { "Content-Type": "application/json" }, signal: controller.signal,
      body: JSON.stringify({ event: "test", companyId: co.id, at: new Date().toISOString(), data: { note: "A test event from VoltMira Settings, Notifications. Nothing happened." } }),
    });
    return res.ok ? { ok: true, status: res.status } : { ok: false, reason: "http", status: res.status };
  } catch (e) {
    return { ok: false, reason: e?.name === "AbortError" ? "timeout" : "network" };
  } finally {
    clearTimeout(timer);
  }
}
