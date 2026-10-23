// lib/quoteInput.js — build the engine quote() input from a raw `projects` row.
//
// Kept in ONE place so every live recompute (dashboard KPIs, projects list,
// anywhere else) stays identical to the editor — which drives cost from the
// bill of materials and uses the project's ACTUAL battery capacity. Before this,
// the dashboard/list omitted battKwh + the BOM total, so a project with a
// non-default battery or a BOM showed a different payback/value than the editor
// and the proposal the client actually received.
//
// Degrades gracefully if add-battery-kwh.sql / add-quote-bom.sql haven't run:
// r.batt_kwh / r.bom are simply undefined and fall back to the legacy defaults.
import { SOLAR_SEASON, FX } from "@voltmira/engine";
import { weightedExportPriceEur } from "./prosumerPrice.js";
import { TARIFF_SEED } from "./tariffSeed.js";
import { pickRule, ruleQuoteInputs } from "./tariffRules.js";
import { operatorFor } from "./workflow.js";

/**
 * The tariff rule a Moldovan quote is priced with on a date, as the engine
 * takes it (lib/tariffRules.js ruleQuoteInputs): the operator its grid file
 * goes to (chosen, else suggested by the address), the rule in force that day.
 * `rules` are the tariff_rules rows (companyEngine puts them on E as
 * E.tariffRules); without them, the code's version 1 (lib/tariffSeed.js).
 */
export function mdTariffFor(r, rules, date = new Date()) {
  const op = operatorFor({ market: "MD", install_progress: r?.install_progress, address: r?.address, title: r?.title })?.id || "premier";
  const on = date instanceof Date ? date.toISOString() : String(date || "");
  return ruleQuoteInputs(pickRule(Array.isArray(rules) && rules.length ? rules : TARIFF_SEED, { market: "MD", operator: op, date: on }));
}

/** The buy-back price (EUR/kWh) of a Moldovan quote today: the rule's, else the published table as before. */
export function mdFeedFor(r, rules, date) {
  return mdTariffFor(r, rules, date)?.feedOverride ?? weightedExportPriceEur(SOLAR_SEASON, FX.MDL);
}

/**
 * Does this bill of materials actually PRICE a battery?
 * The engine needs to tell "the BOM already covers the battery" apart from "the
 * battery toggle is on but no line in the BOM pays for it" — in the second case
 * it must add the battery cost itself, or the client is quoted the battery's
 * extra savings for free.
 */
export function bomHasBattery(bom) {
  return (Array.isArray(bom) ? bom : [])
    .some((l) => l.kind === "battery" && (Number(l.qty) || 0) > 0);
}

/**
 * When a quoted system starts producing, as a fractional year: about a month
 * after the quote (2026.75 = October 2026). Only Ukraine's green tariff, which
 * ends on 31 December 2029, depends on it.
 */
export function startYearOf(when) {
  const d = new Date(when || Date.now());
  const t = Number.isNaN(d.getTime()) ? new Date() : d;
  return t.getUTCFullYear() + (t.getUTCMonth() + 1) / 12;
}

/** @param {object} r a projects row  @param {object} [E] engine settings; E.tariffRules picks the rule */
export function rowToQuoteInput(r, E) {
  return {
    startYear: startYearOf(r.created_at),
    kw: Number(r.kw), price: Number(r.price), cons: Number(r.cons),
    batt: r.batt, battKwh: r.batt_kwh != null ? Number(r.batt_kwh) : 10,
    market: r.market, useMonthly: r.use_monthly, consMonthly: r.cons_monthly,
    afmSubsidy: r.afm_subsidy,
    // the day/night split changes the saving, so the lists and exports carry it as the editor does
    tariffMode: r.tariff_mode || "flat",
    yieldOverride: r.yield_per_kwp ? Number(r.yield_per_kwp) : undefined,
    monthlyYieldShape: r.monthly_yield_shape || undefined,
    // Moldova's surplus is bought back at the operator's published monthly
    // price, weighted by the months a system actually exports in. The editor
    // prices it that way, so every recompute downstream — the proposal the
    // client opens, the PDF, the dashboard KPIs — has to use the same figure,
    // or the document contradicts the screen it was built on.
    // The price comes from the versioned tariff rule in force (lib/tariffRules.js).
    ...(r.market === "MD" ? { feedOverride: mdFeedFor(r, E?.tariffRules) } : {}),
    // The system size (kW × €/kW rate + battery) drives the quote price, so the
    // size slider always moves the cost. The bill of materials is NOT a price
    // override — it's the installer's equipment cost, shown in the editor as a
    // margin figure (quote price − materials). Previously the BOM total froze the
    // price, which made the size slider look broken once materials were added.
    costOverride: 0,
  };
}
