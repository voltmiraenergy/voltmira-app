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

/** How far round a point `capacityNear` looks, km: the snapshot keeps positions to a tenth of a degree (about 11 km north-south), so nothing finer is honest. */
export const NEAR_KM = 15;

/**
 * Plants already in operation round a point, by technology, from the points
 * the snapshot keeps. A floor, never the load on a substation: positions are
 * rounded to a tenth of a degree, and about a quarter of the plants' capacity
 * has no usable position at all. Says nothing about which substation or
 * voltage a plant feeds, nor about plants still waiting to connect.
 * @returns {{ pv:{kw:number,n:number}, wind:{kw:number,n:number}, hydro:{kw:number,n:number}, km:number }}
 */
export function capacityNear(snap, lat, lon, km = NEAR_KM) {
  const out = { pv: { kw: 0, n: 0 }, wind: { kw: 0, n: 0 }, hydro: { kw: 0, n: 0 }, km };
  const k = Math.PI / 180, R = 6371;
  for (const row of snap?.points || []) {
    const [plat, plon, tech, kw, n] = row;
    if (!out[tech] || tech === "km") continue;
    const d = 2 * R * Math.asin(Math.sqrt(Math.sin(((plat - lat) * k) / 2) ** 2 + Math.cos(lat * k) * Math.cos(plat * k) * Math.sin(((plon - lon) * k) / 2) ** 2));
    if (d > km) continue;
    out[tech].kw += Number(kw) || 0;
    out[tech].n += Number(n) || 0;
  }
  return out;
}

/**
 * What a plant's grid section shows of the area round it: the plants already
 * connected in its district (with whether that district is in the top quarter
 * for solar), and those within NEAR_KM. A prompt to ask the operator about
 * free capacity, never a finding about the grid. null outside the districts
 * CNED reports on.
 */
