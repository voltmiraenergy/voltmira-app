// lib/loanFlow.js — the server side of green financing (docs/FINANCING.md):
// the offers a client's page may show, creating an application from it, and
// moving an application through its statuses (a lender's webhook, its portal,
// the admin). Every function takes the database client and the I/O it needs,
// so lib/loanFlow.test.js runs the whole flow against an in-memory database.
//
// Rules held here, whatever the caller sends:
//   - the amount is recomputed from the offer's frozen price and support,
//     never taken from the browser; the term and limits come from the offer;
//   - one application per idempotency key: a double click or a retry returns
//     the first one;
//   - consent is stored with the application and written to the audit log;
//   - a status only moves forward (lib/loanStatus.js); a repeated event id is
//     a no-op; "funded" books the lender's commission once.
import { quoteLoan, offerApplies } from "./loanMath.js";
import { nextStatus } from "./loanStatus.js";
import { commissionFor, periodOf } from "./commission.js";
import { writeAudit } from "./audit.js";
import { adapterFor } from "./lenderAdapters.js";
import { loanApplicationDocument } from "./loanDocument.js";
import { LENDER_SEED, OFFER_SEED } from "./financingSeed.js";

export const CONSENT_VERSION = "loan-consent-2026-10";

export const missingTable = (e) => !!e && (e.code === "42P01" || e.code === "PGRST205" || /does not exist|schema cache|relation/i.test(e.message || ""));
const clip = (v, n) => String(v ?? "").replace(/\s+/g, " ").trim().slice(0, n);

/**
 * The offers a client's page may show, each with its lender's name (no
 * commission terms, no token hash). Sample offers only for a demo workspace
 * or with FINANCING_SAMPLES=on. Before the SQL runs: the code's samples, for
 * a demo only, marked { needsDb: true }.
 */
export async function listOffersFor(db, { market = "MD", clientKind = null, battery = false, samples = false }) {
  let offers, lenders, needsDb = false;
  const [o, l] = await Promise.all([
    db.from("financing_offers").select("*").eq("active", true),
    db.from("lenders").select("id, code, name, is_sample, active").eq("active", true),
  ]);
  if (o.error || l.error) {
    if (!missingTable(o.error || l.error)) return { offers: [], needsDb: false };
    needsDb = true; offers = OFFER_SEED; lenders = LENDER_SEED;
  } else { offers = o.data || []; lenders = l.data || []; }
  const byId = new Map(lenders.map((x) => [x.id, x]));
  const out = offers
    .filter((f) => byId.has(f.lender_id) && (samples || !f.is_sample) && offerApplies(f, { market, clientKind, battery }))
    .map((f) => ({ ...f, lender: { id: f.lender_id, code: byId.get(f.lender_id).code, name: byId.get(f.lender_id).name } }))
    .sort((a, b) => a.rate_bps - b.rate_bps);
  return { offers: out, needsDb };
}

/**
 * A homeowner applies from their offer.
 * @param {object} db   service-role client
 * @param {object} a
 * @param {object} a.prop        { code, company_id, project_id }
 * @param {number} a.priceMinor  the offer's price, frozen in its snapshot, in bani
 * @param {number} a.supportMinor  the sure support frozen with it
 * @param {object} a.input       { offerId, termMonths, name, phone, email, locality, consent, idempotencyKey }
 * @param {object} a.meta        { ip, ua, now }
 * @param {object} a.io          adapter I/O (lib/lenderAdapters.js)
 * @param {object} a.company     { name, legal_name }
 * @param {object} [a.project]   { title, kw }
 * @param {boolean} [a.samples]  sample offers allowed (a demo workspace)
 * @returns {Promise<{ ok: true, application, duplicate? } | { ok: false, error, status }>}
 */
