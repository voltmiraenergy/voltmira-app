import { test } from "node:test";
import assert from "node:assert/strict";
import { fakeDb } from "./fakeDb.testutil.js";
import { syncMilestones, recordMilestonePayment, setJobPlan } from "./milestoneServer.js";

const NOW = Date.parse("2026-10-24T08:00:00Z");
const price = async () => ({ grossMinor: 25000000, cur: "MDL" });   // 250,000 lei
const db0 = (project) => {
  const db = fakeDb({
    projects: [{ id: "P1", company_id: "C1", status: "won", title: "Casa Rusu", install_progress: {}, ...project }],
    companies: [{ id: "C1", invoice_prefix: "PF" }], pay_milestones: [], payments: [], audit_log: [], activity: [],
  }, { pay_milestones: [["project_id", "seq"]], payments: [["company_id", "idempotency_key"]] });
  let n = 41;
  db.rpc = async (name) => (name === "next_invoice_no_srv" ? { data: ++n, error: null } : { data: null, error: { message: "no" } });
  return db;
};

test("signed: 50/40/10 planned, the first stage issued at once from the installer's series; once", async () => {
  const db = db0();
  const acts = [];
  const r = await syncMilestones(db, "P1", { now: NOW, price, io: { logActivity: async (_d, a) => acts.push(a.key) } });
  assert.equal(r.ok, true);
  assert.deepEqual(db.T.pay_milestones.map((m) => [m.seq, m.trigger, m.amount_minor, m.status, m.invoice_no]),
    [[1, "signed", 12500000, "issued", "PF-2026-0042"], [2, "install", 10000000, "planned", undefined], [3, "grid", 2500000, "planned", undefined]]);
  assert.equal(db.T.pay_milestones[0].due_on, "2026-10-31");
  assert.ok(db.T.pay_milestones.every((m) => m.pay_token.length >= 20));
  assert.deepEqual(acts, ["act_ms_issued"]);
  await syncMilestones(db, "P1", { now: NOW, price });
  assert.equal(db.T.pay_milestones.length, 3, "safe to call again");
  assert.equal(db.T.pay_milestones.filter((m) => m.invoice_no).length, 1);
});

test("an install step ticked issues its stage; a job not signed gets none", async () => {
  const db = db0();
  await syncMilestones(db, "P1", { now: NOW, price });
  db.T.projects[0].install_progress = { deposit: "2026-10-25", install: "2026-11-02" };
  await syncMilestones(db, "P1", { now: Date.parse("2026-11-02T09:00:00Z"), price });
  assert.deepEqual(db.T.pay_milestones.map((m) => [m.status, m.invoice_no || null, m.due_on || null]),
    [["issued", "PF-2026-0042", "2026-10-31"], ["issued", "PF-2026-0043", "2026-11-09"], ["planned", null, null]]);
  const d2 = db0({ status: "sent" });
  assert.equal((await syncMilestones(d2, "P1", { price })).skipped, "not_won");
  assert.equal(d2.T.pay_milestones.length, 0);
});

test("payments: part, then the rest; the stage is paid; the client gave up voids what is not paid", async () => {
  const db = db0();
  await syncMilestones(db, "P1", { now: NOW, price });
  const m1 = db.T.pay_milestones[0];
  let r = await recordMilestonePayment(db, { milestoneId: m1.id, companyId: "C1", amountMinor: 5000000, paidAt: "2026-10-26", now: NOW });
  assert.equal(r.milestone.status, "issued");
  r = await recordMilestonePayment(db, { milestoneId: m1.id, companyId: "C1", now: NOW });
  assert.deepEqual([r.milestone.status, r.milestone.paid_minor], ["paid", 12500000]);
  assert.deepEqual(db.T.payments.map((p) => [p.amount_minor, p.milestone_id, p.reference]), [[5000000, m1.id, "PF-2026-0042"], [7500000, m1.id, "PF-2026-0042"]]);
  assert.equal((await recordMilestonePayment(db, { milestoneId: m1.id, companyId: "C1" })).error, "already");
  assert.equal((await recordMilestonePayment(db, { milestoneId: m1.id, companyId: "C2" })).error, "not_found", "another workspace's");
  db.T.projects[0].status = "lost";
  await syncMilestones(db, "P1", { now: NOW, price });
  assert.deepEqual(db.T.pay_milestones.map((m) => m.status), ["paid", "void", "void"]);
  // signed again: the void stages come back
  db.T.projects[0].status = "won";
  await syncMilestones(db, "P1", { now: NOW, price });
  assert.deepEqual(db.T.pay_milestones.map((m) => m.status), ["paid", "planned", "planned"]);
});

test("a job's own plan for what is not issued yet", async () => {
  const db = db0();
  await syncMilestones(db, "P1", { now: NOW, price });
  const project = db.T.projects[0];
  assert.equal((await setJobPlan(db, { project, co: db.T.companies[0], steps: [{ trigger: "install", pct: 30 }], termDays: 7, price })).error, "sum");
  const r = await setJobPlan(db, { project, co: db.T.companies[0], steps: [{ trigger: "order", pct: 25 }, { trigger: "commission", pct: 25 }], termDays: 14, price });
  assert.equal(r.ok, true);
  assert.deepEqual(db.T.pay_milestones.map((m) => [m.seq, m.trigger, m.amount_minor, m.status]),
    [[1, "signed", 12500000, "issued"], [2, "order", 6250000, "planned"], [3, "commission", 6250000, "planned"]]);
});
