// lib/jobFeePay.js — SERVER only. Paying a fee per won project: by card through the gateway (lib/paymentGateway.js)
// or against VoltMira's invoice by bank transfer, and marking it paid (from the card's callback, the test gateway, or
// a platform admin when a transfer arrives). The amount is always the fee row's, never the browser's; a payment
// confirmed twice is paid once; every change is audited.
import { newOrderId } from "./paymentGateway.js";
import { writeAudit } from "./audit.js";

/** The fee is paid: once, only from "due" (a lost job's void fee is not paid; won again, it is due again). */
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

/**
 * Start a card payment for a due fee. With the test gateway the fee is paid at once.
 * @returns {Promise<{ ok: boolean, paid?: boolean, redirect?: string, form?: object, test?: boolean, error?: string }>}
 */
export async function startCardPayment(db, { fee, gateway, actor = null, returnUrl = "", now = Date.now(), io = {} }) {
  if (!fee || fee.status !== "due") return { ok: false, error: "not_due" };
  const orderId = newOrderId(now);
  const ins = await db.from("job_fee_payments").insert({
    fee_id: fee.id, company_id: fee.company_id, order_id: orderId, method: "card", gateway: gateway.id,
    amount_minor: fee.amount_minor, status: "started", idempotency_key: `card-${orderId}`,
  }).select("id").single();
  if (ins.error) return { ok: false, error: "save_failed" };
  const r = await gateway.start({ orderId, amountMinor: fee.amount_minor, currency: "MDL", description: `VoltMira ${orderId}`, returnUrl });
  if (!r.ok) {
    await db.from("job_fee_payments").update({ status: "failed", reply: { error: r.error }, updated_at: new Date(now).toISOString() }).eq("order_id", orderId);
    return { ok: false, error: r.error || "gateway" };
  }
  if (r.paidNow) {
    await db.from("job_fee_payments").update({ status: "paid", reply: { test: !!gateway.test }, updated_at: new Date(now).toISOString() }).eq("order_id", orderId);
    const p = await markFeePaid(db, { feeId: fee.id, method: "card", ref: orderId, actor, now, io });
    return { ok: p.ok, paid: p.ok, test: !!gateway.test, error: p.error };
  }
  return { ok: true, paid: false, redirect: r.redirect, form: r.form };
}

/**
 * The bank's word on a payment (a verified callback): once per order, and only for the amount that was asked.
 * @param {{ orderId: string, amountMinor: number, approved: boolean, reply?: object }} c
 */
export async function settleCallback(db, c, { now = Date.now(), io = {} } = {}) {
  const { data: pay } = await db.from("job_fee_payments").select("*").eq("order_id", String(c.orderId || "")).maybeSingle();
  if (!pay) return { ok: false, error: "unknown_order" };
  if (pay.status === "paid") return { ok: true, already: true };
  const at = new Date(now).toISOString();
  if (!c.approved) {
    await db.from("job_fee_payments").update({ status: "failed", reply: c.reply || null, updated_at: at }).eq("id", pay.id);
    return { ok: true, approved: false };
  }
  if (Number(c.amountMinor) !== Number(pay.amount_minor)) {
    await db.from("job_fee_payments").update({ status: "failed", reply: { ...(c.reply || {}), mismatch: Number(c.amountMinor) }, updated_at: at }).eq("id", pay.id);
    return { ok: false, error: "amount_mismatch" };
  }
  await db.from("job_fee_payments").update({ status: "paid", reply: c.reply || null, updated_at: at }).eq("id", pay.id);
  return markFeePaid(db, { feeId: pay.fee_id, method: "card", ref: pay.order_id, now, io });
}

/** VoltMira's own details for its invoices, from the environment; null while any is missing. */
export function sellerDetails(env = process.env) {
  const s = {
    name: env.VOLTMIRA_LEGAL_NAME || "", idno: env.VOLTMIRA_IDNO || "", address: env.VOLTMIRA_ADDRESS || "",
    iban: env.VOLTMIRA_IBAN || "", bank: env.VOLTMIRA_BANK || "",
  };
  return s.name && s.idno && s.address && s.iban ? s : null;
}

