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

test("a quote named after its client and size, and only while the app chose the name", async () => {
  const { autoQuoteTitle, nextAutoTitle } = await import("./quoteTitle.js");
  assert.equal(autoQuoteTitle({ client: " Ion  Popescu ", kw: 6 }, "ro"), "Ion Popescu, 6 kW");
  assert.equal(autoQuoteTitle({ client: "Ion Popescu", kw: 6.54 }, "ro"), "Ion Popescu, 6,5 kW");
  assert.equal(autoQuoteTitle({ client: "Ion Popescu", kw: 6.54 }, "en"), "Ion Popescu, 6.5 kW");
  assert.equal(autoQuoteTitle({ client: "Ion Popescu", kw: 0 }, "ro"), "Ion Popescu");
  assert.equal(autoQuoteTitle({ client: "", kw: 6 }, "ro"), null);
  // from "Ofertă nouă", from the bare name a lead gave, from the last automatic name
  assert.equal(nextAutoTitle({ title: "Ofertă nouă", client: "", kw: 6 }, { client: "Ana Rusu", kw: 6 }), "Ana Rusu, 6 kW");
  assert.equal(nextAutoTitle({ title: "Ana Rusu", client: "Ana Rusu", kw: 5 }, { client: "Ana Rusu", kw: 6 }), "Ana Rusu, 6 kW");
  assert.equal(nextAutoTitle({ title: "Ana Rusu, 6 kW", client: "Ana Rusu", kw: 6 }, { client: "Ana Rusu", kw: 8 }), "Ana Rusu, 8 kW");
  // a name the installer typed stays; nothing changes when neither client nor size did
  assert.equal(nextAutoTitle({ title: "Casa de la deal", client: "Ana Rusu", kw: 6 }, { client: "Ana Rusu", kw: 8 }), null);
  assert.equal(nextAutoTitle({ title: "Ofertă nouă", client: "Ana", kw: 6 }, { client: "Ana", kw: 6 }), null);
});
