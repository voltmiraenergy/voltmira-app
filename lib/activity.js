// lib/activity.js — the dashboard activity feed, made language-aware.
//
// Feed rows used to store a finished English sentence in `text`, so the feed was
// always English regardless of the company's language. Now each row also carries
// an i18n `key` + `params`, and we translate at RENDER time in the reader's
// language. The English `text` is still written as a fallback (the column is NOT
// NULL, and pre-i18n rows only have text).
import { escapeHtml } from "./safe.js";
import { t } from "./i18n.js";

// Write an activity row. Prefers key+params (translated on display); always
// stores an English `text` fallback too. Degrades gracefully to text-only if the
// key/params columns aren't there yet (before add-activity-i18n.sql runs).
export async function logActivity(sb, { companyId, kind, key, params = {}, text = "" }) {
  const base = { company_id: companyId, kind, text };
  let { error } = await sb.from("activity").insert({ ...base, key, params });
  if (error && /(key|params|column|schema cache)/i.test(error.message || "")) {
    ({ error } = await sb.from("activity").insert(base));
  }
  return error;
}

// Render one feed row to safe HTML: only our own <b>…</b> plus escaped params.
// Prefers the i18n key; falls back to the legacy stored `text` (which already
// contains <b> tags around emphasised words).
export function activityHtml(a, lang) {
  if (a && a.key) {
    const p = a.params || {};
    return t(a.key, lang)
      .replace(/\{b\}/g, `<b>${escapeHtml(String(p.b ?? ""))}</b>`)
      .replace(/\{title\}/g, escapeHtml(String(p.title ?? "")))
      .replace(/\{n\}/g, escapeHtml(String(p.n ?? "")));
  }
  // escapeHtml encodes "/" as "&#x2F;", so the closing tag becomes "&lt;&#x2F;b&gt;";
  // match both that and the plain "&lt;/b&gt;" form so </b> never leaks as text.
  return escapeHtml(a?.text || "")
    .replace(/&lt;b&gt;/g, "<b>")
    .replace(/&lt;(?:\/|&#x2F;)b&gt;/g, "</b>");
}
