// lib/payReminders.js — the client's reminders for a stage invoiced and not paid (lib/milestones.js reminderStep):
// when it is issued, 3 days before it is due, on the day, and 3 and 10 days late. An email to the client with the pay
// link, in the client's language (projects.client_lang) else the workspace's, the installer as the reply-to. At 3
// days late the installer is told too (email and Activity). Run once a day from the daily cron (app/api/cron/nudges);
// each step goes once: claimed in pay_milestone_reminders before anything is sent. Nothing goes out for a job whose
// reminders are paused, or a client with no email.
import { reminderStep } from "./milestones.js";
import { demoCompanyCheck } from "./demoServer.js";
import { pt, money, dayName } from "./payText.js";
import { mdDayKey } from "./tz.js";

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const LANGS = ["en", "ro", "ru", "uk"];

/**
 * @param {object} db  service-role client
 * @param {{ io: { sendEmail, emailConfigured, ownerAlertEmail, logActivity }, now?: number, budgetMs?: number, appUrl?: string }} o
 * @returns {Promise<{ open: number, sent: number, skipped: number, needsDb?: boolean }>}
 */
export async function sendPayReminders(db, { io, now = Date.now(), budgetMs = 10_000, appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://voltmira.com" } = {}) {
  const tally = { open: 0, sent: 0, skipped: 0 };
  const started = Date.now();
  const { data: ms, error } = await db.from("pay_milestones").select("*").eq("status", "issued").eq("reminders_paused", false);
  if (error) return { ...tally, needsDb: true };
  tally.open = (ms || []).length;
  const today = mdDayKey(now);
  const base = String(appUrl).replace(/\/+$/, "");
  const demo = demoCompanyCheck(db);
  for (const m of ms || []) {
    if (Date.now() - started > budgetMs) break;   // the rest go out tomorrow
    const step = reminderStep(m, today);
    if (!step || await demo(m.company_id)) { tally.skipped++; continue; }
    const claim = await db.from("pay_milestone_reminders").insert({ milestone_id: m.id, step });
    if (claim.error) { tally.skipped++; continue; }
    try {
      const [{ data: p }, { data: co }, { data: owner }] = await Promise.all([
        db.from("projects").select("id, title, client_name, client_email, client_lang").eq("id", m.project_id).maybeSingle(),
        db.from("companies").select("id, name, short_name, lang").eq("id", m.company_id).maybeSingle(),
        db.from("profiles").select("email").eq("company_id", m.company_id).eq("role", "owner").limit(1).maybeSingle(),
      ]);
      const company = co?.short_name || co?.name || "";
      const lang = LANGS.includes(p?.client_lang) ? p.client_lang : co?.lang || "ro";
      const owed = Math.max(0, Number(m.amount_minor) - Number(m.paid_minor || 0));
      const vars = { no: m.invoice_no, company, v: money(owed, m.currency, lang), d: dayName(m.due_on, lang) };
      const link = `${base}/pay/${m.pay_token}`;
      if (EMAIL_RE.test(p?.client_email || "") && io.emailConfigured()) {
        const subject = pt("m_s_" + step, lang, vars);
        const { html } = io.ownerAlertEmail({
          lang, kicker: pt("m_kicker", lang, vars), heading: subject,
          rows: [[pt("pp_amount", lang), vars.v], [pt("pp_due", lang), vars.d], [pt("pp_ref", lang), m.invoice_no]],
          lead: pt("m_l_" + step, lang), cta: { label: pt("m_cta", lang), href: link }, foot: pt("m_foot", lang, vars), appUrl: base,
        });
        await io.sendEmail({ to: p.client_email, subject, html, replyTo: owner?.email || undefined });
        tally.sent++;
      } else tally.skipped++;
      // 3 days late: the installer hears of it too
      if (step === "late3") {
        const olang = co?.lang || "ro";
        const ovars = { client: p?.client_name || p?.title || "", no: m.invoice_no, v: money(owed, m.currency, olang) };
        await io.logActivity(db, { companyId: m.company_id, kind: "sys", key: "act_ms_late", params: { b: ovars.client, n: m.invoice_no }, text: pt("own_late", "en", { ...ovars, v: money(owed, m.currency, "en") }), link: "/jobs?view=cash" });
        if (owner?.email && io.emailConfigured()) {
          const subject = pt("own_late", olang, ovars);
          const { html } = io.ownerAlertEmail({ lang: olang, kicker: pt("tab_cash", olang), heading: subject, lead: pt("own_late_p", olang), cta: { label: pt("tab_cash", olang), href: "/jobs?view=cash" }, appUrl: base });
          await io.sendEmail({ to: owner.email, subject, html });
        }
      }
    } catch (e) {
      console.error("[pay reminders]", e?.message);
    }
  }
  return tally;
}
