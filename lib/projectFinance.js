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
// CONSTRUCTION AND RESERVES, as a lender's term sheet sets them (all off by
// default, so a quote or a portfolio without them runs exactly as before):
//   construction  the months from financial close to commissioning. The loan
//                 is drawn evenly over them and its interest is added to the
//                 loan (interest during construction, IDC); the debt share
//                 applies to the cost after grant plus that interest.
//   grace         whole years after commissioning in which only interest is
//                 paid; the principal is then repaid over the rest of the term.
//   reserve       a debt service reserve account (DSRA): the sponsor funds
//                 this many months of the next year's service at
//                 commissioning; a year whose cash flow falls short draws on
//                 it, later surpluses refill it, and it is released as the
//                 service falls and when the loan is repaid. A shortfall the
//                 reserve cannot cover is paid by the sponsor in the model and
//                 reported, because a lender would call it a default.
//
// TAX. The corporate income tax (taxPct; the portfolio sets the market's rate:
// Moldova 12%, Ukraine 18%) is paid on revenue less operating costs, less a
// straight-line depreciation of the cost after grant (plus the interest during
// construction) over taxLifeYears, less the loan's interest; a loss is carried
// forward against later profits, oldest first, for taxLossYears (Moldova 5,
// Tax Code art. 32; Ukraine without a limit, art. 140.4; 0 = no limit), then it
// lapses. CFADS is after this tax. The project's own
// IRR and NPV use the tax the project would pay without the loan (no interest
// deducted, no interest during construction), as an unlevered return should.
//
// Simplifications, all on the cautious side or stated: annual periods, with
// Year 0 the date of commissioning: the spending during construction is placed
// there (its financing cost is the interest during construction, added to the
// loan), so the IRRs leave out the time value of the construction months;
// debt service starts in year 1 whatever the delay; the grant arrives at t0;
// the principal compensation lands at the end of year 1; tax losses are carried
// forward for taxLossYears (Moldova 5, Ukraine no limit) and interest is deducted in full.
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
  // The lender's arrangement fee, % of the loan, paid by the sponsor at
  // financial close. A financing cost: it lowers the equity return, not the
  // project's own (unlevered) IRR or NPV.
  feePct: 0,
  // "annuity": equal yearly payments (a flat debt service line).
  // "sculpted": each year's payment follows that year's cash flow, as lenders
  // to wind and solar plants usually set it, so the cover is the same in every
  // repayment year. The shape is fixed on the base case (P50, the portfolio's
  // own scenario), the way a bank fixes it at financial close: a P90 year or a
  // stress case does not reshape the loan.
  repayment: "annuity",
  // Months from financial close to commissioning; the interest on the loan
  // drawn over them is added to the loan. 0 = built at once (no IDC).
  constructionMonths: 0,
  // Whole years after commissioning paying interest only, inside the term.
  graceYears: 0,
  // The debt service reserve: months of the next year's service the sponsor
  // sets aside at commissioning. 0 = none.
  dsraMonths: 0,
  // Corporate income tax, %, and the years over which the cost is depreciated
  // for tax, straight-line. 0 = no tax (a portfolio sets its market's rate).
  taxPct: 0,
  taxLifeYears: 20,
  // The years a tax loss can be carried forward before it lapses. 0 = no limit.
  taxLossYears: 0,
};

