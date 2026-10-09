// lib/plantLayout.js — a plant's site layout (lib/siteLayout.js) from the plant
// itself: the module count and rating from the equipment list (else the
// declared capacity at an assumed rating), the design tilt and azimuth, the
// number of inverter stations from the inverters' AC power and the transformer
// rating, the grid connection point it is planned to reach, and the plan the
// user drew (one or more plots, the zones no table may stand on, the table
// format and the setback). Several plots are filled nearest the grid first;
// each has its own corridor, and a cable joins each plot's connection point to
// the first one's. Says plainly why there is no layout when there is none. Pure.
import { designAngles } from "./equipment.js";
import { plantExport } from "./plantFinance.js";
import { chosenPoint } from "./gridNear.js";
import { generateLayout, landNeed, plotHectares } from "./siteLayout.js";

/** The module rating assumed where none is entered, Wp. */
export const ASSUMED_WP = 440;
/** The transformer rating assumed where none is entered, MVA. */
export const ASSUMED_MVA = 4.4;

const R = 6371008.8;
const metres = (a, b) => {
  const k = Math.PI / 180;
  const x = (b[1] - a[1]) * k * Math.cos(((a[0] + b[0]) / 2) * k), y = (b[0] - a[0]) * k;
  return Math.hypot(x, y) * R;
};
const centroid = (ring) => [ring.reduce((s, p) => s + p[0], 0) / ring.length, ring.reduce((s, p) => s + p[1], 0) / ring.length];

/**
 * The plant's inputs to a layout, before any plot is drawn.
 * @param {object} pl  a normalised plant with a solar part
 */
export function layoutInputs(pl) {
  const eq = pl.equipment;
  const site = pl.lat != null && pl.lon != null ? { lat: pl.lat, lon: pl.lon } : pl.layout ? { lat: pl.layout.plots[0][0][0], lon: pl.layout.plots[0][0][1] } : null;
  const wpGiven = eq?.modules?.wp > 0;
  const wp = wpGiven ? eq.modules.wp : ASSUMED_WP;
  const moduleCount = eq?.modules?.count > 0 ? eq.modules.count : Math.round((pl.solar.mwp * 1e6) / wp);
  const ang = designAngles(pl);
  const tiltGiven = eq?.mounting?.kind === "fixed" && eq.mounting.tiltDeg != null && eq.mounting.azimuthDeg != null;
  const ex = plantExport(pl);
  const acMw = ex?.acMw || pl.solar.mwp / 1.25;
  const mva = eq?.transformers?.mva > 0 ? eq.transformers.mva : ASSUMED_MVA;
  const stations = Math.max(1, Math.min(40, Math.ceil(acMw / mva)));
  const point = pl.grid ? chosenPoint(pl.grid) : null;
  const target = point?.to && Number.isFinite(point.to.lat) && Number.isFinite(point.to.lon) ? { lat: point.to.lat, lon: point.to.lon } : null;
  const lo = pl.layout || {};
  const inputs = { moduleCount, wp, tiltDeg: ang.tilt, azimuthDeg: ang.azimuth, stations, target, wide: lo.wide || 26, high: lo.high || 2, setbackM: lo.setbackM ?? 5 };
  return { site, inputs, assumed: { wp: !wpGiven, tilt: !tiltGiven } };
}

/**
 * Lay the plant out on its plots, nearest the grid first.
 * @param {number[][][]} plots
 * @param {{ring:number[][]}[]} exclusions
 * @param {object} inputs  layoutInputs().inputs
 * @returns {null | object}  the shape of generateLayout(), joined, with `plots` (each plot's own figures) and `links`
 */