export async function createApplication(db, { prop, priceMinor, supportMinor = 0, input, meta = {}, io, company = {}, project = {}, samples = false }) {
  const name = clip(input?.name, 120), phone = clip(input?.phone, 30).replace(/[^\d+()\s-]/g, ""), email = clip(input?.email, 160), locality = clip(input?.locality, 80);
  const key = clip(input?.idempotencyKey, 80);
  if (input?.consent !== true) return { ok: false, error: "consent", status: 400 };
  if (name.length < 2 || phone.replace(/\D/g, "").length < 6) return { ok: false, error: "details", status: 400 };
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { ok: false, error: "details", status: 400 };
  if (key.length < 8) return { ok: false, error: "idempotency", status: 400 };

  // the same click twice, or a retry: the first application
  const prior = await db.from("loan_applications").select("*").eq("proposal_code", prop.code).eq("idempotency_key", key).maybeSingle();
  if (prior.error && missingTable(prior.error)) return { ok: false, error: "needs_db", status: 503 };
  if (prior.data) return { ok: true, application: prior.data, duplicate: true };

  const { data: offer } = await db.from("financing_offers").select("*").eq("id", String(input?.offerId || "")).maybeSingle();
  if (!offer || offer.active === false || (offer.is_sample && !samples)) return { ok: false, error: "offer", status: 400 };
  const { data: lender } = await db.from("lenders").select("*").eq("id", offer.lender_id).maybeSingle();
  if (!lender || lender.active === false) return { ok: false, error: "offer", status: 400 };
  const loan = quoteLoan({ offer, priceMinor, supportMinor, termMonths: Number(input?.termMonths) });
  if (!loan.ok) return { ok: false, error: loan.error, status: 400 };

  const now = meta.now || new Date().toISOString();
  const row = {
    company_id: prop.company_id, project_id: prop.project_id || null, proposal_code: prop.code,
    offer_id: offer.id, lender_id: lender.id,
    amount_minor: loan.amountMinor, currency: offer.currency || "MDL", term_months: loan.termMonths, rate_bps: loan.rateBps,
    monthly_minor: loan.monthlyMinor, fee_minor: loan.feeMinor, support_minor: Math.max(0, Math.round(supportMinor || 0)),
    applicant: { name, phone, email, locality },
    consent_version: CONSENT_VERSION, consent_at: now, consent_ip: clip(meta.ip, 64), consent_ua: clip(meta.ua, 300),
    status: "submitted", idempotency_key: key,
  };
  const ins = await db.from("loan_applications").insert(row).select("*").single();
  if (ins.error?.code === "23505") {
    const again = await db.from("loan_applications").select("*").eq("proposal_code", prop.code).eq("idempotency_key", key).maybeSingle();
    if (again.data) return { ok: true, application: again.data, duplicate: true };
  }
  if (ins.error) return { ok: false, error: missingTable(ins.error) ? "needs_db" : "save_failed", status: missingTable(ins.error) ? 503 : 500 };
  const app = ins.data;
  await writeAudit(db, { companyId: app.company_id, actor: { email: "homeowner" }, action: "loan.consent", entity: "loan_application", entityId: app.id,
    before: null, after: { consent_version: app.consent_version, consent_at: app.consent_at, consent_ip: app.consent_ip, lender: lender.code } });

  // to the lender
  const document = loanApplicationDocument({ app, lender, offer, company, project });
  let sent;
  try { sent = await adapterFor(lender, io).submit(app, { lender, document }); }
  catch (e) { sent = { ok: false, error: e?.message || "adapter_threw", retryable: true }; }
  const patch = sent.ok ? { channel: sent.channel, lender_ref: clip(sent.ref, 120) } : { status: "failed" };
  await db.from("loan_applications").update({ ...patch, updated_at: now }).eq("id", app.id);
  await db.from("loan_status_events").insert({
    application_id: app.id, company_id: app.company_id, from_status: "", to_status: sent.ok ? "submitted" : "failed",
    source: "adapter", event_id: `submit-${app.id}`, note: sent.ok ? clip(sent.ref, 120) : clip(sent.error, 200),
  });
  const after = { ...app, ...patch };
  await writeAudit(db, { companyId: app.company_id, actor: { email: "system" }, action: sent.ok ? "loan.submit" : "loan.submit_failed", entity: "loan_application", entityId: app.id, before: { status: "" }, after: { status: after.status, channel: after.channel || "", lender_ref: after.lender_ref || "", error: sent.ok ? undefined : sent.error } });
  return { ok: true, application: after, lender, delivered: sent.ok };
}

/**
 * Send an application that did not reach its lender again (the admin's
 * "Resend"). On success it goes back to "submitted" with the adapter's
 * reference; on failure it stays "failed" and says why.
 * @returns {Promise<{ ok: true, application } | { ok: false, error, status, application? }>}
 */
