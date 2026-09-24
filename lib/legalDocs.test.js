/**
 * lib/legalDocs.test.js — the template must never throw on missing data
 * (a brand-new project with no client name yet, a company that hasn't filled
 * in Settings' legal fields) and must actually interpolate the real values
 * it's given, not silently drop them.
 *
 * The grid-connection request used to be tested here too; it's now a real
 * filled PDF (lib/racordarePdf.js) — see lib/racordarePdf.test.js.
 *
 * Run: node --test lib/
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { buildServiceContract, buildCommissioningAct } from "./legalDocs.js";

test("buildServiceContract interpolates the real project/company data given", () => {
  const doc = buildServiceContract({
    companyLegalName: "SolarTech SRL", companyRegNo: "1234567890123",
    companyAddress: "Str. Solară 1, Chișinău", companyIban: "MD00AAAA000000000000",
    clientName: "Ion Popescu", clientAddress: "Str. Florilor 5, Iași",
    systemKw: 6.4, price: 11300, currency: "EUR",
  });
  assert.match(doc, /SolarTech SRL/);
  assert.match(doc, /1234567890123/);
  assert.match(doc, /Ion Popescu/);
  assert.match(doc, /6\.4 kWp/);
  assert.match(doc, /11\.300 EUR/); // ro-RO groups thousands with a period, not a comma
  assert.match(doc, /CONTRACT DE PRESTĂRI SERVICII/);
});

test("buildServiceContract never throws on missing data, and leaves visible blanks instead of \"undefined\"", () => {
  const doc = buildServiceContract({});
  assert.doesNotMatch(doc, /undefined/);
  assert.doesNotMatch(doc, /NaN/);
  assert.match(doc, /_{5,}/); // real blank placeholders, not silently empty
});

test("buildCommissioningAct interpolates real project data and states the real warranty period", () => {
  const doc = buildCommissioningAct({
    companyLegalName: "SolarTech SRL", companyRegNo: "1234567890123",
    clientName: "Ion Popescu", clientAddress: "Str. Florilor 5, Iași",
    systemKw: 6.4, hasBattery: true, battKwh: 10, warrantyYears: 5,
  });
  assert.match(doc, /ACT DE DARE ÎN EXPLOATARE/);
  assert.match(doc, /SolarTech SRL/);
  assert.match(doc, /Ion Popescu/);
  assert.match(doc, /6\.4 kWp/);
  assert.match(doc, /10\.0 kWh/);
  assert.match(doc, /de 5 ani/);
});

test("buildCommissioningAct omits the battery line when there's no battery, and never claims an unset warranty period", () => {
  const doc = buildCommissioningAct({
    companyLegalName: "SolarTech SRL", clientName: "Ion Popescu",
    systemKw: 6, hasBattery: false,
  });
  assert.doesNotMatch(doc, /Instalație de stocare/);
  assert.doesNotMatch(doc, /de \d+ ani/); // no specific year count fabricated
  assert.match(doc, /conform ofertei acceptate/); // honest fallback instead
});

test("buildCommissioningAct never throws on missing data", () => {
  const doc = buildCommissioningAct({});
  assert.doesNotThrow(() => buildCommissioningAct({}));
  assert.doesNotMatch(doc, /undefined/);
  assert.doesNotMatch(doc, /NaN/);
});
