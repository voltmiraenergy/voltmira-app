import { test } from "node:test";
import assert from "node:assert/strict";
import { monthlyPaymentMinor, feeMinor, offerApplies, termOptions, quoteLoan, netMonthlyMinor } from "./loanMath.js";
import { nextStatus, allowedNext, isFinal } from "./loanStatus.js";
import { commissionFor, payoutReport, periodOf } from "./commission.js";
import { signBody, verifyBody, secretEnvName, newPortalToken, hashToken } from "./lenderSignature.js";
import { mockAdapter, emailAdapter, adapterFor } from "./lenderAdapters.js";
import { loanApplicationDocument } from "./loanDocument.js";
import { LT, lt } from "./loanText.js";

const OFFER = { id: "o1", rate_bps: 990, term_min_months: 12, term_max_months: 84, fee_bps: 100, fee_flat_minor: 0, min_amount_minor: 3000000, max_amount_minor: 50000000, eligibility: { markets: ["MD"], clientKinds: ["household"] }, active: true, product_name: { en: "Green", ro: "Verde", ru: "Зел", uk: "Зел" } };

test("the annuity payment is an integer, rounded up, and pays the loan off", () => {
  const m = monthlyPaymentMinor(10000000, 990, 60);   // 100,000 lei at 9.9 % for 5 years
  assert.ok(Number.isInteger(m));
  assert.equal(m, 211979);                            // 2,119.79 lei
  // paying m for 60 months clears the balance (never short)
  let bal = 10000000;
  for (let i = 0; i < 60; i++) bal = bal * (1 + 0.099 / 12) - m;
  assert.ok(bal <= 0 && bal > -60, `balance ${bal}`);
  assert.equal(monthlyPaymentMinor(1200000, 0, 12), 100000, "no interest: a plain split");
  assert.equal(monthlyPaymentMinor(0, 990, 12), 0);
});

test("a loan for an offer: the price less the sure support, inside the offer's limits", () => {
  const q = quoteLoan({ offer: OFFER, priceMinor: 25000000, supportMinor: 2000000, termMonths: 60 });
  assert.equal(q.ok, true);
  assert.equal(q.amountMinor, 23000000);
  assert.equal(q.feeMinor, 230000, "1 % fee");
  assert.equal(q.totalMinor, q.monthlyMinor * 60 + q.feeMinor);
  assert.deepEqual(quoteLoan({ offer: OFFER, priceMinor: 25000000, termMonths: 6 }), { ok: false, error: "term" });
  assert.deepEqual(quoteLoan({ offer: OFFER, priceMinor: 1000000, termMonths: 24 }), { ok: false, error: "below_min" });
  assert.deepEqual(quoteLoan({ offer: OFFER, priceMinor: 90000000, termMonths: 24 }), { ok: false, error: "above_max" });
  assert.equal(netMonthlyMinor(211979, 250000), -38021, "the system out-saves the payment");
  assert.equal(feeMinor({ fee_bps: 0, fee_flat_minor: 50000 }, 123), 50000);
});

test("which offers apply, and the terms a homeowner can pick", () => {
  assert.equal(offerApplies(OFFER, { market: "MD", clientKind: "household" }), true);
  assert.equal(offerApplies(OFFER, { market: "MD", clientKind: "sme" }), false);
  assert.equal(offerApplies(OFFER, { market: "MD" }), true, "no client type set yet: shown");
  assert.equal(offerApplies(OFFER, { market: "RO" }), false);
  assert.equal(offerApplies({ ...OFFER, active: false }, { market: "MD" }), false);
  assert.deepEqual(termOptions(OFFER), [12, 24, 36, 48, 60, 72, 84]);
  assert.deepEqual(termOptions({ term_min_months: 6, term_max_months: 30 }), [6, 12, 24, 30]);
});

test("the status pipeline never goes backwards", () => {
  assert.deepEqual(nextStatus("submitted", "in_review"), { ok: true, from: "submitted", to: "in_review" });
  assert.equal(nextStatus("approved", "funded").ok, true);
  assert.equal(nextStatus("funded", "rejected").error, "bad_transition");
  assert.equal(nextStatus("rejected", "approved").error, "bad_transition");
  assert.equal(nextStatus("in_review", "submitted").error, "bad_transition");
  assert.equal(nextStatus("submitted", "paid").error, "unknown_status");
  assert.equal(nextStatus("approved", "approved").same, true, "a repeated update is a no-op");
  assert.deepEqual(allowedNext("failed"), ["submitted"]);
  assert.ok(isFinal("funded") && isFinal("rejected") && !isFinal("approved"));
});

test("commission per contract, and the monthly payout report", () => {
  assert.deepEqual(commissionFor({ commission_type: "percent", commission_bps: 100, currency: "MDL" }, 23000000), { amountMinor: 230000, basis: "percent", rateBps: 100, currency: "MDL", loanMinor: 23000000 });
  assert.equal(commissionFor({ commission_type: "flat", commission_flat_minor: 150000 }, 999).amountMinor, 150000);
  assert.equal(periodOf("2026-10-18T10:00:00Z"), "2026-10");
  // the month is Moldova's: late on 31 October in UTC is already November in Chisinau
  assert.equal(periodOf("2026-10-31T22:30:00Z"), "2026-11");
  assert.equal(periodOf("2026-10-31T20:30:00Z"), "2026-10");
  const rep = payoutReport([
    { lender_id: "a", period: "2026-10", currency: "MDL", loan_minor: 100, amount_minor: 1 },
    { lender_id: "a", period: "2026-10", currency: "MDL", loan_minor: 200, amount_minor: 2 },
    { lender_id: "b", period: "2026-09", currency: "MDL", loan_minor: 50, amount_minor: 5 },
  ], [{ id: "a", name: "MAIB" }, { id: "b", name: "OTP" }]);
  assert.deepEqual(rep.map((r) => [r.lender, r.period, r.loans, r.loanMinor, r.amountMinor]), [["MAIB", "2026-10", 2, 300, 3], ["OTP", "2026-09", 1, 50, 5]]);
});

