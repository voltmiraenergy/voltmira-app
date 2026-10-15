import { test } from "node:test";
import assert from "node:assert/strict";
import { hasFeature, planFor } from "./features.js";

test("free plan gets neither premium feature", () => {
  assert.equal(hasFeature("free", "crmWebhook"), false);
  assert.equal(hasFeature("free", "customTemplates"), false);
});

test("pro plan gets the CRM webhook but not custom templates", () => {
  assert.equal(hasFeature("pro", "crmWebhook"), true);
  assert.equal(hasFeature("pro", "customTemplates"), false);
});

test("team and enterprise get both", () => {
  for (const plan of ["team", "enterprise"]) {
    assert.equal(hasFeature(plan, "crmWebhook"), true);
    assert.equal(hasFeature(plan, "customTemplates"), true);
  }
});

test("an unknown/missing plan value degrades to free, not a crash or false-positive grant", () => {
  assert.equal(hasFeature(undefined, "crmWebhook"), false);
  assert.equal(hasFeature("madeup", "customTemplates"), false);
});

test("planFor names the lowest plan that actually grants the feature", () => {
  assert.equal(planFor("crmWebhook"), "pro");
  assert.equal(planFor("customTemplates"), "team");
});
