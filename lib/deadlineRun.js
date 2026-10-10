// lib/deadlineRun.js — the weekly deadlines email, for every company that has
// not turned it off (companies.notify_deadlines, supabase/add-deadline-alerts.sql;
// a database without the column counts as on). Reads every portfolio's plants
// with the service role, once, in pages; a company with nothing late and
// nothing due in the next 30 days gets no email. Server-only.
import { sendEmail, emailConfigured } from "./email.js";
import { isDemoEmail } from "./demo.js";
import { collectDeadlines } from "./deadlines.js";
import { deadlineEmail } from "./deadlineEmail.js";
import { normLang } from "./i18n.js";
import { mdDayKey } from "./tz.js";

const PAGE = 200;

/** Every portfolio, grouped by company. */
async function portfoliosByCompany(db) {
  const by = new Map();
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await db.from("portfolios").select("id, company_id, name, assets").order("id").range(from, from + PAGE - 1);
    if (error) return { by, error };
    for (const p of data || []) { if (!by.has(p.company_id)) by.set(p.company_id, []); by.get(p.company_id).push(p); }
    if (!data || data.length < PAGE) break;
  }
  return { by, error: null };
}

/**
 * @param {object} db  the service-role client
 * @param {{ now?: number, budgetMs?: number }} [o]
 */
export async function sendDeadlineDigests(db, { now = Date.now(), budgetMs = 50_000 } = {}) {
  const tally = { companies: 0, sent: 0, skipped: 0, failed: 0 };
  if (!emailConfigured()) return { ...tally, off: true };
  const { by, error } = await portfoliosByCompany(db);
  if (error) return { ...tally, error: "read" };
  const todayKey = mdDayKey(now);
  const started = Date.now();
  const base = String(process.env.NEXT_PUBLIC_APP_URL || "https://app.voltmira.com").replace(/\/+$/, "");
  for (const [companyId, portfolios] of by) {
    if (Date.now() - started > budgetMs) break;
    tally.companies++;
    const d = collectDeadlines(portfolios, todayKey);
    if (!d.rows.length) { tally.skipped++; continue; }
    const [{ data: co }, { data: owner }] = await Promise.all([
      db.from("companies").select("*").eq("id", companyId).maybeSingle(),
      db.from("profiles").select("email").eq("company_id", companyId).eq("role", "owner").not("email", "eq", "").limit(1).maybeSingle(),
    ]);
    if (!co || co.notify_deadlines === false || !owner?.email || isDemoEmail(owner.email)) { tally.skipped++; continue; }
    const { subject, html } = deadlineEmail({ lang: normLang(co.lang), rows: d.rows, late: d.late, soon: d.soon, url: `${base}/portfolios/deadlines` });
    const r = await sendEmail({ to: owner.email, subject, html });
    if (r.sent) tally.sent++; else tally.failed++;
  }
  return tally;
}
