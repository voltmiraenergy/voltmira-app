import { test } from "node:test";
import assert from "node:assert/strict";
import { GRID_RULES_SEED, latestGridRules, validateGridRules, diffGridRules, docAge, overdueOf } from "./gridRules.js";
import { checklistFor, checkPackage, nextGridStatus } from "./gridSubmission.js";

test("the seed is exactly what the code checked before the table existed", () => {
  const r = latestGridRules([], "premier");
  assert.equal(r.version, 0);
  assert.deepEqual(checklistFor("premier", "person", r).map((d) => d.id), checklistFor("premier", "person").map((d) => d.id));
  assert.deepEqual(checklistFor("rednord", "company", r).map((d) => d.id), checklistFor("rednord", "company").map((d) => d.id));
  assert.equal(r.maxAgeDays.registry_extract, 90);
  assert.deepEqual(r.expectedDays, { submitted: 10, docs_requested: 10, approved: 30, meter_installed: 14 });
  assert.equal(GRID_RULES_SEED.length, 2);
});

test("the latest version of an operator wins, and a stored row's fields are read", () => {
  const rows = [
    { operator: "premier", version: 1, docs: { person: ["application", "id_copy"], company: ["application"] }, max_age_days: {}, expected_days: { submitted: 5 } },
    { operator: "premier", version: 2, docs: { person: ["application", "signed"], company: ["application"] }, maxAgeDays: {}, expectedDays: { submitted: 7 } },
    { operator: "rednord", version: 3, docs: { person: ["application"], company: ["application"] } },
  ];
  const p = latestGridRules(rows, "premier");
  assert.equal(p.version, 2);
  assert.deepEqual(p.docs.person, ["application", "signed"]);
  assert.equal(p.expectedDays.submitted, 7);
  assert.equal(p.expectedDays.approved, 30, "a status the version did not name keeps the seed's days");
});

test("an admin's form: the application is always on the list, unknown documents and bad days are refused", () => {
  const ok = validateGridRules({
    operator: "rednord",
    docs: { person: ["id_copy", "property", "tax_cert"], company: ["registry_extract"] },
    custom: { tax_cert: { name: { en: "Tax certificate", ro: "Certificat fiscal", ru: "Налоговая справка", uk: "Податкова довідка" }, optional: true } },
    maxAgeDays: { registry_extract: "90", tax_cert: 30, property: "" },
    expectedDays: { submitted: 12, docs_requested: 10, approved: 30, meter_installed: 14 },
    note: "RED Nord asks for a tax certificate from November",
  });
  assert.equal(ok.ok, true);
  assert.deepEqual(ok.row.docs.person, ["application", "id_copy", "property", "tax_cert"]);
  assert.deepEqual(ok.row.docs.company, ["application", "registry_extract"]);
  assert.deepEqual(ok.row.max_age_days, { registry_extract: 90, tax_cert: 30 });
  assert.equal(ok.row.custom.tax_cert.optional, true);

  const bad = validateGridRules({
    operator: "other", docs: { person: ["nope"] }, custom: { id_copy: { name: {} } },
    maxAgeDays: { id_copy: -1 }, expectedDays: { submitted: 0, docs_requested: 10, approved: 30 },
  });
  assert.equal(bad.ok, false);
  for (const e of ["operator", "docs_person", "custom_id", "max_age", "expected_submitted", "expected_meter_installed"]) assert.ok(bad.errors.includes(e), e);
});

test("what changed between two versions", () => {
  const a = latestGridRules([], "premier");
  const b = { ...a, docs: { ...a.docs, person: [...a.docs.person, "site_sketch"] }, expectedDays: { ...a.expectedDays, approved: 45 } };
  assert.deepEqual(diffGridRules(a, b), ["docs.person", "expected.approved"]);
  assert.deepEqual(diffGridRules(a, a), []);
  assert.deepEqual(diffGridRules(null, a), ["all"]);
});

test("a document that must be recent: no date, too old, from the future, fine", () => {
  assert.deepEqual(docAge("", 90, "2026-10-24"), { state: "missing", age: null });
  assert.deepEqual(docAge("2026-07-01", 90, "2026-10-24"), { state: "expired", age: 115 });
  assert.equal(docAge("2026-11-01", 90, "2026-10-24").state, "future");
  assert.deepEqual(docAge("2026-07-26", 90, "2026-10-24"), { state: "ok", age: 90 });
});

test("the package with rules: an old register extract blocks, and an owner or manager may send past it", () => {
  const rules = latestGridRules([], "premier");
  const base = { operator: "premier", kind: "company", attached: ["signed", "registry_extract", "property", "site_sketch"], rules, today: "2026-10-24" };
  const old = checkPackage({ ...base, docDates: { registry_extract: "2026-06-01" } });
  assert.equal(old.complete, false);
  assert.deepEqual(old.expiredDocs.map((x) => [x.id, x.state]), [["registry_extract", "expired"]]);
  assert.deepEqual(old.blockers, ["age:registry_extract"]);
  assert.equal(old.overridable, true);
  assert.equal(checkPackage({ ...base, docDates: { registry_extract: "2026-10-01" } }).complete, true);
  const noDetails = checkPackage({ ...base, missingDetails: ["cadastral"], docDates: { registry_extract: "2026-06-01" } });
  assert.equal(noDetails.overridable, false, "the operator's form cannot be filled without the details");
  // a document the admin added is asked for, with its own name
  const withCustom = { ...rules, docs: { ...rules.docs, person: [...rules.docs.person, "tax_cert"] }, custom: { tax_cert: { name: { en: "Tax certificate", ro: "Certificat fiscal", ru: "Справка", uk: "Довідка" } } } };
  const p = checkPackage({ operator: "premier", attached: ["signed", "id_copy", "property"], rules: withCustom, today: "2026-10-24" });
  assert.deepEqual(p.missingDocs, ["tax_cert"]);
});

test("the meter step sits between the approval and the connection, and may be skipped", () => {
  assert.equal(nextGridStatus("approved", "meter_installed").ok, true);
  assert.equal(nextGridStatus("meter_installed", "connected").ok, true);
  assert.equal(nextGridStatus("approved", "connected").ok, true);
  assert.equal(nextGridStatus("submitted", "meter_installed").ok, false);
  assert.equal(nextGridStatus("meter_installed", "rejected").ok, true);
});

test("overdue: past the operator's usual days in a waiting step, never in a final one", () => {
  const rules = latestGridRules([], "premier");
  assert.deepEqual(overdueOf("submitted", "2026-10-10", "2026-10-24", rules), { days: 14, expected: 10, overdue: true });
  assert.deepEqual(overdueOf("submitted", "2026-10-20", "2026-10-24", rules), { days: 4, expected: 10, overdue: false });
  assert.equal(overdueOf("connected", "2026-01-01", "2026-10-24", rules).overdue, false);
});