/** The corporate income tax rate a portfolio takes when none is set: Moldova's Tax Code art. 15 (12%), Ukraine's Tax Code art. 136 (18%). */
export const TAX_DEFAULT_PCT = { MD: 12, UA: 18 };
/** The years a tax loss carries forward: Moldova's Tax Code art. 32 (the next 5 fiscal years, then it lapses); Ukraine's art. 140.4 sets no limit (0). */
export const TAX_LOSS_YEARS = { MD: 5, UA: 0 };

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
    feePct: clamp(num(x.feePct), 0, 10),
    repayment: x.repayment === "sculpted" ? "sculpted" : "annuity",
    constructionMonths: Math.round(clamp(num(x.constructionMonths), 0, 48)),
    // at least one year of repayment is left after the grace
    graceYears: Math.round(clamp(num(x.graceYears), 0, Math.min(5, Math.round(clamp(num(x.tenorYears, 10), 1, 25)) - 1))),
    dsraMonths: clamp(num(x.dsraMonths), 0, 12),
    taxPct: clamp(num(x.taxPct), 0, 40),
    taxLifeYears: Math.round(clamp(num(x.taxLifeYears, 20), 1, 40)),
    taxLossYears: Math.round(clamp(num(x.taxLossYears), 0, 40)),
  };
}

/** Finance terms with the market's tax rate and loss carry-forward when the portfolio has not set them. */
export function withTaxDefault(finance, market) {
  const f = finance && typeof finance === "object" ? finance : {};
  const unset = (v) => v == null || v === "";
  return {
    ...f,
    ...(unset(f.taxPct) ? { taxPct: TAX_DEFAULT_PCT[market] ?? 0 } : {}),
    ...(unset(f.taxLossYears) ? { taxLossYears: TAX_LOSS_YEARS[market] ?? 0 } : {}),
  };
}

/**
 * The money side of one asset, the same for a quote and a plant: the loan and
 * its interest during construction, the debt schedule (level or sculpted),
 * the corporate income tax, CFADS after tax, the cover, the reserve account,
 * and the project's and the sponsor's cash flows.
 * @param {object} a
 * @param {number[]} a.ebitda     revenue less operating costs and insurance, each year, EUR
 * @param {number} a.capexNet     the cost after grant
 * @param {object} a.fin, a.scenario
 * @param {number} a.H            years
 * @param {object} [a.baseScenario]  the portfolio's own scenario, when this run is a stress case
 * @param {() => number[]} [a.baseShape]  a sculpted loan in a case other than the base: the shape the base case fixed
 */
