// lib/gridOptions.js — the connection options of a plant compared side by
// side, the way a developer and a lender weigh them: how long the line is
// (the route drawn on the map, or the straight line times the route factor),
// whether one circuit at that voltage can carry the plant (and the other
// plants that chose the same point), how much energy the line loses in a year,
// what it costs from the user's own figures, and what each does to the deal
// (lowest DSCR, project IRR, NPV). The best option that can carry the plant is
// marked; it is an estimate to discuss with the operator, never its answer.
//
// The engineering, stated so it can be checked:
//   capacity of one circuit  MW = sqrt(3) x kV x A x pf      (pf 0.95)
//   line losses              peak 3 x I^2 x R; a year = peak x LLF x 8760 h,
//                            LLF = 0.3 x CF + 0.7 x CF^2 (the usual loss-load
//                            factor), CF the plant's capacity factor
// The conductor ratings and resistances are typical tabulated values for
// steel-aluminium (AC) conductors; the user picks the conductor per voltage.
// Pure; no I/O.
import { allOptions, optionRoute, chosenPoint, GRID_CLASSES } from "./gridNear.js";
import { normalizePlant, plantEnergy, evaluatePlant } from "./plantFinance.js";

/** Steel-aluminium conductors: continuous rating outdoors, A, and resistance, ohm per km per phase. Bundles count their sub-conductors. */
export const CONDUCTORS = {
  "AC-70": { a: 265, ohmKm: 0.4218 },
  "AC-95": { a: 330, ohmKm: 0.3007 },
  "AC-120": { a: 390, ohmKm: 0.244 },
  "AC-150": { a: 450, ohmKm: 0.1963 },
  "AC-185": { a: 510, ohmKm: 0.1591 },
  "AC-240": { a: 610, ohmKm: 0.1182 },
  "AC-300": { a: 690, ohmKm: 0.0958 },
  "AC-400": { a: 835, ohmKm: 0.0733 },
  "2xAC-300": { a: 1380, ohmKm: 0.0479 },
  "3xAC-400": { a: 2505, ohmKm: 0.0244 },
};
export const DEFAULT_CONDUCTOR = { 35: "AC-120", 110: "AC-185", hv: "2xAC-300" };
export const POWER_FACTOR = 0.95;

const conductorOf = (grid, cls) => CONDUCTORS[grid?.conductors?.[cls]] ? grid.conductors[cls] : DEFAULT_CONDUCTOR[cls];

/** What one circuit carries, MW. */
export function circuitMw(kv, conductor) {
  const c = CONDUCTORS[conductor];
  return c ? (Math.sqrt(3) * kv * c.a * POWER_FACTOR) / 1000 : null;
}

/**
 * The energy a connection line loses in a year.
 * @returns {{ peakKw: number, mwh: number, pct: number }}
 */
export function lineLoss({ mw, cf, kv, km, conductor }) {
  const c = CONDUCTORS[conductor];
  if (!c || !(mw > 0) || !(kv > 0) || !(km >= 0)) return { peakKw: 0, mwh: 0, pct: 0 };
  const amps = (mw * 1e6) / (Math.sqrt(3) * kv * 1e3 * POWER_FACTOR);
  const peakKw = (3 * amps * amps * c.ohmKm * km) / 1000;
  const f = Math.max(0, Math.min(1, cf || 0));
  const llf = 0.3 * f + 0.7 * f * f;
  const mwh = (peakKw / 1000) * llf * 8760;
  const yearly = mw * f * 8760;
  return { peakKw, mwh, pct: yearly > 0 ? (mwh / yearly) * 100 : 0 };
}

/** The plant's generating capacity, MW (wind plus solar as installed), and its capacity factor at P50. */
export function plantMwCf(pl) {
  const mw = (pl.wind ? pl.wind.mw : 0) + (pl.solar ? pl.solar.mwp : 0);
  const en = plantEnergy(pl);
  return { mw, cf: mw > 0 ? en.p50Mwh / (mw * 8760) : 0, mwh: en.p50Mwh };
}

/**
 * Plants of a portfolio grouped by the point they connect to: for each option
 * key, who uses it, their MW together, and who shares the line's cost.
 * @param {object[]} plants  raw plants
 * @returns {Map<string, {key, members: Array<{id, name, mw, shared, routeKm}>, mw: number, cls: string, kvAt: number}>}
 */
export function connectionGroups(plants) {
  const groups = new Map();
  for (const raw of plants || []) {
    const pl = normalizePlant(raw);
    const p = chosenPoint(pl.grid);
    if (!p) continue;
    const { mw } = plantMwCf(pl);
    const g = groups.get(p.key) || { key: p.key, members: [], mw: 0, cls: p.cls, kvAt: p.kvAt, name: p.name };
    g.members.push({ id: pl.id, name: pl.name, mw, shared: !!pl.grid.shared, routeKm: optionRoute(pl.grid, p).km });
    g.mw += mw;
    groups.set(p.key, g);
  }
  return groups;
}

