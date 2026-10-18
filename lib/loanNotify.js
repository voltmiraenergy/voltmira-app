// lib/loanNotify.js — SERVER only. Tell the installer that a loan
// application moved (a lender's webhook, its portal, the admin): an Activity
// line, the CRM webhook, and an email under the call-request switch. Never
// throws: the status change itself is already saved.
import { logActivity } from "./activity.js";
import { sendCrmWebhook } from "./crmWebhook.js";
import { sendEmail, emailConfigured, ownerAlertEmail } from "./email.js";
import { escapeHtml } from "./safe.js";
import { lt } from "./loanText.js";

export async function notifyLoanStatus(db, app, { lenderName = "" } = {}) {
  try {
    const { data: co } = await db.from("companies").select("lang, notify_calls").eq("id", app.company_id).maybeSingle();
    const lang = co?.lang || "ro";
    const who = app.applicant?.name || "";
    const status = lt("st_" + app.status, lang);
    await logActivity(db, {
      companyId: app.company_id, kind: "lead", key: "act_loan_status", params: { b: who, lender: lenderName, s: status },
      text: `Loan for <b>${escapeHtml(who)}</b> at ${escapeHtml(lenderName)}: ${escapeHtml(status)}`, link: app.project_id ? `/projects/${app.project_id}` : "/dashboard",
    });
    await sendCrmWebhook(app.company_id, "loan.status", { applicationId: app.id, projectId: app.project_id, lender: lenderName, status: app.status });
    if (!emailConfigured() || co?.notify_calls === false) return;
    const { data: owner } = await db.from("profiles").select("email").eq("company_id", app.company_id).eq("role", "owner").not("email", "eq", "").limit(1).maybeSingle();
    if (!owner?.email) return;
    const { html } = ownerAlertEmail({
      lang, kicker: lt("ln_mail_kicker", lang), heading: lt("ln_mail_status", lang, { name: who, status }),
      rows: [[lt("doc_product", lang), lenderName], ...(app.lender_ref ? [[lt("doc_ref", lang), app.lender_ref]] : [])],
      lead: lt("ln_mail_lead", lang), cta: { label: lt("ln_mail_cta", lang), href: app.project_id ? `/projects/${app.project_id}` : "/dashboard" },
      appUrl: process.env.NEXT_PUBLIC_APP_URL,
    });
    await sendEmail({ to: owner.email, subject: lt("ln_mail_status", lang, { name: who, status }), html });
  } catch (e) {
    console.error("[loan] notify:", e?.message);
  }
}
