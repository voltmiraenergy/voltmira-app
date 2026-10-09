// lib/plantLayout.js — a plant's site layout (lib/siteLayout.js, lib/windLayout.js)
// from the plant itself: the module count and rating from the equipment list
// (else the declared capacity at an assumed rating), the design tilt and
// azimuth (or, for a tracker, the ground-cover target), the number of inverter
// stations from the inverters' AC power and the transformer rating, the wind
// turbines a hybrid plant also stands on, the grid connection point it is
// planned to reach, and the plan the user drew (one or more plots, the zones
// no table or turbine may stand on, the table format and the setback).
// Several plots are filled nearest the grid first; each has its own corridor,
// and a cable joins each plot's connection point to the first one's. Wind
// turbines are placed on a plot before its solar tables, and their keep-out
// circles become exclusions for that plot's tables, so a hybrid's plan shows
// the whole plant on one drawing. Says plainly why there is no layout when
// there is none. Pure.
import { designAngles } from "./equipment.js";
import { plantExport } from "./plantFinance.js";
import { chosenPoint } from "./gridNear.js";
import { generateLayout, landNeed, plotHectares, TRACKER_GCR_DEFAULT } from "./siteLayout.js";
import { generateWindTurbines, rotorDiameterM, keepoutRadiusM, DOWNWIND_D, CROSSWIND_D } from "./windLayout.js";

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
/** A rectangle of width x height metres, centred on (lat, lon), as a [lat, lon] ring. */
function rectAround(lat, lon, wM, hM) {
  const kyDegM = 180 / (Math.PI * R), kxDegM = kyDegM / Math.cos((lat * Math.PI) / 180);
  return [[-wM / 2, -hM / 2], [wM / 2, -hM / 2], [wM / 2, hM / 2], [-wM / 2, hM / 2]].map(([dx, dy]) => [lat + dy * kyDegM, lon + dx * kxDegM]);
}

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
  const tracker = eq?.mounting?.kind === "tracker";
  const tiltGiven = eq?.mounting?.kind === "fixed" && eq.mounting.tiltDeg != null && eq.mounting.azimuthDeg != null;
  const ex = plantExport(pl);
  const acMw = ex?.acMw || pl.solar.mwp / 1.25;
  const mva = eq?.transformers?.mva > 0 ? eq.transformers.mva : ASSUMED_MVA;
  const stations = Math.max(1, Math.min(40, Math.ceil(acMw / mva)));
  const point = pl.grid ? chosenPoint(pl.grid) : null;
  const target = point?.to && Number.isFinite(point.to.lat) && Number.isFinite(point.to.lon) ? { lat: point.to.lat, lon: point.to.lon } : null;
  const lo = pl.layout || {};
  // the wind part this plant also stands on, if any: a per-turbine rating and hub height for its own layout
  const turbineCount = pl.wind ? Math.max(1, Math.round(pl.wind.turbines) || 1) : 0;
  const wind = pl.wind ? { count: turbineCount, mwPerTurbine: pl.wind.mw / turbineCount, hubM: pl.wind.hubM || 120 } : null;
  const inputs = {
    moduleCount, wp, tiltDeg: ang.tilt, azimuthDeg: ang.azimuth, tracker, trackerGcr: lo.trackerGcr ?? TRACKER_GCR_DEFAULT,
    stations, target, wide: lo.wide || 26, high: lo.high || 2, setbackM: lo.setbackM ?? 5, wind,
  };
  return { site, inputs, assumed: { wp: !wpGiven, tilt: !tiltGiven && !tracker } };
}

/**
 * Lay the plant out on its plots, nearest the grid first. Wind turbines are
 * placed on each plot before its solar tables, and their keep-out circles
 * become exclusions for that plot's tables.
 * @param {number[][][]} plots
 * @param {{ring:number[][]}[]} exclusions
 * @param {object} inputs  layoutInputs().inputs
 * @returns {null | object}  the shape of generateLayout(), joined, with `plots`, `links` and `turbines`
 */
