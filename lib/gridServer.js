// lib/gridServer.js — the server side of a grid submission
// (docs/INTEGRATIONS.md): the package an operator receives, and who is told
// at each status. Server only.
//
// The package is in Romanian, the operators' working language: a short
// covering letter naming the applicant, the site, the system and the
// tracked reference (also in the subject, so a reply can be matched), with
// the operator's own application form filled and attached.
import { escapeHtml } from "./safe.js";
import { OPERATORS } from "./mdGrid.js";
import { docName } from "./gridSubmission.js";
import { gridApplicant } from "./gridDetails.js";
import { fillApplication, applicationFileName } from "./racordareFill.js";
import { xt } from "./integrationText.js";
import { logActivity } from "./activity.js";
import { sendCrmWebhook } from "./crmWebhook.js";
import { sendEmail, emailConfigured, ownerAlertEmail } from "./email.js";

/** @returns {Promise<{ subject, html, attachments, replyTo }>} */
export async function buildGridPackage({ project, co, operator, reference, checklist, note = "", replyTo = "" }) {
  const a = gridApplicant(project.install_progress?.gridFile?.details, project);
  const pdf = await fillApplication(project, operator);
  // Only the filled form goes with the message (attached below); the other documents the installer
  // confirmed are handed in with it, and the message says so rather than list them as if attached.
  const handedIn = (checklist || []).filter((c) => c.present && !c.auto).map((c) => docName(c.id, "ro"));
  const kw = Number(project.kw || 0).toLocaleString("ro-RO", { maximumFractionDigits: 1 });
  const row = (k, v) => (v ? `<tr><td style="padding:4px 12px 4px 0;color:#5A695F">${escapeHtml(k)}</td><td style="padding:4px 0"><b>${escapeHtml(v)}</b></td></tr>` : "");
  const html = `<div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.55;color:#142A21">
<p>Bună ziua,</p>
<p>Vă transmitem cererea pentru eliberarea avizului de racordare pentru un prosumator, completată pe formularul ${escapeHtml(OPERATORS[operator].name)}. Cererea este atașată acestui mesaj.</p>
<table style="border-collapse:collapse;margin:8px 0 14px">
${row("Referința dosarului", reference)}${row("Solicitant", a.name)}${row("Adresa instalației", a.siteAddress)}${row("Număr cadastral", a.cadastral)}${row("NLC", a.nlc)}${row("Puterea instalației", kw ? `${kw} kW` : "")}${row("Telefon", a.phone)}${row("E-mail", a.email)}
</table>
${handedIn.length ? `<p><b>Documentele care însoțesc cererea</b> (le prezintă solicitantul separat de acest mesaj):</p>
<ul>${handedIn.map((d) => `<li>${escapeHtml(d)}</li>`).join("")}</ul>` : ""}
${note ? `<p>${escapeHtml(note)}</p>` : ""}
<p>Vă rugăm să indicați referința ${escapeHtml(reference)} în răspuns.</p>
<p>Cu stimă,<br>${escapeHtml(co.legal_name || co.name || "")}${co.phone ? `<br>${escapeHtml(co.phone)}` : ""}</p>
</div>`;
  return {
    subject: `Cerere aviz de racordare prosumator, ${a.name || project.client_name || ""}, ref. ${reference}`,
    html,
    attachments: [{ filename: applicationFileName(operator), content: Buffer.from(pdf).toString("base64") }],
    replyTo: replyTo || undefined,
  };
}

/**
 * Who hears about a change: the installer (an Activity line, the CRM webhook,
 * and an email when the change did not come from them) and the homeowner (an
 * email, when the quote has their address). Never breaks the change itself.
 * @param {object} a
 * @param {object} a.db          service-role client
 * @param {object} a.co          the workspace
 * @param {string} a.ownerEmail  the workspace owner's address
 * @param {string} a.source      who made the change: "installer" | "operator" | "adapter"
 */
export function gridNotifier({ db, co, ownerEmail = "", source = "installer", appUrl = process.env.NEXT_PUBLIC_APP_URL, io = { logActivity, sendCrmWebhook, sendEmail, emailConfigured } }) {
  const lang = co.lang || "ro";
  const company = co.short_name || co.name || "";
  return {
    async notify({ project, submission, from, to }) {
      const op = OPERATORS[submission.operator]?.short || submission.operator;
      const client = project.client_name || project.title || "";
      try {
        await io.logActivity(db, {
          companyId: project.company_id, kind: "sys", key: "act_grid_" + to, params: { b: client, title: op },
          text: `<b>${escapeHtml(client)}</b>: ${escapeHtml(op)}, ${escapeHtml(xt("gs_st_" + to, "en"))}`, link: `/projects/${project.id}`,
        });
        await io.sendCrmWebhook(project.company_id, "grid.status", { project_id: project.id, operator: submission.operator, reference: submission.reference, from, to });
        if (!io.emailConfigured()) return;
        const rows = [[xt("ge_row_op", lang), op], [xt("ge_row_ref", lang), submission.reference]];
        if (source !== "installer" && ownerEmail) {
          const { html } = ownerAlertEmail({
            lang, kicker: xt("ge_kicker", lang), heading: xt("ge_owner_heading", lang, { op, status: xt("gs_st_" + to, lang), client }),
            rows, lead: xt("ge_owner_lead", lang), cta: { label: xt("ge_cta", lang), href: `/projects/${project.id}` }, appUrl,
          });
          await io.sendEmail({ to: ownerEmail, subject: xt("ge_owner_heading", lang, { op, status: xt("gs_st_" + to, lang), client }), html });
        }
        // In test mode nothing left VoltMira, so the homeowner is not told their file "was sent to" the operator
        // (the later steps are what the installer recorded from the operator's answers, and are told as usual).
        const notSent = submission.channel === "mock" && to === "submitted";
        if (!notSent && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(project.client_email || "")) {
          // in the client's own language when the quote has one (projects.client_lang), else the workspace's
          const cl = ["en", "ro", "ru", "uk"].includes(project.client_lang) ? project.client_lang : lang;
          const heading = xt("gc_" + to, cl, { op });
          const { html } = ownerAlertEmail({
            lang: cl, kicker: xt("ge_kicker", cl), heading, rows: [[xt("ge_row_op", cl), op], [xt("ge_row_ref", cl), submission.reference]],
            lead: xt("gc_" + to + "_l", cl, { op, company }), foot: xt("gc_foot", cl, { company }), appUrl,
          });
          await io.sendEmail({ to: project.client_email, subject: heading, html, replyTo: ownerEmail || undefined });
        }
      } catch (e) {
        console.error("[grid] notify failed:", e?.message);
      }
    },
  };
}
