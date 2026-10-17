// lib/openDigest.js — "offer opened" in one morning email instead of one email
// per open, and quiet hours. A company chooses in Settings, Notifications:
//   notify_open_mode "instant"  an email while the client reads (at most one
//                               per offer every 4 hours), as before
//                    "digest"   one email each morning with yesterday's opens
//   notify_quiet     no email between 21:00 and 08:00 Chișinău time: what
//                    happened then waits for the morning email
// (supabase/add-notify-more.sql; a database without the columns counts as
// "instant" with no quiet hours). The morning run is part of the daily cron
// (app/api/cron/nudges). An offer already emailed about since an open is not
// listed again. Server-only.
import { sendEmail, emailConfigured, ownerAlertEmail } from "./email.js";
import { isDemoEmail } from "./demo.js";
import { normLang } from "./i18n.js";
import { nt } from "./notifyText.js";

const TZ = "Europe/Chisinau";
const DAY = 864e5;
/** Quiet hours, Chișinău time: from 21:00 until 08:00. */
export const QUIET_FROM = 21, QUIET_TO = 8;

/** The hour in Chișinău at a moment. */
export function chisinauHour(now = Date.now()) {
  return Number(new Intl.DateTimeFormat("en-GB", { timeZone: TZ, hour: "2-digit", hourCycle: "h23" }).format(now));
}

/** True during the quiet hours. */
export function inQuietHours(now = Date.now()) {
  const h = chisinauHour(now);
  return h >= QUIET_FROM || h < QUIET_TO;
}

/** Whether an open should be emailed at once, by the company's choice and the hour. */
export function openNow(co, now = Date.now()) {
  if (!co || co.notify_open === false) return false;
  if (co.notify_open_mode === "digest") return false;
  return !(co.notify_quiet === true && inQuietHours(now));
}

/**
 * Yesterday's opens, by offer, not yet emailed about. Pure.
 * @param {Array<{code:string, created_at:string}>} events  "open" events of the last day
 * @param {Map<string, {notify_last_at?:string}>} props      by code
 * @returns {Array<{ code:string, opens:number, last:string }>}
 */
export function pendingOpens(events, props) {
  const by = new Map();
  for (const e of events || []) {
    const sent = props.get(e.code)?.notify_last_at;
    if (sent && Date.parse(e.created_at) <= Date.parse(sent)) continue;
    const o = by.get(e.code) || { code: e.code, opens: 0, last: e.created_at };
    o.opens++;
    if (Date.parse(e.created_at) > Date.parse(o.last)) o.last = e.created_at;
    by.set(e.code, o);
  }
  return [...by.values()].sort((a, b) => b.opens - a.opens || b.last.localeCompare(a.last));
}

/** The morning email: each offer, its opens and when it was last read. */
export function openDigestEmail({ lang, rows, appUrl, test = false }) {
  const L = normLang(lang);
  const loc = { en: "en-GB", ro: "ro-RO", ru: "ru-RU", uk: "uk-UA" }[L] || "en-GB";
  const when = (iso) => new Date(iso).toLocaleString(loc, { timeZone: TZ, weekday: "short", hour: "2-digit", minute: "2-digit" });
  const shown = rows.slice(0, 15);
  const { html } = ownerAlertEmail({
    lang: L, kicker: nt(test ? "test_kicker" : "od_kicker", L),
    heading: nt(rows.length === 1 ? "od_heading_1" : "od_heading", L, { n: rows.length }),
    rows: shown.map((r) => [r.title || r.code, nt("od_row", L, { n: r.opens, when: when(r.last) }), r.projectId ? [{ label: nt("od_open", L), href: `/projects/${r.projectId}` }] : []]),
    lead: (test ? nt("test_lead", L) + " " : "") + nt("od_lead", L),
    cta: { label: nt("od_cta", L), href: "/projects?view=hot" }, foot: nt("foot", L), appUrl,
  });
  return { subject: (test ? "[Test] " : "") + nt(rows.length === 1 ? "od_subject_1" : "od_subject", L, { n: rows.length }), html };
}

/** The morning run: one email per company that chose the digest or has quiet hours. */
export async function sendOpenDigests(db, { now = Date.now(), budgetMs = 20_000 } = {}) {
  const tally = { companies: 0, sent: 0, skipped: 0, failed: 0 };
  if (!emailConfigured()) return { ...tally, off: true };
  const started = Date.now();
  const since = new Date(now - DAY).toISOString();
  const { data: events, error } = await db.from("proposal_events").select("code, company_id, created_at").eq("kind", "open").gte("created_at", since);
  if (error) return { ...tally, error: "read" };
  const byCo = new Map();
  for (const e of events || []) { if (!byCo.has(e.company_id)) byCo.set(e.company_id, []); byCo.get(e.company_id).push(e); }
  const base = String(process.env.NEXT_PUBLIC_APP_URL || "https://app.voltmira.com").replace(/\/+$/, "");
  for (const [companyId, evs] of byCo) {
    if (Date.now() - started > budgetMs) break;
    tally.companies++;
    const { data: co } = await db.from("companies").select("*").eq("id", companyId).maybeSingle();
    if (!co || co.notify_open === false || !(co.notify_open_mode === "digest" || co.notify_quiet === true)) { tally.skipped++; continue; }
    const codes = [...new Set(evs.map((e) => e.code))];
    const { data: props } = await db.from("proposals").select("code, project_id, notify_last_at").in("code", codes);
    const pmap = new Map((props || []).map((p) => [p.code, p]));
    const rows = pendingOpens(evs, pmap);
    if (!rows.length) { tally.skipped++; continue; }
    const ids = [...new Set(rows.map((r) => pmap.get(r.code)?.project_id).filter(Boolean))];
    const { data: projs } = ids.length ? await db.from("projects").select("id, title").in("id", ids) : { data: [] };
    const titles = new Map((projs || []).map((p) => [p.id, p.title]));
    for (const r of rows) { r.projectId = pmap.get(r.code)?.project_id || null; r.title = titles.get(r.projectId) || ""; }
    const { data: owner } = await db.from("profiles").select("email").eq("company_id", companyId).eq("role", "owner").not("email", "eq", "").limit(1).maybeSingle();
    if (!owner?.email || isDemoEmail(owner.email)) { tally.skipped++; continue; }
    const { subject, html } = openDigestEmail({ lang: co.lang, rows, appUrl: base });
    const res = await sendEmail({ to: owner.email, subject, html });
    if (!res.sent) { tally.failed++; continue; }
    tally.sent++;
    // what this email covered is not listed again
    await db.from("proposals").update({ notify_last_at: new Date(now).toISOString() }).in("code", rows.map((r) => r.code));
  }
  return tally;
}
