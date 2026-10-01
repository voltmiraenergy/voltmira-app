// app/(app)/studio/_engine.js — Studio's engine is the product's engine.
//
// This used to be a vendored copy of engine/engine.js from when Studio was a
// standalone package, and it had fallen behind (no Ukraine market, no newer
// cost rules). It now re-exports @voltmira/engine, so a Studio job and a quote
// can never compute the same system differently. Only the roof-yield helpers
// below are Studio's own.
export * from "@voltmira/engine";

// Base specific yield (kWh/kWp/yr) for an optimal plane (~35° south), PVGIS-
// SARAH3 ballpark per market. Every Studio surface derives its yield from this
// × the site's roof factor (see effectiveYield) so the quote, annex, P50/P90
// and connection file can never quote three different production numbers for
// the same system. UA: central Ukraine (Kyiv ~1,200; the south is higher).
export const OPTIMAL_YIELD = { MD: 1250, RO: 1300, UA: 1200 };

// The yield actually used for a client: the optimal-plane resource for their
// market, scaled by the roof factor the site survey produces (pitch × azimuth ×
// shading, 1.0 = ideal). Falls back to the optimal plane when no survey has run.
export function effectiveYield(client) {
  const base = OPTIMAL_YIELD[client?.market] || OPTIMAL_YIELD.MD;
  const f = Number(client?.roofFactor);
  return Math.round(base * (f > 0 ? f : 1));
}
