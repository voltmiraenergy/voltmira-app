// Traction numbers are what investors read first, so every rule about what
// counts is pinned here. Fixture rows are invented test data.
import { test } from "node:test";
import assert from "node:assert/strict";
import { computeTraction, weekOf, median, tractionCsv } from "./traction.js";
import { isDemoEmail } from "./demo.js";

// Thursday 24 Sep 2026, midday in Chisinau.
const NOW = Date.UTC(2026, 8, 24, 9);
const d = (s) => new Date(s).toISOString();

function fixture() {
  return {
    companies: [
      { id: "a", name: "SolarTech", created_at: d("2026-08-03T08:00:00Z"), plan: "pro", paddle_subscription_id: "sub_1" },
      { id: "b", name: "Soare SRL", created_at: d("2026-09-21T08:00:00Z"), plan: "pro" },
      { id: "demo", name: "Demo", created_at: d("2026-09-22T08:00:00Z"), plan: "free" },
    ],
    profiles: [
      { company_id: "a", email: "ana@solartech.md" },
      { company_id: "a", email: "ion@solartech.md" },
      { company_id: "b", email: "x@soare.ro" },
      { company_id: "demo", email: "t-1@demo.voltmira.com" },
    ],
    projects: [
      { id: "p1", company_id: "a", status: "won", kw: 8, created_at: d("2026-09-01T08:00:00Z"), updated_at: d("2026-09-10T08:00:00Z") },
      { id: "p2", company_id: "a", status: "sent", kw: 10, created_at: d("2026-09-14T08:00:00Z"), updated_at: d("2026-09-15T08:00:00Z") },
      { id: "p3", company_id: "a", status: "lost", kw: 5, created_at: d("2026-08-10T08:00:00Z"), updated_at: d("2026-08-12T08:00:00Z") },
      { id: "p4", company_id: "b", status: "draft", kw: 6, created_at: d("2026-09-22T08:00:00Z"), updated_at: d("2026-09-22T08:00:00Z") },
      { id: "s1", company_id: "a", status: "won", kw: 50, sample: true, created_at: d("2026-09-01T08:00:00Z"), updated_at: d("2026-09-01T08:00:00Z") },
      { id: "dp", company_id: "demo", status: "won", kw: 99, created_at: d("2026-09-22T08:00:00Z"), updated_at: d("2026-09-22T08:00:00Z") },
    ],
    proposals: [
      { project_id: "p1", created_at: d("2026-09-02T08:00:00Z"), opens: 3, accepted_at: d("2026-09-09T08:00:00Z") },
      { project_id: "p1", created_at: d("2026-09-05T08:00:00Z"), opens: 1 },   // a re-send: not a second quote
      { project_id: "p2", created_at: d("2026-09-15T08:00:00Z"), opens: 0 },
      { project_id: "p3", created_at: d("2026-08-11T08:00:00Z"), opens: 2 },
      { project_id: "s1", created_at: d("2026-09-02T08:00:00Z"), opens: 9, accepted_at: d("2026-09-03T08:00:00Z") },
      { project_id: "dp", created_at: d("2026-09-22T09:00:00Z"), opens: 9 },
    ],
    leads: [
      { company_id: "a", project_id: "p2", created_at: d("2026-09-14T06:00:00Z"), source: "widget" },
      { company_id: "a", project_id: null, created_at: d("2026-09-20T06:00:00Z"), source: "widget" },
      { company_id: "demo", project_id: null, created_at: d("2026-09-22T06:00:00Z"), source: "widget" },
    ],
    activity: [
      { company_id: "b", created_at: d("2026-09-23T08:00:00Z"), actor_id: "u-b" },
      { company_id: "a", created_at: d("2026-09-23T08:00:00Z"), actor_id: null },   // a client opening a proposal
    ],
    grossOf: (p) => p.kw * 1000,
    isDemoEmail,
    now: NOW,
  };
}

test("weeks start on Monday, in Chisinau time", () => {
  assert.equal(weekOf(Date.UTC(2026, 8, 24, 9)), "2026-09-21");
  // Sunday 22:30 UTC is already Monday 01:30 in Chisinau.
  assert.equal(weekOf(Date.UTC(2026, 8, 20, 22, 30)), "2026-09-21");
  assert.equal(weekOf(Date.UTC(2026, 8, 20, 20, 0)), "2026-09-14");
});

test("median handles odd, even and empty lists", () => {
  assert.equal(median([3, 1, 2]), 2);
  assert.equal(median([4, 1, 3, 2]), 2.5);
  assert.equal(median([]), null);
});

