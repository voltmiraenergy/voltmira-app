import { test } from "node:test";
import assert from "node:assert/strict";
import { engineBase } from "./engineSettings.js";
import { rowToQuoteInput } from "./quoteInput.js";

test("the grant set in Settings reaches every live quote, 0 included", () => {
  assert.equal(engineBase({ subsidy_amount_ron: 0 }).subsidyAmountRon, 0);
  assert.equal(engineBase({ subsidy_amount_ron: "15000" }).subsidyAmountRon, 15000);
});

test("without a grant in Settings the engine's own value stays", () => {
  assert.equal(engineBase({}).subsidyAmountRon, 20000);
  assert.equal(engineBase({ subsidy_amount_ron: null, engine: { subsidyAmountRon: 9000 } }).subsidyAmountRon, 9000);
  assert.equal(engineBase(null).subsidyAmountRon, 20000);
});

test("a row carries its tariff mode into the quote, as the editor does", () => {
  assert.equal(rowToQuoteInput({ kw: 10, price: 1000, cons: 12000, market: "MD", tariff_mode: "diff" }).tariffMode, "diff");
  assert.equal(rowToQuoteInput({ kw: 10, price: 1000, cons: 12000, market: "MD" }).tariffMode, "flat");
});
