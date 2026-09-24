// lib/batteryBackup.js — the honest number behind "a battery is a distinct
// product, not just a bill-savings add-on": how many hours of this
// household's OWN average draw a given battery capacity could carry alone.
//
// Deliberately NOT a monetized "avoided blackout cost" — there's no reliable
// RO/MD outage-frequency data to price that against, and this product doesn't
// invent numbers it can't back up (see lib/inverterOptions.js's "energy
// capture" for the same principle: report what's actually computable, not a
// plausible-sounding score). Hours of coverage, from the household's own
// entered consumption, is the defensible claim.
//
// "Average draw" is a simplification, stated as such wherever this is shown:
// a real outage only powers whatever's actually connected (usually essential
// circuits only), so real runtime is normally LONGER than this figure, never
// shorter — the honest direction to round in.

/**
 * @param {number} battKwh        usable battery capacity, kWh
 * @param {number} annualConsKwh  the household's own annual consumption, kWh
 * @returns {number|null} hours of backup at the household's average hourly
 *   draw, or null when there's no consumption to divide by (never a fake
 *   number, never Infinity/NaN).
 */
export function backupHours(battKwh, annualConsKwh) {
  const batt = Number(battKwh);
  const cons = Number(annualConsKwh);
  if (!(batt > 0) || !(cons > 0)) return null;
  const avgHourlyKw = cons / 365 / 24;
  return batt / avgHourlyKw;
}
