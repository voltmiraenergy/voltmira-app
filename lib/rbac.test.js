import { test } from "node:test";
import assert from "node:assert/strict";
import { canViewAllProjects, canEditTechnical, canViewTeamPerformance } from "./rbac.js";

test("with rbac disabled, everyone is fully privileged regardless of title", () => {
  const sales = { role: "member", title: "sales" };
  assert.equal(canViewAllProjects(sales, false), true);
  assert.equal(canEditTechnical(sales, false), true);
  assert.equal(canViewTeamPerformance(sales, false), true);
});

test("owner is always fully privileged, even with a restrictive title", () => {
  const owner = { role: "owner", title: "sales" };
  assert.equal(canViewAllProjects(owner, true), true);
  assert.equal(canEditTechnical(owner, true), true);
  assert.equal(canViewTeamPerformance(owner, true), true);
});

test("a member with no title set (the column default) is fully privileged, not silently locked down", () => {
  const untitled = { role: "member", title: "" };
  assert.equal(canViewAllProjects(untitled, true), true);
  assert.equal(canEditTechnical(untitled, true), true);
  assert.equal(canViewTeamPerformance(untitled, true), true);
});

test("sales, once rbac is on, is scoped to their own projects and can't touch technical config or teammates' numbers", () => {
  const sales = { role: "member", title: "sales" };
  assert.equal(canViewAllProjects(sales, true), false);
  assert.equal(canEditTechnical(sales, true), false);
  assert.equal(canViewTeamPerformance(sales, true), false);
});

test("engineer sees/edits every project's technical config, but not teammates' performance", () => {
  const eng = { role: "member", title: "engineer" };
  assert.equal(canViewAllProjects(eng, true), true);
  assert.equal(canEditTechnical(eng, true), true);
  assert.equal(canViewTeamPerformance(eng, true), false);
});

test("manager sees everything, including teammates' performance", () => {
  const mgr = { role: "member", title: "manager" };
  assert.equal(canViewAllProjects(mgr, true), true);
  assert.equal(canEditTechnical(mgr, true), true);
  assert.equal(canViewTeamPerformance(mgr, true), true);
});

test("a missing profile (no session) never crashes and defaults to privileged — callers must gate on auth separately", () => {
  assert.equal(canViewAllProjects(null, true), true);
  assert.equal(canEditTechnical(undefined, true), true);
});

test("owner only when the profile was read and says owner: a failed read or a missing row is not an owner", async () => {
  const { isOwnerRow } = await import("./rbac.js");
  assert.equal(isOwnerRow({ data: { role: "owner" }, error: null }), true);
  assert.equal(isOwnerRow({ data: { role: "member" }, error: null }), false);
  assert.equal(isOwnerRow({ data: null, error: { code: "08006", message: "connection lost" } }), false, "a failed read used to make a member an owner");
  assert.equal(isOwnerRow({ data: null, error: null }), false);
  assert.equal(isOwnerRow(undefined), false);
});
