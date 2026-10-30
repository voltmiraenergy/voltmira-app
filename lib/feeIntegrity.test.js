// lib/feeIntegrity.test.js — regression tests for the 2026-10-30 billing hardening: the paperwork gate fails closed
// when billing is on and the fee cannot be read, made or recorded; free jobs cannot exceed 2 per company even when
// jobs are signed at the same moment; a credit is spent once; a cancellation and a document at the same moment
// cannot both win; statements are linked and paid all or nothing.
//
// The fake database (lib/fakeDb.testutil.js) is wrapped twice here: `faulty` makes chosen calls fail as a lost
// connection would, and `guarded` stands in for supabase/add-fee-integrity.sql's job_fees_free_guard trigger (count
// and refuse in one step, as the advisory lock makes it in PostgreSQL). The trigger itself runs only in a real
// database: see supabase/check-security.sql and the staging steps in docs/security/2026-10-30-hardening.md.
import { test } from "node:test";
import assert from "node:assert/strict";
import { fakeDb } from "./fakeDb.testutil.js";
import { ensureJobFee, onProjectLost, jobGate, recordPaperwork, assertJobUnlocked, reconcileFreeSlots, gateStatus, feeParam } from "./jobFeeServer.js";
import { invoiceForFees, markStatementPaid } from "./jobFeePay.js";

const IDNO = "1003600123456";
const won = (id, company_id = "C1", kw = 6) => ({ id, company_id, status: "won", kw });
const base = (projects, extra = {}) => fakeDb({
  companies: [{ id: "C1", idno: IDNO }, { id: "C2", idno: IDNO }, { id: "C3", idno: null }],
  projects, proposals: [], job_fees: [], job_fee_credits: [], job_fee_invoices: [], audit_log: [], ...extra,
}, { job_fees: [["project_id"]], job_fee_credits: [["source_fee_id"]], job_fee_invoices: [["company_id", "month"]] });

const LOST = { code: "08006", message: "connection to the database was lost" };

/** Calls matching `when(table, op, query)` answer with an error instead of running. */
function faulty(db, when) {
  return {
    T: db.T,
    from(name) {
      const q = db.from(name);
      const run = Object.getPrototypeOf(q).run;
      q.run = async function () { return when(name, this.op, this) ? { data: null, error: LOST, count: null } : run.call(this); };
      return q;
    },
    rpc: db.rpc,
  };
}

/** The database's free-job guard: a fee written as free is refused when its company (workspace or tax id) already
 *  has 2, counted and decided in one step, as the trigger does under its advisory lock. */
function guarded(db) {
  const tooMany = (row, selfId) => {
    if (row.free_slot == null) return false;
    const used = db.T.job_fees.filter((f) => f.free_slot != null && f.id !== selfId
      && (f.company_id === row.company_id || (row.idno && f.idno === row.idno))).length;
    return used >= 2;
  };
  return {
    T: db.T,
    from(name) {
      const q = db.from(name);
      if (name !== "job_fees") return q;
      const run = Object.getPrototypeOf(q).run;
      q.run = async function () {
        if (this.op === "insert" && [].concat(this.p).some((r) => tooMany(r, null))) return { data: null, error: { code: "23514", message: "free_jobs_used: this company has had its 2 free jobs" } };
        if (this.op === "update") {
          const hits = db.T.job_fees.filter((r) => this.f.every((f) => f(r)));
          if (hits.some((r) => tooMany({ ...r, ...this.p }, r.id) && (r.free_slot == null || this.p.idno !== undefined || this.p.company_id !== undefined))) {
            return { data: null, error: { code: "23514", message: "free_jobs_used: this company has had its 2 free jobs" } };
          }
        }
        return run.call(this);
      };
      return q;
    },
  };
}

const on = async (fn) => { process.env.JOB_FEES = "on"; try { return await fn(); } finally { delete process.env.JOB_FEES; } };
const coOk = { idno: IDNO };
const user = { email: "installer@firma.md" };

// ---------------------------------------------------------------- Issue 1: the gate fails closed

