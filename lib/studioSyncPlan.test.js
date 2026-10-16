import { test } from "node:test";
import assert from "node:assert/strict";
import { planHydration, mergeJobs, isSyncedKey, JOBS_KEY, OWNER_KEY } from "./studioSyncPlan.js";

const me = { companyId: "co-1", cacheOwner: "co-1" };

test("only workspace data is synced, not per-person UI state", () => {
  assert.equal(isSyncedKey("voltmira_studio_pay_job-1"), true);
  assert.equal(isSyncedKey(JOBS_KEY), true);
  assert.equal(isSyncedKey("voltmira_studio_active_job"), false);
  assert.equal(isSyncedKey(OWNER_KEY), false);
  assert.equal(isSyncedKey("voltmira_theme"), false);
});

test("the workspace copy wins for a key both sides have", () => {
  const p = planHydration([{ key: "voltmira_studio_pay_a", value: { depPaid: true } }],
    [["voltmira_studio_pay_a", { depPaid: false }]], me);
  assert.deepEqual(p.writeLocal, [["voltmira_studio_pay_a", { depPaid: true }]]);
  assert.deepEqual(p.upload, []);
});

test("data only this browser has is uploaded once", () => {
  const p = planHydration([], [["voltmira_studio_actuals_a", ["1", "2"]]], { companyId: "co-1", cacheOwner: null });
  assert.deepEqual(p.upload, [{ key: "voltmira_studio_actuals_a", value: ["1", "2"] }]);
});

test("another workspace's cache is dropped, never uploaded", () => {
  const p = planHydration([{ key: JOBS_KEY, value: [{ id: "x" }] }],
    [[JOBS_KEY, [{ id: "other" }]], ["voltmira_studio_pay_other", { depPaid: true }]],
    { companyId: "co-1", cacheOwner: "co-2" });
  assert.deepEqual(p.upload, []);
  assert.deepEqual(p.writeLocal, [[JOBS_KEY, [{ id: "x" }]]]);
  assert.deepEqual(p.removeLocal, ["voltmira_studio_pay_other"]);
});

test("job lists merge by id and the workspace's version of a job wins", () => {
  const server = [{ id: "a", name: "Server A" }, { id: "b", name: "B" }];
  const local = [{ id: "a", name: "Local A" }, { id: "c", name: "C" }];
  assert.deepEqual(mergeJobs(server, local).map((j) => j.name), ["Server A", "B", "C"]);
  const p = planHydration([{ key: JOBS_KEY, value: server }], [[JOBS_KEY, local]], me);
  assert.equal(p.upload.length, 1);
  assert.deepEqual(p.upload[0].value.map((j) => j.id), ["a", "b", "c"]);
});

test("identical job lists need no upload", () => {
  const jobs = [{ id: "a" }];
  const p = planHydration([{ key: JOBS_KEY, value: jobs }], [[JOBS_KEY, jobs]], me);
  assert.deepEqual(p.upload, []);
});

test("an edit this browser never sent wins over the workspace copy, and a removal it never sent is carried out", async () => {
  const { planHydration, JOBS_KEY } = await import("./studioSyncPlan.js");
  const server = [
    { key: "voltmira_studio_install_j1", value: { signed: false } },
    { key: "voltmira_studio_actuals_j1", value: [1, 2] },
    { key: JOBS_KEY, value: [{ id: "j1", kw: 5 }, { id: "j2", kw: 3 }] },
  ];
  const local = [["voltmira_studio_install_j1", { signed: true }], [JOBS_KEY, [{ id: "j1", kw: 6 }]]];
  const p = planHydration(server, local, { companyId: "c1", cacheOwner: "c1", dirty: ["voltmira_studio_install_j1", "voltmira_studio_actuals_j1", JOBS_KEY] });
  assert.deepEqual(p.upload.find((u) => u.key === "voltmira_studio_install_j1").value, { signed: true });
  assert.equal(p.writeLocal.some(([k]) => k === "voltmira_studio_install_j1"), false);
  assert.deepEqual(p.removeRemote, ["voltmira_studio_actuals_j1"]);
  const jobs = p.upload.find((u) => u.key === JOBS_KEY).value;
  assert.deepEqual(jobs, [{ id: "j1", kw: 6 }, { id: "j2", kw: 3 }]);
  // another workspace's unsent marks count for nothing
  const f = planHydration(server, local, { companyId: "c1", cacheOwner: "c9", dirty: ["voltmira_studio_install_j1"] });
  assert.deepEqual(f.removeRemote, []);
  assert.deepEqual(f.writeLocal.find(([k]) => k === "voltmira_studio_install_j1")[1], { signed: false });
});