/** The VAT rate on a fee, percent (0 until VoltMira's VAT status is confirmed: VOLTMIRA_VAT_RATE). */
export const feeVatRate = (env = process.env) => Math.max(0, Math.min(50, Number(env.VOLTMIRA_VAT_RATE) || 0));

/** The payment reference on a transfer: short, from the fee's id. */
export const feeRef = (feeId) => `VM-${String(feeId || "").replace(/-/g, "").slice(0, 10).toUpperCase()}`;

/**
 * VoltMira's invoice for one fee (the transfer, or the record of a card payment): issued once per fee, numbered in
 * the VMF series. Returns the existing one when there is one.
 */
export async function invoiceForFee(db, { fee, company, seller, vatRate = 0, now = Date.now() }) {
  if (!fee || !["due", "paid"].includes(fee.status) || !(fee.amount_minor > 0)) return { ok: false, error: "not_due" };
  if (fee.invoice_id) {
    const { data } = await db.from("job_fee_invoices").select("*").eq("id", fee.invoice_id).maybeSingle();
    if (data) return { ok: true, invoice: data, already: true };
  }
  return invoiceForFees(db, { fees: [fee], company, seller, vatRate, dueAt: fee.grace_ends_at, ref: feeRef(fee.id), now });
}

/** One invoice for several fees (the monthly statement), or one; each fee then points at it. */
export async function invoiceForFees(db, { fees, company, seller, vatRate = 0, dueAt, ref, now = Date.now() }) {
  const list = (fees || []).filter((f) => f && Number(f.amount_minor) > 0);
  if (!list.length) return { ok: false, error: "not_due" };
  if (!seller) return { ok: false, error: "seller" };
  const { data: number, error: nErr } = await db.rpc("next_job_fee_invoice_no");
  if (nErr || !number) return { ok: false, error: "needs_db" };
  const net = list.reduce((s, f) => s + Number(f.amount_minor), 0);
  const vat = Math.round((net * vatRate) / 100);
  const row = {
    number, company_id: list[0].company_id, fee_ids: list.map((f) => f.id),
    buyer: { name: company.legal_name || company.name || "", idno: company.idno || "", address: company.legal_address || "" },
    seller, net_minor: net, vat_rate: vatRate, vat_minor: vat, total_minor: net + vat, currency: "MDL",
    payment_ref: ref || `VM-${String(number).replace(/[^0-9A-Z]/gi, "")}`, issued_at: new Date(now).toISOString(), due_at: dueAt,
  };
  const ins = await db.from("job_fee_invoices").insert(row).select("*").single();
  if (ins.error) return { ok: false, error: "save_failed" };
  await db.from("job_fees").update({ invoice_id: ins.data.id }).in("id", row.fee_ids);
  return { ok: true, invoice: ins.data };
}

/**
 * The 1st of the month (Chișinău): one invoice for each workspace that chose it, with every due fee not yet on an
 * invoice; their 14 days to pay run to the invoice's due date (14 days on), so a fee never locks before its invoice
 * is due.
 */
export async function monthlyStatements(db, { seller, vatRate = 0, now = Date.now() } = {}) {
  const { data: cos, error } = await db.from("companies").select("id, name, legal_name, idno, legal_address").eq("fee_monthly_invoice", true);
  if (error) return { ok: false, needsDb: true };
  const due = new Date(now + 14 * 864e5).toISOString();
  let issued = 0;
  for (const co of cos || []) {
    const { data: fees } = await db.from("job_fees").select("*").eq("company_id", co.id).eq("status", "due").is("invoice_id", null);
    if (!fees?.length) continue;
    const r = await invoiceForFees(db, { fees, company: co, seller, vatRate, dueAt: due, now });
    if (!r.ok) continue;
    issued++;
    // a fee's own 14 days are never shortened: only lengthened to the invoice's due date
    for (const f of fees) if (Date.parse(f.grace_ends_at) < Date.parse(due)) await db.from("job_fees").update({ grace_ends_at: due }).eq("id", f.id);
  }
  return { ok: true, issued };
}