export function layoutPlots(plots, exclusions, inputs) {
  const rings = (exclusions || []).map((e) => e.ring || e);
  const order = plots.map((ring, k) => ({ ring, k })).sort((a, b) => {
    if (!inputs.target) return a.k - b.k;
    const t = [inputs.target.lat, inputs.target.lon];
    return metres(centroid(a.ring), t) - metres(centroid(b.ring), t) || a.k - b.k;
  });
  // the stations are shared out by the plots' area
  const areaAll = plots.reduce((s, r) => s + plotHectares(r), 0) || 1;
  let left = inputs.moduleCount;
  const parts = [];
  for (const { ring, k } of order) {
    const st = Math.max(1, Math.round((inputs.stations * plotHectares(ring)) / areaAll));
    const r = generateLayout({ ...inputs, polygon: ring, moduleCount: Math.max(left, 1), stations: st, exclusions: rings });
    if (!r) continue;
    if (left <= 0) Object.assign(r, { tables: [], stations: [], cables: [] }, { stats: { ...r.stats, placedTables: 0, modulesPlaced: 0, mwpPlaced: 0, rows: 0, cableM: 0 } });
    left -= r.stats.modulesPlaced;
    parts.push({ k, r });
  }
  if (!parts.length) return null;
  const main = parts.find((p) => p.r.tables.length)?.r || parts[0].r;
  // each further plot that carries tables is joined to the main plot's connection point
  const links = parts.filter((p) => p.r !== main && p.r.tables.length).map((p) => [[p.r.connection.lat, p.r.connection.lon], [main.connection.lat, main.connection.lon]]);
  const linkM = links.reduce((s, l) => s + metres(l[0], l[1]), 0);
  let n = 0;
  const stations = parts.flatMap((p) => p.r.stations.map((s) => ({ ...s, n: ++n })));
  const sum = (key) => parts.reduce((s, p) => s + (p.r.stats[key] || 0), 0);
  const placedTables = sum("placedTables"), fitTables = sum("fitTables");
  const needTables = Math.ceil(inputs.moduleCount / main.stats.modulesPerTable);
  return {
    tables: parts.flatMap((p) => p.r.tables), stations, cables: [...parts.flatMap((p) => p.r.cables), ...links], links,
    connection: main.connection, plots: parts.map((p) => ({ k: p.k, stats: p.r.stats, connection: p.r.connection })),
    stats: {
      ...main.stats, plotHa: sum("plotHa"), placedTables, fitTables, needTables, modulesPlaced: sum("modulesPlaced"),
      mwpPlaced: sum("mwpPlaced"), mwpFit: sum("mwpFit"), mwpNeed: (inputs.moduleCount * inputs.wp) / 1e6, short: fitTables < needTables,
      rows: sum("rows"), cableM: sum("cableM") + linkM, linkM, plotCount: parts.length,
      landNeedHa: landNeed({ moduleCount: inputs.moduleCount, wp: inputs.wp, tiltDeg: inputs.tiltDeg, latDeg: centroid(plots[0])[0], wide: inputs.wide, high: inputs.high }).ha,
    },
  };
}

/**
 * @param {object} pl  a normalised plant
 * @returns {{
 *   reason: null|"no_solar"|"tracker"|"no_site",
 *   inputs: null|object, assumed: { wp:boolean, tilt:boolean },
 *   need: null|{ tables:number, ha:number, pitchM:number, gcr:number, modulesPerTable:number },
 *   result: null|object
 * }}
 */
export function layoutFor(pl) {
  const none = (reason) => ({ reason, inputs: null, assumed: { wp: false, tilt: false }, need: null, result: null });
  if (!pl?.solar) return none("no_solar");
  if (pl.equipment?.mounting?.kind === "tracker") return none("tracker");
  const { site, inputs, assumed } = layoutInputs(pl);
  if (!site) return none("no_site");
  const need = landNeed({ moduleCount: inputs.moduleCount, wp: inputs.wp, tiltDeg: inputs.tiltDeg, latDeg: site.lat, wide: inputs.wide, high: inputs.high });
  const result = pl.layout ? layoutPlots(pl.layout.plots, pl.layout.exclusions, inputs) : null;
  return { reason: null, inputs, assumed, need, result };
}
