// lib/inverterOptions.js — "Design suggestions": every inverter that could
// serve this array, compared side by side, instead of one silently auto-picked.
//
// Sunny Design's own version of this screen sorts by "Number of inverters",
// "Nominal power ratio", "Energy yield / rating" and a "Profitability" dial.
// The first two are real, computable numbers and this reproduces them
// honestly. The dial is SMA's own opaque scoring — not published, not
// reproducible — so rather than fake a number behind a label that implies
// precision it doesn't have, this reports "energy capture": the share of the
// array's DC output the combination does NOT clip away, the same clipPct
// designCheck() already computes, just inverted into a positive framing and
// exposed per-candidate instead of for one fixed choice.
import { INVERTERS } from "./supplierCatalog.js";

/**
 * @param {number} dcKw      the array's DC peak power (kWp)
 * @param {number} phases    1 or 3 — a hard compatibility filter, not a preference
 * @param {boolean} wantHybrid  battery attached → hybrid candidates sort first
 * @param {Array}   catalog   defaults to the supplier database; pass the
 *   installer's own catalog (mapped to this shape) to compare their real stock
 * @returns candidates, 1 and 2 units per compatible model, clamped to a
 *   buildable DC/AC window — sorted single-unit-first, then by closeness to
 *   the ratio that neither wastes capacity nor clips much.
 */
export function inverterOptions({ dcKw, phases, wantHybrid = false, catalog = INVERTERS }) {
  const dc = Number(dcKw) || 0;
  if (!(dc > 0)) return [];
  const compatible = (Array.isArray(catalog) ? catalog : []).filter((i) => i.phases === phases);

  const rows = [];
  for (const inv of compatible) {
    for (const count of [1, 2]) {
      const acKw = inv.kw * count;
      if (!(acKw > 0)) continue;
      const dcac = dc / acKw;
      // Below 0.7 the inverter is grossly oversized for this array (installer
      // waste, not a real option); above 1.6 clipping loses too much energy to
      // be a serious candidate. designCheck() flags anything over 1.3 already —
      // this is the wider net "worth even listing" is drawn from.
      if (dcac < 0.7 || dcac > 1.6) continue;
      const clipPct = dcac > 1.3 ? Math.max(0, Math.round((dcac - 1.15) * 22)) : 0;
      rows.push({
        inverter: inv, count, acKw,
        dcac: Math.round(dcac * 100) / 100,
        capturePct: Math.max(60, 100 - clipPct),
        hybrid: inv.type === "hybrid",
      });
    }
  }

  rows.sort((a, b) => {
    if (wantHybrid && a.hybrid !== b.hybrid) return a.hybrid ? -1 : 1;
    if (a.count !== b.count) return a.count - b.count;
    return Math.abs(a.dcac - 1.15) - Math.abs(b.dcac - 1.15);
  });
  return rows;
}
