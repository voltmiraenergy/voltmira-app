// lib/deadlineEmail.js — the weekly "permits and deadlines" email to the
// installer: what is late and what is due in the next 30 days, across all
// their plants, in the workspace's language. Same look as the deal room's
// emails (lib/dealEmail.js). Pure.
import { frame } from "./dealEmail.js";
import { dlt, whenText } from "./deadlineText.js";
import { plt } from "./plantText.js";
import { fmtDate } from "./tz.js";
import { SOON_DAYS } from "./deadlines.js";

const INK = "#142A21";
const MUTED = "#66756C";
const LINE = "#E3E1D6";
const RED = "#B4472F";
const LOC = { en: "en-GB", ro: "ro-RO", ru: "ru-RU", uk: "uk-UA" };
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
/** The most rows an email lists; the rest are on the page. */
export const EMAIL_ROWS = 15;

/** The item's name: "Racordarea la rețea: Contractul de racordare". */
export function itemName(r, lang) {
  return r.step ? `${plt("pm_" + r.item, lang)}: ${plt("gs_" + r.step, lang)}` : plt("pm_" + r.item, lang);
}

/**
 * @param {{lang:string, rows:object[], late:number, soon:number, url:string}} a  rows from collectDeadlines
 */
export function deadlineEmail({ lang, rows = [], late = 0, soon = 0, url }) {
  const L = LOC[lang] ? lang : "en";
  const key = late && soon ? "em_subject" : late ? "em_subject_late" : "em_subject_soon";
  const shown = rows.slice(0, EMAIL_ROWS);
  const list = shown.map((r) => `
      <tr>
        <td style="padding:8px 12px 8px 0;border-bottom:1px solid ${LINE};vertical-align:top;font-size:13.5px;color:${INK};">
          <b>${esc(r.plantName)}</b><br><span style="color:${MUTED};font-size:12.5px;">${esc(itemName(r, L))}${r.by ? `, ${esc(r.by)}` : ""}${r.ref ? `, ${esc(r.ref)}` : ""}</span></td>
        <td style="padding:8px 0;border-bottom:1px solid ${LINE};vertical-align:top;text-align:right;white-space:nowrap;font-size:13px;color:${r.overdue ? RED : INK};font-weight:${r.overdue ? 700 : 500};">
          ${esc(fmtDate(r.due, LOC[L], { day: "numeric", month: "short" }))}<br><span style="font-size:12px;">${esc(whenText(r.days, L))}</span></td>
      </tr>`).join("");
  const more = rows.length > shown.length ? `<p style="margin:10px 0 0;font-size:12.5px;color:${MUTED};">${esc(dlt("em_more", L, { n: rows.length - shown.length }))}</p>` : "";
  return {
    subject: dlt(key, L, { late, soon }),
    html: frame({
      L, url,
      kicker: dlt("em_kicker", L),
      h1: dlt("em_h1", L),
      cta: dlt("em_cta", L),
      foot: dlt("em_foot", L, { n: SOON_DAYS }),
      body: `<table role="presentation" width="100%" cellpadding="0" cellspacing="0">${list}</table>${more}`,
    }),
  };
}
