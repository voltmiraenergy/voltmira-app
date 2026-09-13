// lib/prosumerPrice.js — what a Moldovan prosumer's SURPLUS is actually bought
// back at, month by month.
//
// Source: Premier Energy Distribution's published "Prețul mediu lunar de
// procurare a energiei electrice livrate de prosumatori în rețeaua electrică de
// distribuție" (lei/kWh). This is the net-billing buy-back price — the number
// that decides what an exported kWh is worth, as opposed to a self-consumed one
// which is worth the full retail tariff.
//
// WHY THIS FILE EXISTS: the engine shipped a flat 0.07 €/kWh for MD export.
// The published table says otherwise — the trailing 12 months average ~2.57
// lei/kWh (≈ €0.130 at 19.8 MDL/EUR), i.e. roughly 1.8× the assumption. Worse,
// the price is strongly seasonal in exactly the wrong direction for solar: it
// peaks in winter (3.06 lei in Jan-2026) and dips in spring (2.30 lei in
// Apr-2026), while a PV system's surplus peaks in April–August. So the honest
// figure to quote is not the calendar average — it's the average weighted by
// WHEN the surplus actually occurs. That's weightedExportPrice() below.
//
// null = not published yet.

export const PROSUMER_BUYBACK_MDL = {
  2024: [1.40, 1.23, 1.22, 1.19, 1.22, 1.27, 1.72, 1.40, 1.40, 1.29, 2.05, 2.07],
  2025: [2.58, 1.92, 2.17, 2.05, 2.03, 2.09, 2.34, 2.23, 2.13, 2.65, 2.72, 2.66],
  2026: [3.06, 2.74, 2.63, 2.30, 2.39, 2.72, 2.58, null, null, null, null, null],
};

export const BUYBACK_SOURCE = {
  operator: "Premier Energy Distribution",
  label: {
    ro: "preț mediu lunar de procurare a energiei livrate de prosumatori",
    en: "monthly average purchase price for prosumer-delivered energy",
    ru: "среднемесячная цена закупки энергии от просьюмеров",
  },
  unit: "MDL/kWh",
};

export const MONTHS_RO = ["ian", "feb", "mar", "apr", "mai", "iun", "iul", "aug", "sep", "oct", "noi", "dec"];

/** Years present in the table, newest first. */
export const BUYBACK_YEARS = Object.keys(PROSUMER_BUYBACK_MDL).map(Number).sort((a, b) => b - a);

/**
 * The most recently published price for each calendar month — 2026 where it
 * exists, falling back to 2025, then 2024. This is the seasonal shape to model
 * with: a full 12-month curve made of the freshest real data available.
 */
export function latestSeasonalMdl() {
  const out = new Array(12).fill(null);
  const years = BUYBACK_YEARS;                       // newest first
  for (let m = 0; m < 12; m++) {
    for (const y of years) {
      const v = PROSUMER_BUYBACK_MDL[y]?.[m];
      if (v != null) { out[m] = v; break; }
    }
  }
  return out;
}

/** Plain calendar average of the latest seasonal curve (MDL/kWh). */
export function flatAverageMdl() {
  const c = latestSeasonalMdl().filter((v) => v != null);
  return c.length ? c.reduce((a, b) => a + b, 0) / c.length : 0;
}

/**
 * THE FORMULA, in one line:
 *
 *     P_export = Σ( surplus_m × price_m ) / Σ( surplus_m )
 *
 * i.e. the buy-back price weighted by how much surplus each month actually
 * produces — not a naive yearly mean. `weights` is any 12-value monthly shape
 * proportional to surplus; the engine's SOLAR_SEASON is a good default because
 * surplus tracks production once self-consumption is roughly flat across the
 * year. Returns MDL/kWh.
 */
export function weightedExportPriceMdl(weights) {
  const price = latestSeasonalMdl();
  let num = 0, den = 0;
  for (let m = 0; m < 12; m++) {
    const w = Number(weights?.[m]) || 0;
    const p = price[m];
    if (p == null || w <= 0) continue;
    num += w * p;
    den += w;
  }
  return den > 0 ? num / den : flatAverageMdl();
}

/** Same, in EUR/kWh — the unit the engine's `feed` speaks. */
export function weightedExportPriceEur(weights, mdlPerEur = 19.8) {
  return weightedExportPriceMdl(weights) / (mdlPerEur || 19.8);
}

/**
 * Revenue from selling surplus, month by month — the honest version of
 * "surplus × one average price". Pass the actual monthly surplus in kWh.
 * Returns { mdl, eur, effectiveMdlPerKwh, totalKwh, months[] }.
 */
export function exportRevenue(monthlySurplusKwh, mdlPerEur = 19.8) {
  const price = latestSeasonalMdl();
  const months = [];
  let mdl = 0, kwh = 0;
  for (let m = 0; m < 12; m++) {
    const s = Math.max(0, Number(monthlySurplusKwh?.[m]) || 0);
    const p = price[m] ?? flatAverageMdl();
    const revenue = s * p;
    months.push({ m, surplusKwh: s, priceMdl: p, revenueMdl: revenue });
    mdl += revenue;
    kwh += s;
  }
  return {
    mdl, eur: mdl / (mdlPerEur || 19.8), totalKwh: kwh,
    effectiveMdlPerKwh: kwh > 0 ? mdl / kwh : 0,
    months,
  };
}

/**
 * What one kWh is worth STORED rather than sold: the retail price you avoid
 * paying, minus the buy-back price you give up by not exporting it — weighted
 * by when the surplus actually occurs.
 *
 *     spread = retail − P_export
 *
 * This, not the retail tariff, is what a battery earns per cycled kWh. Quoting
 * the full tariff as battery savings over-promises by exactly the buy-back
 * price. In Moldova the spread is also widest in spring and summer, because the
 * buy-back price bottoms out in the same months the surplus peaks — which is
 * the real argument for storage here, and it doesn't show up in a flat model.
 */
export function storageSpreadMdl(retailMdl, weights) {
  const buybackMdl = weightedExportPriceMdl(weights);
  const retail = Math.max(0, Number(retailMdl) || 0);
  return {
    retailMdl: retail,
    buybackMdl,
    spreadMdl: retail - buybackMdl,
    sharePct: retail > 0 ? ((retail - buybackMdl) / retail) * 100 : 0,
  };
}

/**
 * Per-year averages plus a like-for-like year-over-year change using only the
 * months both years actually published — so a part-year (2026) isn't compared
 * against a full one. This is the evidence behind any escalation assumption:
 * observed history, not a constant someone picked.
 */
export function annualAverages() {
  const years = BUYBACK_YEARS.slice().sort((a, b) => a - b);
  const rows = years.map((y) => {
    const vals = PROSUMER_BUYBACK_MDL[y].filter((v) => v != null);
    return { year: y, months: vals.length, avg: vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0 };
  });
  for (let i = 1; i < rows.length; i++) {
    const prev = PROSUMER_BUYBACK_MDL[rows[i - 1].year];
    const cur = PROSUMER_BUYBACK_MDL[rows[i].year];
    let a = 0, b = 0, n = 0;
    for (let m = 0; m < 12; m++) {
      if (prev[m] != null && cur[m] != null) { a += prev[m]; b += cur[m]; n++; }
    }
    rows[i].yoyPct = n > 0 && a > 0 ? ((b / a) - 1) * 100 : null;
    rows[i].yoyMonths = n;
  }
  return rows;
}
