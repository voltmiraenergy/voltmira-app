// lib/solarSite.js — what a PVGIS answer (engine/pvgis.js getSolarYield) adds to
// a plant's solar part: how much the site's yearly yield varies from year to
// year, which database and years that comes from, and PVGIS's own loss
// breakdown. Kept apart from lib/plantActions.js, a server-actions file that
// may only export async functions. Pure.

/** @param {{variability?: {sdPct:number, db:string, years:string}|null, losses?: object|null}} r */
export function solarSiteData(r) {
  return {
    ...(r?.variability
      ? { variabilityPct: r.variability.sdPct, variabilityDb: r.variability.db, variabilityYears: r.variability.years }
      : { variabilityPct: null, variabilityDb: "", variabilityYears: "" }),
    yieldLosses: r?.losses || null,
  };
}
