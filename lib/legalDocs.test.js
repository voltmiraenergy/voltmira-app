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
import { buildServiceContract, buildCommissioningAct, docLocale } from "./legalDocs.js";

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

test("a Ukrainian quote gets the documents in Ukrainian, with its own dates, number format and ЄДРПОУ", () => {
  const doc = buildServiceContract({
    companyLegalName: "СолярТех ТОВ", companyRegNo: "12345678", companyAddress: "вул. Сонячна 1, Київ", companyIban: "UA00000000000000000000000000",
    clientName: "Іван Петренко", clientAddress: "вул. Квітів 5, Львів", systemKw: 6.4, price: 450000, currency: "UAH", locale: "uk",
  });
  assert.match(doc, /ДОГОВІР НА НАДАННЯ ПОСЛУГ/);
  assert.match(doc, /СолярТех ТОВ/);
  assert.match(doc, /12345678/);
  assert.match(doc, /Іван Петренко/);
  assert.match(doc, /6\.4 кВт \(пік\)/);
  assert.match(doc, /450[\s\u00a0\u202f]000 UAH/);
  assert.match(doc, /законодавства України/);
  assert.doesNotMatch(doc, /Republicii Moldova|PRESTĂRI|undefined|NaN/);
  assert.ok(!/[ыэёъ]/i.test(doc), "no Russian-only letters");
  assert.doesNotMatch(doc, /ст\.\s*\d+\s*(ЦК|ГК)|Закон(у)? №/i, "no invented citations of articles or laws");
});

test("the Ukrainian documents leave visible blanks, never throw, and keep the Romanian ones unchanged by default", () => {
  assert.doesNotMatch(buildServiceContract({ locale: "uk" }), /undefined|NaN/);
  assert.match(buildServiceContract({ locale: "uk" }), /_{5,}/);
  assert.match(buildServiceContract({}), /CONTRACT DE PRESTĂRI SERVICII/);
  assert.equal(docLocale("UA"), "uk");
  assert.equal(docLocale("MD"), "ro");
  assert.equal(docLocale(undefined), "ro");
});

test("the Ukrainian commissioning act: battery line, warranty years with the right plural, honest fallback", () => {
  const one = (y) => buildCommissioningAct({ companyLegalName: "СолярТех ТОВ", clientName: "Іван", systemKw: 6, hasBattery: true, battKwh: 10, warrantyYears: y, locale: "uk" });
  assert.match(one(5), /АКТ ВВЕДЕННЯ В ЕКСПЛУАТАЦІЮ/);
  assert.match(one(5), /10\.0 кВт·год/);
  assert.match(one(1), /1 рік/);
  assert.match(one(2), /2 роки/);
  assert.match(one(5), /5 років/);
  assert.match(one(11), /11 років/);
  assert.match(one(22), /22 роки/);
  const none = buildCommissioningAct({ companyLegalName: "СолярТех ТОВ", clientName: "Іван", systemKw: 6, hasBattery: false, locale: "uk" });
  assert.doesNotMatch(none, /Система накопичення/);
  assert.doesNotMatch(none, /\d+ (рік|роки|років)/);
  assert.match(none, /згідно з прийнятою пропозицією/);
});

test("an installer's own template still works for a Ukrainian quote", () => {
  const doc = buildServiceContract({ clientName: "Іван", templateOverride: "Договір з {{clientName}} на {{systemKw}} кВт, {{nope}}", systemKw: 5, locale: "uk" });
  assert.match(doc, /Договір з Іван на 5\.0 кВт, _{5,}/);
});
