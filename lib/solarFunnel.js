// lib/solarFunnel.js — the public "get a solar design" funnel at /solar
// (docs/MARKETPLACE.md): an instant estimate for a Moldovan address priced
// with the tariff rule in force today (Phase 1, lib/tariffStore.js), and the
// homeowner's request for offers, checked before it is routed.
import { FX } from "@voltmira/engine";
import { estimateSavings } from "./estimateCore.js";
import { tariffFor } from "./tariffStore.js";
import { RAION, raionAt } from "./mdRaions.js";
import { SHAPES } from "./data/mdRaionShapes.js";
import { suggestOperator } from "./mdGrid.js";

const DAY = () => new Date().toISOString().slice(0, 10);

/**
 * @param {object} a  { address, monthlyBill?, consKwhYear?, admin }
 * @returns the estimate (estimateCore's shape) plus { raion, operator, tariff }
 */
export async function funnelEstimate({ address, monthlyBill = null, consKwhYear = null, admin }) {
  const operator0 = suggestOperator(address);
  const rule = await tariffFor({ market: "MD", operator: operator0, date: DAY() }).catch(() => null);
  const mdl = FX.MDL;
  // solar replaces daytime energy: valued at the day rate; a bill is read at
  // the average of day and night, since it pays for both
  const day = Number(rule?.retailDayMdl) || null;
  const night = Number(rule?.retailNightMdl) || null;
  const priceEur = day ? day / mdl : null;
  const billPriceMdl = day && night ? (day + night) / 2 : day;
  const bill = Number(monthlyBill);
  const annualCons = Number(consKwhYear) > 0 ? Number(consKwhYear) : bill > 0 && billPriceMdl ? (bill * 12) / billPriceMdl : null;
  const est = await estimateSavings({ address, bill: monthlyBill, country: "MD", admin, annualCons, priceEur, feedOverride: rule?.feedOverride });
  const raion = raionAt(Number(est.lat), Number(est.lon), SHAPES);
  // the district's own operator wins over the guess from the address text
  const operator = raion && RAION[raion]?.operator ? RAION[raion].operator : operator0;
  return {
    ...est, raion: raion || "",
    operator,
    tariff: rule ? { operator: rule.operator, version: rule.version, effectiveFrom: rule.effectiveFrom, source: rule.source } : null,
  };
}
