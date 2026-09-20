import { test } from "node:test";
import assert from "node:assert/strict";
import { verifyAutomationBearer } from "./automationAuth.js";

function reqWith(authHeader) {
  return { headers: { get: (k) => (k.toLowerCase() === "authorization" ? authHeader : null) } };
}

test("accepts the exact configured bearer token", () => {
  process.env.AUTOMATION_API_KEY = "test-secret-123";
  assert.equal(verifyAutomationBearer(reqWith("Bearer test-secret-123")), true);
  delete process.env.AUTOMATION_API_KEY;
});

test("rejects a wrong token, a missing header, and a differently-cased scheme", () => {
  process.env.AUTOMATION_API_KEY = "test-secret-123";
  assert.equal(verifyAutomationBearer(reqWith("Bearer wrong")), false);
  assert.equal(verifyAutomationBearer(reqWith(null)), false);
  assert.equal(verifyAutomationBearer(reqWith("bearer test-secret-123")), false);
  assert.equal(verifyAutomationBearer(reqWith("test-secret-123")), false);
  delete process.env.AUTOMATION_API_KEY;
});

test("refuses every request when AUTOMATION_API_KEY isn't configured, never leaves the endpoint open", () => {
  delete process.env.AUTOMATION_API_KEY;
  assert.equal(verifyAutomationBearer(reqWith("Bearer anything")), false);
  assert.equal(verifyAutomationBearer(reqWith(null)), false);
});
