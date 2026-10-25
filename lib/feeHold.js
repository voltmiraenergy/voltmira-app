// lib/feeHold.js — SERVER only. How far a workspace is held for an unpaid VoltMira statement (lib/jobFees.js
// holdLevel): 1 its jobs' paperwork is locked, 2 no new offers (30 days late), 3 read-only (60 days late). The
// database enforces 2 and 3 itself (add-fee-lockdown.sql fee_hold_level and its row rules); this gives the app the
// same answer first, so it can say why in words instead of failing on a row rule. Nothing while JOB_FEES is off.
import { holdLevel, feePaywallOn, feeLei } from "./jobFees.js";

/**
 * @returns {Promise<{ level: 0|1|2|3, daysLate: number, month: string|null, owedMinor: number, invoiceId: string|null }>}
 */
export async function holdFor(db, companyId, { now = Date.now(), on = feePaywallOn() } = {}) {
  const none = { level: 0, daysLate: 0, month: null, owedMinor: 0, invoiceId: null };
  if (!on || !companyId) return none;
  const { data: invs, error } = await db.from("job_fee_invoices").select("id, month, due_at, paid_at, fee_ids").eq("company_id", companyId).is("paid_at", null).not("month", "is", null);
  if (error || !invs?.length) return none;
  const ids = invs.flatMap((i) => i.fee_ids || []);
  const { data: fees } = ids.length ? await db.from("job_fees").select("id, status, amount_minor").in("id", ids) : { data: [] };
  const due = new Map((fees || []).filter((f) => f.status === "due").map((f) => [f.id, Number(f.amount_minor) || 0]));
  const statements = invs.map((i) => ({ ...i, owed_minor: (i.fee_ids || []).reduce((t, id) => t + (due.get(id) || 0), 0) }));
  const h = holdLevel(statements, now);
  if (!h.level) return none;
  // the statement that sets the level: the oldest one still owing
  const worst = statements.filter((s) => s.owed_minor > 0 && Date.parse(s.due_at) <= now).sort((a, b) => Date.parse(a.due_at) - Date.parse(b.due_at))[0];
  return { ...h, month: worst?.month || null, owedMinor: worst?.owed_minor || 0, invoiceId: worst?.id || null };
}

/** Thrown where an offer would be made or sent while the workspace is held at level 2 or more. */
export class FeeHoldError extends Error {
  constructor(level) { super(level >= 3 ? "fee_hold_readonly" : "fee_hold_offers"); this.code = this.message; }
}

/** Refuse a new offer (or a change to one) while held at level 2 or more. */
export async function assertCanSendOffers(db, companyId, o = {}) {
  const h = await holdFor(db, companyId, o);
  if (h.level >= 2) throw new FeeHoldError(h.level);
  return h;
}

export { feeLei };
