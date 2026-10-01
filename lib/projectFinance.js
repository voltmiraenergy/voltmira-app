// lib/projectFinance.js — what a lender asks of one project: debt service
// cover, equity return, and what happens to both when the world is worse than
// the base case. Pure; no I/O.
//
// It stands on the quote engine (engine/engine.js), not beside it: the yearly
// energy value comes from simulate(), so a quote, its proposal and this model
// can never disagree about the base case. Everything added here is an overlay
// on that value, one overlay per risk a lender asks about:
//
//   yield         P50 / P90 exceedance, and any further yield haircut
//   tariff        a shock to the price paid, and a different yearly escalation
//   curtailment   the share of exported energy the grid refuses
//   delay         construction finishes later; debt service starts on time
//   currency      the NET yearly loss of local-currency revenue against the EUR,
//                 after tariff indexation (tariffs in lei or hryvnia usually rise
//                 with local inflation, which offsets part of a depreciation)
//   war risk      an insurance premium on the insured value, every year
//   PPA           part of the output sold at a fixed EUR price for N years
//
// DEBT is modelled explicitly: a year-by-year amortisation, a stepped rate
// (0% / 5% / 7% programmes), a grant on the capex, and a one-off principal
// compensation, because the Ukrainian and Moldovan support schemes are built
// from exactly these parts. Defaults are editable assumptions, never facts:
// the programmes' terms change, and callers must label them so.
//
// Simplifications, all on the cautious side or stated: annual periods; debt
// service starts in year 1 whatever the delay; the grant arrives at t0; the
// principal compensation lands at the end of year 1; tax is not modelled
// (CFADS is before tax).
import { simulate } from "@voltmira/engine";

// The yield uncertainty budget Studio's P50/P90 export uses (root-sum-square of
// resource, variability, model, soiling, availability, shading and LID).
export const SIGMA_PCT = 7.1;
export const Z = { P50: 0, P75: 0.6745, P90: 1.2816, P95: 1.6449 };

export const DEFAULT_FINANCE = {
  gearingPct: 70,
  ratePct: 8,
  // Programme rate by year, then ratePct after: [0, 5, 7] = 0% in year 1, 5% in
  // year 2, 7% in year 3. null = flat ratePct.
  rateSteps: null,
  tenorYears: 10,
  discPct: 8,
  // "local": the loan is in the project's own currency, so depreciation also
  // shrinks the debt service measured in EUR. "EUR": it does not.
  debtCurrency: "EUR",
  // A non-repayable grant: this % of the capex, at most grantCapEur.
  grantPct: 0,
  grantCapEur: null,
  // The state repays this % of the loan to the bank once, after year 1.
  principalCompensationPct: 0,
};

export const BASE_SCENARIO = {
  yieldMultiplier: 1,
  tariffMultiplier: 1,
  // null = keep the engine's own escalation (expected band, 3%/yr)
  tariffEscalationPct: null,
  curtailmentPct: 0,
  delayMonths: 0,
  localDepreciationPctYr: 0,
  warRiskPremiumPct: 0,
  capexMultiplier: 1,
  opexMultiplier: 1,
  // { sharePct, priceEurMwh, years, escalationPct, currency: "EUR" | "local" }
  ppa: null,
};

const num = (v, d = 0) => (Number.isFinite(Number(v)) ? Number(v) : d);
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

/** Fill a partial finance / scenario object with the defaults, clamped to sane ranges. */
export function normalizeFinance(f) {
  const x = { ...DEFAULT_FINANCE, ...(f || {}) };
  return {
    gearingPct: clamp(num(x.gearingPct, 70), 0, 95),
    ratePct: clamp(num(x.ratePct, 8), 0, 40),
    rateSteps: Array.isArray(x.rateSteps) && x.rateSteps.length
      ? x.rateSteps.map((r) => clamp(num(r), 0, 40)) : null,
    tenorYears: Math.round(clamp(num(x.tenorYears, 10), 1, 25)),
    discPct: clamp(num(x.discPct, 8), 0, 40),
    debtCurrency: x.debtCurrency === "local" ? "local" : "EUR",
    grantPct: clamp(num(x.grantPct), 0, 100),
    grantCapEur: Number(x.grantCapEur) > 0 ? Number(x.grantCapEur) : null,
    principalCompensationPct: clamp(num(x.principalCompensationPct), 0, 100),
  };
}

