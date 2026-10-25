import { test } from "node:test";
import assert from "node:assert/strict";
import { fakeDb } from "./fakeDb.testutil.js";
import { ensureJobFee, onProjectLost, jobGate, feeFollowsStatus } from "./jobFeeServer.js";

const IDNO = "1003600123456";
const won = (id, company_id = "C1", kw = 6) => ({ id, company_id, status: "won", kw });
const db0 = (projects) => fakeDb({
  companies: [{ id: "C1", idno: IDNO }, { id: "C2", idno: IDNO }, { id: "C3", idno: null }],
  projects, proposals: [], job_fees: [], job_fee_credits: [], audit_log: [],
}, { job_fees: [["project_id"]], job_fee_credits: [["source_fee_id"]] });

test("the first two signed jobs are free per company tax id, across its workspaces; then 200 lei a kW", async () => {
  const ps = [won("P1"), won("P2", "C2"), won("P3", "C2"), won("P4", "C2", 25)];
  const db = db0(ps);
  for (const p of ps) assert.equal((await ensureJobFee(db, p, { trigger: "signed" })).ok, true);
  assert.deepEqual(db.T.job_fees.map((f) => [f.project_id, f.status, f.free_slot, f.amount_minor]),
    [["P1", "free", 1, 0], ["P2", "free", 2, 0], ["P3", "due", null, 120000], ["P4", "due", null, 500000]]);
  assert.equal(db.T.job_fees[3].idno, IDNO);
  assert.deepEqual(db.T.audit_log.map((a) => a.action), ["job_fee.create", "job_fee.create", "job_fee.create", "job_fee.create"]);
  // asked again: nothing changes
  await ensureJobFee(db, ps[3]);
  assert.equal(db.T.job_fees.length, 4);
});

test("the size the client signed sets the fee, and a bigger system later raises an unpaid fee, up to the cap", async () => {
  const db = db0([won("P1"), won("P2"), won("P9", "C1", 5)]);
  db.T.proposals.push({ project_id: "P9", accepted_at: "2026-10-20T10:00:00Z", snapshot: { kw: 12 } });
  for (const id of ["P1", "P2"]) await ensureJobFee(db, db.T.projects.find((p) => p.id === id));
  await ensureJobFee(db, db.T.projects.find((p) => p.id === "P9"));
  assert.equal(db.T.job_fees.find((f) => f.project_id === "P9").amount_minor, 240000, "12 kW signed, not the 5 kW quote");
  db.T.proposals[0].snapshot.kw = 62;
  await ensureJobFee(db, db.T.projects.find((p) => p.id === "P9"));
  assert.deepEqual([db.T.job_fees.find((f) => f.project_id === "P9").amount_minor, db.T.job_fees.find((f) => f.project_id === "P9").tier], [800000, 1]);
  assert.equal(db.T.audit_log.at(-1).action, "job_fee.reprice");
});

test("the client gives up: an unpaid fee is void and nothing locks; a paid one leaves credit that pays the next fee", async () => {
  process.env.JOB_FEES = "on";
  try {
    const db = db0([won("P1"), won("P2"), won("P3"), won("P4"), won("P5"), won("P6")]);
    for (const p of db.T.projects.slice(0, 5)) await ensureJobFee(db, p);
    const f5 = db.T.job_fees[4];
    await onProjectLost(db, "P4");
    assert.equal(db.T.job_fees[3].status, "void");
    const g = await jobGate(db, { project: { ...won("P4"), status: "lost" }, co: { idno: IDNO }, user: { email: "a@b.md" }, now: Date.parse("2027-03-01") });
    assert.deepEqual([g.locked, g.error], [true, "not_signed"], "nothing is owed for it, and a lost job gets no paperwork");
    // P5 is paid, then cancelled: credit; P6 won: paid from it
    db.T.job_fees[4].status = "paid"; db.T.job_fees[4].payment_method = "transfer";
    await onProjectLost(db, "P5");
    assert.deepEqual(db.T.job_fee_credits.map((c) => [c.amount_minor, c.source_fee_id]), [[120000, f5.id]]);
    await onProjectLost(db, "P5");
    assert.equal(db.T.job_fee_credits.length, 1, "credit once");
    await ensureJobFee(db, db.T.projects[5]);
    const f6 = db.T.job_fees[5];
    assert.deepEqual([f6.status, f6.payment_method], ["paid", "credit"]);
    assert.equal(db.T.job_fee_credits[0].used_on_fee_id, f6.id);
  } finally { delete process.env.JOB_FEES; }
});

test("won again: a void fee is due afresh; a paid job won again takes its unused credit back", async () => {
  const db = db0([won("P1"), won("P2"), won("P3"), won("P4"), won("P5")]);
  for (const p of db.T.projects) await ensureJobFee(db, p);
  await onProjectLost(db, "P4");
  await ensureJobFee(db, db.T.projects[3], { now: Date.parse("2026-12-01T10:00:00Z") });
  assert.deepEqual([db.T.job_fees[3].status, db.T.job_fees[3].grace_ends_at], ["due", "2027-01-14T22:00:00.000Z"], "on December's statement");
  db.T.job_fees[4].status = "paid";
  await onProjectLost(db, "P5");
  await ensureJobFee(db, db.T.projects[4]);
  assert.equal(db.T.job_fee_credits[0].used_on_fee_id, db.T.job_fees[4].id, "the credit is taken back");
  assert.equal(db.T.job_fees[4].status, "paid");
});

test("the gate: off, demo, admin and a missing tax id; a won job with no fee yet gets one", async () => {
  const db = db0([won("P1", "C3")]);
  assert.equal((await jobGate(db, { project: won("P1", "C3"), co: { idno: null }, user: {} })).locked, false, "switch off");
  process.env.JOB_FEES = "on";
  try {
    assert.equal((await jobGate(db, { project: won("P1", "C3"), co: { idno: null }, user: { email: "x@demo.voltmira.com" } })).locked, false, "demo");
    assert.equal((await jobGate(db, { project: { ...won("P1", "C3"), is_sample: true }, co: {}, user: {} })).locked, false, "sample");
    const g = await jobGate(db, { project: won("P1", "C3"), co: { idno: null }, user: { email: "a@b.md" } });
    assert.deepEqual([g.locked, g.error], [true, "needs_idno"]);
    assert.equal(db.T.job_fees.length, 1, "created on the way");
    assert.equal(db.T.job_fees[0].idno, null);
  } finally { delete process.env.JOB_FEES; }
});

test("a status change from the app makes the fee follow", async () => {
  const db = db0([won("P1"), won("P2")]);
  await feeFollowsStatus(db, ["P1", "P2"], "won");
  assert.equal(db.T.job_fees.length, 2);
  await feeFollowsStatus(db, ["P1"], "sent");
  assert.equal(db.T.job_fees.length, 2);
  assert.equal((await ensureJobFee(fakeDb({ projects: [] }), won("P9"))).needsDb, true, "before the SQL");
});
