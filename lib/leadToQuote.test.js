import { test } from "node:test";
import assert from "node:assert/strict";
import { leadToQuote } from "./leadToQuote.js";

const NOW = Date.parse("2026-10-24T12:00:00Z");
const h = (hours) => new Date(NOW - hours * 3_600_000).toISOString();

test("the median time from a lead arriving to its first offer link", () => {
  const leads = [
    { created_at: h(30), project_id: "a" },   // offer 28 hours before now -> 2 h
    { created_at: h(50), project_id: "b" },   // 50 -> 10 = 40 h
    { created_at: h(12), project_id: "c" },   // 12 -> 6 = 6 h
    { created_at: h(5), project_id: null },   // no quote yet
  ];
  const props = [
    { project_id: "a", created_at: h(28) }, { project_id: "a", created_at: h(1) },   // the first link counts
    { project_id: "b", created_at: h(10) },
    { project_id: "c", created_at: h(6) },
  ];
  assert.deepEqual(leadToQuote(leads, props, { now: NOW }), { medianHours: 6, count: 3 });
});

test("only offers from the last 90 days count; nothing gives null", () => {
  const old = { created_at: h(24 * 120), project_id: "x" };
  assert.deepEqual(leadToQuote([old], [{ project_id: "x", created_at: h(24 * 100) }], { now: NOW }), { medianHours: null, count: 0 });
  assert.deepEqual(leadToQuote([], [], { now: NOW }), { medianHours: null, count: 0 });
});

test("an offer dated before its lead (a quote linked to a later lead) is left out", () => {
  assert.equal(leadToQuote([{ created_at: h(2), project_id: "a" }], [{ project_id: "a", created_at: h(10) }], { now: NOW }).count, 0);
});
