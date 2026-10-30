// lib/feeLockdown.test.js — every way an installer could avoid the fee for a signed job, tried, and each one shut
// (docs/features/fee-lockdown.md). One test per way, named for what the installer tries.
import { test } from "node:test";
import assert from "node:assert/strict";
import { PDFDocument } from "pdf-lib";
import { fakeDb } from "./fakeDb.testutil.js";
import { idnoValid, holdLevel, feeOnLost, reclaimFreeSlots, jobAccess } from "./jobFees.js";
import { reminderStep } from "./feeReminders.js";
import { ensureJobFee, onProjectLost, jobGate, recordPaperwork, reconcileFreeSlots, sweepWonWithoutFee, repriceForStatement, signedWorkOnly } from "./jobFeeServer.js";
import { monthlyStatements } from "./jobFeePay.js";
import { holdFor, assertCanSendOffers } from "./feeHold.js";
import { stampPdf } from "./pdfStamp.js";

const IDNO = "1003600123459";   // a valid check digit: 7,3,1 weights over the first twelve
const DAY = 864e5;
const SELLER = { name: "VoltMira SRL", idno: "1003600000001", address: "Chișinău", iban: "MD00XX0000000000000000" };
const withFees = async (fn) => {
  const was = process.env.JOB_FEES;
  process.env.JOB_FEES = "on";
  try { return await fn(); } finally { if (was === undefined) delete process.env.JOB_FEES; else process.env.JOB_FEES = was; }
};
const db0 = (t = {}) => fakeDb({
  companies: [{ id: "C1", idno: IDNO }], profiles: [{ company_id: "C1", role: "owner", email: "ana@solar.md" }],
  projects: [], proposals: [], job_fees: [], job_fee_credits: [], job_fee_invoices: [], audit_log: [], ...t,
}, { job_fees: [["project_id"]], job_fee_credits: [["source_fee_id"]], job_fee_invoices: [["company_id", "month"]] });

test("an invented tax id: the check digit refuses 9 in 10, so a new workspace cannot make one up for free jobs", () => {
  assert.equal(idnoValid(IDNO), true);
  assert.equal(idnoValid("1003600123456"), false);
  assert.equal(idnoValid("100360012345"), false, "12 digits");
  assert.equal(idnoValid("10036001234a9"), false);
  let ok = 0;
  for (let d = 0; d < 10; d++) if (idnoValid("100360012345" + d)) ok++;
  assert.equal(ok, 1, "one last digit in ten passes");
});

test("never marking the job signed: no paperwork at all while fees are on", async () => withFees(async () => {
  const db = db0();
  const sent = { id: "P1", company_id: "C1", status: "sent", kw: 8 };
  const g = await jobGate(db, { project: sent, co: { id: "C1", idno: IDNO }, user: { email: "ana@solar.md" }, produce: "contract" });
  assert.deepEqual([g.locked, g.error], [true, "not_signed"]);
  assert.equal(db.T.job_fees.length, 0);
  assert.equal(jobAccess({ fee: null, on: true, signed: false }).locked, true);
  // the install steps and the crews' install visits are the signed job's too
  assert.equal(signedWorkOnly(sent, { email: "ana@solar.md" }), true);
  assert.equal(signedWorkOnly({ ...sent, status: "won" }, { email: "ana@solar.md" }), false);
}));

test("signing, taking the contract, then saying the client gave up: the fee stays, a waiver is asked of VoltMira", async () => withFees(async () => {
  const p = { id: "P1", company_id: "C1", status: "won", kw: 10 };
  const db = db0({ projects: [p], job_fees: [1, 2].map((i) => ({ id: "F" + i, company_id: "C1", project_id: "X" + i, idno: IDNO, status: "free", free_slot: i, kw: 5, amount_minor: 0, won_at: "2026-09-01T10:00:00Z" })) });
  const g = await jobGate(db, { project: p, co: { id: "C1", idno: IDNO }, user: { email: "ana@solar.md" }, produce: "contract" });
  assert.equal(g.locked, false);
  const fee = db.T.job_fees.find((f) => f.project_id === "P1");
  assert.equal(fee.status, "due");
  assert.ok(fee.docs_at, "the first paperwork is kept on the fee");
  assert.deepEqual(fee.docs_kinds, ["contract"]);
  p.status = "lost";
  const r = await onProjectLost(db, "P1");
  assert.equal(r.kept, true);
  assert.equal(db.T.job_fees.find((f) => f.project_id === "P1").status, "due");
  // before any paperwork, giving up is still free
  assert.deepEqual(feeOnLost({ status: "due" }).row.status, "void");
  assert.equal(feeOnLost({ status: "due", docs_at: "2026-10-01T00:00:00Z" }).kept, true);
}));

