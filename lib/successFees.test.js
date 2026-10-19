import { test } from "node:test";
import assert from "node:assert/strict";
import {
  feesOnFor, feeForKw, projectIdOf, periodOf, signedJobs, assignFees, nextJob, monthOf, months, statement, revenueCsv,
  LEI_PER_KW, MAX_LEI_PER_JOB, FREE_JOBS,
} from "./successFees.js";
import { monitoringBill } from "./monitoringPricing.js";

const id = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;

test("the model is on only with the switch, and never in a production build", () => {
  assert.equal(feesOnFor("on", "development"), true);
  assert.equal(feesOnFor("ON", undefined), true);
  assert.equal(feesOnFor("on", "production"), false);
  assert.equal(feesOnFor("1", "development"), false);
  assert.equal(feesOnFor(undefined, "development"), false);
});

test("200 lei a kW, at most 8,000 lei a job, nothing for no size", () => {
  assert.equal(LEI_PER_KW, 200);
  assert.equal(feeForKw(8.4), 1680);
  assert.equal(feeForKw(10), 2000);
  assert.equal(feeForKw(40), MAX_LEI_PER_JOB);
  assert.equal(feeForKw(62), MAX_LEI_PER_JOB);
  assert.equal(feeForKw(0), 0);
  assert.equal(feeForKw(null), 0);
  assert.equal(feeForKw("abc"), 0);
  assert.equal(feeForKw(8.333), 1667);
});

test("the project id comes out of an activity link, and nothing else does", () => {
  assert.equal(projectIdOf(`/projects/${id(7)}`), id(7));
  assert.equal(projectIdOf(`/projects/${id(7).toUpperCase()}?tab=x`), id(7));
  assert.equal(projectIdOf("/leads/abc"), null);
  assert.equal(projectIdOf(""), null);
  assert.equal(projectIdOf(null), null);
});

test("the month is Chisinau time: a job signed just after local midnight is in the new month", () => {
  // 2026-10-31 22:30 UTC is 2026-11-01 00:30 in Chisinau (UTC+2 in winter)
  assert.equal(periodOf("2026-10-31T22:30:00Z"), "2026-11");
  assert.equal(periodOf("2026-10-15T10:00:00Z"), "2026-10");
  assert.equal(periodOf(null), null);
});

test("signed jobs: signed online, marked won, or won by status alone; lost after signing is a cancellation", () => {
  const projects = [
    { id: id(1), title: "Casa A", client_name: "Ana", kw: 8.4, status: "won", updated_at: "2026-10-20T10:00:00Z" },   // signed online
    { id: id(2), title: "Casa B", kw: 10, status: "won", updated_at: "2026-10-25T10:00:00Z" },                         // marked won
    { id: id(3), title: "Casa C", kw: 6, status: "won", updated_at: "2026-10-12T09:00:00Z" },                          // status only
    { id: id(4), title: "Casa D", kw: 7, status: "lost", updated_at: "2026-10-30T09:00:00Z" },                         // signed online, then cancelled
    { id: id(5), title: "Casa E", kw: 9, status: "lost", updated_at: "2026-10-30T09:00:00Z" },                         // never signed
    { id: id(6), title: "Casa F", kw: 9, status: "sent", updated_at: "2026-10-30T09:00:00Z" },                         // not signed
    { id: id(7), title: "Sample", kw: 9, status: "won", updated_at: "2026-10-30T09:00:00Z", sample: true },            // sample: never
  ];
  const proposals = [
    { project_id: id(1), accepted_at: "2026-10-05T08:00:00Z" },
    { project_id: id(1), accepted_at: null },
    { project_id: id(4), accepted_at: "2026-10-08T08:00:00Z" },
    { project_id: id(6), accepted_at: null },
  ];
  const wonActs = [{ link: `/projects/${id(2)}`, created_at: "2026-10-09T08:00:00Z" }, { link: `/projects/${id(2)}`, created_at: "2026-10-19T08:00:00Z" }];
  const jobs = signedJobs({ projects, proposals, wonActs });
  assert.deepEqual(jobs.map((j) => j.id), [id(1), id(4), id(2), id(3)]);
  const by = Object.fromEntries(jobs.map((j) => [j.id, j]));
  assert.equal(by[id(1)].how, "online");
  assert.equal(by[id(1)].signedAt, "2026-10-05T08:00:00Z");
  assert.equal(by[id(2)].how, "marked");
  assert.equal(by[id(2)].signedAt, "2026-10-09T08:00:00Z");   // the first mark counts
  assert.equal(by[id(3)].how, "status");
  assert.equal(by[id(4)].cancelled, true);
  assert.equal(by[id(1)].client, "Ana");
});

