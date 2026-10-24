// lib/acceptIo.js — the real side effects of a signed offer, for
// lib/acceptProposal.js: the proposal assistant's offers, the Activity line,
// the owner's email and the CRM webhook. Server only.
import { nt } from "./notifyText.js";
import { logActivity } from "./activity.js";
import { acceptOffers } from "./proposalOffers.js";
import { sendCrmWebhook } from "./crmWebhook.js";
import { sendEmail, emailConfigured, ownerAlertEmail } from "./email.js";
import { ensureJobFee } from "./jobFeeServer.js";
import { syncMilestones } from "./milestoneServer.js";

/**
 * Email the company owner that a client accepted the offer online. Never
 * breaks the acceptance: a missing email setup only means no email.
 */
export async function notifyAccepted(db, prop, { who, title, signer, pct, level = "simple", simulated = false }) {
  try {
    if (!emailConfigured()) return;
    const [{ data: co }, { data: owner }] = await Promise.all([
      db.from("companies").select("*").eq("id", prop.company_id).single(),
      db.from("profiles").select("email").eq("company_id", prop.company_id)
        .eq("role", "owner").not("email", "eq", "").limit(1).single(),
    ]);
    // its own switch once add-notify-more.sql has run; until then it is on
    if (!co || co.notify_accepted === false || !owner?.email) return;
    const lang = co.lang || "ro";
    const loc = { en: "en-GB", ro: "ro-RO", ru: "ru-RU", uk: "uk-UA" }[lang] || "ro-RO";
    const when = new Date().toLocaleString(loc, { timeZone: "Europe/Chisinau", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" });
    const lvl = level === "qualified" ? (simulated ? "lvl_simulated" : "lvl_qualified") : "lvl_simple";
    const { html } = ownerAlertEmail({
      lang, kicker: nt("acc_kicker", lang), heading: nt("acc_heading", lang, { client: who, title }),
      rows: [[nt("acc_signer", lang), signer || who], [nt("acc_when", lang), when], [nt("acc_level", lang), nt(lvl, lang)], ...(pct ? [[nt("acc_discount", lang), `${pct}%`]] : [])],
      lead: nt("acc_lead", lang), cta: { label: nt("acc_cta", lang), href: `/projects/${prop.project_id}` },
      foot: nt("foot", lang), appUrl: process.env.NEXT_PUBLIC_APP_URL,
    });
    await sendEmail({ to: owner.email, subject: nt("acc_subject", lang, { client: who }), html });
  } catch (err) {
    console.error("accept notify failed", err?.message);
  }
}

/** The client signed: the job's fee (lib/jobFeeServer.js), created from the won project as it now stands. */
export async function feeOnWin(db, projectId) {
  const { data: project } = await db.from("projects").select("*").eq("id", projectId).maybeSingle();
  if (project) await ensureJobFee(db, project, { trigger: "signed" });
  // and the client's payments in stages: the first invoice is issued at once (lib/milestoneServer.js)
  if (project) await syncMilestones(db, projectId, { io: { logActivity } });
}

export const acceptIo = { acceptOffers, logActivity, notifyAccepted, sendCrmWebhook, feeOnWin };
