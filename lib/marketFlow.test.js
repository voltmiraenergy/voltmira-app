import { test } from "node:test";
import assert from "node:assert/strict";
import { fakeDb } from "./fakeDb.testutil.js";
import { createRequest, respondOffer, sweepOffers, hashToken } from "./marketFlow.js";

const NOW = Date.parse("2026-10-18T10:00:00Z");
const P = (id, over = {}) => ({ company_id: id, verification: "verified", licence_valid_to: "2027-06-30", insurance_valid_to: "2027-06-30", published: true, accepting: true, regions: ["ialoveni"], min_kw: 2, max_kw: 20, sla_hours: 24, ...over });
const db0 = (profiles) => fakeDb({ installer_profiles: profiles, reviews: [{ company_id: "B", rating: 5 }, { company_id: "B", rating: 5 }, { company_id: "B", rating: 5 }], lead_offers: [], lead_offer_events: [], quote_requests: [], audit_log: [] },
  { quote_requests: [["idempotency_key"]], lead_offers: [["request_id", "company_id"]], lead_offer_events: [["offer_id", "event_id"]] });
const io0 = () => {
  const log = { inst: [], home: [], leads: [] };
  return { log, io: {
    createLead: async (companyId, r) => { log.leads.push([companyId, r.name]); return `lead-${companyId}`; },
    notifyInstaller: async ({ companyId }) => { log.inst.push(companyId); },
    notifyHomeowner: async ({ kind, companyIds }) => { log.home.push([kind, companyIds.join("")]); },
  } };
};
const INPUT = { lang: "ro", address: "s. Horești, Ialoveni", raion: "ialoveni", cons_kwh_year: 4800, kw: 4, estimate: { kw: 4 }, name: "Ion Rusu", phone: "069000111", email: "ion@x.md", idempotencyKey: "k-123456789" };

test("a request goes to the three best matches; the homeowner gets a status link; the contact is stored, not offered", async () => {
  const db = db0([P("A"), P("B"), P("C"), P("D"), P("E", { regions: ["balti"] })]);
  const { log, io } = io0();
  const r = await createRequest(db, { input: INPUT, ip: "1.2.3.4", now: NOW, io });
  assert.equal(r.ok, true);
  assert.equal(r.offers.length, 3);
  assert.equal(r.offers[0].company_id, "B", "the best rated first");
  assert.ok(!r.offers.map((o) => o.company_id).includes("E"), "not in their region");
  assert.equal(r.offers[0].respond_by, "2026-10-19T10:00:00.000Z");
  assert.equal(db.T.quote_requests[0].status_token_hash, hashToken(r.statusToken));
  assert.equal(db.T.quote_requests[0].consent_ip, "1.2.3.4");
  assert.deepEqual(log.home, [["sent", r.offers.map((o) => o.company_id).join("")]]);
  assert.equal(log.inst.length, 3);
  assert.deepEqual((await createRequest(db, { input: INPUT, now: NOW, io })), { ok: true, duplicate: true }, "the same click twice: one request");
});

test("accept: a lead in the installer's workspace, the homeowner told; decline: the next installer in line", async () => {
  const db = db0([P("A"), P("B"), P("C"), P("D")]);
  const { log, io } = io0();
  const r = await createRequest(db, { input: INPUT, now: NOW, io });
  const [first, second] = r.offers;
  const acc = await respondOffer(db, { companyId: first.company_id, offerId: first.id, accept: true, now: NOW + 3600e3, io });
  assert.equal(acc.ok, true);
  assert.equal(acc.offer.lead_id, `lead-${first.company_id}`);
  assert.deepEqual(log.leads, [[first.company_id, "Ion Rusu"]]);
  assert.equal(db.T.quote_requests[0].status, "accepted");
  assert.deepEqual(log.home.at(-1), ["accepted", first.company_id]);
  const dec = await respondOffer(db, { companyId: second.company_id, offerId: second.id, accept: false, reason: "prea departe", now: NOW + 3600e3, io });
  assert.equal(dec.ok, true);
  assert.equal(db.T.lead_offers.length, 4, "the fourth installer got it");
  assert.equal(db.T.lead_offers[3].company_id, "D");
  assert.equal(db.T.lead_offers[3].rank, 4);
  assert.equal((await respondOffer(db, { companyId: second.company_id, offerId: second.id, accept: true, now: NOW, io })).error, "bad_transition");
  assert.equal((await respondOffer(db, { companyId: "Z", offerId: first.id, accept: true, io })).error, "not_found", "another workspace");
  assert.deepEqual(db.T.audit_log.map((a) => a.action), ["request.create", "request.accept", "request.decline"]);
});

test("the clock: overdue offers expire and pass on; with nobody left, the request is unmatched", async () => {
  const db = db0([P("A"), P("B")]);
  const { log, io } = io0();
  const r = await createRequest(db, { input: INPUT, now: NOW, io });
  assert.equal(r.offers.length, 2);
  assert.equal((await respondOffer(db, { companyId: r.offers[0].company_id, offerId: r.offers[0].id, accept: true, now: NOW + 25 * 3600e3, io })).error, "expired", "too late to accept");
  const s = await sweepOffers(db, { now: NOW + 25 * 3600e3, io });
  assert.equal(s.expired, 2);
  assert.deepEqual(db.T.lead_offers.map((o) => o.status), ["expired", "expired"]);
  assert.equal(db.T.quote_requests[0].status, "unmatched");
  assert.deepEqual(log.home.at(-1), ["unmatched", ""]);
  assert.deepEqual(await sweepOffers(db, { now: NOW + 26 * 3600e3, io }), { expired: 0 }, "again: nothing to do");
  // nobody in the region at all
  const empty = db0([P("A", { regions: ["balti"] })]);
  const e = await createRequest(empty, { input: { ...INPUT, idempotencyKey: "k-999999999" }, now: NOW, io });
  assert.equal(e.offers.length, 0);
  assert.equal(empty.T.quote_requests[0].status, "unmatched");
  assert.equal((await createRequest(fakeDb({ audit_log: [] }), { input: INPUT, now: NOW, io })).error, "needs_db");
});
