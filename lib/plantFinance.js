// lib/plantFinance.js — a utility-scale plant (wind, solar, battery storage,
// or any mix of them on one site) as a bankable project: its energy at P50
// and P90, its contracted and merchant revenue, its costs, and the same cash
// flow, debt and return figures a quote asset produces (lib/projectFinance.js
// evaluateProject), so a portfolio, its stress tests, its debt sizing, the
// report, the Excel model and the data room all take plants without change.
//
// Energy, per source:
//   wind   the independent study's P50 and P90 when entered; until then the
//          screening estimate from public data (lib/windScreen.js), whose
//          uncertainty is an assumption shown as one (15%, 1 sigma)
//   solar  the study's P50 and P90 when entered; else MWp x the site's PVGIS
//          yield (kWh/kWp, losses included), at the app's 7.1% sigma
// P90 adds each source's own P90. That is conservative: wind and sun do not
// fall short in the same years, so a combined P90 would be a little higher.
//
// Revenue: the contracted price (auction contract or PPA) for its years,
// indexed as agreed; then a merchant price, which is an assumption. Stress
// cases move only the merchant part: a contract's price does not drop with
// the market. Storage earns only what the user enters (a balancing or
// capacity contract), never an assumed arbitrage.
//
// Every cost and price here is the user's assumption until a quote, a term
// sheet or a contract replaces it; the screens say so.
import { evaluateProject, normalizeFinance, normalizeScenario, financeFlows, SIGMA_PCT, Z } from "./projectFinance.js";
import { windEnergy, SCREENING_SIGMA_PCT, sigmaFrom, DEFAULT_SHEAR, DEFAULT_LOSSES_PCT, DEFAULT_TURBINE } from "./windScreen.js";
import { normalizeGrid } from "./gridNear.js";

const num = (v, d = 0) => (v !== "" && v != null && Number.isFinite(Number(v)) ? Number(v) : d);
const pos = (v) => Math.max(0, num(v));
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

export const PLANT_COSTS = {
  windEurPerKw: 0, solarEurPerKw: 0, bessEurPerKwh: 0, gridEur: 0, devPct: 0,
  opexWindEurPerKwYr: 0, opexSolarEurPerKwYr: 0, opexBessEurPerKwhYr: 0, landEurYr: 0, insurancePct: 0,
};
export const PLANT_REVENUE = { priceEurMwh: 0, years: 0, indexPct: 0, afterEurMwh: 0, currency: "EUR", bessEurPerMwYr: 0, bessYears: 10, kind: "auction" };