test("the paperwork record: the first date stays, each new kind is added once", async () => {
  const db = db0({ job_fees: [{ id: "F1", status: "due", docs_kinds: [] }] });
  await recordPaperwork(db, db.T.job_fees[0], "invoice", Date.parse("2026-10-01T09:00:00Z"));
  await recordPaperwork(db, { ...db.T.job_fees[0] }, "grid_file", Date.parse("2026-10-05T09:00:00Z"));
  await recordPaperwork(db, { ...db.T.job_fees[0] }, "grid_file", Date.parse("2026-10-06T09:00:00Z"));
  assert.equal(db.T.job_fees[0].docs_at, "2026-10-01T09:00:00.000Z");
  assert.deepEqual(db.T.job_fees[0].docs_kinds, ["invoice", "grid_file"]);
});

test("a second workspace signs jobs before giving its tax id, then gives one already used: its free jobs become due", async () => {
  const used = [1, 2].map((i) => ({ id: "A" + i, company_id: "CA", project_id: "PA" + i, idno: IDNO, status: "free", free_slot: i, kw: 6, amount_minor: 0, won_at: "2026-08-0" + i + "T10:00:00Z" }));
  const mine = [1, 2].map((i) => ({ id: "B" + i, company_id: "CB", project_id: "PB" + i, idno: null, status: "free", free_slot: i, kw: 10, amount_minor: 0, won_at: "2026-10-0" + i + "T10:00:00Z" }));
  const db = db0({ job_fees: [...used, ...mine] });
  for (const f of mine) f.idno = IDNO;   // setCompanyIdno stamps the fees first
  const r = await reconcileFreeSlots(db, { id: "CB", idno: IDNO });
  assert.equal(r.reclaimed, 2);
  assert.deepEqual(db.T.job_fees.filter((f) => f.company_id === "CB").map((f) => [f.status, f.amount_minor, f.free_slot]), [["due", 59000, null], ["due", 59000, null]]);
  assert.deepEqual(db.T.audit_log.map((a) => a.action), ["job_fee.free_reclaimed", "job_fee.free_reclaimed"]);
  // one used elsewhere: one of the two stays free, the earlier signed
  assert.deepEqual(reclaimFreeSlots(mine.map((f) => ({ ...f, status: "free" })), 1).map((f) => f.id), ["B2"]);
});

test("not paying: step by step, paperwork at once, no new offers at 30 days, read-only at 60", async () => {
  const due = "2026-09-15T21:00:00Z";
  const at = (d) => Date.parse(due) + d * DAY + 3600e3;
  const st = [{ due_at: due, paid_at: null, owed_minor: 100000 }];
  assert.deepEqual([0, 29, 30, 59, 60].map((d) => holdLevel(st, at(d)).level), [1, 1, 2, 2, 3]);
  assert.equal(holdLevel(st, at(-1)).level, 0, "before its date");
  assert.equal(holdLevel([{ ...st[0], paid_at: "2026-09-20T00:00:00Z" }], at(90)).level, 0, "paid");
  assert.equal(holdLevel([{ ...st[0], owed_minor: 0 }], at(90)).level, 0, "every client gave up");
  // each step is announced by email first: 5 days before it starts, then the day it does
  const inv = { issued_at: "2026-09-01T09:00:00Z", due_at: due, paid_at: null };
  assert.deepEqual([0, 24, 25, 30, 55, 60].map((d) => reminderStep(inv, at(d))), ["locked", "locked", "warn30", "hold30", "warn60", "hold60"]);
});

test("the hold is read from the statements themselves, and refuses a new offer at 30 days late", async () => withFees(async () => {
  const now = Date.parse("2026-11-20T10:00:00Z");
  const db = db0({
    job_fees: [{ id: "F1", company_id: "C1", status: "due", amount_minor: 200000 }, { id: "F2", company_id: "C1", status: "void", amount_minor: 120000 }],
    job_fee_invoices: [{ id: "I1", company_id: "C1", month: "2026-09", fee_ids: ["F1", "F2"], due_at: "2026-10-15T21:00:00Z", paid_at: null }],
  });
  const h = await holdFor(db, "C1", { now });
  assert.deepEqual([h.level, h.month, h.owedMinor, h.invoiceId], [2, "2026-09", 200000, "I1"]);
  await assert.rejects(assertCanSendOffers(db, "C1", { now }), /fee_hold_offers/);
  // paid: nothing held
  db.T.job_fee_invoices[0].paid_at = "2026-11-19T10:00:00Z";
  assert.equal((await holdFor(db, "C1", { now })).level, 0);
  // the switch off: nothing held either
  db.T.job_fee_invoices[0].paid_at = null;
  assert.equal((await holdFor(db, "C1", { now, on: false })).level, 0);
}));

