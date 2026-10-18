// lib/ticketServer.js — who hears about a maintenance ticket
// (docs/MARKETPLACE.md). The side that did not make a change is told: the
// installer by an Activity line, the CRM webhook and an email to the owner;
// the homeowner by email at every address linked to the system (or the
// quote's client email while nobody has an account), with the visit as a
// calendar file. Never breaks the change itself. Server only.
import { escapeHtml } from "./safe.js";
import { logActivity } from "./activity.js";
import { sendCrmWebhook } from "./crmWebhook.js";
import { sendEmail, emailConfigured, ownerAlertEmail } from "./email.js";
import { visitIcs } from "./ics.js";
import { fmtDate, fmtTime } from "./tz.js";
import { ht } from "./homeText.js";
import { xt } from "./integrationText.js";

const LOC = { en: "en-GB", ro: "ro-RO", ru: "ru-RU", uk: "uk-UA" };

/**
 * @param {object} a
 * @param {object} a.db   service-role client
 * @param {object} a.co   the workspace { id, name, short_name, lang }
 */
export function ticketNotifier({ db, co, appUrl = process.env.NEXT_PUBLIC_APP_URL, io = { logActivity, sendCrmWebhook, sendEmail, emailConfigured } }) {
  const lang = co.lang || "ro";
  const company = co.short_name || co.name || "";
  const when = (iso) => `${fmtDate(iso, LOC[lang], { weekday: "long", day: "numeric", month: "long" })}, ${fmtTime(iso, LOC[lang])}`;
  return {
    async notify({ project, ticket, from, to, source }) {
      const client = project.client_name || project.title || "";
      try {
        // the installer: everything not done by them
        if (source !== "installer") {
          const reopened = from === "resolved" && to === "open";
          if (to === "open") {
            await io.logActivity(db, {
              companyId: project.company_id, kind: "lead", key: reopened ? "act_ticket_reopened" : "act_ticket_open",
              params: { b: client, title: ticket.title }, text: `<b>${escapeHtml(client)}</b>: ${escapeHtml(ticket.title)}`, link: `/projects/${project.id}`,
            });
          }
          if (io.emailConfigured()) {
            const { data: owner } = await db.from("profiles").select("email").eq("company_id", project.company_id).eq("role", "owner").not("email", "eq", "").limit(1).maybeSingle();
            if (owner?.email && to === "open") {
              const { html } = ownerAlertEmail({
                lang, kicker: xt("mt_h", lang), heading: xt("mt_owner_heading", lang, { client, title: ticket.title }),
                rows: ticket.detail ? [[xt("mt_detail", lang), ticket.detail.slice(0, 300)]] : [],
                lead: reopened ? xt("mt_owner_reopen", lang) : xt("mt_owner_lead", lang, { src: xt("mt_src_" + source, lang) }),
                cta: { label: xt("ge_cta", lang), href: `/projects/${project.id}` }, appUrl,
              });
              await io.sendEmail({ to: owner.email, subject: xt("mt_owner_heading", lang, { client, title: ticket.title }), html });
            }
          }
        }
        await io.sendCrmWebhook(project.company_id, "ticket.status", { project_id: project.id, ticket_id: ticket.id, kind: ticket.kind, source, from, to, visit_at: ticket.visit_at || null });

        // the homeowner: everything not done by them
        if (source === "homeowner" || !io.emailConfigured()) return;
        const { data: links } = await db.from("homeowner_links").select("email").eq("project_id", project.id);
        const to_ = [...new Set((links || []).map((l) => l.email).filter(Boolean))];
        if (!to_.length && project.client_email) to_.push(project.client_email);
        if (!to_.length) return;
        const key = to === "open" ? (source === "monitoring" ? "tk_open_mon" : "tk_open") : "tk_" + to;
        const vars = { title: ticket.title, co: company, d: ticket.visit_at ? when(ticket.visit_at) : "", outcome: ticket.outcome || "" };
        const { html } = ownerAlertEmail({
          lang, kicker: ht("tk_kicker", lang), heading: ht(key, lang, vars), lead: ht(key + "_l", lang, vars),
          cta: { label: ht("tk_cta", lang), href: "/home" }, foot: xt("gc_foot", lang, { company }), appUrl,
        });
        const attachments = to === "scheduled" && ticket.visit_at
          ? [{ filename: "vizita.ics", content: Buffer.from(visitIcs({ uid: `ticket-${ticket.id}-${Date.parse(ticket.visit_at)}@voltmira`, start: ticket.visit_at, minutes: 120, title: `${company}: ${ticket.title}`, location: project.address || "" })).toString("base64") }]
          : undefined;
        for (const email of to_) await io.sendEmail({ to: email, subject: ht(key, lang, vars), html, attachments });
      } catch (e) {
        console.error("[ticket] notify failed:", e?.message);
      }
    },
  };
}
