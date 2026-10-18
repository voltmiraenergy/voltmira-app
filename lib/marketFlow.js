// lib/marketFlow.js — a homeowner's request from the public funnel, routed to
// verified installers (docs/MARKETPLACE.md). Written with the service role.
//
//   create   the request stored (consent, what the homeowner was shown, a
//            status link for them), then offered to the best matches
//   respond  an installer accepts (the request becomes a lead in their
//            workspace, and only then do they see the contact) or declines
//   sweep    offers past their answer time expire; a declined or expired
//            offer passes the request to the next installer in line; with
//            nobody left and nobody accepting, the request is unmatched
// Every offer change is an append-only event; the request's own status
// follows its offers. io: { createLead(companyId, request) -> leadId,
// notifyInstaller({ companyId, offer, request }), notifyHomeowner({ request, kind, companyIds }) }
import crypto from "node:crypto";
import { rankInstallers, respondBy, nextOfferStatus, overdueOffers, backfillCount, requestStatus, ratingSummary } from "./marketplace.js";
import { writeAudit } from "./audit.js";

const missing = (e) => e && (e.code === "42P01" || e.code === "PGRST205" || /does not exist|schema cache/i.test(e.message || ""));
export const CONSENT_VERSION = "marketplace-2026-10";
export const TARGET_OFFERS = 3;
export const hashToken = (t) => crypto.createHash("sha256").update(String(t)).digest("hex");

/** Every candidate installer's profile, rating and recent answering record. */
async function candidates(db, now) {
  const since = new Date(now - 90 * 864e5).toISOString();
  const [{ data: profiles }, { data: reviews }, { data: offers }] = await Promise.all([
    db.from("installer_profiles").select("*").eq("verification", "verified").eq("published", true).eq("accepting", true),
    db.from("reviews").select("company_id, rating, hidden"),
    db.from("lead_offers").select("company_id, status, offered_at").gte("offered_at", since),
  ]);
  const facts = new Map();
  for (const p of profiles || []) {
    const mine = (offers || []).filter((o) => o.company_id === p.company_id);
    facts.set(p.company_id, {
      rating: ratingSummary((reviews || []).filter((r) => r.company_id === p.company_id)),
      stats: { offered: mine.length, answered: mine.filter((o) => o.status === "accepted" || o.status === "declined").length, waiting: mine.filter((o) => o.status === "offered").length },
    });
  }
  return { profiles: profiles || [], facts };
}

/** Offer the request to up to `count` more installers. */
async function offerTo(db, request, { count, exclude, now, io }) {
  if (count <= 0) return [];
  const { profiles, facts } = await candidates(db, now);
  const picks = rankInstallers({ raion: request.raion, kw: Number(request.kw) }, profiles, facts, { exclude, n: count, today: new Date(now).toISOString().slice(0, 10) });
  const made = [];
  const at = new Date(now).toISOString();
  for (const pk of picks) {
    const prof = profiles.find((p) => p.company_id === pk.company_id);
    const rank = exclude.length + made.length + 1;
    const ins = await db.from("lead_offers").insert({ request_id: request.id, company_id: pk.company_id, rank, score: pk.score, status: "offered", offered_at: at, respond_by: respondBy(at, prof?.sla_hours || 24) }).select("*").single();
    if (ins.error) continue;
    await db.from("lead_offer_events").insert({ offer_id: ins.data.id, request_id: request.id, company_id: pk.company_id, from_status: "", to_status: "offered", source: "router", event_id: `offer-${ins.data.id}` });
    await io?.notifyInstaller?.({ companyId: pk.company_id, offer: ins.data, request });
    made.push(ins.data);
  }
  return made;
}

/** Bring the request's status in line with its offers, and tell the homeowner when it changes. */
async function settle(db, request, { exhausted, io }) {
  const { data: offers } = await db.from("lead_offers").select("*").eq("request_id", request.id);
  const status = requestStatus(offers || [], { exhausted });
  if (status !== request.status) {
    await db.from("quote_requests").update({ status, updated_at: new Date().toISOString() }).eq("id", request.id);
    if (status === "unmatched") await io?.notifyHomeowner?.({ request, kind: "unmatched", companyIds: [] });
  }
  return status;
}

/**
 * @param {object} a.input  { lang, address, raion, lat, lon, cons_kwh_year, kw, estimate, name, phone, email, idempotencyKey }
 * @returns {{ ok, request?, statusToken?, offers?, duplicate? }}
 */
