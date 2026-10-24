// lib/feeRevenue.js — VoltMira's income from the fee per won project (lib/jobFees.js), for the platform admin at
// /traction: month by month (by the day a fee was paid, or won for the ones not paid), what is still due and what
// is locked, and the revenue per won job and per kW. Pure; the page loads the rows. Amounts in lei minor units.
import { dayKeyOf } from "./tz.js";
import { jobAccess } from "./jobFees.js";

const monthOf = (iso) => dayKeyOf(iso).slice(0, 7);

/**
 * @param {object} a
 * @param {object[]} a.fees   job_fees rows of real workspaces
 * @param {number} [a.months] how many months back, this one included
 * @param {number} [a.now]
 */
export function feeRevenue({ fees = [], months = 6, now = Date.now() }) {
  const keys = [];
  const d = new Date(now);
  for (let k = months - 1; k >= 0; k--) keys.push(new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() - k, 15)).toISOString().slice(0, 7));
  const row = () => ({ paid: { n: 0, minor: 0 }, due: { n: 0, minor: 0 }, free: 0, void: 0, waived: 0 });
  const byMonth = new Map(keys.map((k) => [k, row()]));
  const totals = { paidN: 0, paidMinor: 0, dueN: 0, dueMinor: 0, lockedN: 0, freeN: 0, voidN: 0, waivedN: 0, creditN: 0 };
  let paidKw = 0;
  for (const f of fees) {
    const amount = Number(f.amount_minor) || 0;
    const m = byMonth.get(monthOf(f.status === "paid" ? f.paid_at || f.won_at : f.won_at));
    if (f.status === "paid") {
      // a fee paid from a cancelled job's credit brought no new money
      if (f.payment_method === "credit") { totals.creditN++; continue; }
      totals.paidN++; totals.paidMinor += amount; paidKw += Number(f.kw) || 0;
      if (m) { m.paid.n++; m.paid.minor += amount; }
    } else if (f.status === "due") {
      totals.dueN++; totals.dueMinor += amount;
      if (jobAccess({ fee: f, on: true, now }).locked) totals.lockedN++;
      if (m) { m.due.n++; m.due.minor += amount; }
    } else if (f.status === "free") { totals.freeN++; if (m) m.free++; }
    else if (f.status === "void") { totals.voidN++; if (m) m.void++; }
    else if (f.status === "waived") { totals.waivedN++; if (m) m.waived++; }
  }
  return {
    months: keys.map((k) => ({ month: k, ...byMonth.get(k) })),
    totals,
    perJobMinor: totals.paidN ? Math.round(totals.paidMinor / totals.paidN) : null,
    perKwMinor: paidKw > 0 ? Math.round(totals.paidMinor / paidKw) : null,
  };
}

/** Every fee as CSV, for the accountant. `names` maps a company id to its name and a project id to its title. */
export function feesCsv(fees, { companies = new Map(), projects = new Map() } = {}) {
  const esc = (v) => {
    const s = String(v ?? "");
    return /[",\n\r;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const head = ["fee_id", "workspace", "idno", "job", "kw", "tier", "amount_lei", "status", "won_on", "pay_by", "paid_on", "method", "reference", "invoice_id"];
  const lines = fees.map((f) => [
    f.id, companies.get(f.company_id) || "", f.idno || "", projects.get(f.project_id) || "", f.kw, f.tier,
    ((Number(f.amount_minor) || 0) / 100).toFixed(2), f.status, dayKeyOf(f.won_at), dayKeyOf(f.grace_ends_at), dayKeyOf(f.paid_at),
    f.payment_method || "", f.payment_ref || "", f.invoice_id || "",
  ].map(esc).join(","));
  return [head.join(","), ...lines].join("\r\n") + "\r\n";
}