export function normalizeScenario(s) {
  const x = { ...BASE_SCENARIO, ...(s || {}) };
  const ppa = x.ppa && num(x.ppa.sharePct) > 0 && num(x.ppa.priceEurMwh) > 0 && num(x.ppa.years) > 0
    ? {
      sharePct: clamp(num(x.ppa.sharePct), 0, 100),
      priceEurMwh: Math.max(0, num(x.ppa.priceEurMwh)),
      years: Math.round(clamp(num(x.ppa.years), 1, 25)),
      escalationPct: clamp(num(x.ppa.escalationPct), -10, 20),
      currency: x.ppa.currency === "local" ? "local" : "EUR",
    } : null;
  return {
    yieldMultiplier: clamp(num(x.yieldMultiplier, 1), 0.3, 1.5),
    tariffMultiplier: clamp(num(x.tariffMultiplier, 1), 0, 3),
    tariffEscalationPct: x.tariffEscalationPct == null || x.tariffEscalationPct === ""
      ? null : clamp(num(x.tariffEscalationPct), -10, 25),
    curtailmentPct: clamp(num(x.curtailmentPct), 0, 100),
    delayMonths: clamp(num(x.delayMonths), 0, 60),
    localDepreciationPctYr: clamp(num(x.localDepreciationPctYr), -20, 60),
    warRiskPremiumPct: clamp(num(x.warRiskPremiumPct), 0, 20),
    capexMultiplier: clamp(num(x.capexMultiplier, 1), 0.3, 3),
    opexMultiplier: clamp(num(x.opexMultiplier, 1), 0, 5),
    ppa,
  };
}

/** IRR by bisection; null when the cash flow never changes sign in [-90%, +150%]. */
export function irrOf(cf) {
  const npvAt = (r) => cf.reduce((s, c, n) => s + c / Math.pow(1 + r, n), 0);
  let lo = -0.9, hi = 1.5;
  let fLo = npvAt(lo);
  const fHi = npvAt(hi);
  if (!Number.isFinite(fLo) || !Number.isFinite(fHi) || fLo * fHi > 0) return null;
  for (let i = 0; i < 120; i++) {
    const mid = (lo + hi) / 2, fMid = npvAt(mid);
    if (Math.abs(fMid) < 1e-6) return mid;
    if (fLo * fMid < 0) hi = mid; else { lo = mid; fLo = fMid; }
  }
  return (lo + hi) / 2;
}

/** Year-by-year debt: stepped rate, re-amortised each year, with a one-off compensation. */
export function debtSchedule(loan, fin, years) {
  const f = normalizeFinance(fin);
  const out = [];
  let bal = Math.max(0, num(loan));
  const comp = bal * (f.principalCompensationPct / 100);
  for (let y = 1; y <= years; y++) {
    if (y > f.tenorYears || bal <= 1e-9) { out.push({ y, payment: 0, interest: 0, principal: 0, compensation: 0, balance: 0 }); bal = 0; continue; }
    const r = (f.rateSteps && f.rateSteps[y - 1] != null ? f.rateSteps[y - 1] : f.ratePct) / 100;
    const left = f.tenorYears - y + 1;
    const payment = r === 0 ? bal / left : (bal * r) / (1 - Math.pow(1 + r, -left));
    const interest = bal * r;
    const principal = payment - interest;
    bal = Math.max(0, bal - principal);
    let compensation = 0;
    if (y === 1 && comp > 0) { compensation = Math.min(comp, bal); bal -= compensation; }
    out.push({ y, payment, interest, principal, compensation, balance: bal });
  }
  return out;
}

/**
 * One project, one scenario, one exceedance level.
 *
 * @param {object} input   a quote input (lib/quoteInput.js rowToQuoteInput) or any simulate() input
 * @param {object} E       engine settings
 * @param {object} [fin]   finance assumptions (DEFAULT_FINANCE shape)
 * @param {object} [scenario]  overlays (BASE_SCENARIO shape)
 * @param {{exceed?: "P50"|"P75"|"P90"|"P95"}} [opts]
 */
