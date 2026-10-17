import { test } from "node:test";
import assert from "node:assert/strict";
import { validateTariffInput, validateSubsidyInput } from "./adminValidate.js";
import { checkEligibility } from "./eligibility.js";

const goodTariff = {
  operator: "premier", effective_from: "2026-11-01", retail_day: "3,80", retail_night: "2.95",
  export_monthly: ["3.1", "2.8", "2.6", "2.3", "2.4", "2.7", "2.6", "2.2", "2.1", "2.6", "2.7", "2.7"],
  source_title: "Premier Energy, tabel noiembrie 2026", source_url: "https://premierenergy.md/x",
};

test("a tariff form becomes integer minor units on the server", () => {
  const r = validateTariffInput(goodTariff);
  assert.equal(r.ok, true);
  assert.equal(r.row.retail_day_minor_per_mwh, 380000, "a comma decimal is read");
  assert.equal(r.row.export_monthly[0], 310000);
  assert.ok(r.row.export_monthly.every(Number.isInteger));
  assert.equal(r.row.market, "MD");
  assert.equal(r.row.currency, "MDL");
});

test("a bad tariff form names every field that is wrong", () => {
  const r = validateTariffInput({ operator: "x", effective_from: "2026-13-40", effective_to: "2020-01-01", retail_day: "-1", export_monthly: [], source_title: "", source_url: "http://insecure" });
  assert.equal(r.ok, false);
  for (const k of ["operator", "effective_from", "effective_to", "retail_day", "source_title", "source_url", "export_price"]) assert.ok(r.errors.includes(k), k);
  assert.ok(validateTariffInput({ ...goodTariff, export_monthly: ["500"] }).errors.includes("export_monthly.0"), "over 100 lei/kWh");
});

const goodProgram = {
  code: "facem_373", kind: "grant", name: { en: "FACEM", ro: "FACEM", ru: "FACEM", uk: "FACEM" }, provider: "FACEM",
  clientKinds: ["sme"], requiresBattery: true, netMetering: true,
  estimateType: "pct_of", base: "battery", pct: "40", upTo: true,
  documents: [{ id: "net_metering_contract", name: { en: "a", ro: "b", ru: "c", uk: "d" } }],
  valid_from: "2026-11-01", source_url: "",
};

test("a programme form becomes the table's row, and the checker reads it", () => {
  const r = validateSubsidyInput(goodProgram);
  assert.equal(r.ok, true);
  assert.deepEqual(r.row.eligibility, { clientKinds: ["sme"], requiresBattery: true, netMetering: true });
  assert.deepEqual(r.row.estimate, { type: "pct_of", base: "battery", pct: 40, upTo: true });
  const res = checkEligibility([{ ...r.row, version: 2 }], { market: "MD", clientKind: "sme", kw: 10, batteryMinor: 100000, systemMinor: 300000, date: "2026-11-02" }, { netMetering: true });
  assert.equal(res[0].status, "eligible");
  assert.equal(res[0].estimateMinor, 40000);
});

test("a bad programme form is refused with its fields", () => {
  const r = validateSubsidyInput({ code: "Bad Code!", kind: "gift", name: { en: "x" }, clientKinds: [], estimateType: "pct_of", pct: 150, base: "moon", valid_from: "2026-12-01", valid_to: "2026-01-01" });
  assert.equal(r.ok, false);
  for (const k of ["code", "kind", "name.ro", "clientKinds", "pct", "base", "valid_to"]) assert.ok(r.errors.includes(k), k);
});
