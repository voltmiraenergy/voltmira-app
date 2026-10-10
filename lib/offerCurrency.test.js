import { test } from "node:test";
import assert from "node:assert/strict";
import {
  OFFER_CURRENCIES, MARKET_CURRENCY, normCurrency, effectiveOfferCurrency,
  betterCurrencyFor, currencyOnMarketChange,
} from "./offerCurrency.js";
import { invoiceAmounts, vatBreakdown } from "./invoiceMath.js";
import { moneyFormatter } from "./money.js";

test("the offer currency set matches what companies.currency allows", () => {
  assert.deepEqual([...OFFER_CURRENCIES].sort(), ["EUR", "MDL", "RON", "UAH"]);
  assert.deepEqual(MARKET_CURRENCY, { MD: "MDL", UA: "UAH", RO: "RON" });
});

test("normCurrency accepts the four codes in any case and nothing else", () => {
  assert.equal(normCurrency("uah"), "UAH");
  assert.equal(normCurrency(" MDL "), "MDL");
  assert.equal(normCurrency("USD"), null);
  assert.equal(normCurrency(""), null);
  assert.equal(normCurrency(null), null);
  assert.equal(normCurrency(undefined), null);
});

test("an offer's own currency wins over the workspace's", () => {
  assert.equal(effectiveOfferCurrency("UAH", "MDL", "UA"), "UAH");
  assert.equal(effectiveOfferCurrency("EUR", "MDL", "MD"), "EUR");
  // even when it is not the market's own: the installer chose it
  assert.equal(effectiveOfferCurrency("MDL", "UAH", "UA"), "MDL");
});

test("null on the quote follows the workspace, whatever the market", () => {
  assert.equal(effectiveOfferCurrency(null, "MDL", "MD"), "MDL");
  assert.equal(effectiveOfferCurrency(null, "MDL", "UA"), "MDL");
  assert.equal(effectiveOfferCurrency(undefined, "EUR", "UA"), "EUR");
  assert.equal(effectiveOfferCurrency("", "UAH", "MD"), "UAH");
  // a value the database would refuse is treated as "not set"
  assert.equal(effectiveOfferCurrency("USD", "MDL", "MD"), "MDL");
});

test("with no workspace currency either, the market's own, then EUR", () => {
  assert.equal(effectiveOfferCurrency(null, null, "UA"), "UAH");
  assert.equal(effectiveOfferCurrency(null, undefined, "MD"), "MDL");
  assert.equal(effectiveOfferCurrency(null, "", "XX"), "EUR");
  assert.equal(effectiveOfferCurrency(), "EUR");
});

test("betterCurrencyFor flags another country's currency, never euro", () => {
  assert.equal(betterCurrencyFor("MDL", "UA"), "UAH");
  assert.equal(betterCurrencyFor("UAH", "MD"), "MDL");
  assert.equal(betterCurrencyFor("RON", "MD"), "MDL");
  assert.equal(betterCurrencyFor("MDL", "MD"), null);
  assert.equal(betterCurrencyFor("UAH", "UA"), null);
  assert.equal(betterCurrencyFor("EUR", "UA"), null);
  assert.equal(betterCurrencyFor("MDL", undefined), null);
});

test("market change: a lei workspace quoting Ukraine switches the offer to hryvnia, and says so", () => {
  assert.deepEqual(
    currencyOnMarketChange({ offerCurrency: null, workspaceCurrency: "MDL", from: "MD", to: "UA" }),
    { offerCurrency: "UAH", note: { kind: "switched", currency: "UAH" } });
});

test("market change: back to the workspace's own market returns to the default", () => {
  // the hryvnia set by the switch above was following the market, so it follows it back
  assert.deepEqual(
    currencyOnMarketChange({ offerCurrency: "UAH", workspaceCurrency: "MDL", from: "UA", to: "MD" }),
    { offerCurrency: null, note: null });
  assert.deepEqual(
    currencyOnMarketChange({ offerCurrency: null, workspaceCurrency: "UAH", from: "MD", to: "UA" }),
    { offerCurrency: null, note: null });
});

test("market change: a hryvnia workspace quoting Moldova switches to lei", () => {
  assert.deepEqual(
    currencyOnMarketChange({ offerCurrency: null, workspaceCurrency: "UAH", from: "UA", to: "MD" }),
    { offerCurrency: "MDL", note: { kind: "switched", currency: "MDL" } });
});

test("market change: a euro workspace stays in euro and is only offered the local currency", () => {
  assert.deepEqual(
    currencyOnMarketChange({ offerCurrency: null, workspaceCurrency: "EUR", from: "MD", to: "UA" }),
    { offerCurrency: null, note: { kind: "suggest", currency: "UAH" } });
  assert.deepEqual(
    currencyOnMarketChange({ offerCurrency: null, workspaceCurrency: "EUR", from: "UA", to: "MD" }),
    { offerCurrency: null, note: { kind: "suggest", currency: "MDL" } });
});

