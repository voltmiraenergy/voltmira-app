// lib/plantLayout.js — a plant's site layout (lib/siteLayout.js) from the plant
// itself: the module count and rating from the equipment list (else the
// declared capacity at an assumed rating), the design tilt and azimuth, the
// number of inverter stations from the inverters' AC power and the transformer
// rating, and the grid connection point it is planned to reach. Says plainly
// why there is no layout when there is none. Pure.
import { designAngles } from "./equipment.js";
import { plantExport } from "./plantFinance.js";
import { chosenPoint } from "./gridNear.js";
import { generateLayout, landNeed } from "./siteLayout.js";

/** The module rating assumed where none is entered, Wp. */
export const ASSUMED_WP = 440;
/** The transformer rating assumed where none is entered, MVA. */
export const ASSUMED_MVA = 4.4;

/**
 * @param {object} pl  a normalised plant
 * @returns {{
 *   reason: null|"no_solar"|"tracker"|"no_site",
 *   inputs: null|{ moduleCount:number, wp:number, tiltDeg:number, azimuthDeg:number, stations:number, target:{lat:number,lon:number}|null },
 *   assumed: { wp:boolean, tilt:boolean },
 *   need: null|{ tables:number, ha:number, pitchM:number, gcr:number, modulesPerTable:number },
 *   result: null|ReturnType<typeof generateLayout>
 * }}
 */
export function layoutFor(pl) {
  const none = (reason) => ({ reason, inputs: null, assumed: { wp: false, tilt: false }, need: null, result: null });
  if (!pl?.solar) return none("no_solar");
  const eq = pl.equipment;
  if (eq?.mounting?.kind === "tracker") return none("tracker");
  const site = pl.lat != null && pl.lon != null ? { lat: pl.lat, lon: pl.lon } : pl.layout ? { lat: pl.layout.boundary[0][0], lon: pl.layout.boundary[0][1] } : null;
  if (!site) return none("no_site");
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
  const inputs = { moduleCount, wp, tiltDeg: ang.tilt, azimuthDeg: ang.azimuth, stations, target };
  const need = landNeed({ moduleCount, wp, tiltDeg: ang.tilt, latDeg: site.lat });
  const result = pl.layout ? generateLayout({ polygon: pl.layout.boundary, ...inputs }) : null;
  return { reason: null, inputs, assumed: { wp: !wpGiven, tilt: !tiltGiven }, need, result };
}