/** A plant as stored (portfolios.plants[]), every field filled and clamped. */
export function normalizePlant(p) {
  const x = p && typeof p === "object" ? p : {};
  const w = x.wind && typeof x.wind === "object" ? x.wind : null;
  const s = x.solar && typeof x.solar === "object" ? x.solar : null;
  const b = x.bess && typeof x.bess === "object" ? x.bess : null;
  const page = (v) => (Number.isInteger(Number(v)) && Number(v) > 0 && v !== "" && v != null ? Number(v) : null);
  // a study's figures, and where they came from when they were read from its PDF
  // (components/portfolio/StudyReader.jsx): the file, the pages, the P90 horizon
  const study = (o) => (o && typeof o === "object" ? {
    p50Mwh: pos(o.p50Mwh), p90Mwh: pos(o.p90Mwh), by: String(o.by || "").slice(0, 120), date: String(o.date || "").slice(0, 10),
    file: String(o.file || "").slice(0, 160), p90Basis: o.p90Basis === "1y" || o.p90Basis === "10y" ? o.p90Basis : "",
    pages: { p50: page(o.pages?.p50), p90: page(o.pages?.p90) },
  } : null);
  return {
    id: String(x.id || ""),
    name: String(x.name || "").slice(0, 160),
    locality: String(x.locality || "").slice(0, 120),
    lat: Number.isFinite(Number(x.lat)) && x.lat !== "" && x.lat != null ? Number(x.lat) : null,
    lon: Number.isFinite(Number(x.lon)) && x.lon !== "" && x.lon != null ? Number(x.lon) : null,
    operator: String(x.operator || "").slice(0, 40),
    // who borrows (the project company) and who stands behind it, for the bank pack
    borrower: String(x.borrower || "").trim().slice(0, 160),
    sponsor: String(x.sponsor || "").trim().slice(0, 160),
    sample: !!x.sample,
    wind: w && pos(w.mw) > 0 ? {
      mw: pos(w.mw), turbines: Math.max(1, Math.round(pos(w.turbines) || 1)), hubM: clamp(num(w.hubM, 120), 30, 250),
      shear: clamp(num(w.shear, DEFAULT_SHEAR), 0, 0.6), lossesPct: clamp(num(w.lossesPct, DEFAULT_LOSSES_PCT), 0, 60),
      turbine: { ...DEFAULT_TURBINE, ...(w.turbine || {}) },
      screening: w.screening && w.screening.hist ? w.screening : null,
      study: study(w.study),
    } : null,
    solar: s && pos(s.mwp) > 0 ? {
      mwp: pos(s.mwp), yieldKwhKwp: pos(s.yieldKwhKwp), yieldSource: String(s.yieldSource || ""), degrPctYr: clamp(num(s.degrPctYr, 0.5), 0, 3),
      // the point PVGIS was asked about, so a plant moved since can say its yield is for another site
      yieldAt: s.yieldAt && Number.isFinite(Number(s.yieldAt.lat)) && Number.isFinite(Number(s.yieldAt.lon)) ? { lat: Number(s.yieldAt.lat), lon: Number(s.yieldAt.lon) } : null,
      study: study(s.study),
    } : null,
    bess: b && pos(b.mwh) > 0 ? { mw: pos(b.mw), mwh: pos(b.mwh) } : null,
    revenue: { ...PLANT_REVENUE, ...(x.revenue || {}),
      priceEurMwh: pos(x.revenue?.priceEurMwh), years: Math.round(clamp(num(x.revenue?.years), 0, 30)),
      indexPct: clamp(num(x.revenue?.indexPct), -5, 10), afterEurMwh: pos(x.revenue?.afterEurMwh),
      currency: x.revenue?.currency === "local" ? "local" : "EUR", bessEurPerMwYr: pos(x.revenue?.bessEurPerMwYr),
      // the storage contract's own length; by default the energy contract's, or 10 years
      bessYears: Math.round(clamp(num(x.revenue?.bessYears, num(x.revenue?.years) > 0 ? num(x.revenue?.years) : 10), 0, 30)),
      kind: ["auction", "ppa", "merchant"].includes(x.revenue?.kind) ? x.revenue.kind : "auction" },
    costs: { ...PLANT_COSTS, ...Object.fromEntries(Object.keys(PLANT_COSTS).map((k) => [k, pos(x.costs?.[k])])) },
    permits: x.permits && typeof x.permits === "object" ? x.permits : {},
    // the grid around the site, from OpenStreetMap, and the connection the user chose (lib/gridNear.js)
    grid: normalizeGrid(x.grid),
  };
}

/** Installed generating capacity in kW (storage does not generate). */
export const plantKw = (pl) => (pl.wind ? pl.wind.mw * 1000 : 0) + (pl.solar ? pl.solar.mwp * 1000 : 0);

/**
 * The plant's yearly energy at P50 and its uncertainty, per source, and where
 * each figure comes from.
 * @returns {{ wind: null|{p50Mwh, sigmaPct, source, cfPct?, meanHub?}, solar: null|{p50Mwh, sigmaPct, source}, p50Mwh: number }}
 */
export function plantEnergy(plant) {
  const pl = plant && plant.wind !== undefined ? plant : normalizePlant(plant);
  let wind = null, solar = null;
  if (pl.wind) {
    const st = pl.wind.study;
    if (st && st.p50Mwh > 0) {
      wind = { p50Mwh: st.p50Mwh, sigmaPct: sigmaFrom(st.p50Mwh, st.p90Mwh) ?? 10, source: "study", cfPct: (st.p50Mwh / (pl.wind.mw * 8760)) * 100 };
    } else if (pl.wind.screening) {
      const r = windEnergy({ hist: pl.wind.screening.hist, climMean: pl.wind.screening.climMean, mw: pl.wind.mw, hubM: pl.wind.hubM, shear: pl.wind.shear, lossesPct: pl.wind.lossesPct, turbine: pl.wind.turbine });
      wind = { p50Mwh: r.netMwh, sigmaPct: SCREENING_SIGMA_PCT, source: "screening", cfPct: r.cfPct, meanHub: r.meanHub, meanAt50: r.meanAt50 };
    } else {
      wind = { p50Mwh: 0, sigmaPct: SCREENING_SIGMA_PCT, source: "none" };
    }
  }
  if (pl.solar) {
    const st = pl.solar.study;
    if (st && st.p50Mwh > 0) solar = { p50Mwh: st.p50Mwh, sigmaPct: sigmaFrom(st.p50Mwh, st.p90Mwh) ?? SIGMA_PCT, source: "study" };
    else solar = { p50Mwh: pl.solar.mwp * pl.solar.yieldKwhKwp, sigmaPct: SIGMA_PCT, source: pl.solar.yieldKwhKwp > 0 ? (pl.solar.yieldSource || "pvgis") : "none" };
  }
  return { wind, solar, p50Mwh: (wind ? wind.p50Mwh : 0) + (solar ? solar.p50Mwh : 0) };
}