test("market change: an offer already in the old market's own currency moves with it", () => {
  // a euro workspace where the installer picked lei for a Moldovan client
  assert.deepEqual(
    currencyOnMarketChange({ offerCurrency: "MDL", workspaceCurrency: "EUR", from: "MD", to: "UA" }),
    { offerCurrency: "UAH", note: { kind: "switched", currency: "UAH" } });
});

test("market change: a deliberate choice is never overridden", () => {
  // euro for a Moldovan client, in a lei workspace
  assert.deepEqual(
    currencyOnMarketChange({ offerCurrency: "EUR", workspaceCurrency: "MDL", from: "MD", to: "UA" }),
    { offerCurrency: "EUR", note: null });
  // lei kept for a Ukrainian client on purpose, then the market moves on to Romania
  assert.deepEqual(
    currencyOnMarketChange({ offerCurrency: "MDL", workspaceCurrency: "MDL", from: "UA", to: "RO" }),
    { offerCurrency: "MDL", note: null });
});

test("market change: same market or an unknown one changes nothing", () => {
  assert.deepEqual(
    currencyOnMarketChange({ offerCurrency: null, workspaceCurrency: "MDL", from: "UA", to: "UA" }),
    { offerCurrency: null, note: null });
  assert.deepEqual(
    currencyOnMarketChange({ offerCurrency: "EUR", workspaceCurrency: "MDL", from: "MD", to: "XX" }),
    { offerCurrency: "EUR", note: null });
});

test("market change: a garbage stored value counts as the default", () => {
  assert.deepEqual(
    currencyOnMarketChange({ offerCurrency: "USD", workspaceCurrency: "MDL", from: "MD", to: "UA" }),
    { offerCurrency: "UAH", note: { kind: "switched", currency: "UAH" } });
});

/* ---- the proforma, issued in the offer's currency ---- */

test("invoiceAmounts converts the total first, then splits VAT in that currency", () => {
  // €11,300 at 50 UAH/EUR, 20% VAT
  const a = invoiceAmounts({ grossEur: 11300, fx: 50, vatRatePct: 20 });
  assert.equal(a.gross, 565000);
  assert.equal(a.net, Math.round(565000 / 1.2));
  assert.equal(a.net + a.vat, a.gross);
  assert.equal(a.rate, 20);
  assert.equal(a.showVat, true);
});

test("invoiceAmounts: net + VAT and deposit + balance always add up to the total", () => {
  for (const [g, fx, vat, dep] of [[11337.4, 19.87, 20, 30], [999.5, 50.97, 8, 50], [23375, 5.25, 19, 33], [7, 1, 20, 30]]) {
    const a = invoiceAmounts({ grossEur: g, fx, vatRatePct: vat, depositPct: dep });
    assert.ok(Number.isInteger(a.gross) && Number.isInteger(a.net) && Number.isInteger(a.vat));
    assert.equal(a.net + a.vat, a.gross);
    assert.equal(a.deposit + a.balance, a.gross);
  }
});

test("invoiceAmounts prints the same total as the fiscal CSV export's math", () => {
  // export-invoices: grossLocal = round(round(cost) * fx), then vatBreakdown(grossLocal)
  const cost = 11337.4, fx = 19.87;
  const csvGross = Math.round(Math.max(0, Math.round(cost)) * fx);
  const a = invoiceAmounts({ grossEur: cost, fx, vatRatePct: 20 });
  assert.equal(a.gross, csvGross);
  assert.equal(a.net, Math.round(vatBreakdown(csvGross, 20).net));
});

test("invoiceAmounts in EUR is the whole-euro quote, unconverted", () => {
  const a = invoiceAmounts({ grossEur: 11300.4, fx: 1, vatRatePct: 0, depositPct: 30 });
  assert.equal(a.gross, 11300);
  assert.equal(a.showVat, false);
  assert.equal(a.net, 11300);
  assert.equal(a.vat, 0);
  assert.equal(a.deposit, 3390);
  assert.equal(a.balance, 7910);
});

test("invoiceAmounts never throws or goes negative on garbage input", () => {
  assert.deepEqual(invoiceAmounts(), { gross: 0, net: 0, vat: 0, rate: 0, showVat: false, depositPct: 0, deposit: 0, balance: 0 });
  assert.equal(invoiceAmounts({ grossEur: -500, fx: 20 }).gross, 0);
  assert.equal(invoiceAmounts({ grossEur: 100, fx: 0 }).gross, 100);
  assert.equal(invoiceAmounts({ grossEur: 100, fx: -3 }).gross, 100);
  assert.equal(invoiceAmounts({ grossEur: 100, depositPct: 250 }).deposit, 100);
});

test("a whole-euro quote invoices exactly the proposal's headline at the same rate", () => {
  // what the client reads on the proposal page (lib/money.js) vs the invoice
  const fmt = moneyFormatter({ currency: "UAH", lang: "uk", fx: { UAH: 50 } });
  const a = invoiceAmounts({ grossEur: 11300, fx: fmt.rate });
  assert.equal(Math.round(fmt.toLocal(11300)), a.gross);
});
