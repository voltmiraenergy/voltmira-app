// lib/feeReminders.js — the reminders for VoltMira's monthly statement (lib/jobFeePay.js): the day it is issued, a
// week before it is due, the day before, the day the paperwork of its jobs locks, and then each further step of the
// hold (lib/jobFees.js holdLevel) announced 5 days before it starts and again the day it does: new offers stop at 30
// days late, the workspace turns read-only at 60. An email to the workspace owner
// and a line in Activity, in the workspace's language. Run once a day from the daily cron (app/api/cron/nudges). Only
// the step a statement is at goes out, once: the step is claimed in job_fee_statement_reminders before the email, so
// two runs never send it twice. A statement already paid, or with nothing left to pay (every client gave up), gets
// nothing. Nothing goes out while JOB_FEES is off: nobody is asked to pay before fees are switched on.
import { feePaywallOn, feeLei, HOLD_OFFERS_DAYS, HOLD_READONLY_DAYS } from "./jobFees.js";
import { ft, monthName } from "./feeText.js";
import { demoCompanyCheck } from "./demoServer.js";

const DAY = 864e5;
export const REMINDER_STEPS = ["issued", "week", "last_day", "locked", "warn30", "hold30", "warn60", "hold60"];

/** The step an unpaid statement is at, now: the latest that applies. Null once paid. */
export function reminderStep(inv, now = Date.now()) {
  if (!inv || inv.paid_at) return null;
  const issued = Date.parse(inv.issued_at), due = Date.parse(inv.due_at);
  if (!Number.isFinite(issued) || !Number.isFinite(due)) return null;
  if (now >= due) {
    const late = Math.floor((now - due) / DAY);
    if (late >= HOLD_READONLY_DAYS) return "hold60";
    if (late >= HOLD_READONLY_DAYS - 5) return "warn60";
    if (late >= HOLD_OFFERS_DAYS) return "hold30";
    if (late >= HOLD_OFFERS_DAYS - 5) return "warn30";
    return "locked";
  }
  if (now >= due - DAY) return "last_day";
  if (now >= due - 7 * DAY) return "week";
  return "issued";
}

/**
 * @param {object} db  service-role client
 * @param {object} [o]
 * @param {{ sendEmail, emailConfigured, ownerAlertEmail, logActivity }} o.io
 * @returns {Promise<{ open: number, sent: number, skipped: number }>}
 */
export async function sendFeeReminders(db, { io, now = Date.now(), budgetMs = 15_000, on = feePaywallOn() } = {}) {
  const tally = { open: 0, sent: 0, skipped: 0 };
  if (!on) return { ...tally, off: true };
  const started = Date.now();
  const { data: invs, error } = await db.from("job_fee_invoices").select("*").is("paid_at", null).not("month", "is", null);
  if (error) return { ...tally, needsDb: true };
  tally.open = (invs || []).length;
  const demo = demoCompanyCheck(db);
  for (const inv of invs || []) {
    if (Date.now() - started > budgetMs) break;   // the rest go out tomorrow
    const step = reminderStep(inv, now);
    if (!step || await demo(inv.company_id)) { tally.skipped++; continue; }
    // what is still owed on it: a job whose client gave up since is not
    const { data: fees } = await db.from("job_fees").select("id, status, amount_minor").in("id", inv.fee_ids || []);
    const left = (fees || []).filter((f) => f.status === "due").reduce((s, f) => s + (Number(f.amount_minor) || 0), 0);
    if (!left) { tally.skipped++; continue; }
    // claim the step first: a second run, or a second server, finds it taken
    const claim = await db.from("job_fee_statement_reminders").insert({ invoice_id: inv.id, step });
    if (claim.error) { tally.skipped++; continue; }
    try {
      const [{ data: co }, { data: owner }] = await Promise.all([
        db.from("companies").select("id, lang").eq("id", inv.company_id).maybeSingle(),
        db.from("profiles").select("email").eq("company_id", inv.company_id).eq("role", "owner").limit(1).maybeSingle(),
      ]);
      const lang = co?.lang || "ro";
      const vars = { m: monthName(inv.month, lang), v: feeLei(left, lang) };
      const until = new Date(Date.parse(inv.due_at) - 1).toLocaleDateString({ en: "en-GB", ro: "ro-RO", ru: "ru-RU", uk: "uk-UA" }[lang] || "ro-RO", { day: "numeric", month: "long", timeZone: "Europe/Chisinau" });
      const link = "/settings?tab=fees";
      await io.logActivity(db, {
        companyId: inv.company_id, kind: "sys", key: "act_fee_" + step, params: vars,
        text: ft("rem_s_" + step, "en", { ...vars, m: monthName(inv.month, "en"), v: feeLei(left, "en") }), link,
      });
      if (owner?.email && io.emailConfigured()) {
        const subject = ft("rem_s_" + step, lang, vars);
        const { html } = io.ownerAlertEmail({
          lang, kicker: ft("rem_kicker", lang), heading: subject,
          rows: [[ft("st_h", lang, vars), vars.v], [ft("rem_until", lang), until], [ft("ref_h", lang), inv.payment_ref], ["IBAN", inv.seller?.iban || ""]],
          lead: ft("rem_l_" + step, lang), cta: { label: ft("rem_cta", lang), href: `/fees/invoice/${inv.id}` }, appUrl: process.env.NEXT_PUBLIC_APP_URL,
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
