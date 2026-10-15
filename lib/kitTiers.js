// lib/kitTiers.js — "Recommended Kits": 4 fixed-size system bundles, each
// auto-assembled from the SAME real sizing logic the rest of the app already
// uses (lib/supplierCatalog.js's autoBom(), which itself calls
// recommendPanel/recommendInverter/recommendBattery — the exact functions
// backing the BOM auto-fill button in the project editor and a lead's first
// draft project server-side). Nothing new is invented here: a kit is just
// autoBom() run at a fixed (kw, battKwh) and totaled with lib/quoteAnalysis.js's
// bomTotal(), the same total the editor's own BOM card computes.
//
// The four sizes span what the shipped catalog can actually serve without
// degenerating (verified against the real INVERTERS/BATTERIES arrays):
// a too-small or too-large target can leave recommendInverter() with no
// in-window candidate and fall back to "closest available", which is honest
// but not what a kit tier should showcase.
import { autoBom } from "./supplierCatalog.js";
import { bomTotal } from "./quoteAnalysis.js";

export const KIT_TIERS = [
  { id: "compact-3kw", kw: 3, battKwh: 0 },
  { id: "family-6kw", kw: 6, battKwh: 0 },
  { id: "family-plus-8kw", kw: 8, battKwh: 10 },
  { id: "business-15kw", kw: 15, battKwh: 0 },
];

/**
 * One tier, sized: its own bill of materials and the materials total. Pure —
 * same (kw, battKwh) always yields the same kit, since autoBom() itself is
 * pure and side-effect-free.
 */
export function buildKit(tier) {
  const bom = autoBom(tier.kw, tier.battKwh);
  return { ...tier, bom, total: bomTotal(bom) };
}

/** Every tier, sized. What the Kits tab renders. */
export function recommendedKits() {
  return KIT_TIERS.map(buildKit);
}