test("billing on: a fee that cannot be read keeps the paperwork locked (503, try again), never open", async () => {
  await on(async () => {
    const db = faulty(base([won("P1")]), (t, op) => t === "job_fees" && op === "select");
    const g = await jobGate(db, { project: won("P1"), co: coOk, user, produce: "contract" });
    assert.deepEqual([g.locked, g.error], [true, "fee_unavailable"]);
    const res = await assertJobUnlocked(db, { project: won("P1"), co: coOk, user, produce: "contract" });
    assert.equal(res.status, 503);
    assert.equal(feeParam("fee_unavailable"), "retry");
    assert.deepEqual(["needs_kw", "needs_idno", "job_fee_due"].map(feeParam), ["kw", "idno", "locked"]);
    assert.equal(db.T.job_fees.length, 0, "nothing was written on a guess");
  });
});

test("billing on: the fee tables missing (SQL not run) keeps the paperwork locked", async () => {
  await on(async () => {
    const db = fakeDb({ companies: [{ id: "C1", idno: IDNO }], projects: [won("P1")] });
    const g = await jobGate(db, { project: won("P1"), co: coOk, user, produce: "invoice" });
    assert.deepEqual([g.locked, g.error], [true, "fee_unavailable"]);
  });
});

test("billing on: no fee on record and it cannot be made keeps the paperwork locked", async () => {
  await on(async () => {
    const db = faulty(base([won("P1")]), (t, op) => t === "job_fees" && op === "insert");
    const g = await jobGate(db, { project: won("P1"), co: coOk, user, produce: "handover" });
    assert.deepEqual([g.locked, g.error], [true, "fee_unavailable"]);
    assert.equal(gateStatus(g.error), 503);
  });
});

test("billing on: the company's free-job count cannot be read: no free job is handed out, and no paperwork", async () => {
  await on(async () => {
    // the count is a head select on job_fees with the "counting" flag; the plain read of the fee itself still works
    const db = faulty(base([won("P1")]), (t, op, q) => t === "job_fees" && op === "select" && q.counting);
    const made = await ensureJobFee(db, won("P1"));
    assert.deepEqual([made.ok, made.error], [false, "read_failed"]);
    assert.equal(db.T.job_fees.length, 0, "an unread count is never taken as zero");
    const g = await jobGate(db, { project: won("P1"), co: coOk, user, produce: "contract" });
    assert.deepEqual([g.locked, g.error], [true, "fee_unavailable"]);
  });
});

test("billing on: once the database answers again, the fee is made and the paperwork opens and is on record", async () => {
  await on(async () => {
    let down = true;
    const db = faulty(base([won("P1"), won("P2"), won("P3")]), (t) => down && t === "job_fees");
    assert.equal((await jobGate(db, { project: won("P3"), co: coOk, user, produce: "contract" })).locked, true);
    down = false;
    // the company's two free jobs, then the third is due within its statement's grace: open, and recorded
    for (const id of ["P1", "P2"]) await ensureJobFee(db, won(id));
    const g = await jobGate(db, { project: won("P3"), co: coOk, user, produce: "contract", now: Date.parse("2026-10-30T10:00:00Z") });
    assert.equal(g.locked, false);
    const f = db.T.job_fees.find((x) => x.project_id === "P3");
    assert.equal(f.status, "due");
    assert.ok(f.docs_at && f.docs_kinds.includes("contract"), "the document is on the fee's record");
  });
});

test("billing off, demo, sample and platform admins still pass (as before), even with the database down", async () => {
  const db = faulty(base([won("P1")]), () => true);
  assert.equal((await jobGate(db, { project: won("P1"), co: coOk, user })).locked, false, "billing off");
  await on(async () => {
    assert.equal((await jobGate(db, { project: won("P1"), co: coOk, user: { email: "a@demo.voltmira.com" } })).locked, false, "demo");
    assert.equal((await jobGate(db, { project: { ...won("P1"), is_sample: true }, co: coOk, user })).locked, false, "sample");
    process.env.PLATFORM_ADMIN_EMAILS = "boss@voltmira.com";
    try { assert.equal((await jobGate(db, { project: won("P1"), co: coOk, user: { email: "boss@voltmira.com" } })).locked, false, "admin"); }
    finally { delete process.env.PLATFORM_ADMIN_EMAILS; }
  });
});

