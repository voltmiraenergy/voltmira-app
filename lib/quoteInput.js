// lib/quoteInput.js — build the engine quote() input from a raw `projects` row.
//
// Kept in ONE place so every live recompute (dashboard KPIs, projects list,
// anywhere else) stays identical to the editor — which drives cost from the
// bill of materials and uses the project's ACTUAL battery capacity. Before this,
// the dashboard/list omitted battKwh + the BOM total, so a project with a
// non-default battery or a BOM showed a different payback/value than the editor
// and the proposal the client actually received.
//
// Degrades gracefully if add-battery-kwh.sql / add-quote-bom.sql haven't run:
// r.batt_kwh / r.bom are simply undefined and fall back to the legacy defaults.
/**
 * Does this bill of materials actually PRICE a battery?
 * The engine needs to tell "the BOM already covers the battery" apart from "the
 * battery toggle is on but no line in the BOM pays for it" — in the second case
 * it must add the battery cost itself, or the client is quoted the battery's
 * extra savings for free.
 */
export function bomHasBattery(bom) {
  return (Array.isArray(bom) ? bom : [])
    .some((l) => l.kind === "battery" && (Number(l.qty) || 0) > 0);
}

export function rowToQuoteInput(r) {
  return {
    kw: Number(r.kw), price: Number(r.price), cons: Number(r.cons),
    batt: r.batt, battKwh: r.batt_kwh != null ? Number(r.batt_kwh) : 10,
    market: r.market, useMonthly: r.use_monthly, consMonthly: r.cons_monthly,
    afmSubsidy: r.afm_subsidy,
    yieldOverride: r.yield_per_kwp ? Number(r.yield_per_kwp) : undefined,
    monthlyYieldShape: r.monthly_yield_shape || undefined,
    // The system size (kW × €/kW rate + battery) drives the quote price, so the
    // size slider always moves the cost. The bill of materials is NOT a price
    // override — it's the installer's equipment cost, shown in the editor as a
    // margin figure (quote price − materials). Previously the BOM total froze the
    // price, which made the size slider look broken once materials were added.
    costOverride: 0,
  };
}