/** The plant as it would be with an option applied: the option's cost as the grid cost, its losses on the energy. */
export function withOption(plant, key, costEur, lossPct) {
  const raw = plant && typeof plant === "object" ? plant : {};
  return { ...raw, costs: { ...(raw.costs || {}), gridEur: costEur }, grid: { ...(raw.grid || {}), applied: { key, costEur, lossPct } } };
}

/**
 * The options compared.
 * @param {object} plant   the raw plant
 * @param {object} ctx
 * @param {object} ctx.E   engine settings
 * @param {object} ctx.fin, ctx.scenario  the portfolio's terms and case
 * @param {Map} [ctx.groups]  connectionGroups() of the portfolio, for shared points
 * @param {number} [ctx.perClass]  substations per class to compare (nearest first)
 */
export function compareOptions(plant, { E, fin, scenario, groups = null, perClass = 2 } = {}) {
  const pl = normalizePlant(plant);
  const g = pl.grid;
  if (!g) return { options: [], base: null, recommended: null };
  const { mw, cf, mwh } = plantMwCf(pl);
  const base = evaluatePlant(pl, E, fin, scenario);
  const price = base.energyKwh[0] > 0 ? base.revenue[0] / (base.energyKwh[0] / 1000) : 0;
  const chosen = chosenPoint(g);
  // per class: the nearest substations and the nearest line, plus the chosen point
  const all = allOptions(g);
  const pick = new Map();
  for (const c of GRID_CLASSES) {
    all.filter((o) => o.cls === c && o.kind === "sub").sort((a, b) => a.km - b.km).slice(0, perClass).forEach((o) => pick.set(o.key, o));
    const l = all.filter((o) => o.cls === c && o.kind === "line").sort((a, b) => a.km - b.km)[0];
    if (l) pick.set(l.key, l);
  }
  if (chosen) pick.set(chosen.key, chosen);

  const options = [...pick.values()].map((o) => {
    const route = optionRoute(g, o);
    const conductor = conductorOf(g, o.cls);
    const capacityMw = circuitMw(o.kvAt, conductor);
    const group = groups?.get(o.key);
    const othersMw = group ? group.members.filter((m) => m.id !== pl.id).reduce((s, m) => s + m.mw, 0) : 0;
    const totalMw = mw + othersMw;
    const loss = lineLoss({ mw, cf, kv: o.kvAt, km: route.km, conductor });
    const c = g.costs?.[o.cls] || {};
    const works = (o.kind === "sub" ? c.sub : c.tap) || 0;
    const aloneEur = c.perKm ? route.km * c.perKm + works : null;
    // a shared line: the longest route of those sharing it, the works once, split by MW
    let costEur = aloneEur, shareOf = null;
    const sharers = group ? group.members.filter((m) => m.shared && (m.id !== pl.id || g.shared)) : [];
    if (aloneEur != null && g.shared && chosen && chosen.key === o.key && sharers.length > 1) {
      const sharedMw = sharers.reduce((s, m) => s + m.mw, 0);
      const longest = Math.max(...sharers.map((m) => (m.id === pl.id ? route.km : m.routeKm)));
      shareOf = sharedMw > 0 ? mw / sharedMw : 1;
      costEur = (longest * c.perKm + works) * shareOf;
    }
    let effect = null;
    if (costEur != null) {
      const r = evaluatePlant(normalizePlant(withOption(plant, o.key, costEur, loss.pct)), E, fin, scenario);
      effect = { dscrMin: r.dscrMin, irr: r.irr, npv: r.npv, equityIrr: r.equityIrr };
    }
    return {
      ...o, route, conductor, capacityMw, othersMw, totalMw, fits: capacityMw != null && totalMw <= capacityMw,
      loss: { ...loss, eurYr: loss.mwh * price }, costEur, aloneEur, shareOf, effect, chosen: chosen ? chosen.key === o.key : false,
    };
  }).sort((a, b) => GRID_CLASSES.indexOf(a.cls) - GRID_CLASSES.indexOf(b.cls) || a.route.km - b.route.km);

  // the best that can carry the plant, by NPV; nothing to recommend without costs
  const able = options.filter((o) => o.fits && o.effect);
  const recommended = able.length ? able.reduce((a, b) => (b.effect.npv > a.effect.npv ? b : a)).key : null;
  return { options, base: { dscrMin: base.dscrMin, irr: base.irr, npv: base.npv }, recommended, mw, cf, mwh };
}