// ---------------------------------------------------------------- Issue 3: the paperwork is on record before it is given

test("a document whose record cannot be written is not given (the gate locks, nothing is reported as done)", async () => {
  await on(async () => {
    const db0 = base([won("P1"), won("P2"), won("P3")]);
    for (const id of ["P1", "P2", "P3"]) await ensureJobFee(db0, won(id));
    const db = faulty(db0, (t, op) => t === "job_fees" && op === "update");
    const g = await jobGate(db, { project: won("P3"), co: coOk, user, produce: "grid_file", now: Date.parse("2026-10-30T10:00:00Z") });
    assert.deepEqual([g.locked, g.error], [true, "paperwork_not_recorded"]);
    assert.equal(db0.T.job_fees.find((x) => x.project_id === "P3").docs_at ?? null, null);
  });
});

test("recordPaperwork: by the database function when present; a refusal or a failure is never ok; never on a void fee", async () => {
  const fee = { id: "F1", status: "due", docs_kinds: [] };
  const okDb = { rpc: async (fn, a) => (assert.equal(fn, "job_fee_record_paperwork"), assert.deepEqual(a, { p_fee: "F1", p_kind: "contract" }), { data: true, error: null }) };
  assert.deepEqual(await recordPaperwork(okDb, fee, "contract"), { ok: true });
  assert.deepEqual(await recordPaperwork({ rpc: async () => ({ data: false, error: null }) }, fee, "contract"), { ok: false, error: "void" });
  assert.deepEqual(await recordPaperwork({ rpc: async () => ({ data: null, error: LOST }) }, fee, "contract"), { ok: false, error: "save_failed" });
  assert.deepEqual(await recordPaperwork(okDb, { ...fee, status: "void" }, "contract"), { ok: false, error: "void" });
  // an older database without the function: the same conditional update from the app, checked
  const db = base([]);
  db.T.job_fees.push({ id: "F2", status: "void", docs_kinds: [] }, { id: "F3", status: "due", docs_kinds: [] });
  db.rpc = async () => ({ data: null, error: { code: "PGRST202", message: "Could not find the function" } });
  assert.deepEqual(await recordPaperwork(db, { id: "F2", status: "due", docs_kinds: [] }, "invoice"), { ok: false, error: "void" }, "void in the database, whatever the caller read");
  assert.deepEqual(await recordPaperwork(db, { id: "F3", status: "due", docs_kinds: [] }, "invoice"), { ok: true });
  assert.ok(db.T.job_fees[1].docs_at);
});

test("a cancellation and a document at the same moment: the fee is kept, never voided with a document out", async () => {
  await on(async () => {
    const db = base([won("P1"), won("P2"), won("P3")]);
    for (const id of ["P1", "P2", "P3"]) await ensureJobFee(db, won(id));
    const fee = db.T.job_fees.find((x) => x.project_id === "P3");
    // both read the fee with no paperwork; the document is recorded first, then the cancellation tries to void
    const [rec, lost] = await Promise.all([recordPaperwork(db, { ...fee }, "contract"), onProjectLost(db, "P3")]);
    assert.equal(rec.ok, true);
    assert.deepEqual([lost.ok, lost.kept], [true, true]);
    assert.equal(db.T.job_fees.find((x) => x.project_id === "P3").status, "due", "the fee stays: paperwork was made");
  });
});

test("a job cancelled first gets no document afterwards", async () => {
  await on(async () => {
    const db = base([won("P1"), won("P2"), won("P3")]);
    for (const id of ["P1", "P2", "P3"]) await ensureJobFee(db, won(id));
    const stale = { ...db.T.job_fees.find((x) => x.project_id === "P3") };
    await onProjectLost(db, "P3");
    assert.equal(db.T.job_fees.find((x) => x.project_id === "P3").status, "void");
    // a gate that read the job as signed a moment before: recording on the now void fee is refused
    assert.deepEqual(await recordPaperwork(db, stale, "contract"), { ok: false, error: "void" });
  });
});

