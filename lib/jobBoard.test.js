import { test } from "node:test";
import assert from "node:assert/strict";
import { columnOf, moveTo, boardOf, BOARD_COLUMNS } from "./jobBoard.js";
import { mondayOf, weekDays, overlaps, clashesWith, cleanVisit, visitsByDay, cleanCrew } from "./crewVisits.js";
import { mergeRecord, cleanSerials, cleanRecord, recordProgress } from "./siteRecord.js";

test("a job stands in the column of its furthest step; moving it ticks up to there and clears the rest", () => {
  assert.equal(columnOf({}), "signed");
  assert.equal(columnOf({ deposit: "2026-10-01", permit: "2026-10-05" }), "permit");
  assert.equal(columnOf({ grid: "2026-10-09" }), "grid", "a step ticked out of order still counts");
  const moved = moveTo({ deposit: "2026-10-01" }, "install", "2026-10-24");
  assert.deepEqual(moved, { deposit: "2026-10-01", permit: "2026-10-24", order: "2026-10-24", install: "2026-10-24" });
  assert.deepEqual(moveTo(moved, "permit", "2026-10-25"), { deposit: "2026-10-01", permit: "2026-10-24" });
  assert.deepEqual(moveTo(moved, "signed", "2026-10-25"), {});
  assert.equal(BOARD_COLUMNS.length, 7);
});

test("the board: cards by column, longest waiting first, with the next visit", () => {
  const b = boardOf([
    { id: "A", install_progress: { deposit: "2026-10-10" } },
    { id: "B", install_progress: { deposit: "2026-10-02" } },
    { id: "C", install_progress: {}, wonDay: "2026-10-20" },
  ], [{ project_id: "A", starts_at: "2026-10-30T07:00:00Z" }, { project_id: "A", starts_at: "2026-10-27T07:00:00Z" }]);
  assert.deepEqual(b.deposit.map((c) => c.id), ["B", "A"]);
  assert.equal(b.deposit[1].nextVisit.starts_at, "2026-10-27T07:00:00Z");
  assert.equal(b.signed[0].since, "2026-10-20");
});

test("crew weeks and double bookings", () => {
  assert.equal(mondayOf("2026-10-24"), "2026-10-19");
  assert.equal(mondayOf("2026-10-19"), "2026-10-19");
  assert.deepEqual(weekDays("2026-10-19").slice(-1), ["2026-10-25"]);
  const a = { id: "1", crew_id: "K", starts_at: "2026-10-20T06:00:00Z", ends_at: "2026-10-20T10:00:00Z" };
  const b = { id: "2", crew_id: "K", starts_at: "2026-10-20T09:00:00Z", ends_at: "2026-10-20T12:00:00Z" };
  const c = { id: "3", crew_id: "K", starts_at: "2026-10-20T10:00:00Z", ends_at: "2026-10-20T12:00:00Z" };
  const d = { ...b, id: "4", crew_id: "L" };
  assert.equal(overlaps(a, b), true);
  assert.equal(overlaps(a, c), false, "back to back is fine");
  assert.equal(overlaps(a, d), false, "another crew");
  assert.deepEqual(clashesWith(a, [a, b, c, d]).map((v) => v.id), ["2"]);
});

test("a visit as typed is checked and timed on the Chișinău clock", () => {
  const P = "11111111-1111-4111-8111-111111111111", K = "22222222-2222-4222-8222-222222222222";
  const ok = cleanVisit({ project_id: P, crew_id: K, kind: "install", day: "2026-10-27", from: "08:00", to: "16:30", note: " roof ladder " });
  assert.equal(ok.ok, true);
  assert.equal(ok.row.starts_at, "2026-10-27T06:00:00.000Z", "08:00 in Chișinău is 06:00 UTC in late October (winter time)");
  assert.equal(ok.row.note, "roof ladder");
  assert.equal(ok.row.notify_client, true);
  assert.deepEqual(cleanVisit({ project_id: "x", crew_id: K, kind: "party", day: "27.10", from: "10:00", to: "09:00" }).errors, ["project", "kind", "day", "time"]);
  const byDay = visitsByDay([ok.row], "2026-10-26");
  assert.equal(byDay["2026-10-27"].length, 1);
  assert.deepEqual(cleanCrew({ name: "Echipa A", members: "Vadim, Sergiu", color: "#ABCDEF" }).row, { name: "Echipa A", members: "Vadim, Sergiu", color: "#abcdef" });
  assert.equal(cleanCrew({ name: "" }).ok, false);
});

test("serial numbers are cleaned, and a site record merges a teammate's changes item by item", () => {
  assert.deepEqual(cleanSerials("ab 12\nAB12, cd34;;"), ["AB12", "CD34"]);
  const base = cleanRecord({ checklist: { arrive: { at: "2026-10-24T07:00:00Z", by: "Vadim" } }, serials: { panel: ["P1", "P2"] } });
  const server = cleanRecord({ ...base, checklist: { ...base.checklist, mount: { at: "2026-10-24T09:00:00Z", by: "Sergiu" } }, serials: { panel: ["P1", "P2", "P3"] } });
  const mine = cleanRecord({ ...base, checklist: { ...base.checklist, dc: { at: "2026-10-24T10:00:00Z", by: "Vadim" } }, serials: { panel: ["P2", "P9"] } });
  const r = mergeRecord(server, base, mine);
  assert.deepEqual(Object.keys(r.record.checklist).sort(), ["arrive", "dc", "mount"]);
  assert.deepEqual(r.record.serials.panel, ["P2", "P3", "P9"], "P1 removed here, P3 added there, P9 added here");
  assert.deepEqual(r.conflicts, []);
  // both changed the same item: the later one stands, and it is said
  const s2 = cleanRecord({ ...base, checklist: { arrive: { at: "2026-10-24T08:00:00Z", by: "Ion" } } });
  const m2 = cleanRecord({ ...base, checklist: {} });
  const r2 = mergeRecord(s2, base, m2);
  assert.deepEqual(r2.conflicts, ["checklist.arrive"]);
  assert.equal(r2.record.checklist.arrive.by, "Ion", "a tick against an untick: the tick stands");
  const png = "data:image/png;base64,iVBORw0KGgo=";
  const signedHere = cleanRecord({ ...base, signature: { png, name: "Ion Bivol", at: "2026-10-24T15:00:00Z" } });
  assert.equal(mergeRecord(base, base, signedHere).record.signature.name, "Ion Bivol");
  assert.equal(cleanRecord({ signature: { png: "javascript:alert(1)" } }).signature, null);
  assert.deepEqual(recordProgress(r.record), { done: 3, total: 8, serials: 3, signed: false });
});
