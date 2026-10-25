import { test } from "node:test";
import assert from "node:assert/strict";
import { gridOverview } from "./gridOverview.js";
import { latestGridRules } from "./gridRules.js";

const rules = { premier: latestGridRules([], "premier"), rednord: { ...latestGridRules([], "rednord"), expectedDays: { submitted: 20, docs_requested: 10, approved: 30, meter_installed: 14 } } };
const projects = new Map([["P1", { client_name: "Ion Bivol" }], ["P2", { client_name: "Ana Rusu" }], ["P3", { title: "Hala Ungheni" }], ["P4", { client_name: "Vasile Ceban" }]]);

test("days in the step count from the day the file entered it, against each operator's own usual days", () => {
  const subs = [
    { id: "S1", project_id: "P1", operator: "premier", reference: "VM-P-1", status: "submitted", created_at: "2026-10-01T09:00:00Z" },
    { id: "S2", project_id: "P2", operator: "rednord", reference: "VM-R-2", status: "submitted", created_at: "2026-10-01T09:00:00Z" },
    { id: "S3", project_id: "P3", operator: "premier", reference: "VM-P-3", status: "approved", created_at: "2026-09-01T09:00:00Z", overrides: [{ reason: "extract on its way" }] },
  ];
  const events = [
    { submission_id: "S1", to_status: "submitted", created_at: "2026-10-01T09:00:00Z" },
    { submission_id: "S2", to_status: "submitted", created_at: "2026-10-01T09:00:00Z" },
    { submission_id: "S3", to_status: "submitted", created_at: "2026-09-01T09:00:00Z" },
    { submission_id: "S3", to_status: "approved", created_at: "2026-10-20T21:30:00Z" },   // 21 Oct in Chișinău
  ];
  const o = gridOverview({ subs, events, projects, rules, today: "2026-10-24" });
  assert.deepEqual(o.open.map((r) => [r.reference, r.days, r.expected, r.overdue]), [["VM-P-1", 23, 10, true], ["VM-R-2", 23, 20, true], ["VM-P-3", 3, 30, false]]);
  assert.equal(o.open[0].late, 13);
  assert.equal(o.open[2].since, "2026-10-21", "a timestamp is read on the Chișinău clock");
  assert.equal(o.open[2].exception, true);
  assert.equal(o.open[2].client, "Hala Ungheni");
  assert.deepEqual([o.stats.open, o.stats.overdue], [3, 2]);
});

test("signed offer to connection: the average over files connected in the last 12 months", () => {
  const subs = [
    { id: "C1", project_id: "P1", operator: "premier", status: "connected", created_at: "2026-05-01T09:00:00Z" },
    { id: "C2", project_id: "P2", operator: "premier", status: "connected", created_at: "2026-06-01T09:00:00Z" },
    { id: "C3", project_id: "P3", operator: "premier", status: "connected", created_at: "2025-01-01T09:00:00Z" },   // too long ago
    { id: "C4", project_id: "P4", operator: "premier", status: "rejected", created_at: "2026-10-01T09:00:00Z" },
  ];
  const events = [
    { submission_id: "C1", to_status: "connected", created_at: "2026-07-10T09:00:00Z" },
    { submission_id: "C2", to_status: "connected", created_at: "2026-08-15T09:00:00Z" },
    { submission_id: "C3", to_status: "connected", created_at: "2025-03-01T09:00:00Z" },
    { submission_id: "C4", to_status: "rejected", created_at: "2026-10-10T09:00:00Z" },
  ];
  const signedAt = new Map([["P1", "2026-04-20T10:00:00Z"], ["P2", "2026-05-25T10:00:00Z"], ["P3", "2024-12-01T10:00:00Z"]]);
  const o = gridOverview({ subs, events, projects, signedAt, rules, today: "2026-10-24" });
  // P1: 20 Apr to 10 Jul = 81 days; P2: 25 May to 15 Aug = 82 days
  assert.deepEqual([o.stats.avgDays, o.stats.avgN], [81.5, 2]);
  assert.equal(o.stats.open, 0);
  // C4 rejected 14 days ago, C2 connected 70 days ago; C1 (106 days) and C3 are older than 90 days
  assert.deepEqual(o.closed.map((r) => r.id), ["C4", "C2"], "closed in the last 90 days only, the latest first");
  assert.equal(gridOverview({ subs: [], today: "2026-10-24" }).stats.avgDays, null);
});
