// lib/offerInput.js — the engine input of an offer that was sent: its frozen
// snapshot, with the battery derived from the frozen bill of materials and,
// for an offer issued since tariff rules are versioned, the export price of
// the rule it was issued under (snapshot.tariff, lib/tariffRules.js). An
// offer issued before that has no snapshot.tariff and computes exactly as it
// always did (lib/tariffSnapshot.test.js holds both to it). Pure.
import { bomHasBattery } from "./quoteInput.js";

export function offerQuoteInput(snapshot) {
  const s = { ...(snapshot || {}), bomHasBattery: bomHasBattery(snapshot?.bom) };
  const feed = Number(snapshot?.tariff?.feedOverride);
  if (feed > 0) s.feedOverride = feed;
  return s;
}

/** What the client's page says about the tariff an offer was issued under, or null. */
export function offerTariffNote(snapshot) {
  const t = snapshot?.tariff;
  if (!t || !(Number(t.feedOverride) > 0)) return null;
  return { operator: t.operator, version: t.version, effectiveFrom: t.effectiveFrom, exportMdlPerKwh: t.exportMdlPerKwh ?? null, source: t.source || "" };
}
