import { test } from "node:test";
import assert from "node:assert/strict";
import { systemHealth, needsAttention, cleanRequest, nextStatuses, workingDaysSince, replyLate, nextCheck, checkState, addMonths, warrantiesFor, endingSoon, liveOn } from "./service.js";

const P = { kw: 10, yield_per_kwp: 1200, monthly_yield_shape: null, market: "MD", install_progress: { commission: "2026-02-10" } };
const month = (m, kwh) => ({ month: `2026-${String(m).padStart(2, "0")}`, kwh });

test("health against the system's own quote: fine, low, no readings, not live", () => {
  // expected roughly 1,000 kWh a month on average; summer months more
  const good = [3, 4, 5, 6, 7, 8, 9].map((m) => month(m, 2000));
  assert.equal(systemHealth(P, good, "2026-10-25").status, "ok");
  const low = [3, 4, 5, 6, 7, 8].map((m) => month(m, 2000)).concat(month(9, 300));
  const h = systemHealth(P, low, "2026-10-25");
  assert.equal(h.status, "critical");
  assert.equal(needsAttention(h), true);
  assert.equal(h.lastMonth, "2026-09");
  const none = systemHealth(P, [month(3, 900)], "2026-10-25");
  assert.deepEqual([none.status, none.cause], ["critical", "no_reading"]);
  assert.equal(systemHealth({ ...P, install_progress: {} }, [], "2026-10-25").status, "pending");
  assert.equal(systemHealth({ ...P, install_progress: { commission: "2026-10-02" } }, [], "2026-10-25").status, "pending", "no whole month yet");
  assert.equal(liveOn({ commissioned_at: "2025-06-01T10:00:00Z" }), "2025-06-01");
});

test("a request: the client must leave a phone; the installer need not", () => {
  assert.deepEqual(cleanRequest({ kind: "inverter_error", description: "Ecranul arată eroare", contact_phone: "+373 69 123 456" }, { source: "client" }).row.status, "new");
  assert.deepEqual(cleanRequest({ kind: "inverter_error", description: "Ecranul arată eroare" }, { source: "client" }).errors, ["phone"]);
  assert.deepEqual(cleanRequest({ kind: "roof", description: "x" }).errors, ["kind", "description"]);
  assert.equal(cleanRequest({ kind: "other", description: "Sună clientul" }).row.source, "installer");
  assert.deepEqual(cleanRequest({ kind: "other", description: "abc", contact_phone: "call me" }).errors, ["phone"]);
  assert.deepEqual(nextStatuses("new"), ["planned", "in_progress", "resolved", "closed"]);
  assert.deepEqual(nextStatuses("closed"), ["in_progress"]);
});

test("an answer is late after the working days set, weekends not counted", () => {
  // Friday 23 October 2026, 16:00 in Chișinău
  const req = { status: "new", created_at: "2026-10-23T13:00:00Z" };
  assert.equal(workingDaysSince(req.created_at, "2026-10-26"), 1, "Saturday and Sunday do not count");
  assert.equal(replyLate(req, 2, "2026-10-27"), false);
  assert.equal(replyLate(req, 2, "2026-10-28"), true);
  assert.equal(replyLate({ ...req, first_reply_at: "2026-10-24T08:00:00Z" }, 2, "2026-10-30"), false);
  assert.equal(replyLate({ ...req, status: "planned" }, 2, "2026-10-30"), false);
});

test("the yearly check: from going live, then from the last one done; its state", () => {
  assert.equal(addMonths("2026-01-31", 1), "2026-02-28");
  assert.equal(nextCheck({ live: "2025-06-12" }), "2026-06-12");
  assert.equal(nextCheck({ live: "2025-06-12", lastDone: "2026-07-01" }), "2027-07-01");
  assert.equal(nextCheck({ live: "2025-06-12", months: 6 }), "2025-12-12");
  assert.equal(nextCheck({ live: "2025-06-12", off: true }), null);
  assert.equal(nextCheck({ live: null }), null);
  assert.deepEqual(["2026-06-01", "2026-07-15", "2026-12-01"].map((t) => checkState("2026-06-12", t)), ["soon", "overdue", "overdue"]);
  assert.equal(checkState("2027-06-12", "2026-10-25"), "later");
});

test("warranties: set by hand first, then verified catalog years and the workspace's own; never guessed", () => {
  const bom = [{ kind: "panel", brand: "Phono Solar", model: "PS460" }, { kind: "inverter", brand: "Deye", model: "SUN-5K" }];
  const lookup = (b) => (b === "Phono Solar" ? { warrantyYears: 12 } : null);
  const w = warrantiesFor({ live: "2025-06-12", bom, installYears: 2, saved: [{ item: "performance", years: 25, product: "" }], lookup });
  const by = Object.fromEntries(w.map((x) => [x.item, x]));
  assert.deepEqual([by.panels.years, by.panels.source, by.panels.ends_on], [12, "catalog", "2037-06-12"]);
  assert.deepEqual([by.inverter.years, by.inverter.source, by.inverter.product], [null, "none", "Deye SUN-5K"], "unverified: left to fill in");
  assert.deepEqual([by.install.years, by.install.ends_on], [2, "2027-06-12"]);
  assert.deepEqual([by.performance.years, by.performance.source], [25, "set"]);
  assert.equal(by.battery, undefined, "no battery on this job");
  assert.deepEqual(endingSoon(w, "2027-04-01").map((x) => x.item), ["install"]);
});
