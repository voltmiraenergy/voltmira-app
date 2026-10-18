import { test } from "node:test";
import assert from "node:assert/strict";
import {
  verificationState, verificationMissing, slugFor, ratingSummary, canReview, reviewAuthor,
  eligibility, matchScore, rankInstallers, respondBy, nextOfferStatus, overdueOffers, backfillCount, requestStatus, timeLeft,
} from "./marketplace.js";
import { nextTicketStatus, ticketFromAssessment, cleanTicketInput, visitOk } from "./maintenance.js";

const TODAY = "2026-10-18";
const P = (over = {}) => ({ company_id: "A", verification: "verified", licence_valid_to: "2027-06-30", insurance_valid_to: "2027-03-31", published: true, accepting: true, regions: ["ialoveni", "chisinau"], min_kw: 2, max_kw: 20, ...over });

test("verified means checked, and both documents still in date", () => {
  assert.deepEqual(verificationState(P(), TODAY), { state: "verified", expiresOn: "2027-03-31", soon: false });
  assert.equal(verificationState(P({ insurance_valid_to: "2026-11-01" }), TODAY).soon, true);
  assert.equal(verificationState(P({ licence_valid_to: "2026-10-01" }), TODAY).state, "expired");
  assert.equal(verificationState(P({ insurance_valid_to: null }), TODAY).state, "expired", "a missing date is not in date");
  assert.equal(verificationState(P({ verification: "pending" }), TODAY).state, "pending");
  assert.equal(verificationState(null).state, "none");
  assert.deepEqual(verificationMissing({ licence_no: "A1", regions: [] }), ["licence_valid_to", "licence_doc", "insurer", "insurance_valid_to", "insurance_doc", "regions"]);
});

test("a public name from the company's", () => {
  assert.equal(slugFor("SolarTech Chișinău SRL"), "solartech-chisinau");
  assert.equal(slugFor("S.R.L. Ștefan & Fiii"), "stefan-fiii");
  assert.equal(slugFor("Ab"), "installer-ab");
});

test("ratings: the average shown, the shrunk one for ranking, hidden ones out", () => {
  const s = ratingSummary([{ rating: 5 }, { rating: 5 }, { rating: 1, hidden: true }]);
  assert.equal(s.count, 2);
  assert.equal(s.average, 5);
  assert.equal(s.ranking, (4 * 3 + 10) / 5, "two fives do not beat a long record yet");
  assert.equal(ratingSummary([]).average, null);
  assert.deepEqual(canReview({ project: { install_progress: { commission: "2026-09-01" } }, linked: true, existing: null }), { ok: true });
  assert.equal(canReview({ project: { install_progress: {} }, linked: true }).reason, "not_commissioned");
  assert.equal(canReview({ project: { install_progress: { commission: "x" } }, linked: false }).reason, "not_linked");
  assert.equal(canReview({ project: { install_progress: { commission: "x" } }, linked: true, existing: { id: 1 } }).reason, "already");
  assert.equal(reviewAuthor("Ion Popescu", "Ialoveni"), "Ion P., Ialoveni");
  assert.equal(reviewAuthor("Ana"), "Ana");
});

test("who can take a request, and why not", () => {
  const req = { raion: "ialoveni", kw: 8 };
  assert.deepEqual(eligibility(P(), req, TODAY), { ok: true });
  assert.equal(eligibility(P({ regions: ["balti"] }), req, TODAY).reason, "region");
  assert.deepEqual(eligibility(P({ regions: ["all"] }), req, TODAY), { ok: true });
  assert.equal(eligibility(P({ max_kw: 6 }), req, TODAY).reason, "size");
  assert.equal(eligibility(P({ accepting: false }), req, TODAY).reason, "paused");
  assert.equal(eligibility(P({ published: false }), req, TODAY).reason, "not_published");
  assert.equal(eligibility(P({ verification: "pending" }), req, TODAY).reason, "not_verified");
  assert.equal(eligibility(P({ licence_valid_to: "2026-01-01" }), req, TODAY).reason, "not_verified", "an expired licence stops requests");
});

