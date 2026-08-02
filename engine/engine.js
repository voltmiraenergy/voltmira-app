/**
 * VoltMira calculation engine (pure functions, no globals).
 * The single source of truth for every payback number in the product.
 * Used by: web app (client preview), API (proposal pages, PDFs), tests.
 *
 * All money in EUR. Display conversion happens in the UI layer only.
 */

// Per-market grid rules. `defaultPrice` (EUR/kWh) pre-fills a new quote for that
// market; `feed` is the export tariff for surplus after self-consumption/credits.
// `subsidyKey` names the engine-settings field that holds the local grant amount
// (in that market's currency) so the AFM/Moldova subsidy toggle is market-aware.
// Values are sensible regional defaults — every one is editable in Settings, and
// each proposal freezes the numbers it was built with.
// Moldova is the primary market (net billing since 2024-01-01: surplus paid at the
// low producer price, consumption billed at retail — which is why a battery pays
// off here). Numbers sourced 2026-07 from ANRE / Premier Energy / pv-magazine:
//   MD retail ≈ 3.59 lei/kWh (Premier, central/south) ≈ €0.18; producer/export
//   price ≈ 1.16–1.44 lei (solar auction €0.064 / ceiling €0.073) ≈ €0.07.
// RO stays 1:1 net metering. All values are editable per company in Settings.
export const MARKETS = {
  MD: { name: "Moldova", scheme: "Net billing",      feed: 0.07,  oneToOne: false, defaultPrice: 0.18, subsidyKey: "subsidyAmountMdl", subsidyFx: "MDL", prosumer: true },
  RO: { name: "Romania", scheme: "Net metering 1:1", feed: 0.036, oneToOne: true,  defaultPrice: 0.21, subsidyKey: "subsidyAmountRon", subsidyFx: "RON", prosumer: true },
};

export const SOLAR_SEASON = [0.30,0.40,0.60,0.80,1.00,1.10,1.10,1.00,0.80,0.60,0.40,0.25];

export const FX = { EUR: 1, RON: 4.97, MDL: 19.8 };

export function defaultEngineSettings() {
  return {
    costPerKw: 1050,
    batteryCost: 4200,          // legacy flat fallback (used only if battKwh is 0/absent)
    batteryCostPerKwh: 500,     // installed €/kWh — battery cost = capacity × this
    baseYield: 1100,        // kWh/kWp/yr — overridden by PVGIS when available
    opexPct: 0.5,           // % of capex per year
    horizon: 25,
    subsidyAmountRon: 20000,   // RO — Casa Verde / AFM grant (RON)
    subsidyAmountMdl: 0,       // MD — local prosumer grant (MDL); 0 until the installer sets their programme
    quoteValidityDays: 30,     // a sent quote is "valid until" sentAt + this; older = stale
    bands: {
      pess: { ym: 0.92, degr: 0.8, infl: 0 },
      expc: { ym: 1.00, degr: 0.5, infl: 3 },
      opti: { ym: 1.08, degr: 0.3, infl: 5 },
    },
  };
}

/** Effective annual consumption, honouring the monthly profile when active. */
export function effectiveConsumption(p) {
  if (p.useMonthly && Array.isArray(p.consMonthly) && p.consMonthly.length === 12) {
    return p.consMonthly.reduce((a, b) => a + (Number(b) || 0), 0);
  }
  return p.cons;
}

/**
 * Simulate one scenario band.
 * @param {object} p project inputs:
 *   kw, price, cons, batt, battKwh (usable capacity when batt), market ('RO'|'MD'),
 *   useMonthly, consMonthly[12], afmSubsidy,
 *   yieldOverride?  — kWh/kWp/yr from PVGIS for this exact location (replaces baseYield)
 *   monthlyYieldShape? — optional 12 monthly fractions from PVGIS (replaces SOLAR_SEASON)
 * @param {object} E engine settings (defaultEngineSettings shape)
 * @param {'pess'|'expc'|'opti'} bandKey
 */
