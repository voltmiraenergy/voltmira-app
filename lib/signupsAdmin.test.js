import { test } from "node:test";
import assert from "node:assert/strict";
import { buildSignups, countryName, signupKind, deviceOf } from "./signupsAdmin.js";

const NOW = Date.parse("2026-10-26T12:00:00Z");
const log = [
  { user_id: "u1", email: "ana@solar.md", name: "", phone: "", user_agent: "Mozilla/5.0 (iPhone)", signed_up_at: "2026-10-26T08:00:00Z", provider: "google", country: "MD", city: "Chișinău" },
  { user_id: "u2", email: "ion@x.ro", name: "Ion", signed_up_at: "2026-10-20T08:00:00Z", provider: "email", country: "RO" },
  { user_id: "u3", email: "tm@solar.md", name: "Team", signed_up_at: "2026-10-21T08:00:00Z", provider: "email", country: null },
  { user_id: "u4", email: "ghost@x.com", name: "", signed_up_at: "2026-09-01T08:00:00Z", provider: "email", country: "MD" },
];
const profiles = new Map([["u1", { role: "owner", name: "Ana Rusu", phone: "+37369111222", company_id: "c1" }], ["u2", { role: "owner", name: "Ion", company_id: "c2" }], ["u3", { role: "member", company_id: "c1" }]]);
const companies = new Map([["c1", { name: "SolarTech", lang: "ro" }], ["c2", { name: "Sun SRL", lang: "ro" }]]);

test("the admin tab: newest first, who finished, the countries, and teammates kept out of the headcount", () => {
  const s = buildSignups(log, profiles, companies, new Map([["c1", 3]]), NOW);
  assert.deepEqual(s.rows.map((r) => r.email), ["ana@solar.md", "tm@solar.md", "ion@x.ro", "ghost@x.com"]);
  assert.equal(s.rows[0].name, "Ana Rusu", "the profile name when the sign-up had none");
  assert.deepEqual([s.rows[0].phone, s.rows[0].userAgent], ["+37369111222", "Mozilla/5.0 (iPhone)"], "the profile phone when the sign-up had none");
  assert.deepEqual(s.totals, { people: 3, today: 1, week: 2, month: 2, unfinished: 1, withQuote: 1 });
  assert.deepEqual(s.countries, [["Moldova", 2], ["Romania", 1]]);
  assert.deepEqual([signupKind(null), signupKind({ role: "member" }), signupKind({ role: "owner" })], ["unfinished", "teammate", "owner"]);
  assert.equal(countryName(""), "Unknown");
  assert.equal(countryName("ua"), "Ukraine");
});

test("the device at a glance", () => {
  assert.equal(deviceOf("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1"), "iPhone, Safari");
  assert.equal(deviceOf("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36"), "Windows, Chrome");
  assert.equal(deviceOf(""), "-");
});