test("a cancellation that cannot be written says so (ok: false), so the installer tries again", async () => {
  const db0 = base([won("P1"), won("P2"), won("P3")]);
  for (const id of ["P1", "P2", "P3"]) await ensureJobFee(db0, won(id));
  const r = await onProjectLost(faulty(db0, (t, op) => t === "job_fees" && op === "update"), "P3");
  assert.equal(r.ok, false);
  assert.equal(db0.T.job_fees.find((x) => x.project_id === "P3").status, "due");
  assert.equal((await onProjectLost(db0, "P3")).ok, true, "and again, once it can");
  assert.equal(db0.T.job_fees.find((x) => x.project_id === "P3").status, "void");
});

// ---------------------------------------------------------------- Issue 2: at most 2 free jobs, under concurrency

test("five jobs signed at the same moment in one workspace: exactly 2 free, the rest due", async () => {
  const ids = ["P1", "P2", "P3", "P4", "P5"];
  const db = guarded(base(ids.map((id) => won(id))));
  const out = await Promise.all(ids.map((id) => ensureJobFee(db, won(id), { trigger: "signed" })));
  assert.ok(out.every((r) => r.ok), "every job got its fee");
  assert.equal(db.T.job_fees.length, 5);
  assert.equal(db.T.job_fees.filter((f) => f.status === "free").length, 2);
  assert.equal(db.T.job_fees.filter((f) => f.status === "due").length, 3);
});

test("jobs signed at the same moment from two workspaces sharing one tax id: 2 free in all", async () => {
  const ps = [won("A1", "C1"), won("A2", "C1"), won("B1", "C2"), won("B2", "C2")];
  const db = guarded(base(ps));
  await Promise.all(ps.map((p) => ensureJobFee(db, p)));
  assert.equal(db.T.job_fees.filter((f) => f.status === "free" && f.idno === IDNO).length, 2);
  assert.equal(db.T.job_fees.length, 4);
});

test("without the database guard the app's own count is not enough (why add-fee-integrity.sql is required)", async () => {
  const ids = ["P1", "P2", "P3", "P4"];
  const db = base(ids.map((id) => won(id)));
  await Promise.all(ids.map((id) => ensureJobFee(db, won(id))));
  assert.ok(db.T.job_fees.filter((f) => f.status === "free").length > 2, "the race the trigger closes");
});

test("the same job signed again and again (repeated requests): one fee, one free slot", async () => {
  const db = guarded(base([won("P1")]));
  await Promise.all([1, 2, 3, 4].map(() => ensureJobFee(db, won("P1"))));
  assert.equal(db.T.job_fees.length, 1);
  assert.equal(db.T.job_fees.filter((f) => f.free_slot != null).length, 1);
});

test("a workspace giving its tax id: free jobs past the company's 2 turn due before the fees take the tax id", async () => {
  const db = guarded(base([won("A1", "C1"), won("A2", "C1"), won("B1", "C3"), won("B2", "C3")]));
  for (const p of db.T.projects) await ensureJobFee(db, p);
  assert.equal(db.T.job_fees.filter((f) => f.status === "free").length, 4, "two workspaces, each counted alone so far");
  const r = await reconcileFreeSlots(db, { id: "C3", idno: IDNO });
  assert.deepEqual([r.ok, r.reclaimed], [true, 2]);
  const { error } = await db.from("job_fees").update({ idno: IDNO }).eq("company_id", "C3").is("idno", null);
  assert.equal(error, null, "the guard lets it through: 2 free under the tax id");
  assert.equal(db.T.job_fees.filter((f) => f.status === "free" && f.idno === IDNO).length, 2);
});

test("reconcileFreeSlots: a count it cannot read stops it (ok: false), nothing is kept free on a guess", async () => {
  const db = faulty(base([]), (t, op) => t === "job_fees" && op === "select");
  assert.deepEqual(await reconcileFreeSlots(db, { id: "C3", idno: IDNO }), { ok: false, reclaimed: 0 });
});

// ---------------------------------------------------------------- Issue 4: idempotency

