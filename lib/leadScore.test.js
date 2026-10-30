import { test } from "node:test";
import assert from "node:assert/strict";
import { leadScore, scoreParts, cleanWeights, scoreBand, DEFAULT_WEIGHTS } from "./leadScore.js";

const strong = { monthly_bill: 1500, timeline: "now", phone: "069 123 456", lat: 47.02, lon: 28.86, wants_financing: true, district: "chisinau" };

test("a large bill, now, with a phone, found, wanting finance, in a served district scores 100", () => {
  assert.equal(leadScore(strong, { fx: 19.8, serviceDistricts: ["chisinau"] }).score, 100);
});

test("an empty lead scores low, and never below zero", () => {
  const r = leadScore({}, { fx: 19.8 });
  assert.ok(r.score >= 0 && r.score < 30, String(r.score));
});

test("the bill is read in euros, so lei and euros score alike", () => {
  assert.equal(scoreParts({ monthly_bill: 1200 }, { fx: 19.8 }).bill, 1);   // about 61 EUR
  assert.equal(scoreParts({ monthly_bill: 400 }, { fx: 19.8 }).bill, 0.5);  // about 20 EUR
  assert.equal(scoreParts({ monthly_bill: 200 }, { fx: 19.8 }).bill, 0.2);  // about 10 EUR
  assert.equal(scoreParts({ monthly_bill: 61 }, { fx: 1 }).bill, 1);       // a bill in euros
});

test("a district counts only once the installer lists the districts they serve", () => {
  assert.equal(scoreParts({ district: "orhei" }, { serviceDistricts: [] }).district, 0.5);
  assert.equal(scoreParts({ district: "orhei" }, { serviceDistricts: ["orhei"] }).district, 1);
  assert.equal(scoreParts({ district: "cahul" }, { serviceDistricts: ["orhei"] }).district, 0);
});

test("the installer's weights change the score, and all-zero weights fall back to the defaults", () => {
  const lead = { monthly_bill: 1500, timeline: "later" };
  const billOnly = leadScore(lead, { fx: 19.8 }, { bill: 100, timeline: 0, phone: 0, located: 0, financing: 0, district: 0 }).score;
  const timelineOnly = leadScore(lead, { fx: 19.8 }, { bill: 0, timeline: 100, phone: 0, located: 0, financing: 0, district: 0 }).score;
  assert.equal(billOnly, 100);
  assert.equal(timelineOnly, 20);
  assert.deepEqual(cleanWeights({ bill: 0, timeline: 0, phone: 0, located: 0, financing: 0, district: 0 }), DEFAULT_WEIGHTS);
  assert.deepEqual(cleanWeights({ bill: 250, timeline: -3, phone: "x" }).bill, 100);
  assert.equal(cleanWeights({ timeline: -3 }).timeline, 0);
});

test("the location can come from the estimate the visitor ran", () => {
  assert.equal(scoreParts({ estimate: { lat: 47.3, lon: 28.8 } }).located, 1);
  assert.equal(scoreParts({ estimate: {} }).located, 0);
});

test("bands: hot from 70, warm from 40", () => {
  assert.deepEqual([scoreBand(85), scoreBand(70), scoreBand(55), scoreBand(39)], ["hot", "hot", "warm", "cold"]);
});

test("the score's breakdown: each sign's points of the 100, heaviest first", async () => {
  const { scorePoints } = await import("./leadScore.js");
  const why = scorePoints({ bill: 0, timeline: 0.3, phone: 1, located: 1, financing: 0.5, district: 0.5 });
  assert.deepEqual(why.map((w) => w.key), ["bill", "timeline", "phone", "located", "financing", "district"]);
  assert.deepEqual(why.find((w) => w.key === "phone"), { key: "phone", got: 15, of: 15 });
  assert.equal(why.reduce((s, w) => s + w.of, 0), 100);
});
