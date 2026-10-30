import { test } from "node:test";
import assert from "node:assert/strict";
import { change, weeklySignups, funnel, toCall, topInstallers, breakdown, signupWindow, headline } from "./ceoOverview.js";

const NOW = Date.parse("2026-10-26T12:00:00Z");   // a Monday
const ago = (d) => new Date(NOW - d * 864e5).toISOString();
const rows = [
  { id: "a", kind: "owner", at: ago(1), quotes: 0, phone: "+37369111222", country: "Moldova", provider: "google" },
  { id: "b", kind: "owner", at: ago(3), quotes: 4, phone: "", country: "Moldova", provider: "email" },
  { id: "c", kind: "unfinished", at: ago(10), quotes: 0, phone: "", country: "Romania", provider: "email" },
  { id: "d", kind: "teammate", at: ago(2), quotes: 0, phone: "+40711", country: "Moldova", provider: "email" },
  { id: "e", kind: "owner", at: ago(40), quotes: 2, phone: "", country: "Moldova", provider: "email" },
];
const ws = [
  { name: "SolarTech", quotes: 12, sent: 9, won: 3, kwpQuoted: 80 },
  { name: "Sun SRL", quotes: 2, sent: 1, won: 0, kwpQuoted: 12 },
  { name: "Idle", quotes: 0, sent: 0, won: 0 },
];

test("the change against the period before, and nothing to compare with", () => {
  assert.equal(change(15, 10), 0.5);
  assert.equal(change(3, 0), null);
});

test("sign-ups per week: people only, the last bar this week", () => {
  const w = weeklySignups(rows, { weeks: 3, now: NOW });
  assert.deepEqual(w.map((x) => x.week), ["2026-10-12", "2026-10-19", "2026-10-26"]);
  assert.deepEqual(w.map((x) => x.n), [1, 2, 0], "the teammate is not a sign-up; 10 days ago is the week of the 12th, 1 and 3 days ago the week of the 19th");
});

test("the funnel from an account to a signed job", () => {
  const f = funnel(rows, ws);
  assert.deepEqual(f.map((s) => [s.key, s.n]), [["accounts", 4], ["workspace", 3], ["quote", 2], ["sent", 2], ["signed", 1]]);
  assert.equal(f[1].ofPrev, 0.75);
  assert.equal(f[4].ofTop, 0.25);
});

test("who to call, the top installers, the breakdowns, the window and the headline", () => {
  assert.deepEqual(toCall(rows, { now: NOW }).map((r) => r.id), ["a", "c"], "new, no quote yet, the one with a phone first");
  assert.deepEqual(topInstallers(ws).map((w) => w.name), ["SolarTech", "Sun SRL"]);
  assert.deepEqual(breakdown(rows, "country"), [{ label: "Moldova", n: 3 }, { label: "Romania", n: 1 }]);
  assert.deepEqual(signupWindow(rows, NOW), { last30: 3, prev30: 1 });
  assert.equal(headline({ signups30: 3, sent30: 1, won: 1, active30: 2 }), "Last 30 days: 3 new sign-ups, 2 active workspaces, 1 offer sent. 1 job signed in all.");
});
