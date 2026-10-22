// lib/roofSides.js — what an offer says about the roof's sides and about how the roof was designed.
// Pure.

const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : null);
const KINDS = ["satellite", "verified"];

/**
 * The sides to print on an offer: only when they add up to the panels the quote sells (a side list
 * left over from an earlier design, with the kW since changed by hand, would say things the price
 * does not rest on), cleaned to the fields printed.
 * @param {any[]} sides  site_design.sides, as the roof designer saves it
 * @param {number} modules  the panels in the quote
 * @returns {{ tiltDeg:number, azimuthDeg:number, count:number, kwp:number, yieldPerKwp:number|null, kwh:number|null, tiltEstimated:boolean }[]|undefined}
 */
export function cleanSides(sides, modules) {
  if (!Array.isArray(sides) || !sides.length) return undefined;
  const rows = sides.slice(0, 12).map((s) => ({
    tiltDeg: Math.round(num(s?.tiltDeg) ?? 0), azimuthDeg: Math.round(num(s?.azimuthDeg) ?? 0),
    count: Math.max(0, Math.round(num(s?.count) ?? 0)), kwp: Math.max(0, num(s?.kwp) ?? 0),
    yieldPerKwp: num(s?.yieldPerKwp) > 0 ? Math.round(num(s.yieldPerKwp)) : null,
    kwh: num(s?.kwh) > 0 ? Math.round(num(s.kwh)) : null,
    tiltEstimated: s?.tiltSource === "estimated",
  })).filter((r) => r.count > 0);
  const total = rows.reduce((a, r) => a + r.count, 0);
  if (!rows.length || total !== Math.round(Number(modules) || 0)) return undefined;
  return rows;
}

/**
 * How the roof was designed, for the mark on the offer: from satellite imagery (the installer confirms the
 * measurements on site) or verified on site, with the day. undefined when no roof was drawn.
 * @param {{ planes?: any[], status?: string, verifiedAt?: string }|null} siteDesign
 * @returns {{ kind: "satellite"|"verified", at: string|null }|undefined}
 */
export function roofStatusOf(siteDesign) {
  if (!Array.isArray(siteDesign?.planes) || !siteDesign.planes.length) return undefined;
  const kind = KINDS.includes(siteDesign.status) ? siteDesign.status : "satellite";
  const at = kind === "verified" && /^\d{4}-\d{2}-\d{2}$/.test(String(siteDesign.verifiedAt || "")) ? siteDesign.verifiedAt : null;
  return { kind, at };
}
