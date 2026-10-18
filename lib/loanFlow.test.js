import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createApplication, applyStatus, listOffersFor, resendApplication, CONSENT_VERSION } from "./loanFlow.js";
import { LENDER_SEED, OFFER_SEED } from "./financingSeed.js";

// ---- a small in-memory stand-in for the Supabase client: the calls the flow
// makes, the unique constraints of supabase/add-financing.sql, and the error a
// missing table gives.
function fakeDb(tables, unique = {}) {
  const T = structuredClone(tables);
  let n = 0;
  class Q {
    constructor(name) { this.name = name; this.f = []; this.op = "select"; this.ret = false; }
    select() { if (this.op !== "select") this.ret = true; return this; }
    eq(c, v) { this.f.push([c, v]); return this; }
    order() { return this; }
    limit() { return this; }
    insert(p) { this.op = "insert"; this.p = p; return this; }
    update(p) { this.op = "update"; this.p = p; return this; }
    maybeSingle() { this.one = "maybe"; return this.run(); }
    single() { this.one = "one"; return this.run(); }
    then(a, b) { return this.run().then(a, b); }
    async run() {
      if (!(this.name in T)) return { data: null, error: { code: "42P01", message: `relation "${this.name}" does not exist` } };
      const rows = T[this.name];
      const match = (r) => this.f.every(([c, v]) => r[c] === v);
      if (this.op === "insert") {
        const add = [].concat(this.p).map((r) => ({ id: r.id || `id-${++n}`, created_at: "2026-10-18T09:00:00Z", ...r }));
        for (const r of add) for (const cols of unique[this.name] || []) {
          if (rows.some((x) => cols.every((c) => x[c] === r[c]))) return { data: null, error: { code: "23505", message: "duplicate key" } };
        }
        rows.push(...add);
        return { data: this.ret ? structuredClone(this.one ? add[0] : add) : null, error: null };
      }
      if (this.op === "update") { rows.filter(match).forEach((r) => Object.assign(r, this.p)); return { data: null, error: null }; }
      const hit = structuredClone(rows.filter(match));   // copies, as the real client returns
      if (this.one) return { data: hit[0] || null, error: this.one === "one" && !hit[0] ? { code: "PGRST116" } : null };
      return { data: hit, error: null };
    }
  }
  return { T, from: (name) => new Q(name) };
}

const UNIQUE = { loan_applications: [["proposal_code", "idempotency_key"]], loan_status_events: [["application_id", "event_id"]], commission_ledger: [["application_id"]] };
const LIVE_LENDER = { id: "L1", code: "maib", name: "MAIB", adapter: "mock", contact_email: "", commission_type: "percent", commission_bps: 100, commission_flat_minor: 0, currency: "MDL", is_sample: false, active: true };
const MAIL_LENDER = { ...LIVE_LENDER, id: "L2", code: "micb", adapter: "email", contact_email: "" };
const LIVE_OFFER = { ...OFFER_SEED[0], id: "O1", lender_id: "L1", is_sample: false, eligibility: { markets: ["MD"] } };
const MAIL_OFFER = { ...LIVE_OFFER, id: "O2", lender_id: "L2" };
const db0 = () => fakeDb({
  lenders: [LIVE_LENDER, MAIL_LENDER, ...LENDER_SEED], financing_offers: [LIVE_OFFER, MAIL_OFFER, ...OFFER_SEED],
  loan_applications: [], loan_status_events: [], commission_ledger: [], audit_log: [],
}, UNIQUE);
const PROP = { code: "abc12345", company_id: "C1", project_id: "P1" };
const IN = { offerId: "O1", termMonths: 60, name: "Ion Rusu", phone: "069 000 111", email: "ion@x.md", locality: "Ialoveni", consent: true, idempotencyKey: "k-1234567890" };
const IO = { emailConfigured: () => true, buildPdf: async () => Buffer.from("%PDF"), sendEmail: async () => ({ sent: true }) };
const apply = (db, input = IN, extra = {}) => createApplication(db, { prop: PROP, priceMinor: 25000000, supportMinor: 2000000, input, meta: { ip: "1.2.3.4", ua: "UA", now: "2026-10-18T09:00:00Z" }, io: IO, company: { name: "SolarTech" }, ...extra });