export function financeFlows({ ebitda, capexNet, fin, scenario, H, baseScenario = null, baseShape = null }) {
  const f = normalizeFinance(fin);
  const sc = normalizeScenario(scenario);
  const { loan, idc, equity, fee } = fundingAt(capexNet, f);
  const dep = sc.localDepreciationPctYr / 100;
  const fxAt = (i) => (f.debtCurrency === "local" ? Math.pow(1 - dep, i) : 1);
  const rate = f.taxPct / 100;
  const life = f.taxLifeYears;
  const depreciation = (base) => Array.from({ length: H }, (_, i) => (i < life ? base / life : 0));
  const depLevered = depreciation(capexNet + idc), depUnlevered = depreciation(capexNet);
  // tax on the year's profit after depreciation and interest; each year's loss
  // is used against later profits, oldest first, until it lapses
  const lapse = f.taxLossYears;
  const taxOn = (interest, depn) => {
    const losses = [];                          // { year, left }
    return ebitda.map((e, i) => {
      if (!(rate > 0)) return 0;
      const profit = e - depn[i] - (interest ? interest[i] : 0);
      if (profit <= 0) { if (profit < 0) losses.push({ year: i, left: -profit }); return 0; }
      let taxable = profit;
      for (const l of losses) {
        if (taxable <= 0) break;
        if (lapse > 0 && i - l.year > lapse) continue;
        const used = Math.min(l.left, taxable);
        l.left -= used;
        taxable -= used;
      }
      return taxable * rate;
    });
  };
  // a loan in lei is shaped in lei: the base case's expected drift is put back
  const inLoanCurrency = (shape) => {
    if (!shape || f.debtCurrency !== "local") return shape;
    const dep0 = normalizeScenario(baseScenario || scenario).localDepreciationPctYr / 100;
    return shape.map((v, i) => v / Math.pow(1 - dep0, i));
  };
  const run = (shape) => {
    const sched = debtSchedule(loan, f, H, inLoanCurrency(shape));
    const tax = taxOn(sched.map((d, i) => d.interest * fxAt(i)), depLevered);
    return { sched, tax, cfads: ebitda.map((e, i) => e - tax[i]) };
  };
  let out, shape = null;
  if (f.repayment === "sculpted") {
    if (baseShape) {
      shape = baseShape();
      out = run(shape);
    } else {
      // the base case: the shape is its own CFADS after tax, which the loan's
      // interest moves a little; a few rounds settle it
      shape = ebitda.slice();
      for (let k = 0; k < 8; k++) {
        out = run(shape);
        const moved = out.cfads.reduce((m, v, i) => Math.max(m, Math.abs(v - shape[i])), 0);
        if (moved < 1e-6 || k === 7) break;   // the shape returned is the one this run used
        shape = out.cfads;
      }
    }
  } else {
    out = run(null);
  }
  const ds = serviceInEur(out.sched, f, sc);
  const cfads = out.cfads;
  const dscr = ds.map((d, i) => (d > 1e-9 ? cfads[i] / d : null));
  const live = dscr.filter((v) => v != null);
  // the average is over the years that repay principal: an interest-only
  // year's high cover would flatter it (the minimum still counts every year)
  const repaying = dscr.filter((v, i) => v != null && out.sched[i].principal > 1e-9);
  const avgOver = repaying.length ? repaying : live;
  // the project's own cash flow: after the tax it would pay without the loan
  const taxUnlevered = taxOn(null, depUnlevered);
  const projectCf = [-capexNet, ...ebitda.map((e, i) => e - taxUnlevered[i])];
  // the sponsor pays its equity, the arrangement fee and the reserve; the
  // reserve's draws, top-ups and releases then move what it receives
  const dsra = reserveAccount(cfads, ds, f);
  const equityCf = [-(equity + fee + dsra.opening), ...cfads.map((c, i) => c - ds[i] + dsra.net[i])];
  const dr = f.discPct / 100;
  const npv = projectCf.reduce((acc, c, n) => acc + c / Math.pow(1 + dr, n), 0);
  let cum = projectCf[0], payback = null;
  for (let i = 0; i < H; i++) {
    const before = cum; cum += projectCf[i + 1];
    if (payback == null && cum >= 0) payback = i + (before === cum ? 0 : (0 - before) / (cum - before));
  }
  return {
    loan, idc, equity, fee, sched: out.sched, ds, cfads, tax: out.tax, taxUnlevered, dscr, projectCf, equityCf, dsra, npv,
    irr: irrOf(projectCf), equityIrr: equity + fee + dsra.opening > 1e-6 ? irrOf(equityCf) : null,
    dscrMin: live.length ? Math.min(...live) : null,
    dscrAvg: avgOver.length ? avgOver.reduce((a, b) => a + b, 0) / avgOver.length : null,
    payback, shape,
  };
}

/**
 * The interest during construction on 1 EUR of debt at commissioning: the loan
 * is drawn evenly, so on average half of it is out for the construction months,
 * at the first year's rate: k = rate x months / 24. 0 without a construction
 * period.
 */
export function idcFactor(fin) {
  const f = normalizeFinance(fin);
  const r = (f.rateSteps && f.rateSteps[0] != null ? f.rateSteps[0] : f.ratePct) / 100;
  return (r * f.constructionMonths) / 24;
}

/**
 * The money at commissioning: the debt is the debt share of the whole cost
 * after grant, the interest during construction included, and that interest
 * is itself part of the loan:
 *   loan = g x (cost + IDC),  IDC = k x loan   =>   loan = g x cost / (1 - g x k)
 * @returns {{ loan: number, idc: number, equity: number, fee: number }}
 */
