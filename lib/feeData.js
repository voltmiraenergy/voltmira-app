// lib/feeData.js — what lib/successFees.js needs from the database: one
// workspace's signed jobs and statement (the installer's Plan tab, a job's
// fee card, the sidebar), and every workspace's month for VoltMira's revenue
// page. Server-only, service role: callers check who is asking first (the
// workspace from lib/apiCaller.js or the session, a platform admin for the
// revenue page). Every table is optional, so a database before a migration
// still answers, with less.
import { all, allWithFallback } from "./tractionData.js";
import { getRate } from "./fx.js";
import { isDemoEmail } from "./demo.js";
import { isPlatformAdmin } from "./platformAdmin.js";
import { monitoredCount, monitoringBill } from "./monitoringPricing.js";
import { payoutReport } from "./commission.js";
import { supabaseAdmin } from "./supabase.js";
import { signedJobs, assignFees, months, monthOf, statement, nextJob, periodOf, RULES } from "./successFees.js";

/** The day the model started, "YYYY-MM-DD", when set: jobs signed before it never count. */
const startDay = () => (/^\d{4}-\d{2}-\d{2}$/.test(process.env.SUCCESS_FEES_FROM || "") ? process.env.SUCCESS_FEES_FROM : null);

const PROJECT_COLS = ["id, company_id, title, client_name, kw, status, updated_at, sample", "id, company_id, title, client_name, kw, status, updated_at"];

async function loadRows(scope = (q) => q) {
  const [projects, proposals, wonActs, stations] = await Promise.all([
    allWithFallback("projects", PROJECT_COLS, scope),
    allWithFallback("proposals", ["project_id, company_id, accepted_at"], (q) => scope(q).not("accepted_at", "is", null)).catch(() => []),
    // the "won" rows say when a job was marked signed; none before the link column exists
    allWithFallback("activity", ["company_id, link, created_at"], (q) => scope(q).eq("kind", "won")).catch(() => []),
    allWithFallback("inverter_stations", ["company_id, last_month"], scope).catch(() => []),
  ]);
  return { projects, proposals, wonActs, stations };
}

async function eurMdl() {
  const r = await getRate("MDL").catch(() => null);
  return r ? { rate: r.rate, source: r.source || "static", asOf: r.asOf || null } : { rate: null, source: "none", asOf: null };
}

/**
 * One workspace: every signed job with its fee, every month, this month's
 * statement with monitoring, and what the next signed job will cost.
 */
export async function companyFees(companyId, now = new Date()) {
  const scope = (q) => q.eq("company_id", companyId);
  const [{ projects, proposals, wonActs, stations }, fx] = await Promise.all([loadRows(scope), eurMdl()]);
  const from = startDay();
  const rows = assignFees(signedJobs({ projects, proposals, wonActs }), { from });
  const current = periodOf(now.toISOString());
  const list = months(rows, current);
  return {
    on: true, rules: RULES, from, current, fx,
    rows,
    months: list,
    statement: statement(list.find((m) => m.period === current) || monthOf(rows, current), monitoringBill(monitoredCount(stations, now.getTime())), fx.rate),
    next: nextJob(rows, 0),
  };
}

/** The months the revenue page offers: the current one and the eleven before it. */
export function lastMonths(current, n = 12) {
  const [y, m] = current.split("-").map(Number);
  return Array.from({ length: n }, (_, i) => {
    const d = new Date(Date.UTC(y, m - 1 - i, 1));
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
  });
}

/**
 * Every real workspace's statement for one month, plus what the partner banks
 * owe for that month. Demo workspaces are left out; the team's own and
 * TRACTION_EXCLUDE_COMPANY_IDS are shown marked internal while this is a local
 * preview, and left out once live, as on the traction page. Monitoring is a
 * count of today, so it shows for the current month only.
 */
export async function revenueMonth(period, now = new Date()) {
  const current = periodOf(now.toISOString());
  const [companies, profiles, rows, fx, ledger, lenders] = await Promise.all([
    allWithFallback("companies", ["id, name, created_at, plan"]),
    allWithFallback("profiles", ["company_id, email"]),
    loadRows(),
    eurMdl(),
    all(() => supabaseAdmin().from("commission_ledger").select("lender_id, period, currency, loan_minor, amount_minor")).catch(() => null),
    all(() => supabaseAdmin().from("lenders").select("id, name, is_sample")).catch(() => []),
  ]);

  const excludeIds = new Set(String(process.env.TRACTION_EXCLUDE_COMPANY_IDS || "").split(",").map((s) => s.trim()).filter(Boolean));
  const emails = new Map();
  for (const p of profiles) { if (!emails.has(p.company_id)) emails.set(p.company_id, []); emails.get(p.company_id).push(p.email || ""); }
  // demo workspaces never count; the team's own count while this is a local
  // preview (marked "internal"), so a test job shows, and never once it is live
  const preview = process.env.NODE_ENV !== "production";
  const internal = (c) => excludeIds.has(c.id) || (emails.get(c.id) || []).some((e) => isPlatformAdmin(e));
  const real = companies.filter((c) => !(emails.get(c.id) || []).some((e) => isDemoEmail(e)) && (preview || !internal(c)));

  const group = (list, key = "company_id") => {
    const m = new Map();
    for (const r of list) { if (!m.has(r[key])) m.set(r[key], []); m.get(r[key]).push(r); }
    return m;
  };
  const P = group(rows.projects), Q = group(rows.proposals), A = group(rows.wonActs), S = group(rows.stations);
  const from = startDay();

  const out = real.map((c) => {
    const jobs = assignFees(signedJobs({ projects: P.get(c.id) || [], proposals: Q.get(c.id) || [], wonActs: A.get(c.id) || [] }), { from });
    const mon = period === current ? monitoringBill(monitoredCount(S.get(c.id) || [], now.getTime())) : null;
    const st = statement(monthOf(jobs, period), mon, fx.rate);
    return { companyId: c.id, name: c.name || "", internal: internal(c), ...st };
  }).filter((r) => r.jobs.length > 0 || (r.monitoring?.systems || 0) > 0)
    .sort((a, b) => b.totalLei - a.totalLei || a.name.localeCompare(b.name));

  // the banks: real lenders only, this month
  const sample = new Set((lenders || []).filter((l) => l.is_sample).map((l) => l.id));
  const banks = ledger === null ? null : payoutReport((ledger || []).filter((r) => r.period === period && !sample.has(r.lender_id)), lenders || []);
  const bankLei = (banks || []).filter((b) => b.currency === "MDL").reduce((s, b) => s + Math.round(b.amountMinor / 100), 0);
  const bankEur = (banks || []).filter((b) => b.currency === "EUR").reduce((s, b) => s + b.amountMinor / 100, 0);

  const sum = (f) => out.reduce((s, r) => s + (f(r) || 0), 0);
  const totals = {
    installers: out.length,
    signed: sum((r) => r.signed), free: sum((r) => r.free), cancelled: sum((r) => r.cancelled), kw: Math.round(sum((r) => r.kw) * 10) / 10,
    feeLei: sum((r) => r.feeLei),
    monitoringLei: sum((r) => r.monitoring?.monthlyLei), monitoringEur: Math.round(sum((r) => r.monitoring?.monthlyEur) * 100) / 100,
    bankLei, bankEur: Math.round(bankEur * 100) / 100,
  };
  totals.totalLei = totals.feeLei + totals.monitoringLei + bankLei + (fx.rate ? Math.round(totals.bankEur * fx.rate) : 0);
  return { period, current, from, fx, rows: out, banks, totals, months: lastMonths(current) };
}
