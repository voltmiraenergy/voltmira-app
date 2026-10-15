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
// off here). MD retail ≈ 3.59 lei/kWh (Premier, central/south) ≈ €0.18.
//
// MD `feed` was €0.07, taken from the solar AUCTION ceiling (€0.064–0.073). That
// is the wrong series for a prosumer: an auction PPA prices utility-scale
// generation, while a rooftop's surplus is bought at the operator's published
// "preț mediu lunar de procurare a energiei livrate de prosumatori". Premier
// Energy Distribution's own table (see lib/prosumerPrice.js) gives 2.13–3.06
// lei/kWh over the trailing twelve months. Weighted by when a PV system actually
// exports — the price bottoms out in spring, exactly when surplus peaks — that
// is 2.51 lei/kWh ≈ €0.127, which is what ships here. Pass `feedOverride` to
// price a specific contract instead.
// RO stays 1:1 net metering. All values are editable per company in Settings.
//
// UA: Ukrainian households on the "green tariff" (checked 2026-09-29).
//   - Consumption and export are netted over each calendar month. A month's net
//     surplus is bought at the green tariff: 613.31 kop/kWh excl. VAT for
//     household solar up to 30 kW built in 2026–2029 (NEURC, from 2026-07-01).
//     A net deficit is billed at retail: 4.32 UAH/kWh, fixed for households
//     through the 2026–27 winter.
//   - The tariff is paid for exports between 4:00–23:00 (Apr–Oct) and
//     6:00–21:00 (Nov–Mar). Every hour a panel produces in Ukraine falls
//     inside those windows, so the limit only stops a battery selling at night.
//   - The green tariff ends on 1 January 2030 (`fitEnds`). After that the
//     surplus is valued at `feedAfter`, an active consumer's market price
//     (~2.5 UAH/kWh, an assumption the installer can change), and
//     self-consumption at retail, as in MD.
//   - The household green tariff stops at 30 kW (`maxKw`). Above that, the
//     surplus is valued at `feedAfter` from year 1, as after 2030.
//   - Under monthly netting a battery earns nothing: when inside the month a
//     kWh is used doesn't change the bill. Its value in Ukraine is power through
//     a blackout, which the proposal shows as hours, not as a saving.
//   - EUR values here are at the static rate; the UAH figures sit in engine
//     settings (uaFitUah, uaFeedAfterUah) and convert at the live NBU rate.
export const MARKETS = {
  MD: { name: "Moldova", scheme: "Net billing",      feed: 0.127, oneToOne: false, defaultPrice: 0.18, subsidyKey: "subsidyAmountMdl", subsidyFx: "MDL", prosumer: true },
  RO: { name: "Romania", scheme: "Net metering 1:1", feed: 0.036, oneToOne: true,  defaultPrice: 0.21, subsidyKey: "subsidyAmountRon", subsidyFx: "RON", prosumer: true },
  UA: { name: "Ukraine", scheme: "Green tariff",     feed: 0.1203, oneToOne: false, defaultPrice: 0.0847, subsidyKey: null, subsidyFx: "UAH", prosumer: false,
        monthlyNet: true, fitEnds: 2030, feedAfter: 0.049, maxKw: 30 },
};

export const SOLAR_SEASON = [0.30,0.40,0.60,0.80,1.00,1.10,1.10,1.00,0.80,0.60,0.40,0.25];

