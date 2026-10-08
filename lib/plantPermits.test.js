import { test } from "node:test";
import assert from "node:assert/strict";
import { PERMITS, permitItem, plantDocs, permitProgress } from "./plantPermits.js";

test("every item depends only on items that exist, and the list has no cycle", () => {
  const ids = new Set(PERMITS.map((p) => p.id));
  for (const p of PERMITS) for (const d of p.deps) assert.ok(ids.has(d), `${p.id} -> ${d}`);
  const seen = new Set();
  const visit = (id, path = []) => {
    assert.ok(!path.includes(id), `cycle ${[...path, id].join(" > ")}`);
    if (seen.has(id)) return;
    PERMITS.find((p) => p.id === id).deps.forEach((d) => visit(d, [...path, id]));
    seen.add(id);
  };
  PERMITS.forEach((p) => visit(p.id));
});

test("an item record is cleaned: unknown status is todo, bad dates are dropped", () => {
  assert.deepEqual(permitItem({ grid: { status: "weird", due: "tomorrow", ref: "A-1" } }, "grid"), { status: "todo", by: "", ref: "A-1", submitted: "", due: "" });
  assert.equal(permitItem(null, "land").status, "todo");
});

test("the lender's document slots follow the checklist", () => {
  assert.deepEqual(plantDocs({}), { land: "missing", grid: "missing", permit: "missing", design: "missing", offtake: "missing", es: "missing" });
  const d = plantDocs({ land: { status: "done" }, grid: { status: "in_progress" }, urbanism: { status: "done" }, building: { status: "todo" }, licence: { status: "na" }, contract: { status: "done" } });
  assert.equal(d.land, "done");
  assert.equal(d.grid, "draft");
  assert.equal(d.permit, "draft");
  assert.equal(d.offtake, "done");
  assert.equal(d.es, "missing");
});

test("progress: what is done, what can start now in parallel, what waits and what is overdue", () => {
  const p = permitProgress({ land: { status: "done" }, yield: { status: "in_progress", due: "2026-09-01" }, licence: { status: "na" } }, "2026-10-03");
  assert.equal(p.total, PERMITS.length - 1);
  assert.equal(p.done, 1);
  // with the land in hand, the urban planning certificate, the EIA and the grid application can all start
  for (const id of ["urbanism", "eia", "grid", "contract", "om"]) assert.ok(p.ready.includes(id), id);
  assert.equal(p.rows.find((r) => r.id === "building").state, "waiting");
  assert.deepEqual(p.rows.find((r) => r.id === "design").blockedBy, ["urbanism", "grid"]);
  assert.deepEqual(p.overdue, ["yield"]);
});