test("fees: the first 2 jobs that go ahead are free, a cancelled job never uses a free one", () => {
  const jobs = [
    { id: "a", kw: 8.4, signedAt: "2026-10-01T10:00:00Z", period: "2026-10", cancelled: true },
    { id: "b", kw: 10, signedAt: "2026-10-02T10:00:00Z", period: "2026-10", cancelled: false },
    { id: "c", kw: 6, signedAt: "2026-10-03T10:00:00Z", period: "2026-10", cancelled: false },
    { id: "d", kw: 62, signedAt: "2026-10-04T10:00:00Z", period: "2026-10", cancelled: false },
    { id: "e", kw: 0, signedAt: "2026-11-01T10:00:00Z", period: "2026-11", cancelled: false },
    { id: "f", kw: 8.4, signedAt: "2026-11-02T10:00:00Z", period: "2026-11", cancelled: false },
  ];
  const rows = assignFees(jobs);
  const s = Object.fromEntries(rows.map((r) => [r.id, r]));
  assert.equal(s.a.status, "cancelled");
  assert.equal(s.a.fee, 0);
  assert.equal(s.a.full, 1680);
  assert.equal(s.b.status, "free");
  assert.equal(s.b.freeN, 1);
  assert.equal(s.c.status, "free");
  assert.equal(s.c.freeN, FREE_JOBS);
  assert.equal(s.d.status, "due");
  assert.equal(s.d.fee, MAX_LEI_PER_JOB);
  assert.equal(s.e.status, "no_size");
  assert.equal(s.f.fee, 1680);
  // a start date leaves the jobs before it out, and the free ones start after it
  const later = assignFees(jobs, { from: "2026-10-03" });
  assert.equal(later.find((r) => r.id === "b").status, "before");
  assert.equal(later.find((r) => r.id === "c").status, "free");
  assert.equal(later.find((r) => r.id === "d").status, "free");
  assert.equal(later.find((r) => r.id === "f").status, "due");
});

test("the next job: free while free jobs are left, then the fee on its size", () => {
  assert.deepEqual(nextJob([], 10), { left: 2, fee: 0, free: true, freeN: 1 });
  assert.deepEqual(nextJob([{ status: "free" }], 10), { left: 1, fee: 0, free: true, freeN: 2 });
  assert.deepEqual(nextJob([{ status: "free" }, { status: "free" }, { status: "due" }], 10), { left: 0, fee: 2000, free: false });
});

test("a month's totals, the months list and the statement with monitoring in lei", () => {
  const rows = assignFees([
    { id: "a", kw: 8, signedAt: "2026-09-10T10:00:00Z", period: "2026-09", cancelled: false },
    { id: "b", kw: 8, signedAt: "2026-09-12T10:00:00Z", period: "2026-09", cancelled: false },
    { id: "c", kw: 10, signedAt: "2026-10-02T10:00:00Z", period: "2026-10", cancelled: false },
    { id: "d", kw: 62, signedAt: "2026-10-04T10:00:00Z", period: "2026-10", cancelled: false },
    { id: "e", kw: 7, signedAt: "2026-10-05T10:00:00Z", period: "2026-10", cancelled: true },
  ]);
  const oct = monthOf(rows, "2026-10");
  assert.equal(oct.signed, 2);
  assert.equal(oct.cancelled, 1);
  assert.equal(oct.due, 2);
  assert.equal(oct.kw, 72);
  assert.equal(oct.feeLei, 2000 + 8000);
  const list = months(rows, "2026-11");
  assert.deepEqual(list.map((m) => m.period), ["2026-11", "2026-10", "2026-09"]);
  assert.equal(list[0].feeLei, 0);
  assert.equal(list[2].free, 2);
  const st = statement(oct, monitoringBill(14), 20);
  assert.equal(st.monitoring.billable, 4);
  assert.equal(st.monitoring.monthlyEur, 6);
  assert.equal(st.monitoring.monthlyLei, 120);
  assert.equal(st.totalLei, 10120);
  assert.equal(statement(oct).totalLei, 10000);
});

test("the CSV has one row per workspace and neutralises formulas in names", () => {
  const csv = revenueCsv([{ name: "=HYPERLINK(1)", companyId: "x", signed: 2, free: 0, cancelled: 1, kw: 18, feeLei: 3600, monitoring: { systems: 12, billable: 2, monthlyEur: 3, monthlyLei: 60 }, totalLei: 3660 }], "2026-10");
  const [head, row] = csv.trim().split("\n");
  assert.match(head, /^month,workspace,workspace_id,signed_jobs/);
  assert.match(row, /^2026-10,'=HYPERLINK\(1\),x,2,0,1,18,3600,12,2,3,60,3660,no$/);
  assert.match(revenueCsv([{ name: "Team", companyId: "t", signed: 0, free: 0, cancelled: 0, kw: 0, feeLei: 0, totalLei: 0, internal: true }], "2026-10"), /,yes\n$/);
});
