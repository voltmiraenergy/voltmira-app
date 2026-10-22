// lib/sideYield.js — what each side of a roof produces, and the yield of the roof as a whole. A roof side
// faces its own way at its own pitch, so its kWh per kWp is its own (PVGIS, per side); the quote takes one
// yield for the building, which is the sides' yields weighted by what each side produces. Before this the
// per-side results were worked out, blended and thrown away, a failed lookup silently dropped a side from the
// blend, and the live payback in the designer did not move when a pitch did. Pure, apart from the fetch it is given.

/** The key of a side's lookup: where it is, and the pitch and facing asked for. */
export const sideKey = (s) => `${Number(s.lat).toFixed(3)},${Number(s.lon).toFixed(3)}|${Math.round(Number(s.tiltDeg) || 0)}|${Math.round(Number(s.azimuthDeg) || 0)}`;

const positive = (n) => Number.isFinite(Number(n)) && Number(n) > 0;

/**
 * The building's yield from its sides.
 * @param {{count:number, yieldPerKwp:number|null, monthlyShape?:number[]|null}[]} sides  count is panels (or kWp: only the ratio matters)
 * @returns {{ yieldOverride: number|null, monthlyYieldShape: number[]|null, used: number, failed: number }}
 *   `failed` is the sides that hold panels but got no yield: they are left out of the blend and the caller says so
 */
export function blendYields(sides) {
  const list = (sides || []).filter((s) => Number(s.count) > 0);
  const valid = list.filter((s) => positive(s.yieldPerKwp));
  const failed = list.length - valid.length;
  if (!valid.length) return { yieldOverride: null, monthlyYieldShape: null, used: 0, failed };
  const energy = valid.map((s) => Number(s.count) * Number(s.yieldPerKwp));
  const total = energy.reduce((a, b) => a + b, 0);
  const counts = valid.reduce((a, s) => a + Number(s.count), 0);
  const yieldOverride = total / counts;
  let monthlyYieldShape = null;
  if (valid.every((s) => Array.isArray(s.monthlyShape) && s.monthlyShape.length === 12)) {
    const sums = valid.map((s) => s.monthlyShape.reduce((a, b) => a + (Number(b) || 0), 0) || 1);
    // each side's shape as shares of its own year, weighted by its energy
    monthlyYieldShape = Array.from({ length: 12 }, (_, m) => valid.reduce((a, s, i) => a + energy[i] * ((Number(s.monthlyShape[m]) || 0) / sums[i]), 0) / total);
  }
  return { yieldOverride, monthlyYieldShape, used: valid.length, failed };
}

/** One row per side holding panels: what the offer says about it. */
export function sideSummaries(sides, panelWatt) {
  const watt = Number(panelWatt) || 0;
  return (sides || []).filter((s) => Number(s.count) > 0).map((s) => {
    const kwp = Math.round(((Number(s.count) * watt) / 1000) * 100) / 100;
    const y = positive(s.yieldPerKwp) ? Math.round(Number(s.yieldPerKwp)) : null;
    return {
      id: s.id, tiltDeg: Math.round(Number(s.tiltDeg) || 0), azimuthDeg: Math.round(Number(s.azimuthDeg) || 0),
      count: Number(s.count), kwp, yieldPerKwp: y, kwh: y ? Math.round(kwp * y) : null,
      // how the pitch was found: an estimate is said so on the offer
      tiltSource: ["estimated", "measured", "typed"].includes(s.tiltSource) ? s.tiltSource : "typed",
    };
  });
}

/**
 * One side's yield from /api/pvgis. Never throws: a failed lookup is { yieldPerKwp: null }.
 * @param {{lat:number, lon:number, tiltDeg:number, azimuthDeg:number}} side
 * @param {typeof fetch} [fetchImpl]
 */
export async function fetchSideYield(side, fetchImpl = globalThis.fetch) {
  try {
    const r = await fetchImpl(`/api/pvgis?lat=${side.lat}&lon=${side.lon}&angle=${Math.round(side.tiltDeg)}&aspect=${Math.round(side.azimuthDeg)}`);
    const j = await r.json();
    return positive(j?.yieldPerKwp) ? { yieldPerKwp: Number(j.yieldPerKwp), monthlyShape: Array.isArray(j.monthlyShape) ? j.monthlyShape : null } : { yieldPerKwp: null, monthlyShape: null };
  } catch { return { yieldPerKwp: null, monthlyShape: null }; }
}
