import { test } from "node:test";
import assert from "node:assert/strict";
import { isMonitored, monitoredCount, monitoringBill, monitoringBilled, FREE_SYSTEMS, EUR_PER_SYSTEM } from "./monitoringPricing.js";

const OCT = Date.parse("2026-10-10T12:00:00Z");

test("a system counts while its portal delivered one of the last two finished months", () => {
  assert.equal(isMonitored({ last_month: "2026-09-01" }, OCT), true);
  assert.equal(isMonitored({ last_month: "2026-08-01" }, OCT), true);
  assert.equal(isMonitored({ last_month: "2026-07-01" }, OCT), false, "stale: the connection stopped");
  assert.equal(isMonitored({ last_month: "2026-10-01" }, OCT), false, "a month not over is never stored");
  assert.equal(isMonitored({ last_month: null }, OCT), false, "never synced");
  assert.equal(isMonitored({}, OCT), false);
  // the year turns
  assert.equal(isMonitored({ last_month: "2025-12" }, Date.parse("2026-01-15T00:00:00Z")), true);
  assert.equal(isMonitored({ last_month: "2025-11-01" }, Date.parse("2026-01-15T00:00:00Z")), true);
  assert.equal(isMonitored({ last_month: "2025-10-01" }, Date.parse("2026-01-15T00:00:00Z")), false);
});

test("the count leaves broken and never-synced stations out", () => {
  assert.equal(monitoredCount([{ last_month: "2026-09-01" }, { last_month: "2026-05-01" }, { last_month: null }], OCT), 1);
  assert.equal(monitoredCount(null, OCT), 0);
});

test("the first 10 systems are free, then a fixed price per system", () => {
  assert.deepEqual(monitoringBill(0), { systems: 0, free: 0, billable: 0, monthlyEur: 0 });
  assert.deepEqual(monitoringBill(FREE_SYSTEMS), { systems: 10, free: 10, billable: 0, monthlyEur: 0 });
  assert.deepEqual(monitoringBill(25), { systems: 25, free: 10, billable: 15, monthlyEur: 15 * EUR_PER_SYSTEM });
  assert.equal(monitoringBill(-3).systems, 0);
});

test("billing is off unless MONITORING_BILLING is on", () => {
  assert.equal(monitoringBilled({}), false);
  assert.equal(monitoringBilled({ MONITORING_BILLING: "on" }), true);
});
