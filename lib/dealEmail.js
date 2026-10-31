// lib/dealEmail.js — the deal room's alert emails to the installer: a bank
// asked a question (sent at once), and what a bank did on its link since the
// last alert (at most one every 6 hours per link, lib/dealNotify.js). In the
// workspace's language, informal Romanian, table-based HTML that holds up in
// Gmail, Outlook and phone clients. Same look as lib/email.js. Pure.
import { dt } from "./dealText.js";
import { plt } from "./plantText.js";
import { fmtDate } from "./tz.js";
import { mailShell, mailBtn } from "./email.js";

const INK = "#142A21";
const PAPER = "#F6F5F0";
const GREEN = "#1E6B4E";
const MUTED = "#66756C";
const LINE = "#E3E1D6";
const LOC = { en: "en-GB", ro: "ro-RO", ru: "ru-RU", uk: "uk-UA" };
const langOf = (l) => (LOC[l] ? l : "en");
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

/** One line of the log in words: "A descărcat Aviz.pdf". */
export function eventText(v, lang) {
  if (v.what === "document") return dt("lw_document", lang, { x: v.detail });
  if (v.what === "question") return dt("lw_question", lang, { x: v.detail });
  return dt("lw_" + v.what, lang);
}

/** The shared frame of the deal room's and the deadlines' emails: the one VoltMira look (lib/email.js mailShell). */
export function frame({ L, kicker, h1, body, url, cta, foot }) {
  return mailShell({ lang: L, title: h1, kicker, h1: esc(h1), body: body + `<div style="margin-top:22px;">${mailBtn(url, cta)}</div>`, foot: esc(foot) });
}

/**
 * A bank asked a question on a checklist item.
 * @param {{lang:string, bank:string, plant:string, item:string, askedBy?:string, body:string, url:string}} a
 */
export function dealQuestionEmail({ lang, bank, plant, item, askedBy = "", body, url }) {
  const L = langOf(lang);
  const itemName = plt("pm_" + item, L);
  const subject = dt("em_q_subject", L, { bank, item: itemName, plant });
  const html = frame({
    L, url,
    kicker: dt("em_q_kicker", L),
    h1: dt("em_q_h1", L, { bank, item: itemName }),
    cta: dt("em_cta", L),
    foot: dt("em_q_foot", L),
    body: `<p style="margin:0 0 14px;font-size:14px;line-height:1.6;color:${MUTED};">${esc(dt("em_q_lead", L, { plant }))}</p>
    <div style="border-left:3px solid ${GREEN};padding:10px 14px;background:${PAPER};border-radius:0 10px 10px 0;">
      ${askedBy ? `<p style="margin:0 0 4px;font-size:12px;color:${MUTED};">${esc(dt("em_q_by", L, { x: askedBy }))}</p>` : ""}
      <p style="margin:0;font-size:14.5px;line-height:1.55;color:${INK};white-space:pre-wrap;">${esc(body)}</p>
    </div>`,
  });
  return { subject, html };
}

/**
 * What a bank did on its link since the last alert, newest last.
 * @param {{lang:string, bank:string, plant:string, events:{at:string, what:string, detail?:string}[], url:string}} a
 */
export function dealActivityEmail({ lang, bank, plant, events = [], url }) {
  const L = langOf(lang);
  const when = (iso) => fmtDate(iso, LOC[L], { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
  const rows = [...events].sort((a, b) => String(a.at).localeCompare(String(b.at))).slice(-20).map((v) => `
      <tr>
        <td style="padding:7px 12px 7px 0;border-bottom:1px solid ${LINE};color:${MUTED};font-size:12.5px;white-space:nowrap;vertical-align:top;">${esc(when(v.at))}</td>
        <td style="padding:7px 0;border-bottom:1px solid ${LINE};color:${INK};font-size:13.5px;">${esc(eventText(v, L))}</td>
      </tr>`).join("");
  return {
    subject: dt("em_a_subject", L, { bank, plant }),
    html: frame({
      L, url,
      kicker: dt("em_a_kicker", L),
      h1: dt("em_a_h1", L, { bank, plant }),
      cta: dt("em_cta", L),
      foot: dt("em_a_foot", L),
      body: `<p style="margin:0 0 8px;font-size:14px;line-height:1.6;color:${MUTED};">${esc(dt("em_a_lead", L))}</p>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">${rows}</table>`,
    }),
  };
}

/** Where the alert sends the installer: the portfolio, at its plants. */
export const plantUrl = (appUrl, portfolioId) => `${String(appUrl || "https://app.voltmira.com").replace(/\/+$/, "")}/portfolios/${portfolioId}#plants`;
