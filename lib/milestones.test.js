import { test } from "node:test";
import assert from "node:assert/strict";
import { cleanSchedule, scheduleOf, splitAmounts, planFor, replan, reached, dueOn, stateOf, reminderStep, payRef, cashTiles, cashHistory, DEFAULT_SCHEDULE } from "./milestones.js";

test("a schedule: whole percentages adding up to 100, each step once, in the steps' order", () => {
  const ok = cleanSchedule({ steps: [{ trigger: "grid", pct: 10 }, { trigger: "signed", pct: 50 }, { trigger: "install", pct: 40 }] });
  assert.deepEqual(ok.schedule.steps.map((s) => s.trigger), ["signed", "install", "grid"]);
  assert.equal(ok.schedule.termDays, 7);
  assert.equal(cleanSchedule({ steps: [{ trigger: "signed", pct: 60 }, { trigger: "install", pct: 30 }] }).error, "sum");
  assert.equal(cleanSchedule({ steps: [{ trigger: "signed", pct: 50 }, { trigger: "signed", pct: 50 }] }).error, "twice");
  assert.equal(cleanSchedule({ steps: [{ trigger: "roof", pct: 100 }] }).error, "trigger");
  assert.equal(cleanSchedule({ steps: [{ trigger: "signed", pct: 33.5 }, { trigger: "grid", pct: 66.5 }] }).error, "pct");
  assert.equal(cleanSchedule({ steps: [{ trigger: "signed", pct: 100 }], termDays: 90 }).error, "term");
  assert.equal(cleanSchedule({ steps: [] }).error, "steps");
  assert.deepEqual(scheduleOf(null, { steps: [{ trigger: "signed", pct: 100 }] }).steps, [{ trigger: "signed", pct: 100 }]);
  assert.equal(scheduleOf(null, { steps: [{ trigger: "signed", pct: 20 }] }), DEFAULT_SCHEDULE, "an invalid one falls back");
});

test("the price split in whole lei, adding up exactly", () => {
  assert.deepEqual(splitAmounts(12345678, [50, 40, 10]), [6172800, 4938300, 1234578]);
  assert.equal(splitAmounts(12345678, [50, 40, 10]).reduce((a, b) => a + b, 0), 12345678);
  assert.deepEqual(splitAmounts(100000, [100]), [100000]);
  const rows = planFor({ grossMinor: 25000000, currency: "MDL", schedule: DEFAULT_SCHEDULE });
  assert.deepEqual(rows.map((r) => [r.seq, r.trigger, r.amount_minor, r.status]), [[1, "signed", 12500000, "planned"], [2, "install", 10000000, "planned"], [3, "grid", 2500000, "planned"]]);
});

test("a job's own plan for the stages still to come, after the ones issued", () => {
  const rows = [
    { seq: 1, trigger: "signed", pct: 50, amount_minor: 12500000, status: "issued" },
    { seq: 2, trigger: "install", pct: 40, amount_minor: 10000000, status: "planned" },
    { seq: 3, trigger: "grid", pct: 10, amount_minor: 2500000, status: "planned" },
  ];
  const r = replan({ rows, steps: [{ trigger: "order", pct: 20 }, { trigger: "commission", pct: 30 }], termDays: 10, grossMinor: 25000000, currency: "MDL" });
  assert.deepEqual(r.rows.map((x) => [x.seq, x.trigger, x.amount_minor, x.term_days]), [[2, "order", 5000000, 10], [3, "commission", 7500000, 10]]);
  assert.equal(replan({ rows, steps: [{ trigger: "install", pct: 60 }], grossMinor: 25000000 }).error, "sum");
  assert.equal(replan({ rows, steps: [{ trigger: "signed", pct: 50 }], grossMinor: 25000000 }).error, "issued");
});

test("when a stage's step is reached, and its due day on the Chișinău calendar", () => {
  assert.equal(reached("signed", { won: true }), true);
  assert.equal(reached("install", { won: true, progress: { install: "2026-10-20" } }), true);
  assert.equal(reached("grid", { won: true, progress: { install: "2026-10-20" } }), false);
  assert.equal(reached("signed", { won: false }), false, "nothing for a job not signed");
  assert.equal(dueOn("2026-10-24T22:30:00Z", 7), "2026-11-01", "issued at 00:30 on the 25th in Chișinău");
});

test("where a stage stands, and the reminder it is at", () => {
  const m = { status: "issued", amount_minor: 1000000, paid_minor: 0, due_on: "2026-11-01" };
  assert.equal(stateOf(m, "2026-10-25"), "open");
  assert.equal(stateOf(m, "2026-10-29"), "due_soon");
  assert.equal(stateOf(m, "2026-11-02"), "overdue");
  assert.equal(stateOf({ ...m, paid_minor: 1000000 }, "2026-11-02"), "paid");
  assert.equal(stateOf({ ...m, status: "planned" }), "planned");
  assert.deepEqual(["2026-10-25", "2026-10-29", "2026-11-01", "2026-11-03", "2026-11-04", "2026-11-11"].map((d) => reminderStep(m, d)), ["issued", "before3", "due", "due", "late3", "late10"]);
  assert.equal(reminderStep({ ...m, paid_minor: 1000000 }, "2026-11-11"), null);
  assert.equal(reminderStep({ ...m, status: "planned" }, "2026-11-11"), null);
  assert.equal(payRef("PF-2026-0042"), "PF20260042");
});

test("the Încasări tiles and the months, in one currency", () => {
  const ms = [
    { status: "issued", currency: "MDL", amount_minor: 1000000, paid_minor: 0, due_on: "2026-10-20", issued_at: "2026-10-13T08:00:00Z" },   // overdue
    { status: "issued", currency: "MDL", amount_minor: 500000, paid_minor: 200000, due_on: "2026-10-28", issued_at: "2026-10-21T08:00:00Z" }, // this week, part paid
    { status: "issued", currency: "MDL", amount_minor: 800000, paid_minor: 0, due_on: "2026-11-15", issued_at: "2026-10-23T08:00:00Z" },   // within 30 days
    { status: "planned", currency: "MDL", amount_minor: 300000, paid_minor: 0 },
    { status: "paid", currency: "MDL", amount_minor: 400000, paid_minor: 400000, due_on: "2026-09-30", issued_at: "2026-09-23T08:00:00Z" },
    { status: "issued", currency: "EUR", amount_minor: 99900, paid_minor: 0, due_on: "2026-10-01", issued_at: "2026-09-24T08:00:00Z" },
  ];
  const pays = [{ currency: "MDL", amount_minor: 200000, paid_at: "2026-10-22" }, { currency: "MDL", amount_minor: 400000, paid_at: "2026-09-28" }];
  const t = cashTiles(ms, pays, "MDL", "2026-10-24");
  assert.deepEqual([t.overdue, t.week, t.month, t.planned, t.received], [{ n: 1, minor: 1000000 }, { n: 1, minor: 300000 }, { n: 2, minor: 1100000 }, { n: 1, minor: 300000 }, { n: 1, minor: 200000 }]);
  const h = cashHistory(ms, pays, "MDL", 2, "2026-10-24");
  assert.deepEqual(h, [{ month: "2026-10", invoicedMinor: 2300000, receivedMinor: 200000 }, { month: "2026-09", invoicedMinor: 400000, receivedMinor: 400000 }]);
});