test("growing the system after the paperwork: the statement bills the size it is now, never less", async () => {
  const p = { id: "P1", company_id: "C1", status: "won", kw: 30 };
  const fee = { id: "F1", company_id: "C1", project_id: "P1", idno: IDNO, status: "due", kw: 10, tier: 0, amount_minor: 59000, trigger: "manual", won_at: "2026-10-03T10:00:00Z" };
  const db = db0({ projects: [p], job_fees: [fee] });
  const r = await repriceForStatement(db, { ...fee });
  assert.equal(r.amount_minor, 177000, "30 kW at 59 lei");
  p.kw = 4;
  assert.equal((await repriceForStatement(db, { ...db.T.job_fees[0] })).amount_minor, 177000, "smaller later: the fee stays");
});

test("a fee never billed in its own month is billed on the next statement; demo workspaces are never billed", async () => {
  const now = Date.parse("2026-12-01T08:00:00Z");
  const db = db0({
    companies: [{ id: "C1", idno: IDNO, name: "Solar" }, { id: "CD", idno: null, name: "Demo" }],
    job_fees: [
      { id: "F1", company_id: "C1", project_id: "P1", status: "due", amount_minor: 200000, won_at: "2026-09-10T10:00:00Z" },   // missed
      { id: "F2", company_id: "C1", project_id: "P2", status: "due", amount_minor: 100000, won_at: "2026-11-10T10:00:00Z" },
      { id: "F3", company_id: "CD", project_id: "P3", status: "due", amount_minor: 100000, won_at: "2026-11-10T10:00:00Z" },
    ],
  });
  db.rpc = async () => ({ data: "VMF-2026-000001", error: null });
  const r = await monthlyStatements(db, { seller: SELLER, now, from: Date.parse("2026-01-01T00:00:00+02:00"), io: { skipCompany: async (id) => id === "CD" } });
  assert.deepEqual([r.issued, r.month], [1, "2026-11"]);
  assert.deepEqual(db.T.job_fee_invoices[0].fee_ids, ["F1", "F2"]);
  assert.equal(db.T.job_fees.find((f) => f.id === "F3").invoice_id, undefined);
});

test("a status written straight to the database: the daily check gives the signed job its fee", async () => {
  const db = db0({
    projects: [
      { id: "P1", company_id: "C1", status: "won", kw: 8, won_at: "2026-11-02T10:00:00Z" },
      { id: "P2", company_id: "C1", status: "won", kw: 8, won_at: null },                       // signed before fees existed
      { id: "P3", company_id: "CD", status: "won", kw: 8, won_at: "2026-11-02T10:00:00Z" },     // a demo workspace
      { id: "P4", company_id: "C1", status: "won", kw: 8, won_at: "2026-11-02T10:00:00Z", is_sample: true },
    ],
    companies: [{ id: "C1", idno: IDNO }, { id: "CD", idno: null }],
  });
  const r = await sweepWonWithoutFee(db, { skipCompany: async (id) => id === "CD" });
  assert.equal(r.made, 1);
  assert.deepEqual(db.T.job_fees.map((f) => f.project_id), ["P1"]);
  assert.equal((await sweepWonWithoutFee(db, { skipCompany: async (id) => id === "CD" })).made, 0, "once");
});

test("a demo document says DEMO on every page", async () => {
  const doc = await PDFDocument.create();
  doc.addPage([595, 842]); doc.addPage([595, 842]);
  const out = await stampPdf(await doc.save());
  const back = await PDFDocument.load(out);
  assert.equal(back.getPageCount(), 2);
  assert.ok(out.length > (await doc.save()).length, "each page carries the mark");
});

test("demo and sample jobs are open but never billed; the switch off leaves everything open", async () => {
  assert.equal(signedWorkOnly({ status: "sent" }, { email: "x@demo.voltmira.com" }), false);
  assert.equal(signedWorkOnly({ status: "sent" }, { email: "ana@solar.md" }), false, "fees off");
  const db = db0();
  const r = await ensureJobFee(db, { id: "S1", company_id: "C1", status: "won", kw: 5, is_sample: true });
  assert.deepEqual([r.ok, r.skipped, db.T.job_fees.length], [true, "sample", 0]);
});
