/**
 * lib/legalDocs.test.js — the templates must never throw on missing data
 * (a brand-new project with no client name yet, a company that hasn't filled
 * in Settings' legal fields) and must actually interpolate the real values
 * they're given, not silently drop them.
 *
 * Run: node --test lib/
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { buildServiceContract, buildConnectionRequest } from "./legalDocs.js";

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

test("buildConnectionRequest names the installer and states battery presence honestly", () => {
  const withBatt = buildConnectionRequest({
    companyLegalName: "SolarTech SRL", companyRegNo: "123", clientName: "Ion Popescu",
    clientAddress: "Str. Florilor 5, Iași", systemKw: 6, hasBattery: true,
  });
  assert.match(withBatt, /cu stocare \(baterie\)/);
  assert.doesNotMatch(withBatt, /fără stocare/);

  const noBatt = buildConnectionRequest({
    companyLegalName: "SolarTech SRL", companyRegNo: "123", clientName: "Ion Popescu",
    clientAddress: "Str. Florilor 5, Iași", systemKw: 6, hasBattery: false,
  });
  assert.match(noBatt, /fără stocare/);
});

test("buildConnectionRequest never throws on missing data", () => {
  assert.doesNotThrow(() => buildConnectionRequest({}));
});
