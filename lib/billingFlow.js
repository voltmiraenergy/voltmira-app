// lib/billingFlow.js — a quote's invoice sent to SFS e-Factura, and the
// payments a client made against it (docs/INTEGRATIONS.md). Written with the
// service role after the route has checked the project is the caller's.
//
// e-Factura: one row per attempt. A new attempt only after the last one was
// rejected or failed; unique(project_id, attempt) turns a double click into
// "in progress" rather than two submissions. The amounts are recomputed on
// the server (lib/invoiceServer.js), never taken from the browser.
import { payloadHash } from "./efactura.js";
import { writeAudit } from "./audit.js";

const missing = (e) => e && (e.code === "42P01" || e.code === "PGRST205" || /does not exist|schema cache/i.test(e.message || ""));
const now = () => new Date().toISOString();

export async function latestEfactura(db, projectId) {
  const { data, error } = await db.from("efactura_submissions").select("*").eq("project_id", projectId).order("attempt", { ascending: false }).limit(1).maybeSingle();
  if (missing(error)) return { needsDb: true, row: null };
  return { needsDb: false, row: data || null };
}

/**
 * @param {object} a
 * @param {string} a.companyId
 * @param {string} a.projectId
 * @param {object} a.invoice   lib/efactura.js buildEfacturaInvoice()
 * @param {object} a.adapter   lib/efactura.js
 * @param {object} a.actor     { id, email }
 */
export async function submitEfactura(db, { companyId, projectId, invoice, adapter, actor }) {
  if (!invoice.number) return { ok: false, error: "no_invoice_no" };
  const { needsDb, row: last } = await latestEfactura(db, projectId);
  if (needsDb) return { ok: false, error: "needs_db" };
  if (last?.status === "accepted") return { ok: false, error: "already_accepted", submission: last };
  if (last?.status === "submitted") return { ok: false, error: "in_progress", submission: last };

  const attempt = (last?.attempt || 0) + 1;
  const ins = await db.from("efactura_submissions").insert({
    company_id: companyId, project_id: projectId, invoice_no: invoice.number, attempt, provider: adapter.id,
    status: "submitted", payload_hash: payloadHash(invoice), gross_minor: invoice.totals.grossMinor, currency: invoice.currency,
  }).select("*").single();
  if (ins.error) return { ok: false, error: ins.error.code === "23505" ? "in_progress" : missing(ins.error) ? "needs_db" : "save_failed" };

  const r = await adapter.submit(invoice);
  const set = r.ok
    ? { status: r.status, sfs_ref: String(r.sfsRef || "").slice(0, 120), fiscal_number: String(r.fiscalNumber || "").slice(0, 120), error_code: String(r.code || "").slice(0, 80), error_message: String(r.message || "").slice(0, 500), updated_at: now() }
    : { status: "error", error_code: String(r.error || "error").slice(0, 80), updated_at: now() };
  await db.from("efactura_submissions").update(set).eq("id", ins.data.id);
  const submission = { ...ins.data, ...set };
  await writeAudit(db, {
    companyId, actor, action: "efactura.submit", entity: "project", entityId: projectId,
    before: last ? { attempt: last.attempt, status: last.status } : null,
    after: { attempt, provider: adapter.id, status: set.status, fiscalNumber: set.fiscal_number || null, error: set.error_code || null, grossMinor: invoice.totals.grossMinor, currency: invoice.currency },
  });
  return r.ok ? { ok: true, submission } : { ok: false, error: set.error_code, submission };
}

/** A submission SFS is still processing: ask again. */
export async function refreshEfactura(db, { companyId, projectId, adapter, actor }) {
  const { needsDb, row } = await latestEfactura(db, projectId);
  if (needsDb) return { ok: false, error: "needs_db" };
  if (!row || row.status !== "submitted") return { ok: true, submission: row, unchanged: true };
  if (!row.sfs_ref) {
    // the attempt never reached SFS (the server stopped mid-way): close it so it can be retried
    const set = { status: "error", error_code: "not_sent", updated_at: now() };
    await db.from("efactura_submissions").update(set).eq("id", row.id);
    return { ok: true, submission: { ...row, ...set } };
  }
  const r = await adapter.status(row.sfs_ref);
  if (!r.ok || r.status === "submitted") return { ok: true, submission: row, unchanged: true };
  const set = { status: r.status, fiscal_number: String(r.fiscalNumber || row.fiscal_number || "").slice(0, 120), error_code: String(r.code || "").slice(0, 80), error_message: String(r.message || "").slice(0, 500), updated_at: now() };
  await db.from("efactura_submissions").update(set).eq("id", row.id);
  await writeAudit(db, { companyId, actor, action: "efactura.status", entity: "project", entityId: projectId, before: { status: row.status }, after: { attempt: row.attempt, status: set.status, fiscalNumber: set.fiscal_number || null } });
  return { ok: true, submission: { ...row, ...set } };
}

/**
 * @param {object} a.payment  lib/billing.js validatePayment().payment
 * @returns {{ ok, payment?, duplicate?, error? }}
 */
export async function recordPayment(db, { companyId, projectId, payment, actor }) {
  const ins = await db.from("payments").insert({ company_id: companyId, project_id: projectId, ...payment, created_by: actor?.id || null }).select("*").single();
  if (ins.error) {
    if (ins.error.code === "23505") {
      const { data } = await db.from("payments").select("*").eq("company_id", companyId).eq("idempotency_key", payment.idempotency_key).maybeSingle();
      return { ok: true, duplicate: true, payment: data };
    }
    return { ok: false, error: missing(ins.error) ? "needs_db" : "save_failed" };
  }
  await writeAudit(db, { companyId, actor, action: "payment.record", entity: "payment", entityId: ins.data.id, before: null, after: { projectId, amountMinor: payment.amount_minor, currency: payment.currency, paidAt: payment.paid_at, method: payment.method } });
  return { ok: true, payment: ins.data };
}

/** A payment recorded by mistake. The audit keeps what it was. */
export async function removePayment(db, { companyId, projectId, paymentId, actor }) {
  const { data: row } = await db.from("payments").select("*").eq("id", paymentId).eq("company_id", companyId).eq("project_id", projectId).maybeSingle();
  if (!row) return { ok: false, error: "not_found" };
  await db.from("payments").delete().eq("id", paymentId).eq("company_id", companyId);
  await writeAudit(db, { companyId, actor, action: "payment.remove", entity: "payment", entityId: paymentId, before: { projectId, amountMinor: row.amount_minor, currency: row.currency, paidAt: row.paid_at, method: row.method, reference: row.reference }, after: null });
  return { ok: true };
}