/** Capex in EUR: each technology at its rate, the grid connection, then development as a share. */
export function plantCapex(pl) {
  const c = pl.costs;
  const hard = (pl.wind ? pl.wind.mw * 1000 * c.windEurPerKw : 0)
    + (pl.solar ? pl.solar.mwp * 1000 * c.solarEurPerKw : 0)
    + (pl.bess ? pl.bess.mwh * 1000 * c.bessEurPerKwh : 0)
    + c.gridEur;
  return { hard, dev: hard * (c.devPct / 100), total: hard * (1 + c.devPct / 100) };
}

/**
 * One plant as a project, in the shape lib/projectFinance.js evaluateProject
 * returns, so everything downstream reads it the same way.
 */
export function evaluatePlant(plant, E, fin, scenario, opts = {}) {
  const pl = plant && plant.costs && plant.revenue && plant.permits ? plant : normalizePlant(plant);
  const f = normalizeFinance(fin);
  const sc = normalizeScenario(scenario);
  const exceed = Z[opts.exceed] != null ? opts.exceed : "P50";
  const H = Math.max(1, Math.round(num(E?.horizon, 25)));
  const inflE = num(E?.bands?.expc?.infl, 2.5) / 100;
  const z = Z[exceed];

  const en = plantEnergy(pl);
  const windY = en.wind ? en.wind.p50Mwh * Math.max(0.05, 1 - (z * en.wind.sigmaPct) / 100) : 0;
  const solarY = en.solar ? en.solar.p50Mwh * Math.max(0.05, 1 - (z * en.solar.sigmaPct) / 100) : 0;
  const degr = pl.solar ? pl.solar.degrPctYr / 100 : 0;

  const cap = plantCapex(pl);
  const capex = cap.total * sc.capexMultiplier;
  const grantRaw = capex * (f.grantPct / 100);
  const grant = f.grantCapEur != null ? Math.min(grantRaw, f.grantCapEur) : grantRaw;
  const capexNet = Math.max(0, capex - grant);

  // energy delivered, MWh: sources at the chosen exceedance, solar ageing, curtailment
  const curtail = 1 - sc.curtailmentPct / 100;
  // the connection line's losses, once the user has applied a connection option (lib/gridOptions.js)
  const lineLoss = 1 - (pl.grid?.applied?.lossPct || 0) / 100;
  const energyMwh = Array.from({ length: H }, (_, i) => (windY + solarY * Math.pow(1 - degr, i)) * sc.yieldMultiplier * curtail * lineLoss);

  // revenue: the contract for its years, then the merchant assumption
  const r = pl.revenue;
  const dep = sc.localDepreciationPctYr / 100;
  const escRatio = sc.tariffEscalationPct == null ? 1 : (1 + sc.tariffEscalationPct / 100);
  const revenue = energyMwh.map((e, i) => {
    const y = i + 1;
    let price;
    if (r.kind !== "merchant" && y <= r.years && r.priceEurMwh > 0) {
      price = r.priceEurMwh * Math.pow(1 + r.indexPct / 100, y - 1);
      if (r.currency === "local") price *= Math.pow(1 - dep, y - 1);
    } else {
      // merchant: the stress cases' tariff and escalation overlays apply here
      const yearsMerchant = r.kind === "merchant" ? y - 1 : y - 1 - r.years;
      price = (r.kind === "merchant" ? r.priceEurMwh || r.afterEurMwh : r.afterEurMwh) * sc.tariffMultiplier * Math.pow(escRatio, Math.max(0, yearsMerchant));
    }
    // storage earns what its own contract pays, for that contract's years only
    const bess = pl.bess && y <= r.bessYears ? pl.bess.mw * r.bessEurPerMwYr : 0;
    return e * price + bess;
  });

  const c = pl.costs;
  const opex0 = (pl.wind ? pl.wind.mw * 1000 * c.opexWindEurPerKwYr : 0)
    + (pl.solar ? pl.solar.mwp * 1000 * c.opexSolarEurPerKwYr : 0)
    + (pl.bess ? pl.bess.mwh * 1000 * c.opexBessEurPerKwhYr : 0)
    + c.landEurYr + capex * (c.insurancePct / 100);
  const opex = Array.from({ length: H }, (_, i) => opex0 * sc.opexMultiplier * Math.pow(1 + inflE, i));

  // construction delay: operation starts later
  const shift = (arr) => {
    const s = sc.delayMonths / 12, whole = Math.floor(s), frac = s - whole;
    const at = (k) => (k >= 0 && k < arr.length ? arr[k] : 0);
    return arr.map((_, i) => (1 - frac) * at(i - whole) + frac * at(i - whole - 1));
  };
  const rev = shift(revenue);
  const energyOut = shift(energyMwh);
  const opexOut = shift(opex);
  const warRisk = Array.from({ length: H }, () => capex * (sc.warRiskPremiumPct / 100));
  const ebitda = rev.map((v, i) => v - opexOut[i] - warRisk[i]);

  // the loan, the tax, CFADS, the cover and the cash flows, as for a quote
  // (lib/projectFinance.js financeFlows)
  const isBase = exceed === "P50" && !opts.baseScenario;
  const m = financeFlows({
    ebitda, capexNet, fin: f, scenario: sc, H, baseScenario: opts.baseScenario,
    baseShape: f.repayment === "sculpted" && !isBase ? () => evaluatePlant(pl, E, f, opts.baseScenario || scenario, { exceed: "P50" }).shape : null,
  });
  // the cost of a MWh over the life, before grants and financing
  const dr = f.discPct / 100;
  const dEnergy = energyOut.reduce((acc, e, i) => acc + (e * 1000) / Math.pow(1 + dr, i + 1), 0);
  const dCost = capex + opexOut.reduce((acc, o, i) => acc + o / Math.pow(1 + dr, i + 1), 0)
    + warRisk.reduce((acc, o, i) => acc + o / Math.pow(1 + dr, i + 1), 0);

  return {
    exceed, years: H, kw: plantKw(pl),
    capexEur: capex, grantEur: grant, capexNetEur: capexNet, loanEur: m.loan, equityEur: m.equity, feeEur: m.fee,
    idcEur: m.idc, dsraEur: m.dsra.opening, reserveNet: m.dsra.net, reserveUnmet: m.dsra.unmet,
    shortfallEur: m.dsra.shortfallEur, shortfallYears: m.dsra.shortfallYears, reserveDrawnEur: m.dsra.drawnEur,
    energyKwh: energyOut.map((e) => e * 1000), revenue: rev, opex: opexOut, warRisk, ebitda, tax: m.tax, taxUnlevered: m.taxUnlevered,
    cfads: m.cfads, debtService: m.ds, debt: m.sched, shape: m.shape,
    projectCf: m.projectCf, equityCf: m.equityCf, dscr: m.dscr,
    npv: m.npv, irr: m.irr, equityIrr: m.equityIrr,
    dscrMin: m.dscrMin, dscrAvg: m.dscrAvg,
    paybackYears: m.payback,
    lcoe: dEnergy > 0 ? dCost / dEnergy : null,
    year1Kwh: (energyOut[0] || 0) * 1000,
    selfRatio: 0,
    plant: { energy: en, capex: cap },
  };
}

