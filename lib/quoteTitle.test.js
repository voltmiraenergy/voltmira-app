import test from "node:test";
import assert from "node:assert/strict";
import { defaultQuoteTitle, isPlaceholderTitle } from "./quoteTitle.js";

test("a new quote starts with the workspace language's own words", () => {
  assert.equal(defaultQuoteTitle("ro"), "Ofertă nouă");
  assert.equal(defaultQuoteTitle("en"), "New quote");
  assert.equal(defaultQuoteTitle("ru"), "Новый расчёт");
  assert.equal(defaultQuoteTitle("uk"), "Новий розрахунок");
  assert.equal(defaultQuoteTitle(undefined), "New quote", "an unknown language falls back to English");
});

test("the default title, in any language, counts as no title yet", () => {
  for (const l of ["en", "ro", "ru", "uk"]) assert.equal(isPlaceholderTitle(defaultQuoteTitle(l)), true, l);
  assert.equal(isPlaceholderTitle("  new QUOTE "), true);
  assert.equal(isPlaceholderTitle(""), true);
  assert.equal(isPlaceholderTitle(null), true);
});

test("a title someone typed is kept", () => {
  assert.equal(isPlaceholderTitle("Vila Popescu, Chișinău"), false);
  assert.equal(isPlaceholderTitle("Ofertă nouă pentru Ion"), false);
});