test("ranking: rating, answering in time and free capacity; ties stable", () => {
  assert.equal(matchScore({ ranking: 5 }, { offered: 10, answered: 10, waiting: 0 }), 100);
  assert.equal(matchScore({ ranking: 1 }, { offered: 10, answered: 0, waiting: 5 }), 0);
  assert.equal(matchScore(undefined, {}), Math.round(0.75 * 50 + 0.8 * 35 + 15), "a newcomer gets a fair start");
  const profiles = [P({ company_id: "A" }), P({ company_id: "B" }), P({ company_id: "C", regions: ["balti"] }), P({ company_id: "D" }), P({ company_id: "E" })];
  const facts = new Map([["A", { rating: { ranking: 3 }, stats: { offered: 10, answered: 5 } }], ["B", { rating: { ranking: 4.8 }, stats: { offered: 10, answered: 10 } }]]);
  const r = rankInstallers({ raion: "ialoveni", kw: 8 }, profiles, facts, { today: TODAY });
  assert.deepEqual(r.map((x) => x.company_id), ["B", "D", "E"]);
  assert.deepEqual(rankInstallers({ raion: "ialoveni", kw: 8 }, profiles, facts, { exclude: ["B", "D"], today: TODAY }).map((x) => x.company_id), ["E", "A"]);
});

test("an offer's clock and its moves", () => {
  assert.equal(respondBy("2026-10-18T10:00:00.000Z", 24), "2026-10-19T10:00:00.000Z");
  assert.equal(respondBy("2026-10-18T10:00:00.000Z", 1), "2026-10-18T12:00:00.000Z", "never under two hours");
  assert.deepEqual(nextOfferStatus("offered", "accepted"), { ok: true });
  assert.deepEqual(nextOfferStatus("declined", "accepted"), { ok: false, error: "bad_transition" });
  assert.deepEqual(nextOfferStatus("accepted", "accepted"), { ok: true, same: true });
  const now = Date.parse("2026-10-19T11:00:00Z");
  const offers = [{ id: 1, status: "offered", respond_by: "2026-10-19T10:00:00Z" }, { id: 2, status: "offered", respond_by: "2026-10-20T10:00:00Z" }, { id: 3, status: "declined", respond_by: "2026-10-19T09:00:00Z" }];
  assert.deepEqual(overdueOffers(offers, now).map((o) => o.id), [1]);
  assert.equal(backfillCount(offers), 1);
  assert.equal(requestStatus(offers), "open");
  assert.equal(requestStatus([{ status: "declined" }], { exhausted: true }), "unmatched");
  assert.equal(requestStatus([{ status: "declined" }, { status: "accepted" }]), "accepted");
  assert.deepEqual(timeLeft("2026-10-19T12:30:00Z", now), { hours: 1, minutes: 30, overdue: false });
  assert.equal(timeLeft("2026-10-19T10:00:00Z", now).overdue, true);
});

test("tickets: moves, alerts to tickets once a month, input cleaned", () => {
  assert.deepEqual(nextTicketStatus("open", "scheduled"), { ok: true });
  assert.deepEqual(nextTicketStatus("scheduled", "scheduled"), { ok: true }, "a visit can be moved");
  assert.deepEqual(nextTicketStatus("closed", "open"), { ok: false, error: "bad_transition" });
  assert.deepEqual(nextTicketStatus("resolved", "open"), { ok: true }, "the homeowner can reopen");
  assert.deepEqual(ticketFromAssessment({ status: "critical", cause: "no_reading" }, "2026-09"), { kind: "no_data", alert_key: "no_data-2026-09", severity: "critical" });
  assert.equal(ticketFromAssessment({ status: "warn", cause: "sudden_drop", last: { ratio: 0.7 } }, "2026-09").alert_key, "under-2026-09");
  assert.equal(ticketFromAssessment({ status: "critical", cause: "snow" }, "2026-01"), null, "snow is weather");
  assert.equal(ticketFromAssessment({ status: "watch", cause: "low" }, "2026-09"), null);
  assert.equal(ticketFromAssessment({ status: "ok" }, "2026-09"), null);
  assert.deepEqual(cleanTicketInput({ kind: "fault", title: "  Invertorul   arată eroare ", detail: "F01" }), { ok: true, value: { kind: "fault", title: "Invertorul arată eroare", detail: "F01" } });
  assert.equal(cleanTicketInput({ kind: "x", title: "a" }).error, "title");
  assert.equal(cleanTicketInput({ kind: "x", title: "ok" }).value.kind, "other");
  const now = Date.parse("2026-10-18T10:00:00Z");
  assert.equal(visitOk("2026-10-20T09:00:00Z", now), true);
  assert.equal(visitOk("2026-09-01T09:00:00Z", now), false);
  assert.equal(visitOk("nope", now), false);
});