export function fundingAt(capexNet, fin) {
  const f = normalizeFinance(fin);
  const g = f.gearingPct / 100, k = idcFactor(f);
  const cost = Math.max(0, num(capexNet));
  const loan = g > 0 ? (g * cost) / Math.max(0.05, 1 - g * k) : 0;
  const idc = loan * k;
  return { loan, idc, equity: cost + idc - loan, fee: loan * (f.feePct / 100) };
}

/** The most a lender's debt-share cap allows, on the same definition: g x (cost + IDC). */
export function loanAtShare(capexNet, sharePct, fin) {
  const g = Math.max(0, num(sharePct)) / 100, k = idcFactor(fin);
  return g > 0 ? (g * Math.max(0, num(capexNet))) / Math.max(0.05, 1 - g * k) : 0;
}

/** The debt share a loan of this size is (the inverse of loanAtShare), in %. */
export function shareOfLoan(loanEur, capexNet, fin) {
  const L = Math.max(0, num(loanEur)), C = Math.max(0, num(capexNet));
  const total = C + L * idcFactor(fin);
  return total > 0 ? (L / total) * 100 : null;
}

/**
 * The debt service reserve account, year by year, and what it leaves the
 * sponsor. Funded at commissioning with `months` of the first year's service;
 * each year a shortfall (CFADS below the service) is drawn from it, a surplus
 * first refills it to `months` of the next year's service, and anything above
 * that target is released. A shortfall it cannot cover is "unmet": the model
 * has the sponsor pay it.
 * @param {number[]} cfads
 * @param {number[]} ds      debt service, EUR, same years
 * @returns {{ opening: number, net: number[], drawn: number[], unmet: number[], balance: number[], shortfallEur: number, shortfallYears: number[], drawnEur: number }}
 */
