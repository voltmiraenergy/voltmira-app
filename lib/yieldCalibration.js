// lib/yieldCalibration.js — what the installed base says the yield estimate is
// really worth.
//
// Every quote promises a P50 yield taken from PVGIS. PVGIS models a location;
// it does not know this installer's mounting, their shading survey habits, the
// dust in this valley, or the fact that half their roofs face east. Once real
// systems have been running for a while, the ratio between what they produced
// and what was promised is a measurement of exactly that gap — and it is
// specific to one installer's own work in their own region, which is not a
// number anyone can buy.
//
// Design rules, because this feeds a number a client is shown:
//  · Compare like with like. A system with six months of readings is measured
//    against the P50 for those six months, never against a full year.
//  · Median, not mean. One inverter offline for a month must not drag the whole
//    calibration down.
//  · Refuse to answer on thin evidence. Under the thresholds below the honest
//    output is "not enough data yet", not a confident-looking 1.03.
//  · Never apply itself. The caller surfaces the factor and the installer
//    decides; a yield that silently drifts is the opposite of the promise.
import { SOLAR_SEASON } from "@voltmira/engine";

/** Below these, a ratio is noise dressed up as insight. */
export const MIN_SYSTEMS = 3;
export const MIN_MONTHS = 12;

/** Panel output after `years` of service at `degrPctPerYear`. */
function degraded(years, degrPctPerYear) {
  return Math.pow(1 - (Number(degrPctPerYear) || 0) / 100, Math.max(0, years));
}

/**
 * Expected kWh for one calendar month, from the system's own P50.
 * @param {number} kw            installed kWp
 * @param {number} yieldPerKwp   the P50 annual specific yield the quote promised
 * @param {number[]} shape       12 monthly weights (PVGIS shape when available)
 * @param {number} monthIndex    0 = January
 * @param {number} ageYears      years in service at that month
 */
export function expectedMonthKwh(kw, yieldPerKwp, shape, monthIndex, ageYears, degrPct = 0.5) {
  const s = Array.isArray(shape) && shape.length === 12 ? shape : SOLAR_SEASON;
  const sum = s.reduce((a, b) => a + (Number(b) || 0), 0) || 1;
  const annual = (Number(kw) || 0) * (Number(yieldPerKwp) || 0) * degraded(ageYears, degrPct);
  return (annual * (Number(s[monthIndex]) || 0)) / sum;
}

/**
 * One system's measured performance against its own promise.
 *
 * @param {object} sys
 *   readings: [{ month: "2026-03" | Date, kwh }]
 *   kw, yieldPerKwp, monthlyShape?, commissionedAt?
 * @returns {{ratio, actual, expected, months}|null} null when unmeasurable
 */
export function systemRatio(sys, degrPct = 0.5) {
  const kw = Number(sys?.kw) || 0;
  const y = Number(sys?.yieldPerKwp) || 0;
  const rows = Array.isArray(sys?.readings) ? sys.readings : [];
  if (!(kw > 0) || !(y > 0) || rows.length === 0) return null;

  const start = sys.commissionedAt ? new Date(sys.commissionedAt) : null;
  let actual = 0, expected = 0, months = 0;

  for (const r of rows) {
    const kwh = Number(r?.kwh);
    if (!Number.isFinite(kwh) || kwh < 0) continue;
    const d = r.month instanceof Date ? r.month : new Date(r.month + (String(r.month).length === 7 ? "-01" : ""));
    if (isNaN(d.getTime())) continue;

    // A partial first month would read as underperformance rather than as a
    // system that simply wasn't switched on yet.
    if (start && d.getUTCFullYear() === start.getUTCFullYear() && d.getUTCMonth() === start.getUTCMonth()) continue;
    if (start && d < start) continue;

    const ageYears = start ? Math.max(0, (d - start) / (365.25 * 864e5)) : 0;
    const exp = expectedMonthKwh(kw, y, sys.monthlyShape, d.getUTCMonth(), ageYears, degrPct);
    if (!(exp > 0)) continue;

    actual += kwh; expected += exp; months++;
  }

  if (!(expected > 0) || months === 0) return null;
  return { ratio: actual / expected, actual, expected, months };
}

function median(xs) {
  const a = xs.slice().sort((x, y) => x - y);
  if (!a.length) return 0;
  const m = a.length >> 1;
  return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2;
}

/**
 * The installed base's verdict on the yield model.
 *
 * @returns {{
 *   factor: number,        // multiply a P50 yield by this
 *   systems: number,       // how many contributed
 *   months: number,        // total system-months measured
 *   spread: number,        // p90/p10 ratio spread, a sanity check on the sample
 *   confident: boolean,    // false = do not show this as a recommendation
 *   ratios: number[],
 * }}
 */
export function calibrateYield(systems, degrPct = 0.5) {
  const list = (Array.isArray(systems) ? systems : [])
    .map((s) => systemRatio(s, degrPct))
    .filter(Boolean);

  const ratios = list.map((r) => r.ratio);
  const months = list.reduce((a, r) => a + r.months, 0);
  if (!ratios.length) {
    return { factor: 1, systems: 0, months: 0, spread: 0, confident: false, ratios: [] };
  }

  const sorted = ratios.slice().sort((a, b) => a - b);
  const at = (p) => sorted[Math.min(sorted.length - 1, Math.max(0, Math.round(p * (sorted.length - 1))))];
  const factor = median(ratios);

  return {
    factor,
    systems: ratios.length,
    months,
    spread: at(0.1) > 0 ? at(0.9) / at(0.1) : 0,
    // Enough systems AND enough months. Three systems with one month each is
    // three readings of one particular sunny March, not a calibration.
    confident: ratios.length >= MIN_SYSTEMS && months >= MIN_MONTHS,
    ratios,
  };
}

/**
 * The calibrated yield for a new quote — only ever when the evidence supports
 * it. Returns the original figure unchanged otherwise, so a caller that forgets
 * to check `confident` still cannot quote a number the data doesn't back.
 */
export function applyCalibration(yieldPerKwp, cal) {
  const y = Number(yieldPerKwp) || 0;
  if (!cal?.confident || !(cal.factor > 0)) return y;
  // Clamp: a factor outside ±25% is far likelier to be bad readings — a meter
  // reset, a kWh/MWh mix-up — than a real regional effect, and quietly applying
  // it would put a wrong number in front of a client.
  const f = Math.min(1.25, Math.max(0.75, cal.factor));
  return y * f;
}