// Per 1 EUR. UAH: NBU 50.97 on 2026-09-29.
export const FX = { EUR: 1, RON: 4.97, MDL: 19.8, UAH: 51.0 };

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
    financeRatePct: 9,      // annual interest rate assumed for the monthly-payment estimate — a starting default like costPerKw, editable per company; never presented to a client as a real loan offer
    financeTermYears: 10,   // loan term assumed for the same estimate
    // Moldova's differentiated day/night electricity tariff, ANRE-approved,
    // MDL/kWh — a company-wide editable default, like costPerKw, not a
    // permanently-correct figure: ANRE revises these periodically, and the
    // real rate depends on which supplier serves this client. Defaults here
    // are Premier Energy's (central/south MD), verified 2026-09 against
    // premierenergy.md: night 2.94 MDL/kWh (23:00-07:00), day 3.75 MDL/kWh
    // (07:00-23:00). FEE-Nord's (RED Nord's northern territory) real rates —
    // night ~3.91, day ~4.89 MDL/kWh, per ANRE decisions referenced on
    // fee-nord.md/legislatie — are offered as a one-click Settings preset
    // (app/(app)/settings/page.jsx) rather than a second hardcoded default,
    // since either supplier's client can be on this platform. Applies only
    // to a project with tariffMode:"differentiated" — see simulate()'s own
    // comment for why only the day rate feeds the payback math.
    mdDayRateMdl: 3.75,
    mdNightRateMdl: 2.94,
    // Ukraine (market UA), UAH/kWh excl. VAT. The green tariff for household
    // solar up to 30 kW built 2026–2029 (NEURC, from 2026-07-01), and the price
    // assumed for surplus once the green tariff ends in 2030.
    uaFitUah: 6.1331,
    uaFeedAfterUah: 2.5,
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
 *   feedOverride?   — EUR/kWh paid for exported surplus, replacing the market default.
 *                     Use it to price a specific supply contract, or the operator's
 *                     published monthly buy-back weighted by this site's export shape.
 *   startYear?      — when the system starts producing, as a fractional year
 *                     (2026.75 = October 2026). Only UA uses it: the green tariff
 *                     stops on 1 January 2030, so it decides how many years of
 *                     the horizon still earn it. Freeze it with the proposal.
 * @param {object} E engine settings (defaultEngineSettings shape)
 * @param {'pess'|'expc'|'opti'} bandKey
 */
