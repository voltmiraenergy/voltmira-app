import { test } from "node:test";
import assert from "node:assert/strict";
import { hasFeature } from "./features.js";
import { seatCap, canInvite, seatsOpen } from "./plans.js";

test("no plans any more: every workspace has every feature", () => {
  for (const plan of ["free", "pro", "team", "enterprise", undefined, "madeup"]) {
    assert.equal(hasFeature(plan, "crmWebhook"), true, String(plan));
    assert.equal(hasFeature(plan, "customTemplates"), true, String(plan));
  }
});

test("no seat limit: any workspace may invite another person", () => {
  for (const plan of ["free", "pro", "team"]) {
    assert.equal(seatCap(plan, 3), Infinity);
    assert.equal(canInvite(plan, 12), true);
    assert.equal(seatsOpen(plan, 12), null);
  }
});
