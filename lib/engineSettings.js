// lib/engineSettings.js — one place that assembles the calculation settings.
//
// Nine call sites used to inline `{ ...defaultEngineSettings(), ...co.engine }`,
// which meant a change like "grants must convert at a live FX rate" had to be
// remembered in nine places. It wasn't: the engine converted the AFM/Casa Verde
// grant with its static table, and a 5.7% drift in RON understated the client's
// out-of-pocket by ~€219 on every subsidised Romanian quote.
//
// FROZEN SNAPSHOTS. A sent proposal must recompute to exactly what the client
// was shown, so the rate is frozen into the snapshot at send time and wins over
// today's. Only live, still-editable quotes follow the market.
import { defaultEngineSettings } from "@voltmira/engine";
import { getFxRates } from "./fx.js";

/** The company's calculation settings before live rates: the engine's defaults, its own overrides and the grant set in Settings. Pure. */
export function engineBase(co) {
  const base = { ...defaultEngineSettings(), ...(co?.engine || {}) };
  // The grant set in Settings applies wherever a live quote is priced: the editor, the dashboard, the lists, the
  // proforma and the exports. Each used to patch it in (or forget to), so a workspace that set its grant to 0
  // saw 0 in the editor and 20,000 RON on the invoice.
  if (co?.subsidy_amount_ron != null && Number.isFinite(Number(co.subsidy_amount_ron))) base.subsidyAmountRon = Number(co.subsidy_amount_ron);
  return base;
}

/**
 * Settings for a LIVE quote — today's rates.
 * Server-only (getFxRates does network I/O); pass the result to client
 * components as a prop rather than importing this in one.
 */
export async function companyEngine(co) {
  const base = engineBase(co);
  // the versioned tariff rules in force (lib/tariffStore.js), so every live
  // recompute (rowToQuoteInput, the editor) prices Moldovan exports with the
  // same rule an offer issued today freezes
  try {
    const { loadTariffRules } = await import("./tariffStore.js");
    base.tariffRules = (await loadTariffRules()).rows;
  } catch { /* the code's version 1 applies (lib/tariffSeed.js) */ }
  try {
    const { rates } = await getFxRates();
    return { ...base, fx: rates };
  } catch {
    // getFxRates already falls back internally; this is belt-and-braces so a
    // settings lookup can never take a page down over an exchange rate.
    return base;
  }
}

/**
 * Settings for a SENT proposal. The snapshot's engine (including the `fx` it
 * was frozen with) wins; the company's current settings only fill gaps for
 * proposals created before snapshots carried engine data.
 */
export function snapshotEngine(snapshotEngineObj, co) {
  return { ...defaultEngineSettings(), ...(snapshotEngineObj || co?.engine || {}) };
}
