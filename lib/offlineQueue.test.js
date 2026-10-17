import { test } from "node:test";
import assert from "node:assert/strict";

// a stand-in for the browser's storage and events
const store = new Map();
globalThis.localStorage = { getItem: (k) => (store.has(k) ? store.get(k) : null), setItem: (k, v) => store.set(k, String(v)), removeItem: (k) => store.delete(k) };
globalThis.window = { dispatchEvent() {}, addEventListener() {}, removeEventListener() {} };
globalThis.Event = class { constructor(t) { this.type = t; } };
const { queueAction, queuedCount, flushQueue } = await import("./offlineQueue.js");
const netErr = (e) => e?.message === "offline";

test("ticks wait in order and are sent oldest first when the signal is back", async () => {
  store.clear();
  queueAction("installStep", ["p1", "install", true]);
  queueAction("gridFile", ["p1", { stage: "applied", date: "2026-10-16" }]);
  assert.equal(queuedCount(), 2);
  const calls = [];
  const r = await flushQueue({ installStep: (...a) => calls.push(["installStep", ...a]), gridFile: (...a) => calls.push(["gridFile", ...a]) }, netErr);
  assert.deepEqual(r, { sent: 2, dropped: 0, left: 0 });
  assert.deepEqual(calls.map((c) => c[0]), ["installStep", "gridFile"]);
  assert.equal(queuedCount(), 0);
});

test("still offline: the first call and everything after it stay; a refused one is dropped", async () => {
  store.clear();
  queueAction("installStep", ["p1", "a", true]);
  queueAction("installStep", ["p1", "b", true]);
  let n = 0;
  const r = await flushQueue({ installStep: () => { n++; if (n === 1) throw new Error("no access"); throw new Error("offline"); } }, netErr);
  assert.deepEqual(r, { sent: 0, dropped: 1, left: 1 });
  assert.equal(queuedCount(), 1);
});
