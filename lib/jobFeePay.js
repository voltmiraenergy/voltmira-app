// lib/jobFeePay.js — SERVER only. Billing the fees for signed jobs (lib/jobFees.js): one statement per workspace at
// the start of each month for the jobs signed the month before, VoltMira's invoice in its own series, paid by bank
// transfer within 14 days; a platform admin marks it paid when the transfer arrives. Amounts are always the fee rows',
// never typed; every change is audited.
import { writeAudit } from "./audit.js";
import { feeMonth, statementDue } from "./jobFees.js";

/** A fee is paid: once, only from "due" (a cancelled job's void fee is not paid). */
export async function markFeePaid(db, { feeId, method, ref = "", actor = null, now = Date.now(), io = {} }) {
  const at = new Date(now).toISOString();
  const { data, error } = await db.from("job_fees").update({ status: "paid", paid_at: at, payment_method: method, payment_ref: String(ref).slice(0, 120), updated_at: at })
    .eq("id", feeId).eq("status", "due").select("*");
  if (error) return { ok: false, error: "save_failed" };
  const fee = Array.isArray(data) ? data[0] : data;
  if (!fee) {
    const { data: cur } = await db.from("job_fees").select("*").eq("id", feeId).maybeSingle();
    return cur?.status === "paid" ? { ok: true, already: true, fee: cur } : { ok: false, error: "not_due", fee: cur || null };
  }
  await writeAudit(db, { companyId: fee.company_id, actor, action: "job_fee.paid", entity: "job_fee", entityId: fee.id, before: { status: "due" }, after: { status: "paid", method, ref, amount_minor: fee.amount_minor } });
  if (io.logActivity) {
    await io.logActivity(db, { companyId: fee.company_id, kind: "sys", key: "act_fee_paid", params: { n: Math.round(fee.amount_minor / 100) }, text: `Fee paid: ${Math.round(fee.amount_minor / 100)} lei`, link: `/projects/${fee.project_id}` });
  }
  return { ok: true, fee };
}

/** VoltMira's own details for its invoices, from the environment; null while any is missing. */
export function sellerDetails(env = process.env) {
  const s = {
    name: env.VOLTMIRA_LEGAL_NAME || "", idno: env.VOLTMIRA_IDNO || "", address: env.VOLTMIRA_ADDRESS || "",
    iban: env.VOLTMIRA_IBAN || "", bank: env.VOLTMIRA_BANK || "",
  };
  return s.name && s.idno && s.address && s.iban ? s : null;
}

/** The VAT rate on the fees, percent (0 until VoltMira's VAT status is confirmed: VOLTMIRA_VAT_RATE). */
export const feeVatRate = (env = process.env) => Math.max(0, Math.min(50, Number(env.VOLTMIRA_VAT_RATE) || 0));

/** The reference a statement's transfer carries: its number without the dashes ("VMF2026000012"). */
export const statementRef = (number) => String(number || "").replace(/[^0-9A-Z]/gi, "").toUpperCase();

/**
 * One statement: an invoice for several fees, each then pointing at it.
 * @returns {Promise<{ ok: boolean, invoice?: object, error?: string }>}
 */
export async function invoiceForFees(db, { fees, company, seller, vatRate = 0, month, dueAt, now = Date.now() }) {
  const list = (fees || []).filter((f) => f && Number(f.amount_minor) > 0);
  if (!list.length) return { ok: false, error: "not_due" };
  if (!seller) return { ok: false, error: "seller" };
  const { data: number, error: nErr } = await db.rpc("next_job_fee_invoice_no");
  if (nErr || !number) return { ok: false, error: "needs_db" };
  const net = list.reduce((s, f) => s + Number(f.amount_minor), 0);
  const vat = Math.round((net * vatRate) / 100);
  const row = {
    number, company_id: list[0].company_id, fee_ids: list.map((f) => f.id), month: month || null,
    buyer: { name: company.legal_name || company.name || "", idno: company.idno || "", address: company.legal_address || "" },
    seller, net_minor: net, vat_rate: vatRate, vat_minor: vat, total_minor: net + vat, currency: "MDL",
    payment_ref: statementRef(number), issued_at: new Date(now).toISOString(), due_at: dueAt,
  };
  const ins = await db.from("job_fee_invoices").insert(row).select("*").single();
  if (ins.error) return { ok: false, error: ins.error.code === "23505" ? "exists" : "save_failed" };
  await db.from("job_fees").update({ invoice_id: ins.data.id }).in("id", row.fee_ids);
  return { ok: true, invoice: ins.data };
}

/** The month before `now`'s (Chișinău): on 1 November, "2026-10". */
export function previousMonth(now = Date.now()) {
  const m = feeMonth(new Date(now).toISOString());
  const [y, mo] = m.split("-").map(Number);
  return mo === 1 ? `${y - 1}-12` : `${y}-${String(mo - 1).padStart(2, "0")}`;
}

/**
 * The monthly statements: for each workspace, one invoice with every fee still due from jobs signed in `month` and
 * not yet on a statement; it is paid by the 15th (the fees already carry that date). Run on the 1st; safe to run
 * again (one statement per workspace and month).
 */
export async function monthlyStatements(db, { seller, vatRate = 0, month: m = null, now = Date.now(), io = null } = {}) {
  const month = m || previousMonth(now);
  const { data: fees, error } = await db.from("job_fees").select("*").eq("status", "due").is("invoice_id", null);
  if (error) return { ok: false, needsDb: true };
  const inMonth = (fees || []).filter((f) => feeMonth(f.won_at) === month);
  const byCo = new Map();
  for (const f of inMonth) byCo.set(f.company_id, [...(byCo.get(f.company_id) || []), f]);
  let issued = 0;
  for (const [companyId, list] of byCo) {
    const { data: co } = await db.from("companies").select("id, name, legal_name, idno, legal_address, lang").eq("id", companyId).maybeSingle();
    if (!co) continue;
    const r = await invoiceForFees(db, { fees: list, company: co, seller, vatRate, month, dueAt: statementDue(month), now });
    if (!r.ok) continue;
    issued++;
    if (io?.onIssued) await io.onIssued({ company: co, invoice: r.invoice, fees: list });
  }
  return { ok: true, issued, month };
}

/** A statement's transfer arrived: every fee on it that is still due is paid, and the statement too. */
export async function markStatementPaid(db, { invoiceId, ref = "", actor = null, now = Date.now(), io = {} }) {
  const { data: inv } = await db.from("job_fee_invoices").select("*").eq("id", invoiceId).maybeSingle();
  if (!inv) return { ok: false, error: "not_found" };
  if (inv.paid_at) return { ok: true, already: true };
  for (const feeId of inv.fee_ids || []) await markFeePaid(db, { feeId, method: "transfer", ref: ref || inv.payment_ref, actor, now, io });
  const at = new Date(now).toISOString();
  await db.from("job_fee_invoices").update({ paid_at: at }).eq("id", inv.id).is("paid_at", null);
  await writeAudit(db, { companyId: inv.company_id, actor, action: "job_fee.statement_paid", entity: "job_fee_invoice", entityId: inv.id, before: { paid_at: null }, after: { paid_at: at, ref: ref || inv.payment_ref, total_minor: inv.total_minor } });
  return { ok: true };
}