export function evaluateProject(input, E, fin, scenario, opts = {}) {
  const f = normalizeFinance(fin);
  const sc = normalizeScenario(scenario);
  const exceed = Z[opts.exceed] != null ? opts.exceed : "P50";
  const H = Math.max(1, Math.round(num(E.horizon, 25)));
  const band = E.bands.expc;

  const baseYield = Number(input.yieldOverride) || Number(E.baseYield) || 1100;
  const yieldMul = Math.max(0.05, (1 - (Z[exceed] * SIGMA_PCT) / 100) * sc.yieldMultiplier);
  const sim = simulate({ ...input, yieldOverride: baseYield * yieldMul, costOverride: num(input.costOverride) }, E, "expc");

  // capex, grant, debt, equity
  const capex = sim.grossCost * sc.capexMultiplier;
  const grantRaw = capex * (f.grantPct / 100);
  const grant = f.grantCapEur != null ? Math.min(grantRaw, f.grantCapEur) : grantRaw;
  const capexNet = Math.max(0, capex - grant);
  const loan = capexNet * (f.gearingPct / 100);
  const equity = capexNet - loan;

  // The engine's own yearly net, with its own O&M added back, is the energy value.
  const inflE = band.infl / 100;
  const opex0 = sim.grossCost * (num(E.opexPct, 0.5) / 100);
  const value = [], energy = [];
  let prev = -sim.cost;
  for (let y = 1; y <= H; y++) {
    const net = sim.rows[y - 1] - prev; prev = sim.rows[y - 1];
    value.push(net + opex0 * Math.pow(1 + inflE, y - 1));
    energy.push(sim.solar0 * Math.pow(1 - band.degr / 100, y - 1));
  }

  // overlays on the value, year by year
  const exportShare = clamp(1 - num(sim.self), 0, 1);
  const curtailFactor = 1 - (sc.curtailmentPct / 100) * exportShare;
  const dep = sc.localDepreciationPctYr / 100;
  const escRatio = sc.tariffEscalationPct == null ? 1 : (1 + sc.tariffEscalationPct / 100) / (1 + inflE);
  const valueAdj = value.map((v, i) => {
    const y = i + 1;
    let x = v * sc.tariffMultiplier * Math.pow(escRatio, y - 1);
    x *= Math.pow(1 - dep, y - 1);                       // revenue is in local currency
    return x;
  });

  // part of the output under a fixed-price PPA
  let revenue = valueAdj.map((v) => v);
  if (sc.ppa) {
    const share = sc.ppa.sharePct / 100;
    revenue = valueAdj.map((v, i) => {
      const y = i + 1;
      if (y > sc.ppa.years) return v;
      const ppa = share * (energy[i] / 1000) * sc.ppa.priceEurMwh * Math.pow(1 + sc.ppa.escalationPct / 100, y - 1)
        * (sc.ppa.currency === "local" ? Math.pow(1 - dep, y - 1) : 1) * sc.tariffMultiplier;
      return (1 - share) * v + ppa;
    });
  }
  revenue = revenue.map((v) => v * curtailFactor);
  const delivered = energy.map((e) => e * curtailFactor);

  // construction delay: operation (energy, revenue and O&M) starts later
  const shift = (arr) => {
    const s = sc.delayMonths / 12, whole = Math.floor(s), frac = s - whole;
    const at = (k) => (k >= 0 && k < arr.length ? arr[k] : 0);
    return arr.map((_, i) => (1 - frac) * at(i - whole) + frac * at(i - whole - 1));
  };
  const rev = shift(revenue);
  const energyOut = shift(delivered);
  const opex = Array.from({ length: H }, (_, i) => opex0 * sc.opexMultiplier * Math.pow(1 + inflE, i));
  const opexOut = shift(opex);
  const warRisk = Array.from({ length: H }, () => capex * (sc.warRiskPremiumPct / 100));
  const cfads = rev.map((r, i) => r - opexOut[i] - warRisk[i]);

  // debt service, in EUR terms
  const sched = debtSchedule(loan, f, H);
  const ds = sched.map((d, i) => d.payment * (f.debtCurrency === "local" ? Math.pow(1 - dep, i) : 1));

  const dscr = ds.map((d, i) => (d > 1e-9 ? cfads[i] / d : null));
  const live = dscr.filter((v) => v != null);
  const projectCf = [-capexNet, ...cfads];
  const equityCf = [-equity, ...cfads.map((c, i) => c - ds[i])];
  const dr = f.discPct / 100;
  const npv = projectCf.reduce((s, c, n) => s + c / Math.pow(1 + dr, n), 0);

  let cum = -capexNet, payback = null;
  for (let i = 0; i < H; i++) {
    const before = cum; cum += cfads[i];
    if (payback == null && cum >= 0) payback = i + (before === cum ? 0 : (0 - before) / (cum - before));
  }
  const dEnergy = energyOut.reduce((s, e, i) => s + e / Math.pow(1 + dr, i + 1), 0);
  const dCost = capexNet + opexOut.reduce((s, o, i) => s + o / Math.pow(1 + dr, i + 1), 0)
    + warRisk.reduce((s, o, i) => s + o / Math.pow(1 + dr, i + 1), 0);

  return {
    exceed, years: H, kw: Math.max(0, num(input.kw)),
    capexEur: capex, grantEur: grant, capexNetEur: capexNet, loanEur: loan, equityEur: equity,
    energyKwh: energyOut, revenue: rev, opex: opexOut, warRisk, cfads, debtService: ds, debt: sched,
    projectCf, equityCf, dscr,
    npv, irr: irrOf(projectCf), equityIrr: equity > 1e-6 ? irrOf(equityCf) : null,
    dscrMin: live.length ? Math.min(...live) : null,
    dscrAvg: live.length ? live.reduce((a, b) => a + b, 0) / live.length : null,
    paybackYears: payback,
    lcoe: dEnergy > 0 ? dCost / dEnergy : null,
    year1Kwh: energyOut[0] || 0,
    selfRatio: num(sim.self),
  };
}

