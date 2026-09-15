// lib/stringDesign.js — the electrical rules for stringing panels safely, not
// just under a given inverter's DC input ceiling, but staying inside its MPPT
// working voltage window on both a freezing morning and a scorching afternoon.
//
// Two independent voltage constraints per string, against the SAME inverter:
//   too many modules → cold Voc exceeds the inverter's max DC input →
//     destroys the inverter, voids the warranty (the check designCheck.js
//     already had, one candidate length at a time).
//   too few modules  → hot Vmpp falls below the inverter's MPPT start/minimum
//     voltage → the tracker can't find a working point and the string simply
//     doesn't produce, even though nothing is "broken" (the check that was
//     missing entirely).
// A third, independent constraint applies per MPPT INPUT, not per string:
// however many strings are paralleled onto one input, their combined
// short-circuit current must stay under that input's rated maximum — too many
// parallel strings overloads the input even when each string's voltage is fine.
//
// This is the actual "string designer": given a panel + inverter pair, compute
// the valid range of modules-per-string (not just check one guess), whether a
// specific proposed layout clears every bound, and — since the same rule
// answers both questions — which items in the catalog are even compatible
// with each other at all.
//
// T_COLD/T_STC live here (designCheck.js re-exports them) so every surface
// shares one design-temperature table — a system can't pass on one page's
// assumption and fail on another's — without designCheck.js and this module
// importing each other in a circle.
import { PANELS, INVERTERS } from "./supplierCatalog.js";

// Coldest design cell temperature for MD/RO. Voc rises as temperature falls,
// so this is the worst case for the inverter's DC input — the one that matters
// for the string-length CEILING.
export const T_COLD = -15, T_STC = 25;

// Worst-case CELL temperature on a hot rooftop under full sun — well above
// ambient, because a roof-mounted module runs hotter than the air around it.
// This is the LOW end of the string-length window: Vmpp falls as cells heat
// up, and a string that's too short can fall out of the inverter's tracking
// range before the array ever gets to its hottest, sunniest hour.
export const T_HOT_CELL = 70;

function vocAt(panel, tempC) {
  return panel.voc * (1 + (panel.tempCoeff / 100) * (tempC - T_STC));
}
// Crystalline-silicon Vmpp's temperature coefficient tracks Voc's closely
// enough — both come from the same cell physics — that reusing panel.tempCoeff
// is the honest simplification for a catalog that doesn't carry a separate,
// per-SKU Vmpp coefficient (real datasheets do; this representative one doesn't).
function vmppAt(panel, tempC) {
  return panel.vmp * (1 + (panel.tempCoeff / 100) * (tempC - T_STC));
}

/**
 * The valid module-per-string range for this panel on this inverter.
 * @returns {{min:number, max:number, possible:boolean, vocCold:number, vmppHot:number}}
 *   possible=false when no length clears both bounds at once (min > max) —
 *   the pair cannot be strung together at ANY length, e.g. a high-Voc panel
 *   on a low-max-voltage micro-inverter-class unit.
 */
export function stringRange(panel, inverter) {
  if (!panel || !inverter || !(panel.voc > 0) || !(inverter.maxDcV > 0)) {
    return { min: 0, max: 0, possible: false, vocCold: 0, vmppHot: 0 };
  }
  const vocCold = vocAt(panel, T_COLD);
  const vmppHot = vmppAt(panel, T_HOT_CELL);
  const max = Math.floor(inverter.maxDcV / vocCold);
  const minMpptV = Number(inverter.minMpptV) || 0;
  const min = minMpptV > 0 && vmppHot > 0 ? Math.max(1, Math.ceil(minMpptV / vmppHot)) : 1;
  return { min, max, possible: max >= 1 && min <= max, vocCold, vmppHot };
}

/**
 * Whether N strings paralleled onto ONE MPPT input stay under that input's
 * rated maximum current. No rating on file (an older catalog row from before
 * this field existed) means "don't know" — never invent a failure from a
 * missing number, so this returns true rather than false.
 */
export function stringCurrentOk(panel, inverter, parallelStrings = 1) {
  const maxA = Number(inverter?.maxInputCurrentA);
  if (!(maxA > 0)) return true;
  const isc = Number(panel?.isc) || 0;
  return isc * Math.max(1, Math.round(parallelStrings) || 1) <= maxA;
}

/**
 * The full validation for one proposed layout: this many modules in series,
 * this many such strings paralleled onto one MPPT input. This is what the
 * quote editor and the client PDF's engineering annex both flag against —
 * whether the BOM's actual choice, not just some candidate, clears every bound.
 */
export function validateStringDesign({ panel, inverter, modulesPerString, parallelStrings = 1 }) {
  const range = stringRange(panel, inverter);
  const lenOk = range.possible
    && Number(modulesPerString) >= range.min
    && Number(modulesPerString) <= range.max;
  const currentOk = stringCurrentOk(panel, inverter, parallelStrings);
  return { ...range, modulesPerString: Number(modulesPerString) || 0, parallelStrings, lenOk, currentOk, ok: lenOk && currentOk };
}

/** Can this panel/inverter pair be strung together at all, at any length? */
export function isCompatible(panel, inverter) {
  return stringRange(panel, inverter).possible;
}

/** Every inverter in the catalog this panel can actually be strung to. */
export function compatibleInverters(panel, inverters = INVERTERS) {
  return (Array.isArray(inverters) ? inverters : []).filter((inv) => isCompatible(panel, inv));
}

/** Every panel in the catalog that can actually be strung to this inverter. */
export function compatiblePanels(inverter, panels = PANELS) {
  return (Array.isArray(panels) ? panels : []).filter((p) => isCompatible(p, inverter));
}
