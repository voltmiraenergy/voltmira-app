// lib/bosEstimate.js — Balance-of-system materials estimate: DC cable
// cross-section/length, DC and AC breaker ratings, surge-protection (SPD)
// count. Real formulas (voltage-drop, the standard 1.25x overcurrent-sizing
// safety factor used throughout PV DC/AC protection design) applied to the
// real panel/inverter already in the project's BOM.
//
// This is a SPECIFICATION output (cross-section in mm², a breaker rating in
// A, a count), never a priced catalog line: the supplier catalog has no
// real optimizer, breaker, SPD, or DC-cable SKUs to attach a price to. It
// tells the installer what to buy, not what it costs — same status as
// lib/ncmLoads.js's structural numbers, a design-input sanity check, not a
// substitute for the installer's own final sizing.
//
// What's NOT here: power optimizers. This catalog carries no
// optimizer-requiring (module-level power electronics) inverter class, so
// there's no real product line to size a count against — inventing one
// would be a fabricated recommendation, not a computed one.

const COPPER_RESISTIVITY_OHM_MM2_PER_M = 0.0175; // standard reference value, ~20°C
const STANDARD_CABLE_MM2 = [4, 6, 10, 16];
const STANDARD_BREAKER_A = [6, 10, 13, 16, 20, 25, 32, 40, 50, 63];
const MAX_VOLTAGE_DROP_PCT = 1; // common solar DC design guideline (≤1%)

function nextStandardRating(minA, table = STANDARD_BREAKER_A) {
  return table.find((v) => v >= minA) ?? table[table.length - 1];
}

/**
 * Real DC cable voltage-drop check for one string run:
 * VD% = (2·L·I·ρ) / (A·V) · 100 — two conductors (out and back), L the
 * one-way run length. Picks the smallest standard cross-section that keeps
 * the drop at or under the design guideline; if even the largest standard
 * size doesn't clear it, returns that size flagged `overThreshold` rather
 * than silently under-sizing.
 * @param {number} oneWayRunM one-way cable run, roof to inverter, metres
 * @param {number} currentA the string's real operating current (Imp), A
 * @param {number} stringVoltageV the string's real operating voltage (modulesPerString × Vmp), V
 */
export function dcCableSize({ oneWayRunM, currentA, stringVoltageV }) {
  const L = Number(oneWayRunM), I = Number(currentA), V = Number(stringVoltageV);
  if (!(L > 0) || !(I > 0) || !(V > 0)) return null;
  const dropPctFor = (mm2) => ((2 * L * I * COPPER_RESISTIVITY_OHM_MM2_PER_M) / (mm2 * V)) * 100;
  for (const mm2 of STANDARD_CABLE_MM2) {
    const dropPct = dropPctFor(mm2);
    if (dropPct <= MAX_VOLTAGE_DROP_PCT) return { crossSectionMm2: mm2, voltageDropPct: dropPct, overThreshold: false };
  }
  const mm2 = STANDARD_CABLE_MM2[STANDARD_CABLE_MM2.length - 1];
  return { crossSectionMm2: mm2, voltageDropPct: dropPctFor(mm2), overThreshold: true };
}

/**
 * Total DC cable length estimate, metres: home runs (2x one-way per string,
 * out and back) plus inter-module interconnects (a standard ~1.2m MC4 whip
 * per module gap — an estimate, not a measured layout, same honest-
 * simplification status as designCheck.js's even MPPT-input split).
 */
export function dcCableLengthM({ oneWayRunM, strings, modules }) {
  const homeRun = 2 * (Number(oneWayRunM) || 0) * (Number(strings) || 0);
  const interModule = 1.2 * (Number(modules) || 0);
  return Math.round((homeRun + interModule) * 10) / 10;
}

/** Standard DC breaker/fuse rating: next size up from 1.25x the string's real Isc. */
export function dcBreakerA(iscA) {
  const min = 1.25 * (Number(iscA) || 0);
  if (!(min > 0)) return null;
  return nextStandardRating(min);
}

/**
 * Standard AC breaker rating: next size up from 1.25x the inverter's rated
 * AC current, computed from real acKw at a standard 230V (single-phase) or
 * 400V line-line (three-phase) and power factor 1 — the conservative,
 * commonly-used simplification (a lower real PF would raise current
 * further; sizing at PF=1 is the standard textbook baseline, not the
 * inverter's own datasheet PF curve).
 */
export function acBreakerA(acKw, phases) {
  const kw = Number(acKw);
  if (!(kw > 0)) return null;
  const currentA = phases === 3 ? (kw * 1000) / (Math.sqrt(3) * 400) : (kw * 1000) / 230;
  return nextStandardRating(1.25 * currentA);
}

/** SPD count: one Type 2 per MPPT input (DC side) + one per inverter (AC side) — standard installation practice. */
export function spdCount({ mpptInputs, inverters }) {
  return { dc: Math.max(0, Math.round(Number(mpptInputs) || 0)), ac: Math.max(0, Math.round(Number(inverters) || 0)) };
}