/** A portfolio asset of either kind, evaluated: a plant by its own model, a quote by the engine's. */
export function evaluateAsset(asset, E, fin, scenario, opts = {}) {
  return asset && asset.kind === "plant"
    ? evaluatePlant(asset.plant, E, fin, scenario, opts)
    : evaluateProject(asset.input, E, fin, scenario, opts);
}

/**
 * What has to be true for a lender: the lowest P50 debt cover over the loan's
 * years, and how far energy could fall, or capex rise, before that cover
 * reaches the target (bisection on the scenario's yield or capex multiplier,
 * everything else as it is). null when even a wide move does not reach it, or
 * when there is no debt.
 * @returns {{ dscrMin: number|null, energyHeadroomPct: number|null, capexHeadroomPct: number|null }}
 */
export function plantHeadroom(plant, E, fin, scenario, target = 1.3) {
  const sc = normalizeScenario(scenario);
  const base = evaluatePlant(plant, E, fin, sc);
  if (base.dscrMin == null) return { dscrMin: null, energyHeadroomPct: null, capexHeadroomPct: null };
  const solve = (key, lo, hi, falling) => {
    const at = (m) => evaluatePlant(plant, E, fin, { ...sc, [key]: sc[key] * m }).dscrMin;
    const fLo = at(lo), fHi = at(hi);
    if (fLo == null || fHi == null) return null;
    // the multiplier where cover equals the target; DSCR rises with yield, falls with capex
    if ((fLo - target) * (fHi - target) > 0) return null;
    let a = lo, b = hi;
    for (let i = 0; i < 40; i++) {
      const m = (a + b) / 2;
      const v = at(m);
      // rising with m (yield): above target means the root is lower; falling (capex): higher
      if ((v >= target) !== falling) b = m; else a = m;
    }
    return (a + b) / 2;
  };
  const yieldAt = solve("yieldMultiplier", 0.3, 1.5, false);
  const capexAt = solve("capexMultiplier", 0.3, 3, true);
  return {
    dscrMin: base.dscrMin,
    // + means room to spare (energy may fall by this much), - means it must rise
    energyHeadroomPct: yieldAt == null ? null : (1 - yieldAt) * 100,
    capexHeadroomPct: capexAt == null ? null : (capexAt - 1) * 100,
  };
}
