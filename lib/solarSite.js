// lib/solarSite.js — what a PVGIS answer (engine/pvgis.js getSolarYield) adds to
// a plant's solar part: how much the site's yearly yield varies from year to
// year, which database and years that comes from, and PVGIS's own loss
// breakdown. Kept apart from lib/plantActions.js, a server-actions file that
// may only export async functions. Pure.

/**
 * @param {{variability?: {sdPct:number, db:string, years:string}|null, losses?: object|null}} r  engine getSolarYield()
 * @param {{ yearly: {y:number, pct:number}[] }|null} [weather]  engine getYearlyIrradiation(); null when not answered
 * @param {{ year:number, db:string, ratios:number[], lostPct:number[] }|null} [clip]  engine getClippingCurve(); null when not answered (the plant keeps the curve it has)
 * @param {{ tilt:number, azimuth:number }} [angles]  what PVGIS was asked for (0 is south)
 */
export function solarSiteData(r, weather = null, clip = null, angles = { tilt: 35, azimuth: 0 }) {
  return {
    yieldDesign: { tilt: angles.tilt, azimuth: angles.azimuth },
    ...(clip ? { clipCurve: { year: clip.year, db: clip.db, ratios: clip.ratios, lostPct: clip.lostPct } } : {}),
    weatherYears: weather?.yearly || [],
    monthShape: Array.isArray(r?.monthlyShape) && r.monthlyShape.length === 12 ? r.monthlyShape.map((x) => Math.round(x * 1e4) / 1e4) : null,
    ...(r?.variability
      ? { variabilityPct: r.variability.sdPct, variabilityDb: r.variability.db, variabilityYears: r.variability.years }
      : { variabilityPct: null, variabilityDb: "", variabilityYears: "" }),
    yieldLosses: r?.losses || null,
  };
}
