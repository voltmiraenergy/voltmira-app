import { test } from "node:test";
import assert from "node:assert/strict";
import { sendCrmWebhook } from "./crmWebhook.js";

function fakeAdmin(companyRow) {
  return {
    from(table) {
      assert.equal(table, "companies");
      return {
        select() { return this; },
        eq() { return this; },
        async maybeSingle() { return { data: companyRow }; },
      };
    },
  };
}

function mockFetch(capture) {
  return async (url, opts) => { capture.push({ url, opts }); return { ok: true }; };
}

test("does nothing when the company has never configured a webhook", async () => {
  const calls = [];
  await sendCrmWebhook("co1", "lead.created", { name: "Ion" }, { admin: fakeAdmin(null), fetchImpl: mockFetch(calls) });
  assert.equal(calls.length, 0);
});

test("does nothing when crm_webhook_enabled is false, even with a URL set", async () => {
  const calls = [];
  const admin = fakeAdmin({ crm_webhook_url: "https://hooks.example.com/x", crm_webhook_enabled: false });
  await sendCrmWebhook("co1", "lead.created", {}, { admin, fetchImpl: mockFetch(calls) });
  assert.equal(calls.length, 0);
});

test("does nothing for a non-https URL, never fetches an insecure/local address", async () => {
  const calls = [];
  const admin = fakeAdmin({ crm_webhook_url: "http://localhost:9999/x", crm_webhook_enabled: true });
  await sendCrmWebhook("co1", "lead.created", {}, { admin, fetchImpl: mockFetch(calls) });
  assert.equal(calls.length, 0);
});

test("posts a clean JSON envelope when enabled with a real https URL", async () => {
  const calls = [];
  const admin = fakeAdmin({ crm_webhook_url: "https://hooks.example.com/x", crm_webhook_enabled: true });
  await sendCrmWebhook("co1", "proposal.won", { title: "Casa Rusu" }, { admin, fetchImpl: mockFetch(calls) });
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, "https://hooks.example.com/x");
  const body = JSON.parse(calls[0].opts.body);
  assert.equal(body.event, "proposal.won");
  assert.equal(body.companyId, "co1");
  assert.equal(body.data.title, "Casa Rusu");
  assert.ok(body.at);
  assert.equal(calls[0].opts.headers["Content-Type"], "application/json");
});

test("never throws, even when the fetch itself fails", async () => {
  const admin = fakeAdmin({ crm_webhook_url: "https://hooks.example.com/x", crm_webhook_enabled: true });
  const failingFetch = async () => { throw new Error("network down"); };
  await assert.doesNotReject(() => sendCrmWebhook("co1", "lead.created", {}, { admin, fetchImpl: failingFetch }));
});

test("never throws when companyId is missing", async () => {
  await assert.doesNotReject(() => sendCrmWebhook(null, "lead.created", {}, { admin: fakeAdmin(null), fetchImpl: mockFetch([]) }));
});
