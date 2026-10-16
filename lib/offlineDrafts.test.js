import { test } from "node:test";
import assert from "node:assert/strict";

const store = new Map();
globalThis.localStorage = { getItem: (k) => (store.has(k) ? store.get(k) : null), setItem: (k, v) => store.set(k, String(v)), removeItem: (k) => store.delete(k), key: (i) => [...store.keys()][i] };
Object.defineProperty(globalThis.localStorage, "length", { get: () => store.size });
const keysOf = () => [...store.keys()];
globalThis.Object.keys = ((orig) => (o) => (o === globalThis.localStorage ? keysOf() : orig(o)))(Object.keys);
const { startDraft, readDraft, saveDraft, listDrafts, markSynced, syncedId, isDraftId, draftPayload } = await import("./offlineDrafts.js");

test("a draft is kept under a temporary id, then swapped for the real quote's", () => {
  store.clear();
  const id = startDraft("ro");
  assert.ok(isDraftId(id));
  assert.equal(isDraftId("2f1c0d3e-1111-2222-3333-444455556666"), false, "a real uuid is never a draft id");
  saveDraft(id, { ...readDraft(id), client_name: "Ion Rusu", kw: "6,5" });
  assert.equal(listDrafts().length, 1);
  markSynced(id, "real-uuid");
  assert.equal(readDraft(id), null);
  assert.equal(syncedId(id), "real-uuid");
  assert.equal(listDrafts().length, 0);
});

test("a draft sends only what a quote holds, cleaned", () => {
  const p = draftPayload({ client_name: "  Ion   Rusu ", phone: "+373 69 <b>1", kw: "6,5", cons: "abc", batt_kwh: "", evil: 1 });
  assert.equal(p.client_name, "Ion Rusu");
  assert.equal(p.phone, "+373 69 1");
  assert.equal(p.kw, 6.5);
  assert.equal(p.cons, null);
  assert.equal(p.batt_kwh, null);
  assert.equal("evil" in p, false);
});
