// lib/equipment.js — what a plant is built from, for the bank's equipment
// annex: modules, inverters, mounting, transformers, wind turbines and
// storage, each with maker, model, count, unit rating and warranty, and the
// design basis the structure is calculated for (wind speed, snow load,
// temperature range, the standard). The totals are set against the capacity
// the plant declares, because a count times a unit rating that does not give
// the declared MWp is the first thing a technical adviser checks. A model that
// is in the supplier catalogue is checked against it (never filled from it
// unasked). Pure.
import { findSupplierProduct } from "./supplierCatalog.js";

/** How far a total may sit from the declared capacity before it is flagged (a share). */
export const TOTAL_TOLERANCE = 0.02;
/** A transformer park below this share of the AC capacity is flagged. */
export const TRANSFORMER_MIN_SHARE = 0.95;
/** PVGIS is asked for these angles unless the design says otherwise (tilt, azimuth: 0 is south, -90 east, 90 west). */
export const DEFAULT_ANGLES = { tilt: 35, azimuth: 0 };

const pos = (v) => (Number.isFinite(Number(v)) && v !== "" && v != null && Number(v) > 0 ? Number(v) : 0);
const text = (v, n = 80) => String(v ?? "").trim().slice(0, n);
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const nul = (v, lo, hi) => (v === "" || v == null || !Number.isFinite(Number(v)) ? null : clamp(Number(v), lo, hi));
const years = (v) => Math.round(clamp(pos(v), 0, 50));

/** The parts, in the order the annex lists them. */
export const PARTS = ["modules", "inverters", "mounting", "transformers", "turbines", "storage"];

/**
 * The stored equipment, cleaned; null when nothing is entered.
 * @param {any} x
 * @returns {null | {
 *   modules: null|{maker:string, model:string, count:number, wp:number, productYears:number, perfYears:number},
 *   inverters: null|{maker:string, model:string, count:number, kw:number, years:number},
 *   mounting: null|{kind:"fixed"|"tracker", maker:string, tiltDeg:number|null, azimuthDeg:number|null, years:number},
 *   transformers: null|{maker:string, count:number, mva:number, ratio:string, years:number},
 *   turbines: null|{maker:string, model:string, count:number, mw:number, years:number},
 *   storage: null|{maker:string, model:string, chemistry:string, years:number},
 *   design: null|{windMs:number|null, snowKnM2:number|null, tMinC:number|null, tMaxC:number|null, standard:string}
 * }}
 */
export function normalizeEquipment(x) {
  if (!x || typeof x !== "object") return null;
  const any = (o) => o && Object.values(o).some((v) => v !== "" && v !== 0 && v !== null && v !== "fixed");
  const m = x.modules, i = x.inverters, g = x.mounting, t = x.transformers, w = x.turbines, s = x.storage, d = x.design;
  const out = {
    modules: m && typeof m === "object" ? { maker: text(m.maker), model: text(m.model), count: Math.round(pos(m.count)), wp: pos(m.wp), productYears: years(m.productYears), perfYears: years(m.perfYears) } : null,
    inverters: i && typeof i === "object" ? { maker: text(i.maker), model: text(i.model), count: Math.round(pos(i.count)), kw: pos(i.kw), years: years(i.years) } : null,
    mounting: g && typeof g === "object" ? { kind: g.kind === "tracker" ? "tracker" : "fixed", maker: text(g.maker), tiltDeg: nul(g.tiltDeg, 0, 90), azimuthDeg: nul(g.azimuthDeg, -180, 180), years: years(g.years) } : null,
    transformers: t && typeof t === "object" ? { maker: text(t.maker), count: Math.round(pos(t.count)), mva: pos(t.mva), ratio: text(t.ratio, 40), years: years(t.years) } : null,
    turbines: w && typeof w === "object" ? { maker: text(w.maker), model: text(w.model), count: Math.round(pos(w.count)), mw: pos(w.mw), years: years(w.years) } : null,
    storage: s && typeof s === "object" ? { maker: text(s.maker), model: text(s.model), chemistry: text(s.chemistry, 40), years: years(s.years) } : null,
    design: d && typeof d === "object" ? { windMs: nul(d.windMs, 0, 100), snowKnM2: nul(d.snowKnM2, 0, 20), tMinC: nul(d.tMinC, -60, 30), tMaxC: nul(d.tMaxC, 0, 80), standard: text(d.standard, 200) } : null,
  };
  for (const k of PARTS) {
    if (!out[k]) continue;
    // a flat tilt of 0 degrees and a south azimuth of 0 are entries, not blanks
    const present = k === "mounting" ? out.mounting.maker || out.mounting.years || out.mounting.tiltDeg != null || out.mounting.azimuthDeg != null || out.mounting.kind === "tracker" : any(out[k]);
    if (!present) out[k] = null;
  }
  if (out.design && !(out.design.windMs != null || out.design.snowKnM2 != null || out.design.tMinC != null || out.design.tMaxC != null || out.design.standard)) out.design = null;
  return PARTS.some((k) => out[k]) || out.design ? out : null;
}