test("empty, internal and listed workspaces are left out, and counted as such", () => {
  const f = fixture();
  f.companies.push({ id: "ghost", name: "SolarTech Iași", created_at: d("2026-09-13T08:00:00Z") });   // no people left
  f.companies.push({ id: "ours", name: "Our test", created_at: d("2026-09-01T08:00:00Z") });
  f.profiles.push({ company_id: "ours", email: "founder@voltmira.com" });
  f.companies.push({ id: "listed", name: "Colleague", created_at: d("2026-09-01T08:00:00Z") });
  f.profiles.push({ company_id: "listed", email: "c@x.md" });
  const r = computeTraction({ ...f, isInternalEmail: (e) => e === "founder@voltmira.com", excludeIds: ["listed"] });
  assert.deepEqual(r.workspaces.map((w) => w.id).sort(), ["a", "b"]);
  assert.equal(r.totals.excluded, 4);   // demo, ghost, ours, listed
});

test("demo workspaces and sample rows never count", () => {
  const r = computeTraction(fixture());
  assert.equal(r.totals.workspaces, 2);
  assert.equal(r.totals.paying, 1);   // b is on the default "pro" with no subscription
  assert.equal(r.totals.quotes, 4);
  assert.equal(r.totals.leads, 2);
  assert.ok(!r.workspaces.some((w) => w.id === "demo"));
  assert.equal(r.totals.kwpQuoted, 8 + 10 + 5);   // not the sample's 50 or the demo's 99
});

test("a quote counts once, in the week it was first sent", () => {
  const r = computeTraction(fixture());
  assert.equal(r.totals.sent, 3);
  const w = Object.fromEntries(r.series.map((s) => [s.week, s]));
  assert.equal(w["2026-08-31"].sent, 1);            // p1, first sent 2 Sep
  assert.equal(w["2026-08-31"].kwpQuoted, 8);
  assert.equal(w["2026-09-14"].eurQuoted, 10000);   // p2
  assert.equal(w["2026-09-07"].signed, 1);          // p1 signed online 9 Sep
});

test("win rate is won over decided, value from the engine price", () => {
  const r = computeTraction(fixture());
  assert.equal(r.totals.won, 1);
  assert.equal(r.totals.lost, 1);
  assert.equal(r.totals.winRate, 0.5);
  assert.equal(r.totals.eurWon, 8000);
  assert.equal(r.totals.openRate, 3 / 4);   // 4 real proposal links, 3 opened
});

test("time to quote: lead to proposal, and draft to sent", () => {
  const r = computeTraction(fixture());
  assert.equal(r.totals.hoursLeadToQuote, 26);        // p2: lead 14 Sep 06:00 -> sent 15 Sep 08:00
  assert.equal(r.totals.leadToQuoteN, 1);
  assert.equal(r.totals.hoursDraftToSent, 24);        // p1 24h, p2 24h, p3 24h
});

test("active means a person did something; inbound events alone don't count", () => {
  const r = computeTraction(fixture());
  const thisWeek = r.series.at(-1);
  assert.equal(thisWeek.week, "2026-09-21");
  // b edited a quote and logged an action; a only had a client open this week.
  assert.equal(thisWeek.activeWorkspaces, 1);
  assert.equal(thisWeek.newWorkspaces, 1);
  assert.equal(r.workspaces[0].id, "b");                // most recently active first
  assert.equal(r.workspaces.find((w) => w.id === "a").members, 2);
});

test("rolling 30 days against the 30 before", () => {
  const r = computeTraction(fixture());
  assert.equal(r.last30.sent, 2);    // p1 (2 Sep), p2 (15 Sep)
  assert.equal(r.prev30.sent, 1);    // p3 (11 Aug)
  assert.equal(r.last30.fresh, 1);   // b
  assert.equal(r.prev30.fresh, 1);   // a (3 Aug)
});

test("CSV has one row per week, with a header", () => {
  const r = computeTraction(fixture());
  const lines = tractionCsv(r.series).trim().split("\n");
  assert.equal(lines.length, 13);
  assert.match(lines[0], /^week_starting,/);
  assert.match(lines.at(-1), /^2026-09-21,1,1,0,0\.0,0,0,0$/);
});

test("each workspace's monitored systems and what they cost a month; the demo's never count", () => {
  // NOW is 24 September 2026: July and August are the last two finished months
  const live = Array.from({ length: 12 }, () => ({ company_id: "a", last_month: "2026-08-01" }));
  const stations = [...live, { company_id: "a", last_month: "2026-05-01" }, { company_id: "b", last_month: null }, { company_id: "demo", last_month: "2026-08-01" }];
  const r = computeTraction({ ...fixture(), stations });
  const a = r.workspaces.find((w) => w.id === "a");
  const b = r.workspaces.find((w) => w.id === "b");
  assert.equal(a.monitored, 12, "the stale station is not billed");
  assert.equal(a.monitoringEur, 3, "two systems above the ten free, at 1.50");
  assert.equal(b.monitored, 0);
  assert.equal(b.monitoringEur, 0);
  assert.ok(!r.workspaces.some((w) => w.id === "demo"));
});
