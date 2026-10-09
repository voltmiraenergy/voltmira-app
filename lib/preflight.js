// lib/preflight.js — what a careful reader would catch in a plant's bank pack
// before the bank does: a figure that is missing, a unit that is probably
// wrong, a study that disagrees with public data, a study that is old or does
// not say what its P90 means, a document filed twice, an item marked done with
// no paper behind it, and the assumptions the plant still rests on (first-year
// degradation not set, no measured weather variability). Each finding is
// { id, level: "stop" | "check", ...values }; "stop" means the pack cannot be
// trusted yet, "check" means look before sending. Shown on the plant card and
// listed in the pack's manifest, so nothing is left out quietly. Pure.
import { normalizePlant, plantEnergy, plantExport } from "./plantFinance.js";
import { permitProgress } from "./plantPermits.js";
import { windEnergy } from "./windScreen.js";
import { CF_RANGE } from "./studyReader.js";
import { DCAC_RANGE } from "./clipping.js";
import { equipmentFindings } from "./equipment.js";
import { climateDriftKm } from "./siteClimate.js";

/** A study older than this many years is flagged. */
export const STUDY_MAX_AGE_YEARS = 3;
/** How far a study may sit from the public-data estimate for the same site before it is flagged (a ratio). */
/** Clipping above this share of the year's energy is flagged. */
export const CLIP_HIGH_PCT = 5;
export const PUBLIC_RATIO = { solar: [0.8, 1.25], wind: [0.65, 1.5] };

const yearsBetween = (fromKey, toKey) => {
  const a = Date.parse(`${fromKey}T00:00:00Z`), b = Date.parse(`${toKey}T00:00:00Z`);
  return Number.isFinite(a) && Number.isFinite(b) ? (b - a) / (365.25 * 86400000) : null;
};

/**
 * @param {object} a
 * @param {object} a.plant       a stored plant
 * @param {{item_id:string, name:string, size?:number, size_bytes?:number}[]|null} [a.docs]  documents on file; null where the deal room is not set up
 * @param {string} [a.todayKey]  "YYYY-MM-DD"
 * @returns {{id:string, level:"stop"|"check", [k:string]: any}[]}
 */
export function preflight({ plant, docs = null, todayKey = "" }) {
  const pl = normalizePlant(plant);
  const en = plantEnergy(pl);
  const out = [];
  const add = (id, level, extra = {}) => out.push({ id, level, ...extra });

  // ---- what the cover rests on
  if (pl.revenue.kind !== "merchant" && !(pl.revenue.priceEurMwh > 0)) add("no_price", "stop");
  for (const kind of ["wind", "solar"]) {
    if (en[kind] && !(en[kind].p50Mwh > 0)) add("no_energy", "stop", { part: kind });
  }
  if (!pl.wind && !pl.solar) add("no_source", "stop");

  // ---- is the energy believable
  for (const [kind, cap] of [["wind", pl.wind?.mw], ["solar", pl.solar?.mwp]]) {
    const e = en[kind];
    if (!e || !(e.p50Mwh > 0) || !(cap > 0)) continue;
    const cf = e.p50Mwh / (cap * 8760);
    const [lo, hi] = CF_RANGE[kind];
    if (cf < lo || cf > hi) add("cf_range", "check", { part: kind, cf, lo, hi });
  }
  // a study set against the public data for the same site
  if (pl.solar?.study?.p50Mwh > 0 && pl.solar.yieldKwhKwp > 0 && pl.solar.yieldSource !== "manual") {
    const ratio = pl.solar.study.p50Mwh / (pl.solar.mwp * pl.solar.yieldKwhKwp);
    const [lo, hi] = PUBLIC_RATIO.solar;
    if (ratio < lo || ratio > hi) add("study_vs_public", "check", { part: "solar", ratio });
  }
  if (pl.wind?.study?.p50Mwh > 0 && pl.wind.screening?.hist) {
    const s = windEnergy({ hist: pl.wind.screening.hist, climMean: pl.wind.screening.climMean, mw: pl.wind.mw, hubM: pl.wind.hubM, shear: pl.wind.shear, lossesPct: pl.wind.lossesPct, turbine: pl.wind.turbine }).netMwh;
    if (s > 0) {
      const ratio = pl.wind.study.p50Mwh / s;
      const [lo, hi] = PUBLIC_RATIO.wind;
      if (ratio < lo || ratio > hi) add("study_vs_public", "check", { part: "wind", ratio });
    }
  }

  // ---- the studies themselves
  for (const [kind, s] of [["wind", pl.wind?.study], ["solar", pl.solar?.study]]) {
    if (!s || !(s.p50Mwh > 0)) continue;
    if (s.p90Mwh > 0 && !s.p90Basis) add("p90_horizon", "check", { part: kind });
    if (!(s.p90Mwh > 0)) add("p90_missing", "check", { part: kind });
    if (/^\d{4}-\d{2}-\d{2}$/.test(s.date) && todayKey) {
      const age = yearsBetween(s.date, todayKey);
      if (age != null && age > STUDY_MAX_AGE_YEARS) add("study_old", "check", { part: kind, years: Math.floor(age), date: s.date });
    }
  }

  // ---- assumptions the figures still rest on, stated rather than hidden
  if (pl.solar && !(pl.solar.study?.p50Mwh > 0)) {
    if (!(pl.solar.degrFirstPct > 0)) add("degr_first", "check");
    if (pl.solar.yieldSource === "pvgis" && pl.solar.variabilityPct == null) add("weather_unmeasured", "check");
  }
  // ---- the export limit: set, estimated, and not cutting too much
  const ex = plantExport(pl);
  if (ex) {
    if (ex.dcAc != null && (ex.dcAc < DCAC_RANGE[0] || ex.dcAc > DCAC_RANGE[1])) add("dcac_range", "check", { r: ex.dcAc, lo: DCAC_RANGE[0], hi: DCAC_RANGE[1] });
    if (!ex.inStudy) {
      if (ex.limitMw == null) add("export_unset", "check");
      else if (ex.clipPct == null) add("clip_no_curve", "check");
      else if (ex.clipPct > CLIP_HIGH_PCT) add("clip_high", "check", { x: ex.clipPct });
    }
  }

  // ---- what it is built from, and the site it stands on
  for (const finding of equipmentFindings(pl)) add(finding.id, "check", finding);
  if ((pl.solar || pl.wind) && pl.lat != null && pl.lon != null) {
    if (!pl.climate) add("climate_missing", "check");
    else { const km = climateDriftKm(pl); if (km != null) add("climate_moved", "check", { km }); }
  }

  // ---- the paper
  if (Array.isArray(docs)) {
    const seen = new Map();
    for (const d of docs) {
      const key = `${String(d.name || "").toLowerCase()}|${d.size ?? d.size_bytes ?? ""}`;
      if (seen.has(key)) add("dup_file", "check", { name: d.name });
      seen.set(key, true);
    }
    const have = new Set(docs.map((d) => d.item_id));
    for (const r of permitProgress(pl.permits, todayKey).rows) {
      if (r.status === "done" && !have.has(r.id)) add("done_no_doc", "check", { item: r.id });
    }
  }
  return out.sort((a, b) => (a.level === b.level ? 0 : a.level === "stop" ? -1 : 1));
}
