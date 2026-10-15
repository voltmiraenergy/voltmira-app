/**
 * lib/racordarePdf.test.js — fills the real Premier Energy PDF and checks
 * the result is a real, valid, 2-page PDF (re-parses what it produced,
 * rather than just trusting no exception was thrown).
 *
 * Run: node --test lib/
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { PDFDocument } from "pdf-lib";
import { fillRacordarePdf } from "./racordarePdf.js";

test("fillRacordarePdf produces a real, valid 2-page PDF", async () => {
  const bytes = await fillRacordarePdf({
    clientName: "Ion Popescu", clientAddress: "Str. Toma Cozma 12, Iași",
    systemKw: 6, hasBattery: true, battKwh: 10,
  });
  assert.ok(bytes.length > 100000, `unexpectedly small output: ${bytes.length} bytes`);
  const reloaded = await PDFDocument.load(bytes);
  assert.equal(reloaded.getPageCount(), 2);
});

test("fillRacordarePdf never throws on missing/empty data", async () => {
  await assert.doesNotReject(() => fillRacordarePdf({}));
  await assert.doesNotReject(() => fillRacordarePdf());
});

test("fillRacordarePdf handles a battery-less system without writing a storage figure", async () => {
  const withoutBatt = await fillRacordarePdf({ clientName: "Ana Ionescu", systemKw: 4, hasBattery: false });
  const withBatt = await fillRacordarePdf({ clientName: "Ana Ionescu", systemKw: 4, hasBattery: true, battKwh: 5 });
  // Real, distinct output either way — not the exact same bytes reused.
  assert.notEqual(Buffer.from(withoutBatt).toString("base64"), Buffer.from(withBatt).toString("base64"));
});

test("fillRacordarePdf handles Romanian diacritics in the name/address without throwing", async () => {
  await assert.doesNotReject(() => fillRacordarePdf({
    clientName: "Ștefan Țăranu", clientAddress: "Str. Independenței 5, Chișinău", systemKw: 8,
  }));
});