test("an application: consent stored, amount from the server, sent to the lender, audited", async () => {
  const db = db0();
  const r = await apply(db, { ...IN, amount: 1 });   // whatever the browser sends as an amount is ignored
  assert.equal(r.ok, true);
  const a = r.application;
  assert.equal(a.amount_minor, 23000000, "price less the sure support");
  assert.equal(a.status, "submitted");
  assert.equal(a.channel, "mock");
  assert.match(a.lender_ref, /^MOCK-/);
  assert.equal(a.consent_version, CONSENT_VERSION);
  assert.equal(a.consent_ip, "1.2.3.4");
  assert.ok(Number.isInteger(a.monthly_minor) && a.monthly_minor > 0);
  assert.deepEqual(db.T.loan_status_events.map((e) => [e.to_status, e.source]), [["submitted", "adapter"]]);
  assert.deepEqual(db.T.audit_log.map((x) => x.action), ["loan.consent", "loan.submit"]);
  assert.ok(!JSON.stringify(db.T.audit_log).includes("Ion Rusu"), "the audit names no homeowner");
});

test("the same click twice gives one application", async () => {
  const db = db0();
  const a = await apply(db);
  const b = await apply(db);
  assert.equal(b.duplicate, true);
  assert.equal(b.application.id, a.application.id);
  assert.equal(db.T.loan_applications.length, 1);
});

test("refused: no consent, bad details, a sample offer outside a demo, an amount outside the offer", async () => {
  const db = db0();
  assert.equal((await apply(db, { ...IN, consent: false })).error, "consent");
  assert.equal((await apply(db, { ...IN, phone: "12" })).error, "details");
  assert.equal((await apply(db, { ...IN, email: "nope" })).error, "details");
  assert.equal((await apply(db, { ...IN, idempotencyKey: "x" })).error, "idempotency");
  assert.equal((await apply(db, { ...IN, offerId: "seed-offer-maib" })).error, "offer", "samples only in a demo");
  assert.equal((await apply(db, { ...IN, offerId: "seed-offer-maib", idempotencyKey: "k-sample-123" }, { samples: true })).ok, true, "a demo may use them");
  assert.equal((await apply(db, { ...IN, termMonths: 300 })).error, "term");
  assert.equal((await createApplication(db, { prop: PROP, priceMinor: 100, input: { ...IN, idempotencyKey: "k-small-123" }, io: IO })).error, "below_min");
  assert.equal(db.T.loan_applications.length, 1, "only the demo one was saved");
});

test("a lender that cannot be reached: the application is kept as not delivered", async () => {
  const db = db0();
  const r = await apply(db, { ...IN, offerId: "O2" });   // email lender with no contact address
  assert.equal(r.ok, true);
  assert.equal(r.delivered, false);
  assert.equal(r.application.status, "failed");
  assert.deepEqual(db.T.loan_status_events.map((e) => [e.to_status, e.note]), [["failed", "no_contact_email"]]);
  assert.ok(db.T.audit_log.some((x) => x.action === "loan.submit_failed"));
});

test("an undelivered application can be sent again once the lender is reachable", async () => {
  const db = db0();
  const { application: a } = await apply(db, { ...IN, offerId: "O2" });
  assert.equal(a.status, "failed");
  const still = await resendApplication(db, { applicationId: a.id, io: IO, now: "2026-10-18T10:00:00Z" });
  assert.equal(still.ok, false, "still no contact address");
  assert.equal(still.error, "no_contact_email");
  db.T.lenders.find((l) => l.id === "L2").contact_email = "credite@bank.md";
  const r = await resendApplication(db, { applicationId: a.id, io: IO, actor: { email: "admin@voltmira.com" }, now: "2026-10-18T11:00:00Z" });
  assert.equal(r.ok, true);
  assert.equal(r.application.status, "submitted");
  assert.match(db.T.loan_applications[0].lender_ref, /^EMAIL-/);
  assert.equal((await resendApplication(db, { applicationId: a.id, io: IO })).error, "not_failed", "only an undelivered one");
  assert.ok(db.T.audit_log.some((x) => x.action === "loan.resend_failed"));
});

