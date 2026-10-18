// lib/tariffRules.js — choosing and reading a versioned tariff rule
// (docs/TARIFFS_AND_SUBSIDIES.md). Pure: rules come in as rows of the
// tariff_rules table (or lib/tariffSeed.js before the SQL runs).
//
// What a rule decides in the quote today: the price a Moldovan prosumer's
// exported kWh is bought back at (the engine's feedOverride). The retail
// day/night rates it carries are the operator's published reference; the
// quote keeps using the workspace's own rates from Settings, as before.
import { SOLAR_SEASON, FX } from "@voltmira/engine";

/** lei/kWh -> integer minor units (bani) per MWh: 2.51 -> 251000. */
export function toMinorPerMwh(perKwh) {
  const n = Number(perKwh);
  return Number.isFinite(n) ? Math.round(n * 100000) : null;
}

/** Integer minor units per MWh -> lei/kWh: 251000 -> 2.51. */
export function fromMinorPerMwh(minor) {
  if (minor == null || minor === "") return null;
  const n = Number(minor);
  return Number.isFinite(n) ? n / 100000 : null;
}

const day = (d) => String(d || "").slice(0, 10);

/**
 * The rule in force for a market and operator on a date: among the versions
 * whose effective_from is on or before the date and whose effective_to is open
 * or after it, the one that took effect last (the higher version on a tie).
 * Null when none applies.
 */
export function pickRule(rules, { market = "MD", operator, date }) {
  const on = day(date) || day(new Date().toISOString());
  let best = null;
  for (const r of rules || []) {
    if (r.market !== market || r.operator !== operator) continue;
    if (day(r.effective_from) > on) continue;
    if (r.effective_to && day(r.effective_to) <= on) continue;
    if (!best || day(r.effective_from) > day(best.effective_from)
      || (day(r.effective_from) === day(best.effective_from) && r.version > best.version)) best = r;
  }
  return best;
}

/** The next version number for a market and operator. */
export function nextVersion(rules, { market = "MD", operator }) {
  return 1 + Math.max(0, ...(rules || []).filter((r) => r.market === market && r.operator === operator).map((r) => Number(r.version) || 0));
}

/**
 * A rule's buy-back price for exported energy, in lei/kWh, weighted by the
 * months a system exports in (the engine's solar season by default): the
 * same formula as lib/prosumerPrice.js weightedExportPriceMdl. Null when the
 * rule has no export price.
 */
export function ruleExportMdl(rule, weights = SOLAR_SEASON) {
  if (!rule) return null;
  const monthly = Array.isArray(rule.export_monthly) ? rule.export_monthly.map(fromMinorPerMwh) : [];
  let num = 0, den = 0;
  for (let m = 0; m < 12; m++) {
    const w = Number(weights?.[m]) || 0;
    const p = monthly[m];
    if (p == null || w <= 0) continue;
    num += w * p;
    den += w;
  }
  if (den > 0) return num / den;
  const known = monthly.filter((v) => v != null);
  if (known.length) return known.reduce((a, b) => a + b, 0) / known.length;
  return fromMinorPerMwh(rule.export_flat_minor_per_mwh);
}

/**
 * What a rule hands the quote engine, frozen into an offer's snapshot. The
 * EUR conversion uses the engine's own MDL rate, as the editor always has, so
 * the offer and the screen it was built on agree to the cent.
 */
export function ruleQuoteInputs(rule, { weights = SOLAR_SEASON, mdlPerEur = FX.MDL } = {}) {
  if (!rule) return null;
  const mdl = ruleExportMdl(rule, weights);
  return {
    ruleId: rule.id, market: rule.market, operator: rule.operator, version: rule.version,
    effectiveFrom: day(rule.effective_from), source: rule.source_title || "",
    feedOverride: mdl != null ? mdl / (mdlPerEur || FX.MDL) : null,
    exportMdlPerKwh: mdl,
    retailDayMdl: fromMinorPerMwh(rule.retail_day_minor_per_mwh),
    retailNightMdl: fromMinorPerMwh(rule.retail_night_minor_per_mwh),
    prosumerMaxKw: rule.prosumer_max_kw != null ? Number(rule.prosumer_max_kw) : null,
  };
}

const FIELDS = ["effective_from", "effective_to", "currency", "retail_flat_minor_per_mwh", "retail_day_minor_per_mwh",
  "retail_night_minor_per_mwh", "export_flat_minor_per_mwh", "prosumer_max_kw", "source_title", "source_url", "note"];

/**
 * What changed between two versions, field by field, for the admin's diff
 * view. Monthly export prices are compared month by month ("export_monthly.3"
 * is April).
 */
export function diffRules(prev, next) {
  const out = [];
  for (const f of FIELDS) {
    const a = prev?.[f] ?? null, b = next?.[f] ?? null;
    if (String(a ?? "") !== String(b ?? "")) out.push({ field: f, before: a, after: b });
  }
  const pa = Array.isArray(prev?.export_monthly) ? prev.export_monthly : [];
  const pb = Array.isArray(next?.export_monthly) ? next.export_monthly : [];
  for (let m = 0; m < 12; m++) {
    const a = pa[m] ?? null, b = pb[m] ?? null;
    if (a !== b) out.push({ field: `export_monthly.${m}`, before: a, after: b });
  }
  return out;
}