export async function createRequest(db, { input, ip = "", now = Date.now(), io }) {
  const token = crypto.randomBytes(18).toString("base64url");
  const row = {
    lang: input.lang, market: "MD", address: input.address, raion: input.raion || "", lat: input.lat ?? null, lon: input.lon ?? null,
    cons_kwh_year: input.cons_kwh_year, kw: input.kw, estimate: input.estimate || {}, name: input.name, phone: input.phone || "", email: input.email || "",
    consent_version: CONSENT_VERSION, consent_at: new Date(now).toISOString(), consent_ip: String(ip || "").slice(0, 64),
    status: "open", status_token_hash: hashToken(token), idempotency_key: input.idempotencyKey,
  };
  const ins = await db.from("quote_requests").insert(row).select("*").single();
  if (ins.error) {
    if (ins.error.code === "23505") return { ok: true, duplicate: true };
    return { ok: false, error: missing(ins.error) ? "needs_db" : "save_failed" };
  }
  const request = ins.data;
  await writeAudit(db, { companyId: null, actor: null, action: "request.create", entity: "quote_request", entityId: request.id, after: { raion: request.raion, kw: request.kw, consent: CONSENT_VERSION } });
  const offers = await offerTo(db, request, { count: TARGET_OFFERS, exclude: [], now, io });
  await settle(db, request, { exhausted: offers.length === 0, io });
  await io?.notifyHomeowner?.({ request, kind: offers.length ? "sent" : "unmatched", companyIds: offers.map((o) => o.company_id), statusToken: token });
  return { ok: true, request, statusToken: token, offers };
}

/** An installer's answer. */
export async function respondOffer(db, { companyId, offerId, accept, reason = "", actor = null, now = Date.now(), io }) {
  const { data: offer, error } = await db.from("lead_offers").select("*").eq("id", offerId).maybeSingle();
  if (missing(error)) return { ok: false, error: "needs_db" };
  if (!offer || offer.company_id !== companyId) return { ok: false, error: "not_found" };
  const to = accept ? "accepted" : "declined";
  if (accept && offer.status === "offered" && Date.parse(offer.respond_by) <= now) return { ok: false, error: "expired" };
  const step = nextOfferStatus(offer.status, to);
  if (!step.ok) return { ok: false, error: step.error, offer };
  if (step.same) return { ok: true, already: true, offer };
  const { data: request } = await db.from("quote_requests").select("*").eq("id", offer.request_id).maybeSingle();
  if (!request) return { ok: false, error: "not_found" };

  const set = { status: to, responded_at: new Date(now).toISOString(), decline_reason: accept ? "" : String(reason || "").slice(0, 300) };
  if (accept) set.lead_id = await io.createLead(companyId, request);
  await db.from("lead_offers").update(set).eq("id", offer.id).eq("status", "offered");
  await db.from("lead_offer_events").insert({ offer_id: offer.id, request_id: offer.request_id, company_id: companyId, from_status: offer.status, to_status: to, source: "installer", event_id: `answer-${offer.id}`, note: set.decline_reason });
  await writeAudit(db, { companyId, actor, action: accept ? "request.accept" : "request.decline", entity: "lead_offer", entityId: offer.id, before: { status: offer.status }, after: { status: to, leadId: set.lead_id || null } });
  if (accept) await io?.notifyHomeowner?.({ request, kind: "accepted", companyIds: [companyId] });
  else await passOn(db, request, { now, io });
  await settle(db, request, { exhausted: false, io });
  return { ok: true, offer: { ...offer, ...set } };
}

/** After a decline or an expiry: the next installer in line, if any. */
async function passOn(db, request, { now, io }) {
  const { data: offers } = await db.from("lead_offers").select("company_id, status").eq("request_id", request.id);
  const made = await offerTo(db, request, { count: backfillCount(offers || [], TARGET_OFFERS), exclude: (offers || []).map((o) => o.company_id), now, io });
  const live = (offers || []).some((o) => o.status === "offered" || o.status === "accepted") || made.length > 0;
  await settle(db, request, { exhausted: !live, io });
}

/** Expire overdue offers and pass their requests on. Safe to run any time; returns counts. */
export async function sweepOffers(db, { now = Date.now(), io } = {}) {
  const { data: open, error } = await db.from("lead_offers").select("*").eq("status", "offered").limit(500);
  if (error) return { expired: 0 };
  const due = overdueOffers(open || [], now);
  const touched = new Set();
  for (const o of due) {
    await db.from("lead_offers").update({ status: "expired", responded_at: new Date(now).toISOString() }).eq("id", o.id).eq("status", "offered");
    const ev = await db.from("lead_offer_events").insert({ offer_id: o.id, request_id: o.request_id, company_id: o.company_id, from_status: "offered", to_status: "expired", source: "sweep", event_id: `expire-${o.id}` });
    if (!ev.error) touched.add(o.request_id);
  }
  for (const rid of touched) {
    const { data: request } = await db.from("quote_requests").select("*").eq("id", rid).maybeSingle();
    if (request && request.status !== "closed") await passOn(db, request, { now, io });
  }
  return { expired: touched.size ? due.length : 0 };
}
