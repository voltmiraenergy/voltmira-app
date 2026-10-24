// lib/feeOverview.js — the workspace's fees month by month, as Settings "Pay per job" shows them: this month's
// signed jobs and what they will cost, then each earlier month with its statement (lib/jobFeePay.js) and whether it
// is paid, still open, or late and so locking its jobs. Pure; lib/feeActions.js loads the rows.
import { feeMonth, monthSummary, nextMonth } from "./jobFees.js";

/**
 * @param {object} a
 * @param {object[]} a.fees      the workspace's job_fees rows (with client and title added)
 * @param {object[]} a.invoices  its job_fee_invoices rows
 * @param {number} [a.now]
 */
export function feeOverview({ fees = [], invoices = [], now = Date.now() }) {
  const month = feeMonth(new Date(now).toISOString());
  const byMonth = new Map();
  for (const f of fees) {
    const m = feeMonth(f.won_at);
    byMonth.set(m, [...(byMonth.get(m) || []), f]);
  }
  const newest = (a, b) => Date.parse(b.won_at) - Date.parse(a.won_at);
  const current = (byMonth.get(month) || []).sort(newest);
  const stOf = new Map(invoices.filter((i) => i.month).map((i) => [i.month, i]));
  const statusOf = new Map(fees.map((f) => [f.id, f]));
  const months = [...byMonth.keys()].filter((m) => m < month).sort().reverse().map((m) => {
    const summary = monthSummary(byMonth.get(m));
    const inv = stOf.get(m);
    // no statement: one is still to come, or the month was settled without one (paid from credit, or by hand)
    if (!inv) return { month: m, summary, statement: null, state: summary.dueMinor > 0 ? "coming" : summary.paidMinor > 0 ? "settled" : "none", comesOn: `${nextMonth(m)}-01` };
    // what is still owed: a job whose client gave up after the statement is not
    const leftMinor = (inv.fee_ids || []).map((id) => statusOf.get(id)).filter((f) => f?.status === "due").reduce((s, f) => s + (Number(f.amount_minor) || 0), 0);
    const state = inv.paid_at ? "paid" : leftMinor === 0 ? "none" : now >= Date.parse(inv.due_at) ? "late" : "open";
    return {
      month: m, summary, state,
      statement: { id: inv.id, number: inv.number, total_minor: Number(inv.total_minor) || 0, leftMinor, due_at: inv.due_at, paid_at: inv.paid_at || null },
    };
  });
  return { month, current, summary: monthSummary(current), months };
}
