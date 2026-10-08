// lib/weatherReplay.js — the loan's cover under the weather of every year on
// record. For each year PVGIS has (lib/solarSite.js stores them as each
// year's in-plane radiation, % of the average year), the plant's solar energy
// is set to that year's share and the whole plant is run again on the same
// loan; the lowest cover over the loan's life is the cover that year's sun
// would leave. A lender reads "the worst year on record still leaves 1.08x"
// more easily than a statistical P90. The weather applies to every year of the
// loan: the cover in the weakest loan year is the one that matters, and a
// single bad year hitting that year leaves the same figure. Radiation stands
// in for the yield (it ignores the small effect of temperature), and only the
// solar part is replayed. Pure.
import { normalizePlant, evaluatePlant } from "./plantFinance.js";

/**
 * @param {object} plant
 * @param {object} E, fin, scenario  as for evaluatePlant
 * @returns {null | { years:{y:number, pct:number, dscrMin:number|null}[], base:number|null, worst:{y:number, pct:number, dscrMin:number|null}, below:number, total:number, db:string, range:string }}
 *   null when the plant has no solar part, no weather years, or no debt to test
 */
export function weatherReplay(plant, E, fin, scenario) {
  const pl = normalizePlant(plant);
  if (!pl.solar || !pl.solar.weatherYears.length || pl.solar.yieldKwhKwp <= 0) return null;
  const base = evaluatePlant(pl, E, fin, scenario);
  if (base.dscrMin == null) return null;
  const years = pl.solar.weatherYears.map((w) => ({
    y: w.y, pct: w.pct,
    dscrMin: evaluatePlant(pl, E, fin, scenario, { solarFactor: w.pct / 100 }).dscrMin,
  }));
  const live = years.filter((x) => x.dscrMin != null);
  const worst = live.reduce((a, b) => (b.dscrMin < a.dscrMin ? b : a), live[0]);
  const ys = years.map((x) => x.y);
  return {
    years, base: base.dscrMin, worst,
    below: live.filter((x) => x.dscrMin < 1).length, total: live.length,
    db: pl.solar.variabilityDb, range: `${Math.min(...ys)}-${Math.max(...ys)}`,
  };
}

/** The weakest years first, for a short table. */
export const weakest = (replay, n = 5) => [...replay.years].sort((a, b) => (a.dscrMin ?? 9) - (b.dscrMin ?? 9) || a.y - b.y).slice(0, n);
