import { test } from "node:test";
import assert from "node:assert/strict";
import { t, normLang, LANGS, LANG_NAMES, TABLE } from "./i18n.js";

test("Ukrainian is a language of the app", () => {
  assert.ok(LANGS.includes("uk"));
  assert.equal(normLang("uk"), "uk");
  assert.equal(LANG_NAMES.uk, "Українська");
  assert.equal(t("nav_dashboard", "uk"), "Панель");
  assert.equal(t("lead_visit_title", "uk", { name: "Ion" }), "Виїзд на об’єкт: Ion");
});

test("every string that has Russian also has Ukrainian, with the same placeholders", () => {
  const ph = (s) => (String(s).match(/\{[a-zA-Z0-9_]+\}/g) || []).sort().join("|");
  const bad = [];
  for (const [k, row] of Object.entries(TABLE)) {
    if (row.ru == null) continue;
    if (row.uk == null) { bad.push(k + ": missing"); continue; }
    if (ph(row.uk) !== ph(row.ru)) bad.push(k + ": placeholders differ");
    // letters Ukrainian does not have: a Russian word slipped in
    if (/[ыэъёЫЭЪЁ]/.test(row.uk)) bad.push(k + ": Russian letter");
    if (/\u2014/.test(row.uk)) bad.push(k + ": em dash");
  }
  assert.deepEqual(bad, []);
});