export function simulate(p, E, bandKey) {
  const b = E.bands[bandKey] || E.bands.expc;
  const mkt = MARKETS[p.market] || MARKETS.MD;
  let feed = Number(p.feedOverride) > 0 ? Number(p.feedOverride) : mkt.feed;
  let feedAfter = mkt.feedAfter || feed;
  if (mkt.monthlyNet) {
    // The Ukrainian tariffs are published in UAH; price them at the frozen or
    // live NBU rate when one is given.
    const liveUah = Number(E.fx && E.fx.UAH);
    const fxUah = liveUah > 0 ? liveUah : FX.UAH;
    if (!(Number(p.feedOverride) > 0) && Number(E.uaFitUah) > 0) feed = Number(E.uaFitUah) / fxUah;
    if (Number(E.uaFeedAfterUah) > 0) feedAfter = Number(E.uaFeedAfterUah) / fxUah;
  }
  // Sanitize numeric inputs: a blank editor field, a stale DB value or a missing
  // param must never leak NaN into a proposal or PDF. Clamp to non-negative — a
  // negative system size or price is meaningless, not a discount.
  const kw = Math.max(0, Number(p.kw) || 0);
  const price = Math.max(0, Number(p.price) || 0);
  const cons = Math.max(0, Number(effectiveConsumption(p)) || 0);

  // Battery cost scales with usable capacity (kWh). A legacy project that just has
  // batt=true with no size falls back to ~10 kWh so old quotes still compute.
  // Only a truly UNSET size (legacy batt=true with no battKwh) falls back to ~10;
  // an explicit 0 must stay 0 (was coerced to 10 by `|| 10`, so 0 and 10 kWh
  // wrongly cost the same and a bigger battery seemed not to change the price).
  const battKwh = p.batt ? (p.battKwh == null ? 10 : Math.max(0, Number(p.battKwh) || 0)) : 0;
  const batteryCost = battKwh > 0 ? battKwh * (Number(E.batteryCostPerKwh) || 500) : 0;

  // A bill of materials from the catalog drives the real cost when present;
  // otherwise fall back to the kW x EUR/kW estimate (+ battery).
  //
  // The BOM total replaces the kW x rate estimate, but it only replaces the
  // BATTERY cost when the BOM actually CONTAINS a battery line. Otherwise ticking
  // "include battery" while building a BOM of panels + inverter handed the client
  // the battery's self-consumption boost for free — €0 of cost against real extra
  // savings, which shortened the quoted payback by years on a document that gets
  // emailed to a homeowner. bomHasBattery is derived from the BOM's own line
  // kinds by lib/quoteInput.js, so an explicit battery line is never charged twice.
  const override = Math.max(0, Number(p.costOverride) || 0);
  const batteryUnpriced = override > 0 && battKwh > 0 && !p.bomHasBattery;
  const grossCost = override > 0
    ? override + (batteryUnpriced ? batteryCost : 0)
    : (kw * E.costPerKw + batteryCost);
  let cost = grossCost;
  // Local grant, market-aware: RO subtracts the AFM/Casa Verde amount (RON),
  // MD subtracts the Moldovan prosumer grant (MDL). The `afmSubsidy` flag is the
  // generic "apply the local subsidy" switch; the amount comes from the market's
  // subsidyKey in engine settings, converted from its local currency to EUR.
  if (p.afmSubsidy && mkt.subsidyKey) {
    const amount = Number(E[mkt.subsidyKey]) || 0;
    // A caller-supplied live rate wins over the static table. The constants
    // drift: checked 2026-08-21, RON was 4.97 here against an actual 5.2563,
    // which valued a 20,000 RON grant at €4,024 instead of €3,805 — every
    // subsidised Romanian quote understated the client's own cost by ~€219,
    // and payback inherited the error. Frozen proposal snapshots carry the
    // rate they were sent with, so an old proposal still recomputes identically.
    const live = Number(E.fx && E.fx[mkt.subsidyFx]);
    const fx = live > 0 ? live : (FX[mkt.subsidyFx] || 1);
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

  // Moldova's differentiated day/night tariff: the "day" band (07:00-23:00)
  // comfortably covers every daylight hour at this latitude, so real solar
  // self-consumption is ~entirely a daytime event — the energy it displaces
  // would otherwise have been bought at the DAY rate, not the flat `price`.
  // Valuing it at a blended/flat rate understates what self-consumption is
  // actually worth for a client on this plan. The night rate isn't part of
  // this formula: solar never displaces night-time grid draw (there's no
  // production then), so a household pays the night rate for that regardless
  // of having solar — it's shown to the client for transparency, not modeled
  // as a saving. Exported surplus is unaffected either way: it's valued at
  // the operator's real buy-back price (feed/feedOverride), never at retail.
  // RO's 1:1 net-metering credit isn't in scope — differentiated pricing
  // only applies to MD's net-billing scheme.
  let selfPriceBase = price;
  if (p.market === "MD" && p.tariffMode === "differentiated" && !mkt.oneToOne) {
    const liveMdl = Number(E.fx && E.fx.MDL);
    const fxMdl = liveMdl > 0 ? liveMdl : FX.MDL;
    const dayRateMdl = Number(E.mdDayRateMdl) || 0;
    if (dayRateMdl > 0) selfPriceBase = dayRateMdl / fxMdl;
  }

  // UA monthly netting: each month's production and consumption, as shares.
  const seasonTotal = season.reduce((a, x) => a + x, 0) || 1;
  const monthShare = season.map((x) => x / seasonTotal);
  const consByMonth = (p.useMonthly && Array.isArray(p.consMonthly) && p.consMonthly.length === 12)
    ? p.consMonthly.map((v) => Math.max(0, Number(v) || 0))
    : Array(12).fill(cons / 12);
  // A missing start date only happens for a UA quote built before this field
  // existed; October 2026 is when the first of those were made.
  const startYear = Number(p.startYear) > 0 ? Number(p.startYear) : 2026.75;

  let cum = -cost, payback = null, total = 0, year1 = 0;
  const rows = [];
  for (let y = 1; y <= horizon; y++) {
    const prod = solar0 * Math.pow(1 - b.degr / 100, y - 1);
    const priceY = price * Math.pow(1 + b.infl / 100, y - 1);
    const selfPriceY = selfPriceBase * Math.pow(1 + b.infl / 100, y - 1);
    const selfK = Math.min(prod * selfRatio, cons);
    const expK = prod - selfK;
    let val;
    if (mkt.oneToOne) {
      const imports = Math.max(0, cons - selfK);
      const credited = Math.min(expK, imports);
      val = selfK * priceY + credited * priceY + (expK - credited) * feed;
    } else if (mkt.monthlyNet) {
      // Green tariff: per month, production first cancels consumption (worth
      // retail), and what is left over is sold at the tariff. After the tariff
      // ends, the year is valued like net billing. A year that straddles the
      // end date is split by the share of it still inside the tariff.
      // The household green tariff covers systems up to maxKw (30 kW). A larger
      // plant sells its surplus at the market price from day one, so it gets no
      // share of the tariff at all, however early it starts.
      const fitEligible = !(mkt.maxKw > 0) || kw <= mkt.maxKw;
      const fitShare = fitEligible ? Math.max(0, Math.min(1, (mkt.fitEnds || 0) - (startYear + y - 1))) : 0;
      let offset = 0, surplus = 0;
      for (let m = 0; m < 12; m++) {
        const prodM = prod * monthShare[m];
        offset += Math.min(prodM, consByMonth[m]);
        surplus += Math.max(0, prodM - consByMonth[m]);
      }
      const valFit = offset * priceY + surplus * feed;
      const valAfter = selfK * selfPriceY + expK * feedAfter;
      val = fitShare * valFit + (1 - fitShare) * valAfter;
    } else {
      val = selfK * selfPriceY + expK * feed;
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
    // `cost` is what the CLIENT pays (after any local grant) — the number the
    // proposal shows. `grossCost` is the full system price before the grant, i.e.
    // the contract value the installer actually invoices; the dashboard's pipeline
    // KPI needs that one, not the client's out-of-pocket figure.
    cost, grossCost, prod0, solar0, wind0: 0, year1, payback,
    // null, not a sentinel: when a grant covers the whole system the return on
    // the client's own outlay is undefined, and the old 999 rendered as a literal
    // "25-yr ROI 999%" on the proposal PDF. Callers must show "∞" / "—".
    roi: cost > 0 ? ((total - cost) / cost) * 100 : null,
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

/**
 * Standard amortized monthly loan payment: M = P·r(1+r)^n / ((1+r)^n − 1),
 * degrading to P/n at 0% (the textbook formula divides by zero there).
 * Not a loan offer — an estimate from the installer's own configured
 * rate/term (financeRatePct/financeTermYears in engine settings), the same
 * way costPerKw is an editable starting assumption, not a verified market
 * rate. Callers must label it as an estimate, never a bank quote.
 * @param {number} principal EUR, the amount financed
 * @param {number} annualRatePct e.g. 9 for 9%/yr — 0 is a valid, interest-free case
 * @param {number} termYears loan length
 * @returns {number} monthly payment in EUR, or 0 for a non-positive principal/term
 */
export function amortizedMonthlyPayment(principal, annualRatePct, termYears) {
  const p = Math.max(0, Number(principal) || 0);
  const n = Math.max(0, Number(termYears) || 0) * 12;
  if (p <= 0 || n <= 0) return 0;
  const r = Math.max(0, Number(annualRatePct) || 0) / 100 / 12;
  if (r === 0) return p / n;
  const factor = Math.pow(1 + r, n);
  return (p * r * factor) / (factor - 1);
}

/** Display-currency formatting (UI layer). Engine stays in EUR. */
export function formatMoney(amountEur, currency = "EUR") {
  if (currency === "RON") return "lei " + Math.round(amountEur * FX.RON).toLocaleString("ro-RO");
  if (currency === "MDL") return "lei " + Math.round(amountEur * FX.MDL).toLocaleString("ro-MD");
  if (currency === "UAH") return Math.round(amountEur * FX.UAH).toLocaleString("uk-UA") + " грн";
  return "\u20AC" + Math.round(amountEur).toLocaleString("en-IE");
}
