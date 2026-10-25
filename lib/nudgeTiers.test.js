import { test } from "node:test";
import assert from "node:assert/strict";
import { nextNudgeTier, cleanNudgeDays } from "./nudgeTiers.js";

const NOW = Date.parse("2026-10-24T12:00:00Z");
const sent = (daysAgo, count = 0, extra = {}) => ({ created_at: new Date(NOW - daysAgo * 86_400_000).toISOString(), nudge_count: count, ...extra });

test("the standard follow-ups go on day 3, 7 and 14, then stop", () => {
  assert.equal(nextNudgeTier(sent(2), undefined, NOW), null);
  assert.equal(nextNudgeTier(sent(3), undefined, NOW), 0);
  assert.equal(nextNudgeTier(sent(8, 1), undefined, NOW), 1);
  assert.equal(nextNudgeTier(sent(30, 3), undefined, NOW), null);
});

test("a workspace's own days are used", () => {
  assert.equal(nextNudgeTier(sent(2), [2, 5], NOW), 0);
  assert.equal(nextNudgeTier(sent(4, 1), [2, 5], NOW), null);
  assert.equal(nextNudgeTier(sent(6, 2), [2, 5], NOW), null);   // only two follow-ups set
});

test("an offer with follow-ups switched off is never due", () => {
  assert.equal(nextNudgeTier(sent(10, 0, { nudges_off: true }), undefined, NOW), null);
});

test("the days are kept as up to three different whole days from 1 to 60, in order", () => {
  assert.deepEqual(cleanNudgeDays([10, 2, 2, 90, "5", -1, 7]), [2, 5, 7]);
  assert.deepEqual(cleanNudgeDays(null), [3, 7, 14]);
  assert.deepEqual(cleanNudgeDays([0, 100]), [3, 7, 14]);
});