export function reserveAccount(cfads, ds, fin) {
  const m = normalizeFinance(fin).dsraMonths / 12;
  const n = cfads.length;
  const target = (i) => m * Math.max(0, num(ds[i]));
  let bal = target(0);
  const opening = bal;
  const net = [], drawn = [], unmet = [], balance = [];
  for (let i = 0; i < n; i++) {
    const avail = num(cfads[i]) - num(ds[i]);
    let draw = 0, short = 0;
    if (avail < 0) { draw = Math.min(bal, -avail); bal -= draw; short = -avail - draw; }
    // the sponsor gets the surplus, or pays the shortfall the reserve could not cover
    let toSponsor = avail < 0 ? -short : avail;
    const want = target(i + 1);
    if (bal < want && toSponsor > 0) { const top = Math.min(toSponsor, want - bal); bal += top; toSponsor -= top; }
    if (bal > want) { toSponsor += bal - want; bal = want; }
    // the reserve's effect this year: what the sponsor gets, against CFADS less service
    net.push(toSponsor - avail); drawn.push(draw); unmet.push(short); balance.push(bal);
  }
  const shortfallYears = unmet.map((u, i) => (u > 1e-6 ? i + 1 : null)).filter(Boolean);
  return { opening, net, drawn, unmet, balance, shortfallEur: unmet.reduce((a, b) => a + b, 0), shortfallYears, drawnEur: drawn.reduce((a, b) => a + b, 0) };
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

/**
 * Year-by-year debt: stepped rate, re-amortised each year, with a one-off
 * compensation, and interest only in the grace years after commissioning.
 */
export function debtSchedule(loan, fin, years, shape = null) {
  const f = normalizeFinance(fin);
  const grace = f.graceYears;
  // sculpted: payments in proportion to the shape (the base-case CFADS) over the repayment years
  const sculpt = f.repayment === "sculpted" && Array.isArray(shape) && shape.slice(grace, f.tenorYears).some((v) => num(v) > 0);
  const rateAt = (y) => (f.rateSteps && f.rateSteps[y - 1] != null ? f.rateSteps[y - 1] : f.ratePct) / 100;
  const out = [];
  let bal = Math.max(0, num(loan));
  const comp = bal * (f.principalCompensationPct / 100);
  for (let y = 1; y <= years; y++) {
    if (y > f.tenorYears || bal <= 1e-9) { out.push({ y, payment: 0, interest: 0, principal: 0, compensation: 0, balance: 0 }); bal = 0; continue; }
    const r = rateAt(y);
    const left = f.tenorYears - y + 1;
    let payment;
    if (y <= grace) {
      // grace: interest only, the balance is untouched
      payment = bal * r;
    } else if (sculpt) {
      // the balance spread over the years left in proportion to the shape:
      // payment = balance x w_y / sum of w_t discounted from this year
      let pv = 0, df = 1;
      for (let t = y; t <= f.tenorYears; t++) { df /= 1 + rateAt(t); pv += Math.max(0, num(shape[t - 1])) * df; }
      payment = pv > 0 ? (bal * Math.max(0, num(shape[y - 1]))) / pv : (r === 0 ? bal / left : (bal * r) / (1 - Math.pow(1 + r, -left)));
    } else {
      payment = r === 0 ? bal / left : (bal * r) / (1 - Math.pow(1 + r, -left));
    }
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
 * The yearly debt service in EUR of a schedule: a loan in the local currency
 * costs fewer EUR as that currency loses value. evaluateProject and the debt
 * sizing (lib/debtSizing.js) both read it, so they cannot disagree.
 */
export function serviceInEur(sched, fin, scenario) {
  const f = normalizeFinance(fin);
  const dep = normalizeScenario(scenario).localDepreciationPctYr / 100;
  return sched.map((d, i) => d.payment * (f.debtCurrency === "local" ? Math.pow(1 - dep, i) : 1));
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
  const ebitda = rev.map((r, i) => r - opexOut[i] - warRisk[i]);

  // the loan, the tax, CFADS, the cover and the cash flows (financeFlows); a
  // sculpted loan in a stress case keeps the shape the base case fixed
  const isBase = exceed === "P50" && !opts.baseScenario;
  const m = financeFlows({
    ebitda, capexNet, fin: f, scenario: sc, H, baseScenario: opts.baseScenario,
    baseShape: f.repayment === "sculpted" && !isBase ? () => evaluateProject(input, E, f, opts.baseScenario || scenario, { exceed: "P50" }).shape : null,
  });
  // the cost of a kWh over the life, before grants and financing
  const dr = f.discPct / 100;
  const dEnergy = energyOut.reduce((acc, e, i) => acc + e / Math.pow(1 + dr, i + 1), 0);
  const dCost = capex + opexOut.reduce((acc, o, i) => acc + o / Math.pow(1 + dr, i + 1), 0)
    + warRisk.reduce((acc, o, i) => acc + o / Math.pow(1 + dr, i + 1), 0);

  return {
    exceed, years: H, kw: Math.max(0, num(input.kw)),
    capexEur: capex, grantEur: grant, capexNetEur: capexNet, loanEur: m.loan, equityEur: m.equity, feeEur: m.fee,
    idcEur: m.idc, dsraEur: m.dsra.opening, reserveNet: m.dsra.net, reserveUnmet: m.dsra.unmet,
    shortfallEur: m.dsra.shortfallEur, shortfallYears: m.dsra.shortfallYears, reserveDrawnEur: m.dsra.drawnEur,
    energyKwh: energyOut, revenue: rev, opex: opexOut, warRisk, ebitda, tax: m.tax, taxUnlevered: m.taxUnlevered,
    cfads: m.cfads, debtService: m.ds, debt: m.sched, shape: m.shape,
    projectCf: m.projectCf, equityCf: m.equityCf, dscr: m.dscr,
    npv: m.npv, irr: m.irr, equityIrr: m.equityIrr,
    dscrMin: m.dscrMin, dscrAvg: m.dscrAvg,
    paybackYears: m.payback,
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