test("one credit, two jobs signed at the same moment: it pays one of them only", async () => {
  const ps = [won("P1"), won("P2"), won("P3"), won("P4")];
  const db = guarded(base(ps));
  await ensureJobFee(db, ps[0]); await ensureJobFee(db, ps[1]);   // the two free ones
  db.T.job_fee_credits.push({ id: "CR1", company_id: "C1", amount_minor: 200000, source_fee_id: "OLD", used_on_fee_id: null });
  await Promise.all([ensureJobFee(db, ps[2]), ensureJobFee(db, ps[3])]);
  const paid = db.T.job_fees.filter((f) => f.status === "paid" && f.payment_method === "credit");
  assert.equal(paid.length, 1, "the credit is spent once");
  assert.equal(db.T.job_fees.filter((f) => f.status === "due").length, 1);
  assert.equal(db.T.job_fee_credits.find((c) => c.id === "CR1").used_on_fee_id, paid[0].id);
  const rest = db.T.job_fee_credits.filter((c) => c.source_fee_id === paid[0].id);
  assert.deepEqual(rest.map((c) => c.amount_minor), [164600], "what was left of it (2,000 lei less the 354 of a 6 kW job) stays as credit, once");
});

test("a paid job cancelled twice at once: one credit", async () => {
  const db = base([won("P1"), won("P2"), won("P3")]);
  for (const p of db.T.projects) await ensureJobFee(db, p);
  Object.assign(db.T.job_fees[2], { status: "paid", payment_method: "transfer" });
  const out = await Promise.all([onProjectLost(db, "P3"), onProjectLost(db, "P3")]);
  assert.ok(out.every((r) => r.ok));
  assert.equal(db.T.job_fee_credits.length, 1);
});

test("a statement whose fees cannot be linked says so; run again, it links them", async () => {
  const db0 = base([]);
  db0.rpc = async () => ({ data: "VMF-2026-000001", error: null });
  db0.T.job_fees.push({ id: "F1", company_id: "C1", amount_minor: 120000, status: "due", invoice_id: null, won_at: "2026-10-05T10:00:00Z" });
  const seller = { name: "VoltMira SRL", idno: IDNO, address: "Chișinău", iban: "MD00" };
  const args = { fees: [...db0.T.job_fees], company: { id: "C1", name: "SolarTech", idno: IDNO }, seller, month: "2026-10", dueAt: "2026-11-14T22:00:00.000Z" };
  const broken = faulty(db0, (t, op) => t === "job_fees" && op === "update");
  broken.rpc = db0.rpc;
  const r1 = await invoiceForFees(broken, args);
  assert.deepEqual([r1.ok, r1.error], [false, "link_failed"]);
  assert.equal(db0.T.job_fees[0].invoice_id, null);
  const r2 = await invoiceForFees(db0, args);
  assert.deepEqual([r2.ok, r2.error, r2.relinked], [false, "exists", true]);
  assert.equal(db0.T.job_fees[0].invoice_id, db0.T.job_fee_invoices[0].id, "linked on the second run");
  assert.equal(db0.T.job_fee_invoices.length, 1, "one statement for the month");
});

test("a statement is marked paid only when every fee on it is", async () => {
  const db0 = base([]);
  db0.T.job_fees.push({ id: "F1", company_id: "C1", amount_minor: 120000, status: "due" }, { id: "F2", company_id: "C1", amount_minor: 80000, status: "due" });
  db0.T.job_fee_invoices.push({ id: "I1", company_id: "C1", fee_ids: ["F1", "F2"], payment_ref: "VMF2026000001", total_minor: 200000, paid_at: null });
  let failF2 = true;
  const db = faulty(db0, (t, op, q) => failF2 && t === "job_fees" && op === "update" && q.f.every((f) => f({ id: "F2", status: "due" })) && !q.f.every((f) => f({ id: "F1", status: "due" })));
  const r = await markStatementPaid(db, { invoiceId: "I1" });
  assert.deepEqual([r.ok, r.error, r.failed], [false, "fees_not_paid", ["F2"]]);
  assert.equal(db0.T.job_fee_invoices[0].paid_at, null, "the statement does not read paid");
  failF2 = false;
  assert.equal((await markStatementPaid(db, { invoiceId: "I1" })).ok, true, "and once it can, all of it");
  assert.deepEqual(db0.T.job_fees.map((f) => f.status), ["paid", "paid"]);
  assert.ok(db0.T.job_fee_invoices[0].paid_at);
});
