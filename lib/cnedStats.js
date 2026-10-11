// lib/cnedStats.js — the figures every CNED surface derives from a snapshot
// of CNED's register (lib/data/cnedEser.js): each area's totals and ranks,
// per 10,000 residents, 12-month growth, the installer's market, a quote's
// area, a portfolio's regional context. Pure functions of the snapshot or of
// raionStats() rows, with NO data of their own, so client components can use
// them on rows the server hands over (lib/cnedData.js holds the data and the
// switch).
import { RAIONS, RAION, COVERED, raionAt, nearestRaions } from "./mdRaions.js";

const TECHS = ["pv", "wind", "hydro"];
const round1 = (x) => Math.round(x * 10) / 10;
const pct = (a, b) => (b > 0 ? round1((a / b) * 100) : null);

/** The value a monthly series had `back` months before its last entry: [ym, kw, n] rows, oldest first. */
function monthsBack(series, back) {
  if (!series?.length) return null;
  const last = series[series.length - 1][0];
  const [y, m] = last.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 - back, 1));
  const want = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
  return series.find((r) => r[0] === want) || null;
}

/**
 * Every covered area's figures, with its ranks among the 35:
 *   plantsKw     plants in scope (solar, wind, hydro), kW; plants[t] = { kw, n }
 *   prosumers    { kw, n, pf, pj, cn, fn }: households (pf), companies (pj),
 *                net metering (cn), net billing (fn)
 *   perTenK      prosumers per 10,000 residents (BNS, 1 January 2026)
 *   growth12     prosumers added in the last 12 months: { kw, n, pctKw }
 *   near         the 5 nearest areas by centre, when centres are given
 */
export function raionStats(snap, centres = null) {
  if (!snap) return [];
  const rows = COVERED.map((r) => {
    const d = snap.raions[r.id];
    if (!d) return null;
    const plants = Object.fromEntries(TECHS.map((t) => [t, d.plants[t] || { kw: 0, n: 0 }]));
    const plantsKw = round1(TECHS.reduce((s, t) => s + plants[t].kw, 0));
    const plantsN = TECHS.reduce((s, t) => s + plants[t].n, 0);
    const p = d.prosumers;
    const now = d.prosumersMonthly.at(-1), then = monthsBack(d.prosumersMonthly, 12);
    const growth12 = now && then ? { kw: round1(now[1] - then[1]), n: now[2] - then[2], pctKw: pct(now[1] - then[1], then[1]) } : null;
    return {
      id: r.id, population: r.population, operator: r.operator,
      plants, plantsKw, plantsN, byScheme: d.byScheme, plantsByYear: d.plantsByYear,
      prosumers: p,
      perTenK: r.population ? round1((p.n / r.population) * 10000) : null,
      kwPerTenK: r.population ? round1((p.kw / r.population) * 10000) : null,
      householdsPct: pct(p.pf.n, p.n), netBillingPct: pct(p.fn.n, p.n),
      growth12, monthly: d.prosumersMonthly, bess: d.bess || null,
      near: centres ? nearestRaions(r.id, centres).map((x) => x.id) : [],
    };
  }).filter(Boolean);
  // ranks: 1 = highest
  const rank = (key, get) => {
    const order = [...rows].filter((x) => get(x) != null).sort((a, b) => get(b) - get(a));
    order.forEach((x, i) => { x.rank = { ...(x.rank || {}), [key]: i + 1 }; });
  };
  rank("plantsKw", (x) => x.plantsKw);
  rank("prosumersKw", (x) => x.prosumers.kw);
  rank("perTenK", (x) => x.perTenK);
  rank("growth", (x) => x.growth12?.kw ?? null);
  return rows;
}

