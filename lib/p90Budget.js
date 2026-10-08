// lib/p90Budget.js — what a solar plant's P90 is made of. The yield's
// uncertainty is the root-sum-square of independent parts (the same seven
// parts Studio's P50/P90 export uses, summing to about 7.1%). One part is
// measurable for the exact site: how much the yearly yield varies from year to
// year, which PVGIS reports as the standard deviation of the yield over the
// years of its radiation database. When the plant has that figure it replaces
// the generic 4.8% guess for the weather; every other part stays an
// assumption and is shown as one. A study's own P50 and P90 replace the whole
// budget (lib/windScreen.js sigmaFrom). Pure.

/** The generic parts, % of the yearly yield (1 sigma). Sum of squares 50.5, so about 7.1%. */
export const SOLAR_PARTS = [
  { id: "ghi", pct: 3.5 },        // long-term solar resource (satellite data)
  { id: "weather", pct: 4.8 },    // year-to-year weather: the part a site figure replaces
  { id: "model", pct: 2.6 },      // transposition and PV model
  { id: "soiling", pct: 1.8 },    // soiling and snow
  { id: "availability", pct: 1.5 },
  { id: "shading", pct: 1.4 },    // shading and horizon
  { id: "lid", pct: 1.0 },        // first-year degradation and LID
];

const rss = (xs) => Math.sqrt(xs.reduce((a, x) => a + x * x, 0));

/**
 * @param {{variabilityPct?: number|null, variabilityDb?: string, variabilityYears?: string}} [site]
 * @returns {{ parts: {id:string, pct:number, source:"site"|"assumed", db?:string, years?:string}[], totalPct: number, siteWeather: boolean }}
 */
export function solarBudget(site = {}) {
  const v = Number(site?.variabilityPct);
  const siteWeather = Number.isFinite(v) && v > 0 && v <= 15;
  const parts = SOLAR_PARTS.map((p) => (p.id === "weather" && siteWeather
    ? { id: p.id, pct: v, source: "site", db: site.variabilityDb || "", years: site.variabilityYears || "" }
    : { ...p, source: "assumed" }));
  return { parts, totalPct: rss(parts.map((p) => p.pct)), siteWeather };
}

/** P90 as a share of P50 for a 1-sigma uncertainty, one-year horizon (z = 1.2816). */
export const p90Share = (sigmaPct) => Math.max(0, 1 - (1.2816 * Math.max(0, sigmaPct)) / 100);
