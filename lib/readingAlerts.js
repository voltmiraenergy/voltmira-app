// lib/readingAlerts.js — the weekly "no production reading for 30 days" email:
// a commissioned system that has gone a month without a reading (none typed on
// the job rail, none pulled from an inverter portal) is one whose fault would
// go unnoticed. One email per company, listing them; off with
// companies.notify_readings (supabase/add-notify-more.sql; a database without
// the column counts as on). Runs with the Monday deadlines cron.
import { sendEmail, emailConfigured, ownerAlertEmail } from "./email.js";
import { isDemoEmail } from "./demo.js";
import { normLang } from "./i18n.js";
import { nt } from "./notifyText.js";
import { fmtDate } from "./tz.js";

const DAY = 864e5;
const PAGE = 200;
/** A system this long without a reading is listed. */
export const STALE_DAYS = 30;
/** The most systems one email lists. */
export const MAX_ROWS = 15;

/**
 * The commissioned systems with no reading for STALE_DAYS. Pure.
 * @param {Array<{id:string, title?:string, status?:string, install_progress?:object}>} projects
 * @param {Map<string, string>} lastReading  project id -> ISO time of its newest reading row
 * @returns {Array<{ id:string, title:string, commissioned:string, last:string|null, days:number }>}
 */
export function staleSystems(projects, lastReading, now = Date.now()) {
  const out = [];
  for (const p of projects || []) {
    const c = p?.install_progress?.commission;
    if (!p || p.status !== "won" || !c) continue;
    const since = Date.parse(`${String(c).slice(0, 10)}T00:00:00Z`);
    if (!Number.isFinite(since) || now - since < STALE_DAYS * DAY) continue;
    const last = lastReading.get(p.id) || null;
    const from = last ? Date.parse(last) : since;
    const days = Math.floor((now - from) / DAY);
    if (days >= STALE_DAYS) out.push({ id: p.id, title: p.title || "", commissioned: String(c).slice(0, 10), last, days });
  }
  return out.sort((a, b) => b.days - a.days);
}

/** The email for one company. */
export function readingAlertEmail({ lang, rows, appUrl, test = false }) {
  const L = normLang(lang);
  const loc = { en: "en-GB", ro: "ro-RO", ru: "ru-RU", uk: "uk-UA" }[L] || "en-GB";
  const date = (d) => fmtDate(String(d).length === 10 ? `${d}T12:00:00Z` : d, loc, { day: "numeric", month: "short", year: "numeric" });
  const shown = rows.slice(0, MAX_ROWS);
  const { html } = ownerAlertEmail({
    lang: L, kicker: nt(test ? "test_kicker" : "rd_kicker", L), heading: nt(rows.length === 1 ? "rd_heading_1" : "rd_heading", L, { n: rows.length }),
    rows: shown.map((r) => [r.title, r.last ? nt("rd_last", L, { date: date(r.last) }) : nt("rd_none", L, { date: date(r.commissioned) })]),
    lead: (test ? nt("test_lead", L) + " " : "") + nt("rd_lead", L) + (rows.length > shown.length ? " " + nt("rd_more", L, { n: rows.length - shown.length }) : ""),
    cta: { label: nt("rd_cta", L), href: "/projects?status=won" }, foot: nt("foot", L), appUrl,
  });
  return { subject: (test ? "[Test] " : "") + nt(rows.length === 1 ? "rd_subject_1" : "rd_subject", L, { n: rows.length }), html };
}

/** Every company's commissioned quotes and their newest reading, then one email each. */
export async function sendReadingAlerts(db, { now = Date.now(), budgetMs = 40_000 } = {}) {
  const tally = { companies: 0, sent: 0, skipped: 0, failed: 0 };
  if (!emailConfigured()) return { ...tally, off: true };
  const started = Date.now();
  const byCo = new Map();
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await db.from("projects").select("id, company_id, title, status, install_progress").eq("status", "won").order("id").range(from, from + PAGE - 1);
    if (error) return { ...tally, error: "read" };
    for (const p of data || []) if (p.install_progress?.commission) { if (!byCo.has(p.company_id)) byCo.set(p.company_id, []); byCo.get(p.company_id).push(p); }
    if (!data || data.length < PAGE) break;
  }
  const base = String(process.env.NEXT_PUBLIC_APP_URL || "https://app.voltmira.com").replace(/\/+$/, "");
  for (const [companyId, projects] of byCo) {
    if (Date.now() - started > budgetMs) break;
    tally.companies++;
    const { data: reads, error } = await db.from("production_readings").select("project_id, created_at").in("project_id", projects.map((p) => p.id)).order("created_at", { ascending: false });
    if (error) { tally.failed++; continue; }
    const last = new Map();
    for (const r of reads || []) if (!last.has(r.project_id)) last.set(r.project_id, r.created_at);
    const rows = staleSystems(projects, last, now);
    if (!rows.length) { tally.skipped++; continue; }
    const [{ data: co }, { data: owner }] = await Promise.all([
      db.from("companies").select("*").eq("id", companyId).maybeSingle(),
      db.from("profiles").select("email").eq("company_id", companyId).eq("role", "owner").not("email", "eq", "").limit(1).maybeSingle(),
    ]);
    if (!co || co.notify_readings === false || !owner?.email || isDemoEmail(owner.email)) { tally.skipped++; continue; }
    const { subject, html } = readingAlertEmail({ lang: co.lang, rows, appUrl: base });
    const r = await sendEmail({ to: owner.email, subject, html });
    if (r.sent) tally.sent++; else tally.failed++;
  }
  return tally;
}
