import { test } from "node:test";
import assert from "node:assert/strict";
import { cleanSlug, slugFromName, cleanColor, textOn, pageLang } from "./publicPage.js";

test("a page address is lowercase letters, digits and single hyphens", () => {
  assert.equal(cleanSlug("SolarTech Chișinău"), "solartech-chisinau");
  assert.equal(cleanSlug("  --Solar__Tech!!  "), "solar-tech");
  assert.equal(cleanSlug("ab"), "");
  assert.equal(cleanSlug("admin"), "");
  assert.equal(cleanSlug("x".repeat(60)).length, 40);
});

test("a first address drops the company form", () => {
  assert.equal(slugFromName("SolarTech Instal SRL"), "solartech-instal");
  assert.equal(slugFromName("Energie Verde S.R.L."), "energie-verde");
});

test("a colour is #rrggbb or nothing", () => {
  assert.equal(cleanColor("#1E6B4E"), "#1e6b4e");
  assert.equal(cleanColor("red"), "");
  assert.equal(cleanColor("#123"), "");
});

test("text on a colour is whichever of white or ink reads better", () => {
  assert.equal(textOn("#1e6b4e"), "#ffffff");   // the app's green
  assert.equal(textOn("#e89b2d"), "#142A21");   // the app's amber
  assert.equal(textOn("#ffffff"), "#142A21");
});

test("the page speaks the asked language, else the browser's, else the installer's", () => {
  assert.equal(pageLang({ asked: "uk", acceptLanguage: "ru-RU", fallback: "ro" }), "uk");
  assert.equal(pageLang({ acceptLanguage: "ru-RU,ru;q=0.9,en;q=0.8", fallback: "ro" }), "ru");
  assert.equal(pageLang({ acceptLanguage: "de-DE,fr;q=0.9", fallback: "ro" }), "ro");
  assert.equal(pageLang({ fallback: "xx" }), "ro");
});
