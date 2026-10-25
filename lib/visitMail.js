// lib/visitMail.js — SERVER only. The email a client gets when a crew visit to their job is planned or moved
// (lib/jobActions.js saveVisit): the day and the time window on the Chișinău clock, the crew, what the visit is for,
// in the client's language (projects.client_lang) else the workspace's. Sent from VoltMira's address with the
// workspace owner as the reply-to. Never breaks the save: a failure is logged and the visit stays saved.
import { jt } from "./jobText.js";
import { sendEmail, emailConfigured, ownerAlertEmail } from "./email.js";
import { isDemoEmail } from "./demo.js";
import { fmtDate, fmtTime } from "./tz.js";

const LOCS = { en: "en-GB", ro: "ro-RO", ru: "ru-RU", uk: "uk-UA" };
const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

/** The visit's day and time window in a language: "marți, 27 octombrie, 08:00 - 16:30" without the dash. */
export function visitWhen(visit, lang) {
  const loc = LOCS[lang] || "ro-RO";
  const day = fmtDate(visit.starts_at, loc, { weekday: "long", day: "numeric", month: "long" });
  return `${day}, ${fmtTime(visit.starts_at, loc)} ${lang === "en" ? "to" : lang === "ro" ? "până la" : lang === "ru" ? "до" : "до"} ${fmtTime(visit.ends_at, loc)}`;
}

/**
 * @returns {Promise<boolean>} sent
 */
export async function sendVisitEmail({ co, project, visit, crew, moved = false, ownerEmail = "", io = { sendEmail, emailConfigured, ownerAlertEmail } }) {
  try {
    if (!visit.notify_client || !EMAIL_RE.test(project.client_email || "") || !io.emailConfigured()) return false;
    // a demo workspace emails nobody (lib/demoServer.js)
    if (isDemoEmail(ownerEmail)) return false;
    const lang = ["en", "ro", "ru", "uk"].includes(project.client_lang) ? project.client_lang : co.lang || "ro";
    const company = co.short_name || co.name || "";
    const when = visitWhen(visit, lang);
    const heading = jt(moved ? "ve_moved" : "ve_new", lang, { company, d: when });
    const { html } = io.ownerAlertEmail({
      lang, kicker: jt("ve_kicker", lang), heading,
      rows: [[jt("ve_when", lang), when], ...(crew?.name ? [[jt("ve_crew", lang), crew.name]] : [])],
      lead: jt("ve_lead_" + visit.kind, lang), foot: jt("ve_foot", lang, { company }), appUrl: process.env.NEXT_PUBLIC_APP_URL,
    });
    const r = await io.sendEmail({ to: project.client_email, subject: heading, html, replyTo: ownerEmail || undefined });
    return !!r?.sent;
  } catch (e) {
    console.error("[visit mail]", e?.message);
    return false;
  }
}
