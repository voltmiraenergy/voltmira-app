// lib/windScreen.js — a first, screening-grade estimate of what a wind farm
// produces, from public reanalysis data, before any wind study exists. Pure;
// no I/O (lib/windActions.js fetches the data).
//
// What it does, and why each step is only a screening step:
//   1. Wind speed at 50 m, every hour of one recent full year, from NASA POWER
//      (MERRA-2 reanalysis, a grid of about 50 km: it does not see the hill a
//      turbine stands on). Kept as a histogram of 0.5 m/s bins.
//   2. Scaled so its mean matches the site's 20-year mean (NASA POWER
//      climatology, 2001 to 2020): one year can be windier or calmer.
//   3. Lifted to hub height with the power law v_hub = v_50 * (hub/50)^alpha.
//      alpha (wind shear) depends on terrain and stability; 0.2 is a common
//      rule of thumb for open farmland, and the user can change it.
//   4. Through a GENERIC power curve (not any manufacturer's): nothing below
//      cut-in, a cubic rise to rated power, flat to cut-out, nothing above.
//   5. Less losses: wakes, availability, electrical, icing and the rest, as one
//      editable percentage.
// The result is labelled a screening estimate everywhere it appears. A bank
// lends on an independent study with on-site measurements; once its P50 and
// P90 are entered, they replace this.

export const BIN = 0.5;                 // m/s
export const DEFAULT_TURBINE = { cutIn: 3, rated: 11, cutOut: 25 };
export const DEFAULT_SHEAR = 0.2;
export const DEFAULT_LOSSES_PCT = 15;
/** Uncertainty of a screening estimate with no measurement on site (1 sigma, % of P50). An assumption, shown as one. */
export const SCREENING_SIGMA_PCT = 15;
export const HOURS_PER_YEAR = 8760;

/**
 * Hourly speeds into a histogram: counts per BIN-wide bin, bin i covering
 * [i*BIN, (i+1)*BIN). Missing values (NASA's -999 fill) are skipped.
 * @returns {{ counts: number[], hours: number, mean: number }}
 */
export function histogram(speeds) {
  const counts = [];
  let hours = 0, sum = 0;
  for (const v of speeds || []) {
    const s = Number(v);
    if (!Number.isFinite(s) || s < 0 || s > 60) continue;
    const i = Math.floor(s / BIN);
    counts[i] = (counts[i] || 0) + 1;
    hours++; sum += s;
  }
  for (let i = 0; i < counts.length; i++) counts[i] = counts[i] || 0;
  return { counts, hours, mean: hours ? sum / hours : 0 };
}

/** The mean speed a histogram describes (bin centres). */
export function histMean(h) {
  if (!h || !h.hours) return 0;
  return h.counts.reduce((s, c, i) => s + c * (i + 0.5) * BIN, 0) / h.hours;
}

/** Power law from 50 m to the hub. */
export const hubFactor = (hubM, shear = DEFAULT_SHEAR) => Math.pow(Math.max(10, Number(hubM) || 100) / 50, Number.isFinite(Number(shear)) ? Number(shear) : DEFAULT_SHEAR);

/** Share of rated power at speed v on the generic curve. */
export function curve(v, t = DEFAULT_TURBINE) {
  const { cutIn, rated, cutOut } = { ...DEFAULT_TURBINE, ...(t || {}) };
  if (v < cutIn || v >= cutOut) return 0;
  if (v >= rated) return 1;
  return (Math.pow(v, 3) - Math.pow(cutIn, 3)) / (Math.pow(rated, 3) - Math.pow(cutIn, 3));
}

/**
 * Net yearly energy of a wind farm from a 50 m histogram.
 * @param {object} a
 * @param {{counts:number[], hours:number}} a.hist   hourly 50 m speeds of one year
 * @param {number} [a.climMean]  the site's long-term mean at 50 m; the histogram is scaled to it
 * @param {number} a.mw          installed capacity, MW
 * @param {number} [a.hubM]      hub height, m
 * @param {number} [a.shear]     power-law exponent
 * @param {number} [a.lossesPct] all losses together, %
 * @param {object} [a.turbine]   { cutIn, rated, cutOut } of the generic curve
 * @returns {{ netMwh: number, grossMwh: number, cfPct: number, meanHub: number, meanAt50: number, scale: number }}
 */
export function windEnergy({ hist, climMean = null, mw, hubM = 120, shear = DEFAULT_SHEAR, lossesPct = DEFAULT_LOSSES_PCT, turbine = DEFAULT_TURBINE }) {
  const cap = Math.max(0, Number(mw) || 0);
  if (!hist || !hist.hours || !cap) return { netMwh: 0, grossMwh: 0, cfPct: 0, meanHub: 0, meanAt50: 0, scale: 1 };
  const yearMean = histMean(hist);
  const scale = climMean > 0 && yearMean > 0 ? climMean / yearMean : 1;
  const k = hubFactor(hubM, shear) * scale;
  // a histogram of any length stands for a full year
  const perYear = HOURS_PER_YEAR / hist.hours;
  let share = 0;
  hist.counts.forEach((c, i) => { if (c) share += c * curve((i + 0.5) * BIN * k, turbine); });
  const grossMwh = cap * share * perYear;
  const netMwh = grossMwh * (1 - Math.min(60, Math.max(0, Number(lossesPct) || 0)) / 100);
  return {
    netMwh, grossMwh,
    cfPct: (netMwh / (cap * HOURS_PER_YEAR)) * 100,
    meanAt50: yearMean * scale,
    meanHub: yearMean * scale * hubFactor(hubM, shear),
    scale,
  };
}

/** P90 from a P50 and a 1-sigma uncertainty in % (normal approximation, z = 1.2816). */
export const p90From = (p50, sigmaPct) => Math.max(0, p50 * (1 - (1.2816 * Math.max(0, sigmaPct)) / 100));

/** The 1-sigma uncertainty a study's own P50 and P90 imply, in %. */
export function sigmaFrom(p50, p90) {
  const a = Number(p50), b = Number(p90);
  if (!(a > 0) || !(b > 0) || b > a) return null;
  return ((1 - b / a) / 1.2816) * 100;
}
