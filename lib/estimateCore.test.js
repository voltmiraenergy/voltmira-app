import { test } from "node:test";
import assert from "node:assert/strict";
import { MARKET_CFG } from "./estimateCore.js";
import { MARKETS } from "@voltmira/engine";

test("the free estimate prices a bill at the market's own default tariff, the one its quote starts with", () => {
  for (const cc of ["RO", "MD", "UA"]) assert.equal(MARKET_CFG[cc].price, MARKETS[cc].defaultPrice, cc);
});

test("Ukraine is estimated in hryvnias, not as Romania", () => {
  assert.equal(MARKET_CFG.UA.currency, "UAH");
});