/** The inverters' total AC power in MW, or null where the count or the unit rating is missing. */
export const inverterMw = (eq) => (eq?.inverters?.count > 0 && eq.inverters.kw > 0 ? (eq.inverters.count * eq.inverters.kw) / 1000 : null);
/** The modules' total DC power in MWp, or null. */
export const moduleMwp = (eq) => (eq?.modules?.count > 0 && eq.modules.wp > 0 ? (eq.modules.count * eq.modules.wp) / 1e6 : null);
/** The turbines' total power in MW, or null. */
export const turbineMw = (eq) => (eq?.turbines?.count > 0 && eq.turbines.mw > 0 ? eq.turbines.count * eq.turbines.mw : null);
/** The transformers' total power in MVA, or null. */
export const transformerMva = (eq) => (eq?.transformers?.count > 0 && eq.transformers.mva > 0 ? eq.transformers.count * eq.transformers.mva : null);

/**
 * The angles PVGIS should be asked for: the design's fixed tilt and azimuth
 * where both are entered, else the defaults. A tracker has no fixed angle.
 * @param {object} pl  a normalised plant
 */
export function designAngles(pl) {
  const g = pl?.equipment?.mounting;
  if (g && g.kind === "fixed" && g.tiltDeg != null && g.azimuthDeg != null) return { tilt: g.tiltDeg, azimuth: g.azimuthDeg };
  return { ...DEFAULT_ANGLES };
}

/** Each part's maker and model against the supplier catalogue: only a model found there with a different rating is returned. */
export function catalogueConflicts(eq) {
  const out = [];
  const m = eq?.modules;
  if (m && m.maker && m.model && m.wp > 0) {
    const hit = findSupplierProduct(m.maker, m.model);
    if (hit && Number(hit.watt) > 0 && Math.abs(hit.watt - m.wp) > 0.5) out.push({ part: "modules", entered: m.wp, catalogue: Number(hit.watt), unit: "Wp" });
  }
  const i = eq?.inverters;
  if (i && i.maker && i.model && i.kw > 0) {
    const hit = findSupplierProduct(i.maker, i.model);
    if (hit && Number(hit.kw) > 0 && Math.abs(hit.kw - i.kw) > 0.05) out.push({ part: "inverters", entered: i.kw, catalogue: Number(hit.kw), unit: "kW" });
  }
  return out;
}

/**
 * What the annex says about the totals: each count times its unit rating, the
 * capacity the plant declares, and the gap.
 * @param {object} pl  a normalised plant
 * @returns {{ id:"modules"|"inverters"|"turbines"|"transformers", total:number, declared:number|null, gapPct:number|null, unit:string }[]}
 */
export function totalsOf(pl) {
  const eq = pl?.equipment;
  const out = [];
  const add = (id, total, declared, unit) => out.push({ id, total, declared: declared > 0 ? declared : null, gapPct: declared > 0 ? (total / declared - 1) * 100 : null, unit });
  const mw = moduleMwp(eq); if (mw != null) add("modules", mw, pl.solar?.mwp, "MWp");
  const ac = inverterMw(eq); if (ac != null) add("inverters", ac, pl.solar?.acMw, "MW");
  const wt = turbineMw(eq); if (wt != null) add("turbines", wt, pl.wind?.mw, "MW");
  const tr = transformerMva(eq); if (tr != null) add("transformers", tr, (ac ?? pl.solar?.acMw ?? 0) + (pl.wind ? pl.wind.mw : 0), "MVA");
  return out;
}

/**
 * Findings for the pre-send check (lib/preflight.js), each { id, ...values }.
 * @param {object} pl  a normalised plant
 */
export function equipmentFindings(pl) {
  const eq = pl?.equipment;
  const out = [];
  // a plant with a generating part and no equipment entered at all
  if (pl.solar && !(eq?.modules || eq?.inverters)) out.push({ id: "eq_missing", part: "solar" });
  if (pl.wind && !eq?.turbines) out.push({ id: "eq_missing", part: "wind" });
  if (!eq) return out;
  for (const t of totalsOf(pl)) {
    if (t.id === "transformers") {
      if (t.declared && t.total < TRANSFORMER_MIN_SHARE * t.declared) out.push({ id: "eq_transformer", mva: t.total, mw: t.declared });
    } else if (t.gapPct != null && Math.abs(t.gapPct) > TOTAL_TOLERANCE * 100) {
      out.push({ id: "eq_total", item: t.id, total: t.total, declared: t.declared, unit: t.unit, pct: t.gapPct });
    }
  }
  for (const c of catalogueConflicts(eq)) out.push({ id: "eq_catalogue", ...c });
  // the yield PVGIS gave is for one angle; the design says another
  const g = eq.mounting;
  if (pl.solar && pl.solar.yieldSource === "pvgis" && pl.solar.yieldKwhKwp > 0 && !(pl.solar.study?.p50Mwh > 0) && g) {
    if (g.kind === "tracker") out.push({ id: "eq_tracker" });
    else if (g.tiltDeg != null && g.azimuthDeg != null) {
      const at = pl.solar.yieldDesign || DEFAULT_ANGLES;
      if (Math.abs(at.tilt - g.tiltDeg) > 3 || Math.abs(at.azimuth - g.azimuthDeg) > 10) out.push({ id: "eq_tilt", at, design: { tilt: g.tiltDeg, azimuth: g.azimuthDeg } });
    }
  }
  // the annex is started but the loads the structure is calculated for are not stated
  if (!eq.design || (eq.design.windMs == null && eq.design.snowKnM2 == null)) out.push({ id: "design_loads" });
  return out;
}
