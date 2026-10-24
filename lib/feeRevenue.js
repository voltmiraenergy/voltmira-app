// lib/feeRevenue.js — VoltMira's income from the fee for signed jobs (lib/jobFees.js), for the platform admin at
// /traction: month by month (the month a job was signed, as the statements group them), each installer's statement
// for a month with what is paid and still owed, and the revenue per charged job and per kW. Pure; the page loads the
// rows. Amounts in lei minor units.
import { dayKeyOf } from "./tz.js";
import { feeMonth, monthSummary } from "./jobFees.js";

/** The last `n` months up to `now`'s, oldest first: ["2026-05", ..., "2026-10"]. */
export function lastMonths(n = 6, now = Date.now()) {
  const [y, m] = feeMonth(new Date(now).toISOString()).split("-").map(Number);
  const out = [];
  for (let k = n - 1; k >= 0; k--) {
    const d = new Date(Date.UTC(y, m - 1 - k, 15));
    out.push(d.toISOString().slice(0, 7));
  }
  return out;
}

const statementState = (inv, leftMinor, now) => (inv.paid_at ? "paid" : leftMinor === 0 ? "none" : now >= Date.parse(inv.due_at) ? "late" : "open");

/**
 * @param {object} a
 * @param {object[]} a.fees      job_fees rows of real workspaces
 * @param {number} [a.months]    how many months back, this one included
 * @param {number} [a.now]
 */
export function feeRevenue({ fees = [], months = 6, now = Date.now() }) {
  const keys = lastMonths(months, now);
  const byMonth = new Map(keys.map((k) => [k, []]));
  for (const f of fees) byMonth.get(feeMonth(f.won_at))?.push(f);
  const totals = { paidMinor: 0, dueMinor: 0, lateMinor: 0, lateN: 0, creditN: 0 };
  let chargedN = 0, chargedMinor = 0, chargedKw = 0;
  for (const f of fees) {
    const a = Number(f.amount_minor) || 0;
    if (f.status === "paid" && f.payment_method === "credit") { totals.creditN++; continue; }   // no new money
    if (f.status === "paid") totals.paidMinor += a;
    if (f.status === "due") {
      totals.dueMinor += a;
      if (Date.parse(f.grace_ends_at) <= now) { totals.lateMinor += a; totals.lateN++; }
    }
    if (f.status === "paid" || f.status === "due") { chargedN++; chargedMinor += a; chargedKw += Number(f.kw) || 0; }
  }
  return {
    months: keys.map((k) => ({ month: k, ...monthSummary(byMonth.get(k)) })),
    totals,
    perJobMinor: chargedN ? Math.round(chargedMinor / chargedN) : null,
    perKwMinor: chargedKw > 0 ? Math.round(chargedMinor / chargedKw) : null,
  };
}

/**
 * Each installer's statement for one month, as the admin settles them: what was signed, free and cancelled, the kW,
 * the fees, and the statement (if issued) with what is still owed. Rows with nothing signed that month are left out.
 * @returns {{ rows: object[], totals: object }}
 */
export function statementsFor({ fees = [], invoices = [], month, now = Date.now() }) {
  const inMonth = fees.filter((f) => feeMonth(f.won_at) === month);
  const byCo = new Map();
  for (const f of inMonth) byCo.set(f.company_id, [...(byCo.get(f.company_id) || []), f]);
  const feeById = new Map(fees.map((f) => [f.id, f]));
  const invOf = new Map(invoices.filter((i) => i.month === month).map((i) => [i.company_id, i]));
  const rows = [...byCo].map(([companyId, list]) => {
    const s = monthSummary(list);
    const inv = invOf.get(companyId);
    let statement = null;
    if (inv) {
      const leftMinor = (inv.fee_ids || []).map((id) => feeById.get(id)).filter((f) => f?.status === "due").reduce((t, f) => t + (Number(f.amount_minor) || 0), 0);
      statement = { id: inv.id, number: inv.number, totalMinor: Number(inv.total_minor) || 0, leftMinor, ref: inv.payment_ref, dueAt: inv.due_at, paidAt: inv.paid_at || null, state: statementState(inv, leftMinor, now) };
    }
    const dueFees = list.filter((f) => f.status === "due").map((f) => ({ id: f.id, projectId: f.project_id, kw: Number(f.kw) || 0, amount_minor: Number(f.amount_minor) || 0 }));
    return { companyId, ...s, statement, dueFees };
  }).sort((a, b) => b.feesMinor - a.feesMinor);
  const sum = (k) => rows.reduce((t, r) => t + (r[k] || 0), 0);
  return {
    rows,
    totals: { signed: sum("signed"), free: sum("free"), cancelled: sum("cancelled"), kw: Math.round(sum("kw") * 10) / 10, feesMinor: sum("feesMinor"), paidMinor: sum("paidMinor"), dueMinor: sum("dueMinor") },
  };
}

/** Every fee as CSV, for the accountant. `companies` maps a company id to its name, `projects` a project id to its title. */
export function feesCsv(fees, { companies = new Map(), projects = new Map(), invoices = [] } = {}) {
  const esc = (v) => {
    const s = String(v ?? "");
    return /[",\n\r;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const invNo = new Map(invoices.map((i) => [i.id, i.number]));
  const head = ["fee_id", "workspace", "idno", "job", "month", "kw", "capped", "amount_lei", "status", "signed_on", "how", "pay_by", "paid_on", "method", "reference", "statement"];
  const lines = fees.map((f) => [
    f.id, companies.get(f.company_id) || "", f.idno || "", projects.get(f.project_id) || "", feeMonth(f.won_at), f.kw, Number(f.tier) === 1 ? "yes" : "",
    ((Number(f.amount_minor) || 0) / 100).toFixed(2), f.status, dayKeyOf(f.won_at), f.trigger || "", dayKeyOf(f.grace_ends_at), dayKeyOf(f.paid_at),
    f.payment_method || "", f.payment_ref || "", invNo.get(f.invoice_id) || "",
  ].map(esc).join(","));
  return [head.join(","), ...lines].join("\r\n") + "\r\n";
}