export function gridContext(snap, stats, lat, lon, shapes) {
  const id = raionFor(lat, lon, shapes);
  const s = id && RAION[id]?.covered ? stats.find((x) => x.id === id) : null;
  if (!s) return null;
  const pvSorted = stats.map((x) => x.plants.pv.kw).sort((a, b) => a - b);
  const q3 = pvSorted[Math.floor(pvSorted.length * 0.75)];
  return {
    raion: id, pvKw: s.plants.pv.kw, windKw: s.plants.wind.kw, plantsN: s.plantsN,
    crowded: s.plants.pv.kw >= q3 && s.plants.pv.kw > 0,
    near: capacityNear(snap, lat, lon),
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

// ---------------------------------------------------------------- the map over time

/** What the map can colour by: plants (kW), prosumers (kW), prosumers per 10,000 residents, prosumer kW added in 12 months. */
export const MAP_METRICS = ["plants", "prosumers", "per10k", "growth"];

/**
 * The moments the map can step through for a metric, oldest first, the last
 * being the snapshot's own date: plants by year (CNED keeps their capacity at
 * each year's end, the last year to the data date), prosumers by month (the
 * snapshot keeps 25 months), the 12-month growth from the 13th month on.
 * @returns {{ kind: "year"|"month", keys: string[] }}
 */
export function timeline(stats, metric) {
  if (metric === "plants") {
    const years = new Set();
    for (const s of stats) for (const y of Object.keys(s.plantsByYear || {})) years.add(Number(y));
    if (!years.size) return { kind: "year", keys: [] };
    const lo = Math.min(...years), hi = Math.max(...years), keys = [];
    for (let y = lo; y <= hi; y++) keys.push(String(y));
    return { kind: "year", keys };
  }
  const months = stats.find((s) => s.monthly?.length)?.monthly.map((m) => m[0]) || [];
  return { kind: "month", keys: metric === "growth" ? months.slice(12) : months };
}

/**
 * One area's plants at the end of a year, by technology. CNED's yearly series
 * is cumulative but skips a year now and then (Dubăsari has no 2023, then
 * 1.8 MW in 2024): a skipped year carries the year before, since capacity does
 * not vanish and come back. After the series ends the area has none left
 * (Bălți: 60 kW until 2022, none today).
 */
export function plantsInYear(s, year) {
  const by = s?.plantsByYear || {};
  const years = Object.keys(by).map(Number).sort((a, b) => a - b);
  const y = Number(year);
  if (!years.length || y < years[0] || y > years.at(-1)) return { pv: 0, wind: 0, hydro: 0 };
  const at = years.filter((k) => k <= y).at(-1);
  const row = by[at] || {};
  return { pv: row.pv || 0, wind: row.wind || 0, hydro: row.hydro || 0 };
}

/**
 * The value an area shows on the map for a metric at a moment of timeline();
 * no `key` means the snapshot's date. tech narrows plants to one technology.
 * null when it cannot be worked out (no population, or a month not kept).
 */
export function valueAt(s, metric, tech = "all", key = null) {
  if (!s) return null;
  if (metric === "plants") {
    if (key == null) return tech === "all" ? s.plantsKw : s.plants[tech]?.kw || 0;
    const p = plantsInYear(s, key);
    return round1(tech === "all" ? TECHS.reduce((a, t) => a + p[t], 0) : p[tech] || 0);
  }
  const m = s.monthly || [];
  const i = key == null ? m.length - 1 : m.findIndex((r) => r[0] === key);
  if (key == null && metric === "prosumers") return s.prosumers.kw;
  if (key == null && metric === "per10k") return s.perTenK;
  if (key == null && metric === "growth") return s.growth12?.kw ?? null;
  if (i < 0) return null;
  if (metric === "prosumers") return m[i][1];
  if (metric === "per10k") return s.population ? round1((m[i][2] / s.population) * 10000) : null;
  if (metric === "growth") return i >= 12 ? round1(m[i][1] - m[i - 12][1]) : null;
  return null;
}

/** Four cut points splitting the positive values into five equal-count classes (quintiles); fewer when there are few distinct values. */
export function quintileCuts(values) {
  const pos = values.filter((v) => v != null && v > 0).sort((a, b) => a - b);
  if (!pos.length) return [];
  const cuts = [0.2, 0.4, 0.6, 0.8].map((p) => pos[Math.min(pos.length - 1, Math.floor(p * pos.length))]);
  return [...new Set(cuts)];
}

/** The class of a value against quintileCuts(): -1 no data, 0 none, 1 to 5 from palest to deepest. */
export const classOf = (v, cuts) => (v == null ? -1 : v <= 0 ? 0 : 1 + cuts.filter((c) => v > c).length);

/**
 * Where each area's prosumer market stands: how many prosumers it already has
 * per 10,000 residents (x) against how much its prosumer capacity grew in 12
 * months, % (y), split at the medians of the areas. "early" is the corner an
 * installer looks at first: growing faster than most, with fewer prosumers
 * than most so far. A reading of CNED's counts, never a forecast.
 * @returns {{ xMed:number, yMed:number, rows: {id:string, x:number, y:number, population:number, q:"early"|"hot"|"quiet"|"mature"}[] }}
 */
export function marketQuadrants(stats) {
  const rows = stats.filter((s) => s.perTenK != null && s.growth12?.pctKw != null)
    .map((s) => ({ id: s.id, x: s.perTenK, y: s.growth12.pctKw, population: s.population || 0 }));
  const median = (a) => {
    const v = [...a].sort((x, y) => x - y), m = v.length >> 1;
    return v.length ? (v.length % 2 ? v[m] : round1((v[m - 1] + v[m]) / 2)) : 0;
  };
  const xMed = median(rows.map((r) => r.x)), yMed = median(rows.map((r) => r.y));
  for (const r of rows) r.q = r.y > yMed ? (r.x <= xMed ? "early" : "hot") : (r.x <= xMed ? "quiet" : "mature");
  return { xMed, yMed, rows };
}

/** The country's prosumers per 10,000 residents across the covered areas. */
export function nationalPerTenK(stats) {
  const pop = stats.reduce((a, s) => a + (s.population || 0), 0);
  const n = stats.reduce((a, s) => a + s.prosumers.n, 0);
  return pop ? round1((n / pop) * 10000) : null;
}
