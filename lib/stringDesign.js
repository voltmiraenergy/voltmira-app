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

// Coldest design cell temperature, default/RO. Voc rises as temperature falls,
// so this is the worst case for the inverter's DC input — the one that matters
// for the string-length CEILING.
export const T_COLD = -15, T_STC = 25;

// Worst-case CELL temperature on a hot rooftop under full sun — well above
// ambient, because a roof-mounted module runs hotter than the air around it.
// This is the LOW end of the string-length window: Vmpp falls as cells heat
// up, and a string that's too short can fall out of the inverter's tracking
// range before the array ever gets to its hottest, sunniest hour.
export const T_HOT_CELL = 70;

// Republica Moldova's real winter/summer design extremes (-25°C / +40°C
// ambient — the figures an installer would pull from a local site survey or
// the NCM climate data) are colder/hotter than the RO-tuned defaults above.
// Sizing an MD string against -15°C instead of -25°C understates cold Voc —
// a string that passes the check could still over-volt the inverter on a
// real Moldovan winter morning.
//
// +40°C ambient is converted to a worst-case CELL temperature via the
// standard NOCT model: Tcell = Tamb + (G/G_NOCT)·(NOCT−20), at peak sun
// (G=1000 W/m²), the standard NOCT test irradiance (G_NOCT=800 W/m²), and a
// typical datasheet NOCT≈45°C (the catalog doesn't carry a per-SKU NOCT):
//   Tcell = 40 + (1000/800)·(45−20) = 40 + 31.25 ≈ 71°C
const T_COLD_BY_MARKET = { MD: -25 };
const T_HOT_CELL_BY_MARKET = { MD: 71 };

/** The cold design temperature (°C) to size a string's Voc ceiling against. */
export function coldDesignTemp(market) { return T_COLD_BY_MARKET[market] ?? T_COLD; }
/** The hot design CELL temperature (°C) to size a string's Vmpp floor against. */
export function hotCellDesignTemp(market) { return T_HOT_CELL_BY_MARKET[market] ?? T_HOT_CELL; }

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
 * @param {string} [market] - "MD" sizes against Moldova's real -25°C/+40°C
 *   design extremes instead of the RO-tuned defaults; any other value (or
 *   omitted) keeps the exact prior behaviour.
 * @returns {{min:number, max:number, possible:boolean, vocCold:number, vmppHot:number, coldT:number, hotT:number}}
 *   possible=false when no length clears both bounds at once (min > max) —
 *   the pair cannot be strung together at ANY length, e.g. a high-Voc panel
 *   on a low-max-voltage micro-inverter-class unit.
 */
export function stringRange(panel, inverter, market) {
  const coldT = coldDesignTemp(market), hotT = hotCellDesignTemp(market);
  if (!panel || !inverter || !(panel.voc > 0) || !(inverter.maxDcV > 0)) {
    return { min: 0, max: 0, possible: false, vocCold: 0, vmppHot: 0, coldT, hotT };
  }
  const vocCold = vocAt(panel, coldT);
  const vmppHot = vmppAt(panel, hotT);
  const max = Math.floor(inverter.maxDcV / vocCold);
  const minMpptV = Number(inverter.minMpptV) || 0;
  const min = minMpptV > 0 && vmppHot > 0 ? Math.max(1, Math.ceil(minMpptV / vmppHot)) : 1;
  return { min, max, possible: max >= 1 && min <= max, vocCold, vmppHot, coldT, hotT };
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
export function validateStringDesign({ panel, inverter, modulesPerString, parallelStrings = 1, market }) {
  const range = stringRange(panel, inverter, market);
  const lenOk = range.possible
    && Number(modulesPerString) >= range.min
    && Number(modulesPerString) <= range.max;
  const currentOk = stringCurrentOk(panel, inverter, parallelStrings);
  return { ...range, modulesPerString: Number(modulesPerString) || 0, parallelStrings, lenOk, currentOk, ok: lenOk && currentOk };
}

/** Can this panel/inverter pair be strung together at all, at any length? */
export function isCompatible(panel, inverter, market) {
  return stringRange(panel, inverter, market).possible;
}

/** Every inverter in the catalog this panel can actually be strung to. */
export function compatibleInverters(panel, inverters = INVERTERS, market) {
  return (Array.isArray(inverters) ? inverters : []).filter((inv) => isCompatible(panel, inv, market));
}

/** Every panel in the catalog that can actually be strung to this inverter. */
export function compatiblePanels(inverter, panels = PANELS, market) {
  return (Array.isArray(panels) ? panels : []).filter((p) => isCompatible(p, inverter, market));
}
