// lib/commission.js — what a lender owes VoltMira for a funded loan, under
// its contract (lenders.commission_type), and the monthly payout report per
// lender (docs/FINANCING.md). Pure; integer minor units.

/** The commission on one funded loan. */
export function commissionFor(lender, loanMinor) {
  const loan = Math.max(0, Math.round(Number(loanMinor) || 0));
  if (lender?.commission_type === "flat") {
    return { amountMinor: Math.max(0, Math.round(Number(lender.commission_flat_minor) || 0)), basis: "flat", rateBps: 0, currency: lender.currency || "MDL", loanMinor: loan };
  }
  const bps = Math.max(0, Math.round(Number(lender?.commission_bps) || 0));
  return { amountMinor: Math.round((loan * bps) / 10000), basis: "percent", rateBps: bps, currency: lender?.currency || "MDL", loanMinor: loan };
}

/** "2026-10" from a date. */
export const periodOf = (d) => new Date(d || Date.now()).toISOString().slice(0, 7);

/**
 * The payout report: one row per lender, month and currency, newest month
 * first, from commission_ledger rows.
 */
export function payoutReport(rows, lenders = []) {
  const names = new Map(lenders.map((l) => [l.id, l.name]));
  const by = new Map();
  for (const r of rows || []) {
    const k = `${r.lender_id}|${r.period}|${r.currency}`;
    const cur = by.get(k) || { lenderId: r.lender_id, lender: names.get(r.lender_id) || r.lender_id, period: r.period, currency: r.currency, loans: 0, loanMinor: 0, amountMinor: 0 };
    cur.loans += 1;
    cur.loanMinor += Number(r.loan_minor) || 0;
    cur.amountMinor += Number(r.amount_minor) || 0;
    by.set(k, cur);
  }
  return [...by.values()].sort((a, b) => b.period.localeCompare(a.period) || a.lender.localeCompare(b.lender));
}
