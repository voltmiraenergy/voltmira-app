// lib/feeReminders.js — the reminders for a due fee per won project (lib/jobFees.js): the day it is created, a week
// later, the last day of the 14 to pay, and the day the paperwork locks. An email to the workspace owner and a line in
// Activity, in the workspace's language. Run once a day from the daily cron (app/api/cron/nudges). Only the step a
// fee is at goes out, once: the step is claimed in job_fee_reminders before the email, so two runs never send it twice.
// Nothing goes out while JOB_FEES is off: nobody is asked to pay before fees are switched on.
import { feePaywallOn, feeLei } from "./jobFees.js";
import { ft } from "./feeText.js";
import { escapeHtml } from "./safe.js";

const DAY = 864e5;
export const REMINDER_STEPS = ["won", "week", "last_day", "locked"];

/** The step a due fee is at, now: the latest that applies. Null for any other fee. */
export function reminderStep(fee, now = Date.now()) {
  if (!fee || fee.status !== "due") return null;
  const won = Date.parse(fee.won_at), end = Date.parse(fee.grace_ends_at);
  if (!Number.isFinite(won) || !Number.isFinite(end)) return null;
  if (now >= end) return "locked";
  if (now >= end - DAY) return "last_day";
  if (now >= won + 7 * DAY) return "week";
  return "won";
}

/**
 * @param {object} db  service-role client
 * @param {object} [o]
 * @param {{ sendEmail, emailConfigured, ownerAlertEmail, logActivity }} o.io
 * @returns {Promise<{ due: number, sent: number, skipped: number }>}
 */
export async function sendFeeReminders(db, { io, now = Date.now(), budgetMs = 15_000, on = feePaywallOn() } = {}) {
  const tally = { due: 0, sent: 0, skipped: 0 };
  if (!on) return { ...tally, off: true };
  const started = Date.now();
  const { data: fees, error } = await db.from("job_fees").select("*").eq("status", "due");
  if (error) return { ...tally, needsDb: true };
  tally.due = (fees || []).length;
  for (const fee of fees || []) {
    if (Date.now() - started > budgetMs) break;   // the rest go out tomorrow
    const step = reminderStep(fee, now);
    if (!step) { tally.skipped++; continue; }
    // claim the step first: a second run, or a second server, finds it taken
    const claim = await db.from("job_fee_reminders").insert({ fee_id: fee.id, step });
    if (claim.error) { tally.skipped++; continue; }
    try {
      const [{ data: co }, { data: owner }, { data: proj }] = await Promise.all([
        db.from("companies").select("id, lang").eq("id", fee.company_id).maybeSingle(),
        db.from("profiles").select("email").eq("company_id", fee.company_id).eq("role", "owner").limit(1).maybeSingle(),
        db.from("projects").select("title, client_name").eq("id", fee.project_id).maybeSingle(),
      ]);
      const lang = co?.lang || "ro";
      const client = proj?.client_name || proj?.title || "";
      const v = feeLei(fee.amount_minor, lang);
      const until = new Date(fee.grace_ends_at).toLocaleDateString({ en: "en-GB", ro: "ro-RO", ru: "ru-RU", uk: "uk-UA" }[lang] || "ro-RO", { day: "numeric", month: "long", timeZone: "Europe/Chisinau" });
      const link = `/projects/${fee.project_id}`;
      await io.logActivity(db, {
        companyId: fee.company_id, kind: "sys", key: "act_fee_" + step, params: { b: client, n: v },
        text: `${escapeHtml(client)}: ${escapeHtml(ft("rem_s_" + step, "en", { client, v }))}`, link,
      });
      if (owner?.email && io.emailConfigured()) {
        const subject = ft("rem_s_" + step, lang, { client, v });
        const { html } = io.ownerAlertEmail({
          lang, kicker: ft("rem_kicker", lang), heading: subject,
          rows: [[ft("fee_h", lang), v], [ft("rem_until", lang), until]],
          lead: ft("rem_l_" + step, lang), cta: { label: ft("rem_cta", lang), href: link }, appUrl: process.env.NEXT_PUBLIC_APP_URL,
        });
        await io.sendEmail({ to: owner.email, subject, html });
      }
      tally.sent++;
    } catch (e) {
      console.error("[fee reminders]", e?.message);
    }
  }
  return tally;
}
