// lib/mountingEstimate.js — rail length and clamp count for the panel layout
// lib/roofLayout.js's fitPanels() already computed (its `rows` field), not a
// separate guess: same row groupings, same real placed-panel geometry.
//
// Both numbers are QUANTITIES, not a priced BOM line: lib/supplierCatalog.js's
// MOUNTS entries are priced per kW as a whole-system estimate (rail set,
// clamps, everything included), so adding a separate priced rail/clamp line
// would double-count that cost. Same status as lib/bosEstimate.js: a
// specification output for what to buy, not what it costs.
//
// Clamp-count convention: two rails per row (near the row's two long edges,
// the standard portrait/landscape rail-racking layout), each rail needing
// N+1 clamp positions for N panels — one dedicated "end clamp" at each end,
// plus one "mid clamp" between every adjacent pair (shared by both panels it
// separates). This is the standard convention pitched-roof rail systems
// (K2, Schletter, Renusol, ...) install to, not a brand-specific number —
// same status as lib/bosEstimate.js's 1.25x breaker-sizing convention.

/** Total rail stock length, meters — two rails per row, summed over every row. */
export function railLengthM(rows) {
  return (Array.isArray(rows) ? rows : []).reduce((sum, r) => sum + 2 * (Number(r.lengthM) || 0), 0);
}

/**
 * Clamp counts across every row: `end` (dedicated end clamps, 2 per rail x 2
 * rails per row), `mid` (shared clamps between adjacent panels, 2 per rail x
 * (panels-1) per row), and `total`.
 */
export function clampCount(rows) {
  const list = Array.isArray(rows) ? rows : [];
  let end = 0, mid = 0;
  for (const r of list) {
    const n = Number(r.count) || 0;
    if (n <= 0) continue;
    end += 4;
    mid += 2 * Math.max(0, n - 1);
  }
  return { end, mid, total: end + mid };
}
