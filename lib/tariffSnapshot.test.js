import { test } from "node:test";
import assert from "node:assert/strict";
import { quote, defaultEngineSettings, MARKETS } from "@voltmira/engine";
import { offerQuoteInput, offerTariffNote } from "./offerInput.js";
import { mdTariffFor, mdFeedFor, rowToQuoteInput } from "./quoteInput.js";
import { TARIFF_SEED } from "./tariffSeed.js";
import { SUBSIDY_SEED } from "./subsidySeed.js";
import { supportSnapshot } from "./supportSnapshot.js";

const E = { ...defaultEngineSettings(), fx: { EUR: 1, MDL: 19.8, RON: 4.97, UAH: 51 } };
// an offer exactly as buildProposalSnapshot froze it before tariff rules were versioned
const OLD = { market: "MD", kw: 8, price: 0.18, cons: 6000, batt: true, battKwh: 10, bom: [], costOverride: 0, useMonthly: false, tariffMode: "flat", engine: E };
const row = { market: "MD", address: "str. Mare 3, Ialoveni", title: "Casa Test", install_progress: {} };

// a later version 2 for Premier, with a lower buy-back price in every month
const V2 = { ...TARIFF_SEED[0], id: "v2", version: 2, effective_from: "2026-11-01", export_monthly: TARIFF_SEED[0].export_monthly.map((v) => v - 50000) };
const RULES_LATER = [...TARIFF_SEED, V2];

test("an offer issued before versioning computes exactly as it always did", () => {
  const before = quote({ ...OLD, bomHasBattery: false }, E).e;
  const input = offerQuoteInput(OLD);
  assert.equal(input.feedOverride, undefined, "no tariff frozen, no export override");
  const now = quote(input, E).e;
  assert.equal(now.year1, before.year1);
  assert.equal(now.payback, before.payback);
  assert.equal(now.cost, before.cost);
  assert.equal(offerTariffNote(OLD), null);
  assert.ok(MARKETS.MD.feed > 0, "it keeps the market's own buy-back constant");
});

test("a new offer prices exports exactly like the editor on the day it is sent", () => {
  const day = "2026-10-17";
  const snap = { ...OLD, tariff: mdTariffFor(row, TARIFF_SEED, day) };
  const offer = quote(offerQuoteInput(snap), E).e;
  const editor = quote({ ...OLD, bomHasBattery: false, feedOverride: mdFeedFor(row, TARIFF_SEED, day) }, E).e;
  assert.equal(offer.year1, editor.year1);
  assert.equal(snap.tariff.operator, "premier", "Ialoveni is Premier Energy's area");
  assert.equal(snap.tariff.version, 1);
  assert.equal(offerTariffNote(snap).version, 1);
});

test("a newer version changes new offers, never one already sent", () => {
  const sent = { ...OLD, tariff: mdTariffFor(row, TARIFF_SEED, "2026-10-17") };
  const sentBefore = quote(offerQuoteInput(sent), E).e.year1;

  // version 2 is published; the old offer is opened again in December
  const sentLater = quote(offerQuoteInput(sent), E).e.year1;
  assert.equal(sentLater, sentBefore, "the frozen rule still applies");

  const fresh = { ...OLD, tariff: mdTariffFor(row, RULES_LATER, "2026-12-01") };
  assert.equal(fresh.tariff.version, 2);
  assert.ok(quote(offerQuoteInput(fresh), E).e.year1 < sentBefore, "a lower buy-back price earns less");
  assert.equal(mdTariffFor(row, RULES_LATER, "2026-10-31").version, 1, "the day before v2 starts");
});

test("the dashboard and the editor use the rules on E, the code's version 1 without them", () => {
  const r = { ...row, kw: 8, price: 0.18, cons: 6000, batt: true, batt_kwh: 10, created_at: "2026-10-01" };
  assert.equal(rowToQuoteInput(r).feedOverride, mdFeedFor(row, TARIFF_SEED));
  assert.equal(rowToQuoteInput(r, { tariffRules: TARIFF_SEED }).feedOverride, mdFeedFor(row, TARIFF_SEED));
  const north = { ...r, address: "str. Independenței 5, Bălți" };
  assert.equal(mdTariffFor(north, TARIFF_SEED).operator, "rednord");
});

test("the support frozen with an offer is in whole bani", () => {
  const s = supportSnapshot({
    programs: SUBSIDY_SEED, input: offerQuoteInput(OLD), E, clientKind: "sme",
    profile: { vatPayer: true, netMetering: true, loanMdl: 150000 }, vatRatePct: 20, date: "2026-10-17",
  });
  assert.equal(s.currency, "MDL");
  assert.deepEqual(s.results.map((r) => r.code).sort(), ["bess_guarantee", "facem_373", "law112_customs", "law112_vat"]);
  for (const r of s.results) if (r.estimateMinor != null) assert.ok(Number.isInteger(r.estimateMinor), r.code);
  assert.ok(Number.isInteger(s.totals.sureMinor) && s.totals.sureMinor > 0);
  assert.equal(supportSnapshot({ programs: SUBSIDY_SEED, input: { ...OLD, market: "RO" }, E, date: "2026-10-17" }), null);
});