export function simulate(p, E, bandKey) {
  const b = E.bands[bandKey] || E.bands.expc;
  const mkt = MARKETS[p.market] || MARKETS.MD;
  // Sanitize numeric inputs: a blank editor field, a stale DB value or a missing
  // param must never leak NaN into a proposal or PDF. Clamp to non-negative — a
  // negative system size or price is meaningless, not a discount.
  const kw = Math.max(0, Number(p.kw) || 0);
  const price = Math.max(0, Number(p.price) || 0);
  const cons = Math.max(0, Number(effectiveConsumption(p)) || 0);

  // Battery cost scales with usable capacity (kWh). A legacy project that just has
  // batt=true with no size falls back to ~10 kWh so old quotes still compute.
  const battKwh = p.batt ? Math.max(0, Number(p.battKwh) || 10) : 0;
  const batteryCost = battKwh > 0 ? battKwh * (Number(E.batteryCostPerKwh) || 500) : 0;

  // A bill of materials from the catalog drives the real cost when present;
  // otherwise fall back to the kW x EUR/kW estimate (+ battery). costOverride is
  // the BOM total, already including any battery line, so it replaces both.
  const override = Math.max(0, Number(p.costOverride) || 0);
  const grossCost = override > 0 ? override : (kw * E.costPerKw + batteryCost);
  let cost = grossCost;
  // Local grant, market-aware: RO subtracts the AFM/Casa Verde amount (RON),
  // MD subtracts the Moldovan prosumer grant (MDL). The `afmSubsidy` flag is the
  // generic "apply the local subsidy" switch; the amount comes from the market's
  // subsidyKey in engine settings, converted from its local currency to EUR.
  if (p.afmSubsidy && mkt.subsidyKey) {
    const amount = Number(E[mkt.subsidyKey]) || 0;
    const fx = FX[mkt.subsidyFx] || 1;
    cost = Math.max(0, cost - amount / fx);
  }

  const yieldPerKwp = p.yieldOverride || E.baseYield;
  const solar0 = kw * yieldPerKwp * b.ym;
  const prod0 = solar0;
  const season = (Array.isArray(p.monthlyYieldShape) && p.monthlyYieldShape.length === 12)
    ? p.monthlyYieldShape : SOLAR_SEASON;

  // Self-consumption a battery unlocks: it time-shifts evening/overnight usage
  // (~half of daily consumption) off the grid, but only up to its usable capacity
  // (~90% round-trip). Past the point where capacity covers that shiftable share,
  // a bigger battery adds cost with NO extra savings — which is the honest reason
  // an oversized battery lengthens payback.
  const dailyCons = cons / 365;
  const shiftableDaily = Math.min(battKwh * 0.9, dailyCons * 0.5);   // kWh/day
  const batteryBoost = solar0 > 0 ? (shiftableDaily * 365) / solar0 : 0;   // fraction of production
  let selfRatio;
  if (p.useMonthly && Array.isArray(p.consMonthly) && p.consMonthly.length === 12) {
    const seasonSum = season.reduce((a, x) => a + x, 0);
    let selfSum = 0, prodSum = 0;
    for (let m = 0; m < 12; m++) {
      const prodM = solar0 * (season[m] / seasonSum);
      const consM = Number(p.consMonthly[m]) || 0;
      const baseSelf = Math.min(0.85, Math.max(0.2, (consM / Math.max(prodM, 1)) * 0.55));
      const selfM = Math.min(0.95, baseSelf + batteryBoost);
      selfSum += Math.min(prodM, prodM * selfM, consM);
      prodSum += prodM;
    }
    selfRatio = prodSum > 0 ? selfSum / prodSum : 0;
  } else {
    const baseSelf = Math.min(0.85, Math.max(0.2, (cons / Math.max(prod0, 1)) * 0.55));
    selfRatio = Math.min(0.95, baseSelf + batteryBoost);
  }

  // Self-consumed energy can never exceed what the client actually uses; the
  // surplus is exported at the feed-in tariff, not valued at retail. The annual
  // path's selfRatio is a propensity, so this effective ratio caps it at usage —
  // making it agree with the monthly path, which already caps per month.
  const selfRatioEff = solar0 > 0 ? Math.min(solar0 * selfRatio, cons) / solar0 : 0;

  // O&M is maintenance on the PHYSICAL system, so it's computed on gross capex (a
  // grant lowers what you paid, not upkeep). It also inflates year over year at
  // the same rate as energy prices — holding it flat while revenue inflates would
  // understate lifetime cost and flatter the payback.
  const opexEur0 = grossCost * (E.opexPct / 100);
  const horizon = E.horizon || 25;

  let cum = -cost, payback = null, total = 0, year1 = 0;
  const rows = [];
  for (let y = 1; y <= horizon; y++) {
    const prod = solar0 * Math.pow(1 - b.degr / 100, y - 1);
    const priceY = price * Math.pow(1 + b.infl / 100, y - 1);
    const selfK = Math.min(prod * selfRatio, cons);
    const expK = prod - selfK;
    let val;
    if (mkt.oneToOne) {
      const imports = Math.max(0, cons - selfK);
      const credited = Math.min(expK, imports);
      val = selfK * priceY + credited * priceY + (expK - credited) * mkt.feed;
    } else {
      val = selfK * priceY + expK * mkt.feed;
    }
    const opexY = opexEur0 * Math.pow(1 + b.infl / 100, y - 1);
    const net = val - opexY;
    if (y === 1) year1 = net;
    total += net;
    const prev = cum; cum += net;
    if (payback === null && cum >= 0) {
      payback = prev === cum ? 0 : (y - 1) + (0 - prev) / (cum - prev);
    }
    rows.push(cum);
  }

  const immediate = cost <= 0;
  if (immediate) payback = 0;

  return {
    cost, prod0, solar0, wind0: 0, year1, payback,
    roi: cost > 0 ? ((total - cost) / cost) * 100 : 999,
    self: selfRatioEff, rows, horizon, immediate,
  };
}

/** All three bands at once. */
export function quote(p, E) {
  return {
    p: simulate(p, E, "pess"),
    e: simulate(p, E, "expc"),
    o: simulate(p, E, "opti"),
  };
}

/** Display-currency formatting (UI layer). Engine stays in EUR. */
export function formatMoney(amountEur, currency = "EUR") {
  if (currency === "RON") return "lei " + Math.round(amountEur * FX.RON).toLocaleString("ro-RO");
  if (currency === "MDL") return "lei " + Math.round(amountEur * FX.MDL).toLocaleString("ro-MD");
  return "\u20AC" + Math.round(amountEur).toLocaleString("en-IE");
}
