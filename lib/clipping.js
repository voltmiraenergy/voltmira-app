// lib/clipping.js — the export limit of a solar plant and what it costs in
// energy. Two limits can bind: the inverters' AC rating (the plant's own) and
// the power the grid operator approved at the connection point (the ATR, a
// figure for the whole plant, wind included). The energy above the lower of
// the two is clipped. PVGIS's hourly year gives a curve of the share of the
// year's energy above each AC power per kWp of panels (engine/pvgis.js
// getClippingCurve), stored on the plant; this reads it at the plant's ratio.
// A study's P50 has its own clipping inside it, so none is taken off twice.
// Stated simplifications: one weather year; where wind shares the connection,
// the solar part gets what the approved power leaves after the wind's average
// output (wind and sun are taken as independent, so the joint peak is not
// modelled); clipping is held at its first-year level (ageing would lower it,
// so this errs low on energy); wind is not clipped. Pure.

/** DC/AC ratios a bank reads without a question. */
export const DCAC_RANGE = [1.0, 1.6];

/**
 * Share of the year's energy lost above a limit, read on the stored curve.
 * @param {{ratios:number[], lostPct:number[]}|null} curve
 * @param {number} ratio  limit (AC kW) per kWp of panels
 * @returns {{ pct:number, below:boolean }|null} null without a curve; `below` when the ratio is under the curve's lowest point (the figure is then a floor)
 */
export function clipLossPct(curve, ratio) {
  if (!curve || !Array.isArray(curve.ratios) || curve.ratios.length < 2 || curve.ratios.length !== curve.lostPct.length || !(ratio > 0)) return null;
  const { ratios: r, lostPct: l } = curve;
  if (ratio >= r[r.length - 1]) return { pct: 0, below: false };
  if (ratio <= r[0]) return { pct: l[0], below: ratio < r[0] };
  let i = 0;
  while (r[i + 1] < ratio) i++;
  const t = (ratio - r[i]) / (r[i + 1] - r[i]);
  return { pct: l[i] + (l[i + 1] - l[i]) * t, below: false };
}

/**
 * @param {object} pl  a normalised plant (lib/plantFinance.js normalizePlant)
 * @param {number} [windMwh]  the wind part's yearly P50 energy, MWh (lib/plantFinance.js plantEnergy); its average output comes off the approved power
 * @returns {null | {
 *   dcMw:number, acMw:number|null, exportMw:number|null, dcAc:number|null, limitMw:number|null, ratio:number|null,
 *   clipPct:number|null, clipMwh:number|null, grossMwh:number, floor:boolean, inStudy:boolean, bindsOn:"ac"|"grid"|null
 * }} null without a solar part; clipPct is null when no limit is set or the curve is missing
 */
export function solarExport(pl, windMwh = 0) {
  const s = pl?.solar;
  if (!s) return null;
  const dcMw = s.mwp;
  // the inverters' AC rating: typed, else the equipment list's count times unit rating
  const eqAc = pl.equipment?.inverters?.count > 0 && pl.equipment.inverters.kw > 0 ? (pl.equipment.inverters.count * pl.equipment.inverters.kw) / 1000 : null;
  const acMw = s.acMw > 0 ? s.acMw : eqAc;
  const exportMw = pl.exportMw > 0 ? pl.exportMw : null;
  // what the approved power leaves for the solar part after the wind's average output (never below a tenth of it)
  const windAvgMw = pl.wind && windMwh > 0 ? windMwh / 8760 : 0;
  const gridShare = exportMw == null ? null : Math.max(exportMw - windAvgMw, exportMw / 10);
  const limits = [acMw, gridShare].filter((x) => x != null);
  const limitMw = limits.length ? Math.min(...limits) : null;
  const bindsOn = limitMw == null ? null : acMw != null && limitMw === acMw && (gridShare == null || acMw <= gridShare) ? "ac" : "grid";
  const inStudy = !!(s.study && s.study.p50Mwh > 0);
  const av = 1 - (Number(s.availabilityPct) || 0) / 100;
  const grossMwh = dcMw * s.yieldKwhKwp * av;
  const ratio = limitMw == null ? null : limitMw / dcMw;
  const loss = ratio == null || inStudy ? null : clipLossPct(s.clipCurve, ratio);
  return {
    dcMw, acMw, exportMw, dcAc: acMw ? dcMw / acMw : null, limitMw, ratio,
    clipPct: loss ? loss.pct : null, clipMwh: loss ? (grossMwh * loss.pct) / 100 : null,
    grossMwh, floor: !!loss?.below, inStudy, bindsOn,
  };
}