/** National totals as CNED prints them: plants by technology, prosumers, the total with "other" (biogas) kept out of the parts. */
export function nationalTotals(snap) {
  if (!snap) return null;
  const n = snap.national;
  const plantsKw = TECHS.reduce((s, t) => s + n.plants[t].kw, 0);
  return {
    totalKw: round1(plantsKw + n.plants.other.kw + n.prosumers.kw),
    plantsKw: round1(plantsKw), otherKw: n.plants.other.kw,
    plants: n.plants, prosumers: n.prosumers, bess: n.bess, byScheme: n.byScheme,
    installations: TECHS.reduce((s, t) => s + n.plants[t].n, 0) + n.plants.other.n,
    unlocatedKw: n.unlocatedKw, dataTo: snap.source.dataTo,
  };
}

/** The installer's chosen areas, summed, with the nearby areas outside them that grew most. */
export function marketSummary(stats, ids) {
  const set = new Set(ids);
  const mine = stats.filter((s) => set.has(s.id));
  if (!mine.length) return null;
  const sum = (f) => round1(mine.reduce((a, s) => a + (f(s) || 0), 0));
  const population = mine.reduce((a, s) => a + (s.population || 0), 0);
  const n = sum((s) => s.prosumers.n), kw = sum((s) => s.prosumers.kw);
  const g = { kw: sum((s) => s.growth12?.kw), n: sum((s) => s.growth12?.n) };
  const nearIds = [...new Set(mine.flatMap((s) => s.near))].filter((id) => !set.has(id));
  const nearby = stats.filter((s) => nearIds.includes(s.id)).sort((a, b) => (b.growth12?.kw || 0) - (a.growth12?.kw || 0)).slice(0, 4);
  return {
    ids: mine.map((s) => s.id), population, n, kw, growth12: { ...g, pctKw: pct(g.kw, kw - g.kw) },
    perTenK: population ? round1((n / population) * 10000) : null,
    households: sum((s) => s.prosumers.pf.n), companies: sum((s) => s.prosumers.pj.n),
    netBilling: sum((s) => s.prosumers.fn.n), plantsKw: sum((s) => s.plantsKw),
    rows: [...mine].sort((a, b) => (b.growth12?.kw || 0) - (a.growth12?.kw || 0)),
    nearby,
  };
}

/** One area's figures for a quote: what the installer sees, and the one line a client may see. */
export function raionBrief(stats, id) {
  const s = stats.find((x) => x.id === id);
  if (!s) return null;
  return {
    id, population: s.population, operator: s.operator,
    prosumers: s.prosumers, perTenK: s.perTenK, rankPerTenK: s.rank?.perTenK ?? null, growth12: s.growth12,
    householdsN: s.prosumers.pf.n, plantsKw: s.plantsKw, bess: s.bess,
  };
}

/** Which area a position is in, for a quote or a plant. Shapes come from lib/data/mdRaionShapes.js. */
export const raionFor = (lat, lon, shapes) => raionAt(Number(lat), Number(lon), shapes);

/**
 * The regional context of a portfolio's assets for lenders: the area each one
 * sits in and what is already built there. `crowded` marks an area in the top
 * quarter for solar plants already connected: a prompt to check the
 * substation's free capacity, never a finding about the grid.
 */
export function regionalContext(stats, assets, shapes) {
  if (!stats.length) return [];
  const pvSorted = stats.map((s) => s.plants.pv.kw).sort((a, b) => a - b);
  const q3 = pvSorted[Math.floor(pvSorted.length * 0.75)];
  return (assets || []).filter((a) => a.lat != null && a.lon != null).map((a) => {
    const id = raionFor(a.lat, a.lon, shapes);
    const s = id ? stats.find((x) => x.id === id) : null;
    return {
      name: a.name, raion: id, covered: !!RAION[id]?.covered,
      pvKw: s?.plants.pv.kw ?? null, windKw: s?.plants.wind.kw ?? null, plantsN: s?.plantsN ?? null,
      prosumersKw: s?.prosumers.kw ?? null, bessKwh: s?.bess?.kwh ?? null,
      crowded: s ? s.plants.pv.kw >= q3 && s.plants.pv.kw > 0 : false,
    };
  });
}

/** Area ids with no data, for the map's grey. */
export const UNCOVERED = RAIONS.filter((r) => !r.covered).map((r) => r.id);