test("a webhook signature: accepted when right, refused when wrong, stale or missing", () => {
  const raw = JSON.stringify({ event_id: "e1", application_id: "a1", status: "approved" });
  const now = 1_800_000_000;
  const h = signBody(raw, "s3cret", now);
  assert.deepEqual(verifyBody(raw, h, "s3cret", now), { ok: true });
  assert.equal(verifyBody(raw + " ", h, "s3cret", now).error, "bad_signature", "a changed body");
  assert.equal(verifyBody(raw, h, "other", now).error, "bad_signature", "another lender's secret");
  assert.equal(verifyBody(raw, h, "s3cret", now + 301).error, "stale", "replayed after five minutes");
  assert.equal(verifyBody(raw, "", "s3cret", now).error, "no_signature");
  assert.equal(verifyBody(raw, h, "", now).error, "no_secret", "no secret configured: refused");
  assert.equal(secretEnvName("maib"), "LENDER_WEBHOOK_SECRET_MAIB");
  const t = newPortalToken();
  assert.ok(t.token.length >= 30 && t.hash === hashToken(t.token) && !t.hash.includes(t.token));
});

const APP = { id: "5f1c2d3e-0000-4000-8000-000000000001", applicant: { name: "Ion Rusu", phone: "+373 69 000 111", email: "ion@x.md", locality: "Ialoveni" }, amount_minor: 23000000, currency: "MDL", term_months: 60, rate_bps: 990, monthly_minor: 487566, support_minor: 2000000, consent_at: "2026-10-18T09:00:00Z", consent_version: "loan-consent-2026-10" };
const DOC = loanApplicationDocument({ app: APP, lender: { name: "MAIB" }, offer: OFFER, company: { name: "SolarTech" }, project: { kw: 8, title: "Casa Rusu" } });

test("the mock adapter: accepted with a reference, or a forced failure", async () => {
  assert.deepEqual(await mockAdapter().submit(APP, { lender: {}, document: DOC }), { ok: true, ref: "MOCK-5F1C2D3E00", channel: "mock" });
  assert.deepEqual(await mockAdapter({ fail: "down" }).submit(APP, {}), { ok: false, error: "down", retryable: true });
  assert.equal(adapterFor({ adapter: "mock" }, {}).id, "mock");
});

test("the email adapter: the PDF goes to the lender; failures say whether to retry", async () => {
  const sent = [];
  const io = { emailConfigured: () => true, buildPdf: async () => Buffer.from("%PDF-1.7"), sendEmail: async (m) => { sent.push(m); return { sent: true }; } };
  const ok = await emailAdapter(io).submit(APP, { lender: { contact_email: "credite@bank.md" }, document: DOC });
  assert.deepEqual(ok, { ok: true, ref: "EMAIL-5F1C2D3E00", channel: "email" });
  assert.equal(sent[0].to, "credite@bank.md");
  assert.equal(sent[0].attachments[0].content, Buffer.from("%PDF-1.7").toString("base64"));
  assert.ok(sent[0].html.includes("Ion Rusu") && sent[0].html.includes("Ialoveni"));

  assert.deepEqual(await emailAdapter(io).submit(APP, { lender: {}, document: DOC }), { ok: false, error: "no_contact_email", retryable: false });
  assert.deepEqual(await emailAdapter({ ...io, emailConfigured: () => false }).submit(APP, { lender: { contact_email: "a@b.md" }, document: DOC }), { ok: false, error: "email_not_configured", retryable: false });
  assert.deepEqual(await emailAdapter({ ...io, sendEmail: async () => ({ sent: false, error: "resend_500" }) }).submit(APP, { lender: { contact_email: "a@b.md" }, document: DOC }), { ok: false, error: "resend_500", retryable: true });
  assert.deepEqual(await emailAdapter({ ...io, buildPdf: async () => { throw new Error("chromium"); } }).submit(APP, { lender: { contact_email: "a@b.md" }, document: DOC }), { ok: false, error: "pdf_failed", retryable: true });
  assert.equal(adapterFor({ adapter: "email" }, io).id, "email");
});

test("the application document escapes what the applicant typed", () => {
  const d = loanApplicationDocument({ app: { ...APP, applicant: { name: "<script>x</script>" } }, lender: { name: "MAIB" }, offer: OFFER, company: { name: "S" } });
  assert.ok(!d.html.includes("<script>x"));
  assert.ok(d.html.includes("&lt;script&gt;"));
  assert.equal(DOC.subject, "Cerere de credit: Ion Rusu, 230.000 lei");
});

test("every financing text has all four languages, the same placeholders, no banned punctuation", () => {
  for (const [k, e] of Object.entries(LT)) {
    for (const l of ["en", "ro", "ru", "uk"]) {
      assert.ok(typeof e[l] === "string" && e[l].length > 0, `${k} missing ${l}`);
      assert.ok(!/[—–·✓✔]/.test(e[l]), `${k} ${l} has a dash, middle dot or check mark`);
    }
    const vars = (s) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort().join();
    for (const l of ["ro", "ru", "uk"]) assert.equal(vars(e[l]), vars(e.en), `${k} ${l} placeholders`);
    assert.ok(!/[ыэёъ]/i.test(e.uk), `${k} uk has a Russian letter`);
  }
  assert.equal(lt("months_n", "ro", { n: 60 }), "60 luni");
});