export function layoutPlots(plots, exclusions, inputs) {
  const rings = (exclusions || []).map((e) => e.ring || e);
  const order = plots.map((ring, k) => ({ ring, k })).sort((a, b) => {
    if (!inputs.target) return a.k - b.k;
    const t = [inputs.target.lat, inputs.target.lon];
    return metres(centroid(a.ring), t) - metres(centroid(b.ring), t) || a.k - b.k;
  });
  // the stations, and the turbines, are shared out by the plots' area
  const areaAll = plots.reduce((s, r) => s + plotHectares(r), 0) || 1;
  let leftModules = inputs.moduleCount;
  let leftTurbines = inputs.wind ? inputs.wind.count : 0;
  const parts = [];
  for (const { ring, k } of order) {
    const areaShare = plotHectares(ring) / areaAll;
    let wind = null;
    let turbineExclusions = [];
    if (leftTurbines > 0) {
      const want = Math.max(1, Math.round(inputs.wind.count * areaShare));
      wind = generateWindTurbines({ polygon: ring, count: Math.min(leftTurbines, want), mwPerTurbine: inputs.wind.mwPerTurbine, hubM: inputs.wind.hubM, setbackM: inputs.setbackM, exclusions: rings });
      if (wind && wind.turbines.length) { leftTurbines -= wind.turbines.length; turbineExclusions = wind.turbines.map((t) => t.exclusion); }
    }
    const st = Math.max(1, Math.round((inputs.stations * plotHectares(ring)) / areaAll));
    const r = generateLayout({ ...inputs, polygon: ring, moduleCount: Math.max(leftModules, 1), stations: st, exclusions: [...rings, ...turbineExclusions] });
    if (!r) continue;
    if (leftModules <= 0) Object.assign(r, { tables: [], stations: [], cables: [] }, { stats: { ...r.stats, placedTables: 0, modulesPlaced: 0, mwpPlaced: 0, rows: 0, cableM: 0 } });
    leftModules -= r.stats.modulesPlaced;
    parts.push({ k, r, wind });
  }
  if (!parts.length) return null;
  const main = parts.find((p) => p.r.tables.length)?.r || parts[0].r;
  // each further plot that carries tables is joined to the main plot's connection point
  const links = parts.filter((p) => p.r !== main && p.r.tables.length).map((p) => [[p.r.connection.lat, p.r.connection.lon], [main.connection.lat, main.connection.lon]]);
  const linkM = links.reduce((s, l) => s + metres(l[0], l[1]), 0);
  let n = 0;
  const stations = parts.flatMap((p) => p.r.stations.map((s) => ({ ...s, n: ++n })));
  let tn = 0;
  const turbines = parts.flatMap((p) => (p.wind ? p.wind.turbines.map((t) => ({ ...t, n: ++tn, plot: p.k })) : []));
  const sum = (key) => parts.reduce((s, p) => s + (p.r.stats[key] || 0), 0);
  const placedTables = sum("placedTables"), fitTables = sum("fitTables");
  const needTables = Math.ceil(inputs.moduleCount / main.stats.modulesPerTable);
  const needTurbines = inputs.wind ? inputs.wind.count : 0;
  const rotorM = parts.find((p) => p.wind?.turbines.length)?.wind.stats.rotorM ?? null;
  return {
    tables: parts.flatMap((p) => p.r.tables), stations, cables: [...parts.flatMap((p) => p.r.cables), ...links], links, turbines,
    connection: main.connection, plots: parts.map((p) => ({ k: p.k, stats: p.r.stats, connection: p.r.connection })),
    stats: {
      ...main.stats, plotHa: sum("plotHa"), placedTables, fitTables, needTables, modulesPlaced: sum("modulesPlaced"),
      mwpPlaced: sum("mwpPlaced"), mwpFit: sum("mwpFit"), mwpNeed: (inputs.moduleCount * inputs.wp) / 1e6, short: fitTables < needTables,
      rows: sum("rows"), cableM: sum("cableM") + linkM, linkM, plotCount: parts.length,
      landNeedHa: landNeed({ moduleCount: inputs.moduleCount, wp: inputs.wp, tiltDeg: inputs.tiltDeg, latDeg: centroid(plots[0])[0], wide: inputs.wide, high: inputs.high, tracker: inputs.tracker, trackerGcr: inputs.trackerGcr }).ha,
      turbineCount: turbines.length, needTurbines, turbinesShort: turbines.length < needTurbines, rotorM,
    },
  };
}

/**
 * @param {object} pl  a normalised plant
 * @returns {{
 *   reason: null|"no_solar"|"no_site",
 *   inputs: null|object, assumed: { wp:boolean, tilt:boolean },
 *   need: null|{ tables:number, ha:number, pitchM:number, gcr:number, modulesPerTable:number },
 *   result: null|object
 * }}
 */
export function layoutFor(pl) {
  const none = (reason) => ({ reason, inputs: null, assumed: { wp: false, tilt: false }, need: null, result: null });
  if (!pl?.solar) return none("no_solar");
  const { site, inputs, assumed } = layoutInputs(pl);
  if (!site) return none("no_site");
  const need = landNeed({ moduleCount: inputs.moduleCount, wp: inputs.wp, tiltDeg: inputs.tiltDeg, latDeg: site.lat, wide: inputs.wide, high: inputs.high, tracker: inputs.tracker, trackerGcr: inputs.trackerGcr });
  const result = pl.layout ? layoutPlots(pl.layout.plots, pl.layout.exclusions, inputs) : null;
  return { reason: null, inputs, assumed, need, result };
}

/**
 * A plausible plot, automatically, for a plant that has none yet: a
 * rectangle centred on the site, sized for the solar land need with a
 * margin, and widened to also hold the wind turbines' array (set out on a
 * grid sized to the turbine count and the rotor-diameter spacing) when the
 * plant has a wind part. Used only to give a freshly created sample plant a
 * complete, illustrative site plan; a real plant's plot is drawn by hand.
 * @param {object} pl  a normalised plant
 * @returns {null | { plots: number[][][] }}  null without a solar part or a site
 */
export function autoPlot(pl) {
  if (!pl?.solar) return null;
  const { site, inputs } = layoutInputs(pl);
  if (!site) return null;
  const solarHa = landNeed({ moduleCount: inputs.moduleCount, wp: inputs.wp, tiltDeg: inputs.tiltDeg, latDeg: site.lat, wide: inputs.wide, high: inputs.high, tracker: inputs.tracker, trackerGcr: inputs.trackerGcr }).ha;
  const solarM2 = solarHa * 1e4 * 1.35;
  let w = Math.sqrt(solarM2 * 1.2), h = solarM2 / w;
  if (inputs.wind) {
    const D = rotorDiameterM(inputs.wind.mwPerTurbine);
    const keepR = keepoutRadiusM(inputs.wind.hubM, D);
    const rowStep = DOWNWIND_D * D, colStep = CROSSWIND_D * D;
    const cols = Math.max(1, Math.round(Math.sqrt((inputs.wind.count * rowStep) / colStep)));
    const rows = Math.ceil(inputs.wind.count / cols);
    w = Math.max(w, cols * colStep + 2 * keepR);
    h = Math.max(h, rows * rowStep + 2 * keepR);
  }
  return { plots: [rectAround(site.lat, site.lon, w, h)] };
}