// What each market's stress cases use. ILLUSTRATIVE: round numbers chosen to
// show how much headroom there is, not forecasts. The UI labels them as such and
// lets the user replace every one.
export const STRESS_DEFAULTS = {
  MD: { curtailmentPct: 3, localDepreciationPctYr: 2, tariffDropPct: 20, delayMonths: 6, warRiskPremiumPct: 0, escalationPct: 0 },
  UA: { curtailmentPct: 10, localDepreciationPctYr: 4, tariffDropPct: 20, delayMonths: 6, warRiskPremiumPct: 1, escalationPct: 0 },
};

/** The standard downside cases, each layered on the base scenario. */
export function stressCases(market, base) {
  const d = STRESS_DEFAULTS[market] || STRESS_DEFAULTS.MD;
  const b = normalizeScenario(base);
  const cases = [
    { id: "base", exceed: "P50", scenario: b },
    { id: "p90", exceed: "P90", scenario: b },
    { id: "tariff", exceed: "P50", scenario: { ...b, tariffMultiplier: b.tariffMultiplier * (1 - d.tariffDropPct / 100) } },
    { id: "escalation", exceed: "P50", scenario: { ...b, tariffEscalationPct: d.escalationPct } },
    { id: "curtailment", exceed: "P50", scenario: { ...b, curtailmentPct: Math.max(b.curtailmentPct, d.curtailmentPct) } },
    { id: "delay", exceed: "P50", scenario: { ...b, delayMonths: Math.max(b.delayMonths, d.delayMonths) } },
    { id: "currency", exceed: "P50", scenario: { ...b, localDepreciationPctYr: Math.max(b.localDepreciationPctYr, d.localDepreciationPctYr) } },
    { id: "capex", exceed: "P50", scenario: { ...b, capexMultiplier: b.capexMultiplier * 1.15 } },
  ];
  if (d.warRiskPremiumPct > 0) {
    cases.push({ id: "war", exceed: "P50", scenario: { ...b, warRiskPremiumPct: Math.max(b.warRiskPremiumPct, d.warRiskPremiumPct) } });
  }
  cases.push({
    id: "combined", exceed: "P90",
    scenario: {
      ...b,
      tariffMultiplier: b.tariffMultiplier * (1 - d.tariffDropPct / 200),
      curtailmentPct: Math.max(b.curtailmentPct, d.curtailmentPct),
      delayMonths: Math.max(b.delayMonths, d.delayMonths),
      localDepreciationPctYr: Math.max(b.localDepreciationPctYr, d.localDepreciationPctYr),
      warRiskPremiumPct: Math.max(b.warRiskPremiumPct, d.warRiskPremiumPct),
    },
  });
  return cases;
}
