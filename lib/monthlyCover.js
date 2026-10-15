// lib/monthlyCover.js — the loan's cover month by month, in the loan year
// where the yearly cover is lowest. The model works in years, but a bank with
// monthly or quarterly instalments reads the cover month by month, and in
// Moldova a solar plant earns about half as much in December as in June. The
// year's energy revenue is spread over the months by the site's own PVGIS
// monthly shape (lib/solarSite.js stores it) for the solar part and evenly for
// wind (a stated simplification: wind is stronger in winter, so even is the
// cautious choice for the lean months); a storage contract and the costs run
// evenly; the year's tax is spread evenly; the instalments are the year's debt
// service in twelve equal parts. Then: the lowest month, the lowest quarter,
// and the cash that has to be held to pay the instalments through the lean
// stretch (the deepest drop of the running balance, a year after a year), to
// set beside the debt service reserve. Pure.
import { normalizePlant, evaluatePlant, plantEnergy } from "./plantFinance.js";

/**
 * @param {object} plant
 * @param {object} E, fin, scenario  as for evaluatePlant
 * @returns {null | {
 *   year:number, annualCover:number, months:{m:number, cfads:number, ds:number, cover:number|null}[],
 *   lowMonth:{m:number, cover:number|null}, lowQuarter:{q:number, cover:number|null}, monthsBelow:number,
 *   bridgeEur:number, reserveEur:number, covered:boolean
 * }} null without a solar part with a stored monthly shape, or without debt
 */
export function monthlyCover(plant, E, fin, scenario) {
  const pl = normalizePlant(plant);
  const shape = pl.solar?.monthShape;
  if (!pl.solar || !shape) return null;
  const r = evaluatePlant(pl, E, fin, scenario);
  if (!r.debtService.some((d) => d > 1e-9)) return null;
  // the loan year with the lowest yearly cover
  let k = -1, min = Infinity;
  r.dscr.forEach((d, i) => { if (d != null && d < min) { min = d; k = i; } });
  if (k < 0) return null;

  const en = plantEnergy(pl);
  const sol = en.solar?.p50Mwh || 0, wind = en.wind?.p50Mwh || 0;
  const solarShare = sol + wind > 0 ? sol / (sol + wind) : 0;
  // the storage contract pays a fixed sum a year; the rest of the revenue follows the energy
  const bess = pl.bess && k + 1 <= pl.revenue.bessYears ? pl.bess.mw * pl.revenue.bessEurPerMwYr : 0;
  const energyRev = r.revenue[k] - bess;
  const costs = (r.opex[k] + (r.warRisk[k] || 0)) / 12;
  const tax = (r.tax?.[k] || 0) / 12;
  const ds = r.debtService[k] / 12;

  const months = shape.map((s, i) => {
    const w = solarShare * (s / 12) + (1 - solarShare) / 12;
    const cfads = energyRev * w + bess / 12 - costs - tax;
    return { m: i + 1, cfads, ds, cover: ds > 1e-9 ? cfads / ds : null };
  });
  const live = months.filter((x) => x.cover != null);
  const lowMonth = live.reduce((a, b) => (b.cover < a.cover ? b : a), live[0]);
  let lowQuarter = null;
  for (let q = 0; q < 4; q++) {
    const part = months.slice(q * 3, q * 3 + 3);
    const d = part.reduce((a, x) => a + x.ds, 0);
    const cover = d > 1e-9 ? part.reduce((a, x) => a + x.cfads, 0) / d : null;
    if (cover != null && (!lowQuarter || cover < lowQuarter.cover)) lowQuarter = { q: q + 1, cover };
  }
  // the cash to hold: the deepest drop of the running balance, over two years so a winter that wraps the year end counts
  let bal = 0, peak = 0, bridge = 0;
  for (let rep = 0; rep < 2; rep++) {
    for (const x of months) {
      bal += x.cfads - x.ds;
      if (bal > peak) peak = bal;
      bridge = Math.max(bridge, peak - bal);
    }
  }
  return {
    year: k + 1, annualCover: min, months, lowMonth, lowQuarter,
    monthsBelow: live.filter((x) => x.cover < 1).length,
    bridgeEur: bridge, reserveEur: r.dsraEur || 0, covered: bridge <= (r.dsraEur || 0) + 1e-6,
  };
}
