// lib/ncmLoads.js — structural loads for a mounted array: snow load (NCM EN
// 1991-1-3) and wind load (NCM EN 1991-1-4), the Eurocodes Moldova adopted
// with a national annex. This is a design-input SANITY CHECK for the
// mounting system, handed to a structural engineer for final sign-off — not
// a stamped structural calculation, same status as designCheck.js's DC/AC
// headroom check.
//
// What this CAN compute exactly: the shape/exposure/turbulence coefficients
// are fixed, standard Eurocode methodology — real formulas, not fabricated.
// What it CANNOT know: the characteristic ground snow load sk (kN/m²) and
// base wind velocity vb,0 (m/s) for a specific Moldovan district. Those come
// from the National Annex's own zonal maps (Nord/Centru/Sud), which this
// codebase doesn't have parsed — so they stay installer-entered, sourced
// from a real site survey or the official annex, never guessed. Passing a
// non-positive sk/vb0 returns null rather than a load computed from zero.

const AIR_DENSITY_KG_M3 = 1.25; // kg/m³, standard EN 1991-1-4 value

// EN 1991-1-4 Table 4.1 terrain categories: roughness length z0 (m) and the
// minimum height zmin (m) the log-law wind profile is valid down to.
export const TERRAIN_CATEGORIES = {
  0: { z0: 0.003, zmin: 1, label: { ro: "0: mare, zonă de coastă", en: "0: sea, coastal area", ru: "0: море, побережье" } },
  I: { z0: 0.01, zmin: 1, label: { ro: "I: lacuri, teren plat fără vegetație", en: "I: lakes, flat terrain, negligible vegetation", ru: "I: озёра, ровная местность" } },
  II: { z0: 0.05, zmin: 2, label: { ro: "II: teren deschis, vegetație joasă", en: "II: open country, low vegetation", ru: "II: открытая местность" } },
  III: { z0: 0.3, zmin: 5, label: { ro: "III: suburban, vegetație/clădiri regulate", en: "III: suburban, regular cover of vegetation/buildings", ru: "III: пригород" } },
  IV: { z0: 1.0, zmin: 10, label: { ro: "IV: urban dens", en: "IV: dense urban", ru: "IV: плотная застройка" } },
};

const Z0_II = 0.05; // reference roughness length, category II
const K_I = 1.0;    // turbulence factor, EC-recommended value
const C0 = 1;        // orography factor — flat terrain assumption (no hill/cliff speed-up); Moldova has no real mountain relief outside a few hills

/** Roughness factor cr(z) — EN 1991-1-4 §4.3.2, expression (4.4). */
function roughnessFactor(zClamped, z0) {
  const kr = 0.19 * Math.pow(z0 / Z0_II, 0.07);
  return kr * Math.log(zClamped / z0);
}

/**
 * Peak wind velocity pressure qp(z), kN/m² — EN 1991-1-4 §4.5, expression
 * (4.8): qp(z) = [1 + 7·Iv(z)] · ½·ρ·vm(z)².
 * @param {number} vb0 base wind velocity, m/s (installer-entered — from the
 *   National Annex zonal map or a real site survey; not verified here)
 * @param {number} height building/array height above ground, m
 * @param {"0"|"I"|"II"|"III"|"IV"} terrainCategory
 * @returns {number|null} kN/m², or null if vb0 isn't a real positive value
 */
export function windPeakPressure({ vb0, height, terrainCategory }) {
  const vb = Number(vb0);
  if (!(vb > 0)) return null;
  const t = TERRAIN_CATEGORIES[terrainCategory] || TERRAIN_CATEGORIES.II;
  const z = Math.max(Number(height) || 0, t.zmin);
  const cr = roughnessFactor(z, t.z0);
  const vm = cr * C0 * vb;
  const Iv = K_I / (C0 * Math.log(z / t.z0));
  const qpPa = (1 + 7 * Iv) * 0.5 * AIR_DENSITY_KG_M3 * vm * vm;
  return qpPa / 1000; // Pa -> kN/m²
}

/**
 * Net wind action on the array/mounting structure, kN/m² (can be negative —
 * suction). cpe is the aerodynamic pressure coefficient for THIS roof
 * geometry/mounting zone — the caller supplies it, either as a custom value
 * or via FLAT_ROOF_CPE_ZONES below.
 */
export function windLoad({ vb0, height, terrainCategory, cpe }) {
  const qp = windPeakPressure({ vb0, height, terrainCategory });
  if (qp == null || !(Number(cpe) !== 0 && Number.isFinite(Number(cpe)))) return null;
  return qp * Number(cpe);
}

// EN 1991-1-4 Table 7.2 — external pressure coefficients cpe,10 for a FLAT
// roof with sharp eaves (hp/h = 0), by zone. Real, standard, unchanged
// Eurocode values, not a fabricated approximation — but they ARE
// specifically the flat-roof table; a pitched roof's own zones (Table
// 7.4a/7.4b, which depend on pitch angle and wind direction) aren't
// implemented here, so this is a real gap for pitched roofs, not a solved
// one. Zones are defined by e = min(b, 2h) (b = crosswind roof dimension,
// h = building height): F is the corner (worst suction, most exposed to
// vortex separation), G the edge strip, H the field near the edge, I the
// central field. An array mounted near a roof edge/corner sits in F/G; one
// well inside the field sits in H/I.
export const FLAT_ROOF_CPE_ZONES = {
  F: { cpe: -1.8, label: { ro: "Zona F: colț acoperiș (cea mai expusă)", en: "Zone F: roof corner (most exposed)", ru: "Зона F: угол крыши (наиболее подвержена)" } },
  G: { cpe: -1.2, label: { ro: "Zona G: bandă de margine", en: "Zone G: edge strip", ru: "Зона G: краевая полоса" } },
  H: { cpe: -0.7, label: { ro: "Zona H: câmp lângă margine", en: "Zone H: field near the edge", ru: "Зона H: поле у края" } },
  I: { cpe: 0.2, label: { ro: "Zona I: câmp central", en: "Zone I: central field", ru: "Зона I: центральное поле" } },
};

/** Snow load shape coefficient μ1 for a pitched roof — EN 1991-1-3 §5.3.1, Table 5.2. */
export function snowShapeCoeff(pitchDeg) {
  const a = Math.max(0, Number(pitchDeg) || 0);
  if (a <= 30) return 0.8;
  if (a < 60) return 0.8 * ((60 - a) / 30);
  return 0;
}

/**
 * Characteristic snow load on the roof, kN/m² — EN 1991-1-3 §5.2,
 * expression (5.1): s = μ1·Ce·Ct·sk.
 * @param {number} sk characteristic ground snow load, kN/m² (installer-
 *   entered — from the National Annex zonal map; not verified here)
 * @param {number} pitchDeg roof pitch, degrees — the Site Designer's own
 *   plane tiltDeg, when one's been drawn
 * @param {number} [ce=1] exposure coefficient (1.0 normal topography, 0.8
 *   windswept, 1.2 sheltered — EN 1991-1-3 Table 5.1)
 * @param {number} [ct=1] thermal coefficient (1.0 for ordinary roof
 *   insulation; only reduced for a roof with high heat loss)
 * @returns {number|null} kN/m², or null if sk isn't a real positive value
 */
export function snowLoad({ sk, pitchDeg, ce = 1, ct = 1 }) {
  const skN = Number(sk);
  if (!(skN > 0)) return null;
  return snowShapeCoeff(pitchDeg) * (Number(ce) || 1) * (Number(ct) || 1) * skN;
}
