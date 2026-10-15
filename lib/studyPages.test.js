import { test } from "node:test";
import assert from "node:assert/strict";
import { scorePage, pickPages, hasTextLayer, parseRange, quoteOnPage, numbersIn, valueInQuote, pagesText, MAX_PAGES } from "./studyPages.js";

const filler = "The site lies on agricultural land with access from the national road. ".repeat(4);
const results = "Table 8.1 Net energy yield. P50 net AEP 153.3 GWh/year. P90 (1 year) 128.4 GWh/year. P90 (10 years) 139.1 GWh/year. Total uncertainty 10.8%.";

test("results pages outscore the rest, in four languages", () => {
  assert.ok(scorePage(results) > scorePage(filler) + 10);
  assert.ok(scorePage("Producția anuală netă P50: 153.346 MWh; incertitudine 10,8%") > 5);
  assert.ok(scorePage("Годовая выработка P50 153 ГВт·ч, неопределённость 10,8%") > 5);
  assert.ok(scorePage("Річний виробіток P50 153 ГВт·год, невизначеність 10,8%") > 5);
  assert.equal(scorePage(""), 0);
});

test("the first page and the best results pages are sent, in page order", () => {
  const pages = Array.from({ length: 90 }, () => filler);
  pages[0] = "Energy Yield Assessment, Parcul hibrid Sud. Prepared by Windtest SRL, 2026-05-14.";
  pages[6] = results; pages[41] = "Uncertainty analysis: total uncertainty 10.8%, P90 over 10 years.";
  pages[57] = "Losses: wake 6.1%, availability 3%, electrical 2%.";
  const picked = pickPages(pages);
  assert.equal(picked[0], 1);
  assert.ok(picked.includes(7) && picked.includes(42) && picked.includes(58));
  assert.deepEqual(picked, [...picked].sort((a, b) => a - b));
  // never more than the cap, however many pages mention P50
  assert.ok(pickPages(Array.from({ length: 200 }, () => results)).length <= MAX_PAGES);
  assert.deepEqual(pickPages([]), []);
});

test("a scan has no text layer; a normal study does", () => {
  assert.equal(hasTextLayer(Array.from({ length: 40 }, () => "")), false);
  assert.equal(hasTextLayer(["", "", "  12  "]), false);
  assert.equal(hasTextLayer(Array.from({ length: 10 }, (_, i) => (i < 3 ? "" : filler))), true);
});

test("pages typed by hand", () => {
  assert.deepEqual(parseRange("4-9, 12", 50), [4, 5, 6, 7, 8, 9, 12]);
  assert.deepEqual(parseRange("3 3 2", 50), [2, 3]);
  assert.deepEqual(parseRange("48-60", 50), [48, 49, 50]);
  assert.equal(parseRange("9-4", 50), null);
  assert.equal(parseRange("abc", 50), null);
  assert.equal(parseRange("", 50), null);
  assert.equal(parseRange("1-30", 50), null, "more than 15 pages");
});

test("a quote counts only when it is on that page, whatever the spacing", () => {
  assert.ok(quoteOnPage("P50 net AEP 153.3 GWh/year", results));
  assert.ok(quoteOnPage("p50  net   aep 153.3gwh/year", results));
  assert.ok(!quoteOnPage("P50 net AEP 163.3 GWh/year", results));
  assert.ok(!quoteOnPage("P5", results), "too short to mean anything");
  assert.ok(quoteOnPage("Producția netă – 12,5 GWh", "Producţia netă - 12,5 GWh"), "cedilla and dash variants");
});

test("numbers are read with either decimal mark and thousands separators", () => {
  assert.deepEqual(numbersIn("153.3 GWh"), [153.3]);
  assert.ok(numbersIn("153,3 GWh").includes(153.3));
  assert.ok(numbersIn("153 346 MWh").includes(153346));
  assert.ok(numbersIn("153.346 MWh").includes(153346), "Romanian thousands");
  assert.ok(numbersIn("153,346 MWh").includes(153346), "English thousands");
  assert.ok(numbersIn("1,234.5").includes(1234.5));
  assert.ok(numbersIn("1.234,5").includes(1234.5));
  assert.ok(valueInQuote(153.3, "P50 net AEP 153.3 GWh/year"));
  assert.ok(valueInQuote(153346, "P50: 153.346 MWh/an"));
  assert.ok(!valueInQuote(160, "P50 net AEP 153.3 GWh/year"));
  assert.ok(!valueInQuote(null, "153"));
});

test("pages go out with the marker the reader cites", () => {
  const t = pagesText([{ n: 7, text: "abc" }, { n: 42, text: "x".repeat(9000) }]);
  assert.match(t, /^=== Page 7 ===\nabc/);
  assert.match(t, /=== Page 42 ===/);
  assert.ok(t.length < 7200 + 40);
});