export async function resendApplication(db, { applicationId, io, actor = null, now }) {
  const { data: app } = await db.from("loan_applications").select("*").eq("id", String(applicationId || "")).maybeSingle();
  if (!app) return { ok: false, error: "not_found", status: 404 };
  if (app.status !== "failed") return { ok: false, error: "not_failed", status: 409 };
  const [{ data: lender }, { data: offer }, { data: company }, { data: project }] = await Promise.all([
    db.from("lenders").select("*").eq("id", app.lender_id).maybeSingle(),
    db.from("financing_offers").select("*").eq("id", app.offer_id).maybeSingle(),
    db.from("companies").select("name, legal_name").eq("id", app.company_id).maybeSingle(),
    app.project_id ? db.from("projects").select("title, kw").eq("id", app.project_id).maybeSingle() : Promise.resolve({ data: null }),
  ]);
  if (!lender) return { ok: false, error: "not_found", status: 404 };
  const document = loanApplicationDocument({ app, lender, offer, company: company || {}, project: project || {} });
  let sent;
  try { sent = await adapterFor(lender, io).submit(app, { lender, document }); }
  catch (e) { sent = { ok: false, error: e?.message || "adapter_threw" }; }
  if (!sent.ok) {
    await writeAudit(db, { companyId: app.company_id, actor, action: "loan.resend_failed", entity: "loan_application", entityId: app.id, before: { status: "failed" }, after: { status: "failed", error: sent.error } });
    return { ok: false, error: sent.error, status: 502, application: app };
  }
  await db.from("loan_applications").update({ channel: sent.channel, lender_ref: clip(sent.ref, 120) }).eq("id", app.id);
  return applyStatus(db, { applicationId: app.id, to: "submitted", source: "admin", eventId: `resend-${Date.parse(now || new Date().toISOString())}`, note: clip(sent.ref, 120), actor, now });
}

/**
 * Move an application to a new status: a lender's webhook, its portal, the
 * admin. A repeated event id changes nothing; a step backwards is refused;
 * "funded" books the commission once.
 * @returns {Promise<{ ok: true, application, duplicate?, same?, commission? } | { ok: false, error, status }>}
 */
export async function applyStatus(db, { applicationId, to, source, eventId, note = "", lenderRef = "", actor = null, lenderId = null, now }) {
  const { data: app, error } = await db.from("loan_applications").select("*").eq("id", String(applicationId || "")).maybeSingle();
  if (error && missingTable(error)) return { ok: false, error: "needs_db", status: 503 };
  if (!app) return { ok: false, error: "not_found", status: 404 };
  if (lenderId && app.lender_id !== lenderId) return { ok: false, error: "not_found", status: 404 };   // a lender sees only its own
  const ev = clip(eventId, 120);
  if (!ev) return { ok: false, error: "event_id", status: 400 };

  // already applied: the same delivery again
  const seen = await db.from("loan_status_events").select("id").eq("application_id", app.id).eq("event_id", ev).maybeSingle();
  if (seen.data) return { ok: true, application: app, duplicate: true };

  const step = nextStatus(app.status, to);
  if (!step.ok) return { ok: false, error: step.error, status: 409 };
  if (step.same && !lenderRef) return { ok: true, application: app, same: true };

  const at = now || new Date().toISOString();
  const wasFunded = app.status === "funded";
  const evIns = await db.from("loan_status_events").insert({
    application_id: app.id, company_id: app.company_id, from_status: app.status, to_status: to, source, event_id: ev, note: clip(note, 500),
  });
  if (evIns.error?.code === "23505") return { ok: true, application: app, duplicate: true };
  if (evIns.error) return { ok: false, error: "save_failed", status: 500 };
  const patch = { status: to, updated_at: at, ...(lenderRef ? { lender_ref: clip(lenderRef, 120) } : {}) };
  await db.from("loan_applications").update(patch).eq("id", app.id);
  const after = { ...app, ...patch };
  await writeAudit(db, { companyId: app.company_id, actor, action: "loan.status", entity: "loan_application", entityId: app.id, before: { status: app.status }, after: { status: to, source, event_id: ev } });

  let commission = null;
  if (to === "funded" && !wasFunded) {
    const { data: lender } = await db.from("lenders").select("*").eq("id", app.lender_id).maybeSingle();
    const c = commissionFor(lender || {}, app.amount_minor);
    const ins = await db.from("commission_ledger").insert({
      lender_id: app.lender_id, application_id: app.id, company_id: app.company_id,
      amount_minor: c.amountMinor, currency: c.currency, basis: c.basis, rate_bps: c.rateBps, loan_minor: c.loanMinor, period: periodOf(at),
    });
    if (!ins.error) {
      commission = c;
      await writeAudit(db, { companyId: null, actor, action: "commission.accrue", entity: "loan_application", entityId: app.id, before: null, after: { amount_minor: c.amountMinor, currency: c.currency, period: periodOf(at) } });
    }
  }
  return { ok: true, application: after, commission };
}