test("statuses move forward only; a repeated event is a no-op; funded books the commission once", async () => {
  const db = db0();
  const { application: a } = await apply(db);
  const step = (to, id, extra = {}) => applyStatus(db, { applicationId: a.id, to, source: "webhook", eventId: id, lenderId: "L1", now: "2026-10-20T10:00:00Z", ...extra });
  assert.equal((await step("in_review", "e1")).ok, true);
  assert.equal((await step("in_review", "e1")).duplicate, true, "the same delivery again");
  assert.equal((await step("submitted", "e2")).error, "bad_transition");
  assert.equal((await step("approved", "e3")).ok, true);
  const funded = await step("funded", "e4", { lenderRef: "MAIB-778" });
  assert.equal(funded.application.status, "funded");
  assert.equal(funded.application.lender_ref, "MAIB-778");
  assert.deepEqual(funded.commission, { amountMinor: 230000, basis: "percent", rateBps: 100, currency: "MDL", loanMinor: 23000000 });
  assert.equal((await step("funded", "e5")).same, true, "already funded");
  assert.equal(db.T.commission_ledger.length, 1);
  assert.equal(db.T.commission_ledger[0].period, "2026-10");
  assert.equal((await step("rejected", "e6")).error, "bad_transition", "a funded loan stays funded");
  assert.equal((await applyStatus(db, { applicationId: a.id, to: "rejected", source: "portal", eventId: "x", lenderId: "L2" })).error, "not_found", "another lender's portal");
  assert.deepEqual(db.T.loan_status_events.map((e) => e.to_status), ["submitted", "in_review", "approved", "funded"]);
});

test("before the SQL runs: applying says so; a demo still sees the sample offers", async () => {
  const db = fakeDb({ audit_log: [] });
  assert.deepEqual(await apply(db), { ok: false, error: "needs_db", status: 503 });
  const demo = await listOffersFor(db, { market: "MD", samples: true });
  assert.equal(demo.needsDb, true);
  assert.equal(demo.offers.length, 3);
  assert.deepEqual((await listOffersFor(db, { market: "MD", samples: false })).offers, [], "never a sample to a real client");
});

test("offers listed for a quote: live ones always, samples only in a demo, cheapest rate first", async () => {
  const db = db0();
  const live = await listOffersFor(db, { market: "MD", clientKind: "household", samples: false });
  assert.deepEqual(live.offers.map((o) => o.id), ["O1", "O2"]);
  assert.ok(!("commission_bps" in live.offers[0].lender), "no commission terms reach the page");
  const all = await listOffersFor(db, { market: "MD", clientKind: "sme", samples: true });
  assert.ok(!all.offers.some((o) => o.id === "seed-offer-maib"), "MAIB's sample is for households");
  assert.deepEqual(all.offers.map((o) => o.rate_bps), [...all.offers.map((o) => o.rate_bps)].sort((a, b) => a - b));
});

test("the code's samples equal the SQL seed", () => {
  const sql = readFileSync(new URL("../supabase/add-financing.sql", import.meta.url), "utf8");
  for (const l of LENDER_SEED) assert.ok(sql.includes(`('${l.code}', '${l.name}', 'mock'`), l.code);
  for (const o of OFFER_SEED) {
    const code = LENDER_SEED.find((l) => l.id === o.lender_id).code;
    assert.ok(sql.includes(`('${code}', '${JSON.stringify(o.product_name)}', ${o.rate_bps}, ${o.term_min_months}, ${o.term_max_months}, ${o.fee_bps}, ${o.fee_flat_minor}, ${o.min_amount_minor}, ${o.max_amount_minor}, '${JSON.stringify(o.eligibility)}')`), code);
  }
});
