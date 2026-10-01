import { test } from "node:test";
import assert from "node:assert/strict";
import { suggestOperator, splitMdAddress, gridFileStatus, GRID_STAGES } from "./mdGrid.js";

test("the north goes to RED Nord, everywhere else to Premier Energy", () => {
  assert.equal(suggestOperator("str. Independenței 12, mun. Bălți"), "rednord");
  assert.equal(suggestOperator("s. Pîrjota, r-nul Rîșcani"), "rednord");
  assert.equal(suggestOperator("or. Sîngerei, str. Mihai Eminescu 5"), "rednord");
  assert.equal(suggestOperator("Soroca"), "rednord");
  assert.equal(suggestOperator("str. Alexandru cel Bun 15, Ialoveni"), "premier");
  assert.equal(suggestOperator("bd. Ștefan cel Mare 1, Chișinău"), "premier");
  assert.equal(suggestOperator(""), "premier");
  // a street named after a northern town is not the north
  assert.equal(suggestOperator("str. Soroceanca 3, Chișinău"), "premier");
});

test("an address is split into the parts the forms ask for, and nothing is guessed", () => {
  assert.deepEqual(splitMdAddress("str. Alexandru cel Bun 15, s. Horești, r-nul Ialoveni"),
    { street: "str. Alexandru cel Bun", nr: "15", locality: "s. Horești", district: "Ialoveni" });
  assert.deepEqual(splitMdAddress("bd. Ștefan cel Mare 1, Chișinău"),
    { street: "bd. Ștefan cel Mare", nr: "1", locality: "Chișinău", district: "" });
  assert.deepEqual(splitMdAddress("str. Grenoble nr. 142/2, Chișinău, MD-2019"),
    { street: "str. Grenoble", nr: "142/2", locality: "Chișinău", district: "" });
  assert.deepEqual(splitMdAddress("Bălți"), { street: "", nr: "", locality: "Bălți", district: "" });
  assert.deepEqual(splitMdAddress(""), { street: "", nr: "", locality: "", district: "" });
});

test("a file waits on its next stage, and asks for a call once it has waited long enough", () => {
  assert.equal(gridFileStatus({}, "2026-09-27").next, "applied");
  const s = gridFileStatus({ stages: { applied: "2026-09-10" } }, "2026-09-27");
  assert.equal(s.next, "approval");
  assert.equal(s.waitingDays, 17);
  assert.equal(s.chase, true);
  const fresh = gridFileStatus({ stages: { applied: "2026-09-24" } }, "2026-09-27");
  assert.equal(fresh.chase, false);
  // installing is the installer's own job: never a reason to chase the operator
  const inst = gridFileStatus({ stages: { applied: "2026-08-01", approval: "2026-08-12" } }, "2026-09-27");
  assert.equal(inst.next, "installed");
  assert.equal(inst.chase, false);
  const all = Object.fromEntries(GRID_STAGES.map((x) => [x.id, "2026-09-01"]));
  assert.equal(gridFileStatus({ stages: all }, "2026-09-27").complete, true);
});
