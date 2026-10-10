// lib/peakShaving.js — hour-by-hour battery peak-shaving simulation for ONE
// representative day: a real production shape (engine/pvgis.js's
// getHourlySolarShape — real PVGIS reanalysis irradiance, reduced to a
// representative day) against a real consumption shape
// (lib/residentialLoadProfile.js's published DEER SLP), both scaled to the
// project's own real daily kWh totals. Shows how much of the evening's draw
// a battery of a given size could cover from midday solar surplus, instead
// of that surplus being exported and the evening draw coming from the grid.
//
// Round-trip/usable-capacity factor: 0.9, the SAME figure engine/engine.js's
// own annual self-consumption model already uses for a battery's shiftable
// share ("~90% round-trip") — not a separately invented number.
//
// Pure function, no I/O — the caller supplies both real shapes and real
// daily totals; this only does the hour-by-hour bookkeeping.

const ROUND_TRIP = 0.9;
const EVENING_HOURS = [18, 19, 20, 21];

/**
 * @param {object} p
 * @param {number[]} p.prodShape 24 fractions of the day's production (sum 1)
 * @param {number[]} p.loadShape 24 fractions of the day's consumption (sum 1)
 * @param {number} p.dailyProdKwh real production for this representative day, kWh
 * @param {number} p.dailyConsKwh real consumption for this representative day, kWh
 * @param {number} p.battKwh nameplate battery capacity, kWh
 * @returns {null|{
 *   hours: {h:number, prodKwh:number, consKwh:number, directSolarKwh:number,
 *     battChargeKwh:number, battDischargeKwh:number, gridImportKwh:number,
 *     gridExportKwh:number, socKwh:number}[],
 *   shiftedKwh:number, eveningConsKwh:number, eveningCoverPct:number,
 *   gridImportKwh:number, gridExportKwh:number,
 * }}
 */
export function simulatePeakShaving({ prodShape, loadShape, dailyProdKwh, dailyConsKwh, battKwh }) {
  if (!Array.isArray(prodShape) || prodShape.length !== 24) return null;
  if (!Array.isArray(loadShape) || loadShape.length !== 24) return null;

  const usableKwh = Math.max(0, Number(battKwh) || 0) * ROUND_TRIP;
  const prodTotal = Math.max(0, Number(dailyProdKwh) || 0);
  const consTotal = Math.max(0, Number(dailyConsKwh) || 0);

  let soc = 0;
  let shiftedKwh = 0, totalImport = 0, totalExport = 0;
  const hours = [];
  for (let h = 0; h < 24; h++) {
    const prodKwh = prodTotal * prodShape[h];
    const consKwh = consTotal * loadShape[h];
    const directSolarKwh = Math.min(prodKwh, consKwh);
    const net = prodKwh - consKwh;

    let battChargeKwh = 0, battDischargeKwh = 0, gridImportKwh = 0, gridExportKwh = 0;
    if (net >= 0) {
      battChargeKwh = Math.min(net, usableKwh - soc);
      soc += battChargeKwh;
      gridExportKwh = net - battChargeKwh;
    } else {
      const need = -net;
      battDischargeKwh = Math.min(need, soc);
      soc -= battDischargeKwh;
      gridImportKwh = need - battDischargeKwh;
    }
    shiftedKwh += battDischargeKwh;
    totalImport += gridImportKwh;
    totalExport += gridExportKwh;
    hours.push({ h, prodKwh, consKwh, directSolarKwh, battChargeKwh, battDischargeKwh, gridImportKwh, gridExportKwh, socKwh: soc });
  }

  const eveningConsKwh = EVENING_HOURS.reduce((s, h) => s + consTotal * loadShape[h], 0);
  const eveningDischargeKwh = hours.filter((r) => EVENING_HOURS.includes(r.h)).reduce((s, r) => s + r.battDischargeKwh, 0);
  const eveningCoverPct = eveningConsKwh > 0 ? (eveningDischargeKwh / eveningConsKwh) * 100 : 0;

  return { hours, shiftedKwh, eveningConsKwh, eveningCoverPct, gridImportKwh: totalImport, gridExportKwh: totalExport };
}
