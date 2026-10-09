// lib/monitoringPricing.js — what an installer pays for monitoring the
// systems they installed (lib/inverterSync.js pulls each system's monthly
// production from FusionSolar, Solarman or Growatt). Recurring revenue that
// grows with the installed base, not with seats.
//
// The price: the first 10 systems free, then 1.50 EUR per system a month.
// A system counts only while it is actually monitored: its portal delivered a
// reading for one of the last two finished months. A station whose
// connection broke, or that never synced, is not billed. Billing is done by
// hand for now: the Traction page shows each workspace's count and amount,
// and VoltMira invoices monthly. Until MONITORING_BILLING is "on" the app
// says monitoring is free while it is tested. Pure; no I/O.

export const FREE_SYSTEMS = 10;
export const EUR_PER_SYSTEM = 1.5;

/** Whether monitoring is billed yet. */
export function monitoringBilled(env = process.env) {
  return String(env.MONITORING_BILLING || "").toLowerCase() === "on";
}

/** "YYYY-MM" of the month `back` months before the one `now` falls in (UTC). */
function monthBack(now, back) {
  const d = new Date(now instanceof Date ? now.getTime() : Number(now));
  const m = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() - back, 1));
  return `${m.getUTCFullYear()}-${String(m.getUTCMonth() + 1).padStart(2, "0")}`;
}

/**
 * Whether a station is monitored now: its latest reading is for one of the
 * last two finished months (readings are written only for months that are over).
 * @param {{ last_month?: string|null }} station  last_month "YYYY-MM-01" or "YYYY-MM"
 */
export function isMonitored(station, now = Date.now()) {
  const lm = String(station?.last_month || "").slice(0, 7);
  if (!/^\d{4}-\d{2}$/.test(lm)) return false;
  return lm >= monthBack(now, 2) && lm < monthBack(now, 0);
}

/** The monitored systems among a company's stations. */
export function monitoredCount(stations, now = Date.now()) {
  return (stations || []).filter((s) => isMonitored(s, now)).length;
}

/**
 * The monthly bill for a number of monitored systems.
 * @returns {{ systems:number, free:number, billable:number, monthlyEur:number }}
 */
export function monitoringBill(systems) {
  const n = Math.max(0, Math.floor(Number(systems) || 0));
  const billable = Math.max(0, n - FREE_SYSTEMS);
  return { systems: n, free: Math.min(n, FREE_SYSTEMS), billable, monthlyEur: Math.round(billable * EUR_PER_SYSTEM * 100) / 100 };
}
