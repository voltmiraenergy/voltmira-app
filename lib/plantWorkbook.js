// lib/plantWorkbook.js — one plant as a LIVE spreadsheet model, for the
// portfolio workbook (lib/portfolioExport.js buildWorkbook):
//
//   "P1 Inputs"  every assumption, typed in (and a few lines worked out from
//                them by formula: capex, the loan, the interest during
//                construction, the first-year opex)
//   "P1 Model"   year by year, ONLY formulas on the inputs: energy at the
//                chosen exceedance, price by phase, revenue, opex, insurance,
//                replacements, EBITDA, the loan (grace, annuity or sculpted,
//                stepped rates, compensation), depreciation, tax, CFADS,
//                DSCR, the reserve account, the project's and the sponsor's
//                cash flows, and the results (NPV, IRR, DSCR, LLCR)
//   "P1 Tax"     the tax losses carried forward, oldest first, each lapsing
//                after the market's limit, with the loan and without it
//
// Change an input and everything recalculates. The same formulas are
// mirrored here in JavaScript for each cell's cached value (what a viewer that
// does not recalculate shows), and the Checks rows compare the model's results
// with the app's own (lib/plantFinance.js evaluatePlant): a lender can see the
// spreadsheet and the app agree, to the euro. Pure; no I/O.
import { colName } from "./xlsx.js";
import { normalizePlant, plantEnergy } from "./plantFinance.js";
import { normalizeFinance, normalizeScenario, Z } from "./projectFinance.js";

const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);

/**
 * @param {object} a
 * @param {object} a.asset     a model asset of kind "plant" ({ plant, name })
 * @param {object} a.result    its evaluatePlant() result, P50, base scenario
 * @param {object} a.fin, a.scenario, a.E
 * @param {number} a.idx       1-based, names the sheets "P1 ..."
 * @returns {{ sheets: object[], checks: Array<Array<any>>, names: { inputs: string, model: string, tax: string } }}
 */
export function plantModelSheets({ asset, result, fin, scenario, E, idx = 1 }) {
  const pl = normalizePlant(asset.plant);
  const f = normalizeFinance(fin);
  const sc = normalizeScenario(scenario);
  const H = Math.max(1, Math.round(num(E?.horizon) || 25));
  const infl = num(E?.bands?.expc?.infl ?? 2.5);
  const en = plantEnergy(pl);
  const names = { inputs: `P${idx} Inputs`, model: `P${idx} Model`, tax: `P${idx} Tax` };
  const IN = `'${names.inputs}'!`, TX = `'${names.tax}'!`;

  // ---------------------------------------------------------------- inputs
  const r = pl.revenue, c = pl.costs;
  const merchantBase = r.kind === "merchant" ? (r.priceEurMwh || r.afterEurMwh) : r.afterEurMwh;
  const steps = f.rateSteps || [];
  const S = Math.max(5, steps.length);
  const shape = f.repayment === "sculpted" && Array.isArray(result.shape) ? result.shape : null;
  const inputs = [];                                // [key, label, value, unit, style, formula?]
  const head = (t) => inputs.push([null, t]);
  const put = (key, label, v, unit = "", s = "num", fml = null) => inputs.push([key, label, v, unit, s, fml]);

  head("Energy");
  put("windP50", "Wind P50, MWh a year", en.wind ? en.wind.p50Mwh : 0, "MWh", "eur");
  put("windSig", "Wind uncertainty, 1 sigma", en.wind ? en.wind.sigmaPct : 0, "%");
  put("solarP50", "Solar P50, MWh a year (after availability and clipping)", en.solar ? en.solar.p50Mwh : 0, "MWh", "eur");
  put("solarSig", "Solar uncertainty, 1 sigma", en.solar ? en.solar.sigmaPct : 0, "%");
  put("z", "Exceedance factor z (P50 = 0, P90 = 1.2816)", Z.P50, "", "num4");
  put("degr1", "Solar extra loss in the first year", pl.solar ? pl.solar.degrFirstPct : 0, "%");
  put("degr", "Solar degradation a year", pl.solar ? pl.solar.degrPctYr : 0, "%");
  put("yMul", "Energy multiplier (scenario)", sc.yieldMultiplier, "x");
  put("curt", "Curtailment", sc.curtailmentPct, "%");
  put("line", "Connection line losses", pl.grid?.applied?.lossPct || 0, "%");
  head("Revenue");
  put("hasContract", "A contracted price applies (1 yes, 0 merchant only)", r.kind !== "merchant" ? 1 : 0, "", "int");
  put("price", "Contracted price, year 1", r.priceEurMwh, "EUR/MWh");
  put("cYears", "Contract years", r.years, "years", "int");
  put("idx", "Contract indexation a year (held at the case's price rise when lower)", sc.tariffEscalationPct == null ? r.indexPct : Math.min(r.indexPct, sc.tariffEscalationPct), "%");
  put("cLocal", "Contract price in the local currency (1 yes, 0 EUR)", r.currency === "local" ? 1 : 0, "", "int");
  put("mBase", "Merchant price after the contract (an assumption)", merchantBase, "EUR/MWh");
  put("tMul", "Merchant price multiplier (scenario)", sc.tariffMultiplier, "x");
  put("mEsc", "Merchant price rise a year (scenario)", sc.tariffEscalationPct == null ? 0 : sc.tariffEscalationPct, "%");
  put("bessMw", "Storage power", pl.bess ? pl.bess.mw : 0, "MW");
  put("bessEur", "Storage contract, EUR per MW a year", r.bessEurPerMwYr, "EUR");
  put("bessYears", "Storage contract years", r.bessYears, "years", "int");
  put("dep", "Local currency loss a year (scenario)", sc.localDepreciationPctYr, "%");
  head("Costs");
  put("windKw", "Wind capacity", pl.wind ? pl.wind.mw * 1000 : 0, "kW", "eur");
  put("windEur", "Wind capex", c.windEurPerKw, "EUR/kW", "eur");
  put("solarKw", "Solar capacity (DC)", pl.solar ? pl.solar.mwp * 1000 : 0, "kWp", "eur");
  put("solarEur", "Solar capex", c.solarEurPerKw, "EUR/kWp", "eur");
  put("bessKwh", "Storage energy", pl.bess ? pl.bess.mwh * 1000 : 0, "kWh", "eur");
  put("bessCapex", "Storage capex", c.bessEurPerKwh, "EUR/kWh", "eur");
  put("grid", "Grid connection", c.gridEur, "EUR", "eur");
  put("devPct", "Development, share of the hard cost", c.devPct, "%");
  put("cMul", "Capex multiplier (scenario)", sc.capexMultiplier, "x");
  put("opW", "Wind O&M", c.opexWindEurPerKwYr, "EUR/kW a year");
  put("opS", "Solar O&M", c.opexSolarEurPerKwYr, "EUR/kWp a year");
  put("opB", "Storage O&M", c.opexBessEurPerKwhYr, "EUR/kWh a year");
  put("land", "Land lease", c.landEurYr, "EUR a year", "eur");
  put("ins", "Insurance, share of capex a year", c.insurancePct, "%");
  put("oMul", "Opex multiplier (scenario)", sc.opexMultiplier, "x");
  put("infl", "Inflation (opex and replacements)", infl, "%");
  put("war", "War-risk insurance, share of capex a year (scenario)", sc.warRiskPremiumPct, "%");
  put("invYear", "Inverters replaced in year (0 none)", pl.solar ? Math.round(c.invReplaceYear) : 0, "", "int");
  put("invKw", "Inverter AC power replaced", pl.solar ? (pl.solar.acMw > 0 ? pl.solar.acMw : pl.solar.mwp) * 1000 : 0, "kW", "eur");
  put("invEur", "Inverter replacement, today's price", c.invReplaceEurPerKw, "EUR/kW");
  put("augYear", "Battery augmented in year (0 none)", pl.bess ? Math.round(c.bessAugYear) : 0, "", "int");
  put("augEur", "Battery augmentation, today's price", c.bessAugEurPerKwh, "EUR/kWh");
  put("delay", "Construction delay (scenario)", sc.delayMonths, "months");
  head("Finance");
  put("gPct", "Grant, share of capex", f.grantPct, "%");
  put("gCap", "Grant cap (blank = none)", f.grantCapEur, "EUR", "eur");
  put("gear", "Debt share of the cost after grant plus IDC", f.gearingPct, "%");
  put("rate", "Interest rate", f.ratePct, "%");
  for (let k = 1; k <= S; k++) put("step" + k, `Programme rate in year ${k} (blank = the interest rate)`, steps[k - 1] ?? null, "%");
  put("tenor", "Tenor", f.tenorYears, "years", "int");
  put("grace", "Interest-only years", f.graceYears, "years", "int");
  put("sculpt", "Repayment sculpted to the cash flow (1) or level annuity (0)", shape ? 1 : 0, "", "int");
  put("months", "Construction months (interest during construction)", f.constructionMonths, "months", "int");
  put("feePct", "Arrangement fee, share of the loan", f.feePct, "%");
  put("compPct", "Principal compensation after year 1, share of the loan", f.principalCompensationPct, "%");
  put("dLocal", "Loan in the local currency (1 yes, 0 EUR)", f.debtCurrency === "local" ? 1 : 0, "", "int");
  put("dsra", "Debt service reserve, months of the next year's service", f.dsraMonths, "months");
  put("taxPct", "Corporate income tax", f.taxPct, "%");
  put("taxLife", "Tax depreciation, straight-line over", f.taxLifeYears, "years", "int");
  put("lapse", "Tax losses carried forward for (0 = no limit)", f.taxLossYears, "years", "int");
  put("disc", "Discount rate (NPV)", f.discPct, "%");
  head("Worked out from the inputs (formulas)");
  // row numbers are known once every input is placed; derived lines follow
  const rowOf = {};
  let row = 3;                                       // rows 1-2: title, note
  for (const e of inputs) { row += 1; if (e[0]) rowOf[e[0]] = row; }
  const I = (k) => `${IN}$B$${rowOf[k]}`;
  const iLocal = (k) => `$B$${rowOf[k]}`;            // the same cell, from its own sheet
  const iv = (k) => { const e = inputs.find((x) => x[0] === k); return e ? num(e[2]) : 0; };

  // JavaScript mirror of the derived lines
  const hard = iv("windKw") * iv("windEur") + iv("solarKw") * iv("solarEur") + iv("bessKwh") * iv("bessCapex") + iv("grid");
  const capex = hard * (1 + iv("devPct") / 100) * iv("cMul");
  const grantRaw = capex * iv("gPct") / 100;
  const grant = f.grantCapEur != null ? Math.min(grantRaw, f.grantCapEur) : grantRaw;
  const capexNet = Math.max(0, capex - grant);
  const r1 = steps[0] != null ? steps[0] : f.ratePct;
  const k = (r1 / 100) * iv("months") / 24;
  const g = iv("gear") / 100;
  const loan = g > 0 ? (g * capexNet) / Math.max(0.05, 1 - g * k) : 0;
  const idc = loan * k, equity = capexNet + idc - loan, fee = loan * iv("feePct") / 100;
  const opex0 = iv("windKw") * iv("opW") + iv("solarKw") * iv("opS") + iv("bessKwh") * iv("opB") + iv("land") + capex * iv("ins") / 100;
  const dW = Math.floor(iv("delay") / 12), dF = iv("delay") / 12 - dW;
  const derived = [
    ["hard", "Hard cost", hard, `${iLocal("windKw")}*${iLocal("windEur")}+${iLocal("solarKw")}*${iLocal("solarEur")}+${iLocal("bessKwh")}*${iLocal("bessCapex")}+${iLocal("grid")}`],
    ["capex", "Capex", capex, `$B$H*(1+${iLocal("devPct")}/100)*${iLocal("cMul")}`],
    ["grant", "Grant", grant, `IF(ISBLANK(${iLocal("gCap")}),$B$C*${iLocal("gPct")}/100,MIN($B$C*${iLocal("gPct")}/100,${iLocal("gCap")}))`],
    ["capexNet", "Cost after grant", capexNet, `MAX(0,$B$C-$B$G)`],
    ["k", "Interest during construction per EUR of loan", k, `IF(ISBLANK(${iLocal("step1")}),${iLocal("rate")},${iLocal("step1")})/100*${iLocal("months")}/24`],
    ["loan", "Loan at commissioning", loan, `IF(${iLocal("gear")}>0,${iLocal("gear")}/100*$B$N/MAX(0.05,1-${iLocal("gear")}/100*$B$K),0)`],
    ["idc", "Interest during construction", idc, `$B$L*$B$K`],
    ["equity", "Equity", equity, `$B$N+$B$I-$B$L`],
    ["fee", "Arrangement fee", fee, `$B$L*${iLocal("feePct")}/100`],
    ["comp", "Principal compensation", loan * iv("compPct") / 100, `$B$L*${iLocal("compPct")}/100`],
    ["opex0", "Opex in year 1, before the multiplier", opex0, `${iLocal("windKw")}*${iLocal("opW")}+${iLocal("solarKw")}*${iLocal("opS")}+${iLocal("bessKwh")}*${iLocal("opB")}+${iLocal("land")}+$B$C*${iLocal("ins")}/100`],
    ["dW", "Delay, whole years", dW, `INT(${iLocal("delay")}/12)`],
    ["dF", "Delay, part of a year", dF, `${iLocal("delay")}/12-INT(${iLocal("delay")}/12)`],
    ["depLev", "Tax depreciation a year, with the loan (cost after grant plus IDC)", (capexNet + idc) / f.taxLifeYears, `($B$N+$B$I)/${iLocal("taxLife")}`],
    ["depUnl", "Tax depreciation a year, without the loan", capexNet / f.taxLifeYears, `$B$N/${iLocal("taxLife")}`],
  ];
  for (const d of derived) { row += 1; rowOf[d[0]] = row; }
  // the derived lines' own references, by key (the letters above are placeholders)
  const keyOfLetter = { H: "hard", C: "capex", G: "grant", N: "capexNet", K: "k", L: "loan", I: "idc" };
  const fixLetters = (s) => s.replace(/\$B\$([A-Z])\b/g, (m, L) => (keyOfLetter[L] ? `$B$${rowOf[keyOfLetter[L]]}` : m));
  const D = (k2) => `${IN}$B$${rowOf[k2]}`;
  const dv = Object.fromEntries(derived.map((d) => [d[0], d[2]]));
  row += 2;
  const shapeRow = row;                              // the sculpting shape, a row of H values
  const inputRows = [
    [{ v: `${asset.name || pl.name}: inputs`, s: "bold" }],
    [{ v: "Every value in column B is typed in and can be changed; the Model and Tax sheets recalculate from them. The worked-out lines at the end are formulas.", s: "note" }],
    [{ v: "Input", s: "head" }, { v: "Value", s: "head" }, { v: "Unit", s: "head" }],
    ...inputs.map((e) => (e[0] ? [e[1], e[2] == null ? null : { v: e[2], s: e[4] }, e[3]] : [{ v: e[1], s: "bold" }])),
    ...derived.map((d) => [d[1], { v: d[2], f: fixLetters(d[3]), s: d[0] === "k" ? "num4" : d[0] === "dW" ? "int" : d[0] === "dF" ? "num4" : "eur" }, d[0] === "k" || d[0] === "dW" || d[0] === "dF" ? "" : "EUR"]),
    [],
    ["Sculpting shape, fixed at financial close (the base case's CFADS), by year", ...Array.from({ length: H }, (_, i) => (shape ? { v: num(shape[i]), s: "eur" } : null))],
  ];

  // ---------------------------------------------------------------- model
  const yc = (t) => colName(1 + t);                  // year t's column: B is year 0, C year 1
  const last = yc(H);
  const M = {};                                      // key -> sheet row
  const mRows = [];
  const vals = {};                                   // key -> values by year (index t, 1..H; 0 for year 0)
  const add = (key, label, unit, perYear, opts = {}) => {
    const rr = mRows.length + 1;
    M[key] = rr;
    vals[key] = [];
    const cells = [label, unit];
    // column B: year 0 where the row has one
    cells[1] = opts.y0 ? { v: opts.y0.v, f: opts.y0.f, s: "eur" } : unit;
    for (let t = 1; t <= H; t++) {
      const out = perYear(t);
      vals[key][t] = out.v;
      cells.push(out.v == null && !out.f ? null : { v: out.v, f: out.f, s: opts.s || "eur" });
    }
    if (opts.y0) vals[key][0] = opts.y0.v;
    mRows.push(cells);
  };
  const sec = (title) => mRows.push([{ v: title, s: "bold" }]);
  // a row's number is written as @@key@@ and filled in once every row is placed:
  // the opening balance reads the closing balance, a row further down
  const ref = (key, t) => `${yc(t)}@@${key}@@`;
  const span = (key) => `$C$@@${key}@@:$${last}$@@${key}@@`;
  const rowRef = (key) => `@@${key}@@`;

  mRows.push([{ v: "Year", s: "head" }, { v: 0, s: "head" }, ...Array.from({ length: H }, (_, i) => ({ v: i + 1, s: "head" }))]);
  M.year = 1;
  const shiftF = (key, t) => `(1-${D("dF")})*IF(${t}-${D("dW")}>=1,INDEX(${span(key)},${t}-${D("dW")}),0)+${D("dF")}*IF(${t}-${D("dW")}-1>=1,INDEX(${span(key)},${t}-${D("dW")}-1),0)`;
  const shiftV = (key, t) => {
    const at = (kk) => (kk >= 1 && kk <= H ? vals[key][kk] : 0);
    return (1 - dF) * at(t - dW) + dF * at(t - dW - 1);
  };

  sec("Energy");
  const windY = iv("windP50") * Math.max(0.05, 1 - (iv("z") * iv("windSig")) / 100);
  const solarY = iv("solarP50") * Math.max(0.05, 1 - (iv("z") * iv("solarSig")) / 100);
  add("eWind", "Wind energy", "MWh", () => ({ v: windY, f: `${I("windP50")}*MAX(0.05,1-${I("z")}*${I("windSig")}/100)` }));
  add("eSolar", "Solar energy, after ageing", "MWh", (t) => ({ v: solarY * (1 - iv("degr1") / 100) * Math.pow(1 - iv("degr") / 100, t - 1),
    f: `${I("solarP50")}*MAX(0.05,1-${I("z")}*${I("solarSig")}/100)*(1-${I("degr1")}/100)*(1-${I("degr")}/100)^(${yc(t)}$1-1)` }));
  const eFac = iv("yMul") * (1 - iv("curt") / 100) * (1 - iv("line") / 100);
  add("eRaw", "Energy delivered, before any delay", "MWh", (t) => ({ v: (vals.eWind[t] + vals.eSolar[t]) * eFac,
    f: `(${ref("eWind", t)}+${ref("eSolar", t)})*${I("yMul")}*(1-${I("curt")}/100)*(1-${I("line")}/100)` }));
  add("energy", "Energy delivered", "MWh", (t) => ({ v: shiftV("eRaw", t), f: shiftF("eRaw", t) }));

  sec("Revenue");
  add("onC", "Contract price applies (1) or merchant (0)", "", (t) => ({ v: iv("hasContract") === 1 && t <= iv("cYears") && iv("price") > 0 ? 1 : 0,
    f: `IF(AND(${I("hasContract")}=1,${yc(t)}$1<=${I("cYears")},${I("price")}>0),1,0)` }), { s: "int" });
  add("pC", "Contracted price", "EUR/MWh", (t) => ({ v: iv("price") * Math.pow(1 + iv("idx") / 100, t - 1) * (iv("cLocal") === 1 ? Math.pow(1 - iv("dep") / 100, t - 1) : 1),
    f: `${I("price")}*(1+${I("idx")}/100)^(${yc(t)}$1-1)*IF(${I("cLocal")}=1,(1-${I("dep")}/100)^(${yc(t)}$1-1),1)` }), { s: "num" });
  add("pM", "Merchant price", "EUR/MWh", (t) => {
    const ym = iv("hasContract") === 1 ? t - 1 - iv("cYears") : t - 1;
    return { v: iv("mBase") * iv("tMul") * Math.pow(1 + iv("mEsc") / 100, Math.max(0, ym)),
      f: `${I("mBase")}*${I("tMul")}*(1+${I("mEsc")}/100)^MAX(0,IF(${I("hasContract")}=1,${yc(t)}$1-1-${I("cYears")},${yc(t)}$1-1))` };
  }, { s: "num" });
  add("price", "Price received", "EUR/MWh", (t) => ({ v: vals.onC[t] ? vals.pC[t] : vals.pM[t], f: `IF(${ref("onC", t)}=1,${ref("pC", t)},${ref("pM", t)})` }), { s: "num" });
  add("rBess", "Storage contract", "EUR", (t) => ({ v: t <= iv("bessYears") ? iv("bessMw") * iv("bessEur") : 0, f: `IF(${yc(t)}$1<=${I("bessYears")},${I("bessMw")}*${I("bessEur")},0)` }));
  add("revRaw", "Revenue, before any delay", "EUR", (t) => ({ v: vals.eRaw[t] * vals.price[t] + vals.rBess[t], f: `${ref("eRaw", t)}*${ref("price", t)}+${ref("rBess", t)}` }));
  add("revenue", "Revenue", "EUR", (t) => ({ v: shiftV("revRaw", t), f: shiftF("revRaw", t) }));

  sec("Costs");
  add("opRaw", "Opex, before any delay", "EUR", (t) => ({ v: opex0 * iv("oMul") * Math.pow(1 + iv("infl") / 100, t - 1), f: `${D("opex0")}*${I("oMul")}*(1+${I("infl")}/100)^(${yc(t)}$1-1)` }));
  add("opex", "Opex (O&M, land, insurance)", "EUR", (t) => ({ v: shiftV("opRaw", t), f: shiftF("opRaw", t) }));
  add("war", "War-risk insurance", "EUR", () => ({ v: capex * iv("war") / 100, f: `${D("capex")}*${I("war")}/100` }));
  add("ebitda", "EBITDA", "EUR", (t) => ({ v: vals.revenue[t] - vals.opex[t] - vals.war[t], f: `${ref("revenue", t)}-${ref("opex", t)}-${ref("war", t)}` }));
  add("susRaw", "Replacements, before any delay", "EUR", (t) => {
    const g1 = Math.pow(1 + iv("infl") / 100, t - 1);
    return { v: ((t === iv("invYear") ? iv("invKw") * iv("invEur") * g1 : 0) + (t === iv("augYear") ? iv("bessKwh") * iv("augEur") * g1 : 0)) * iv("cMul"),
      f: `(IF(${yc(t)}$1=${I("invYear")},${I("invKw")}*${I("invEur")},0)+IF(${yc(t)}$1=${I("augYear")},${I("bessKwh")}*${I("augEur")},0))*(1+${I("infl")}/100)^(${yc(t)}$1-1)*${I("cMul")}` };
  });
  add("sus", "Replacements (inverters, battery augmentation)", "EUR", (t) => ({ v: shiftV("susRaw", t), f: shiftF("susRaw", t) }));

  sec("Loan");
  const rateV = (t) => (t <= S && steps[t - 1] != null ? steps[t - 1] : f.ratePct) / 100;
  add("rate", "Interest rate", "", (t) => ({ v: rateV(t), f: t <= S ? `IF(ISBLANK(${I("step" + t)}),${I("rate")},${I("step" + t)})/100` : `${I("rate")}/100` }), { s: "pct" });
  add("cdf", "Discount factor at the loan's rates", "", (t) => ({ v: (t === 1 ? 1 : vals.cdf[t - 1]) / (1 + vals.rate[t]), f: t === 1 ? `1/(1+${ref("rate", t)})` : `${ref("cdf", t - 1)}/(1+${ref("rate", t)})` }), { s: "num4" });
  add("shape", "Sculpting shape", "EUR", (t) => ({ v: shape ? Math.max(0, num(shape[t - 1])) : 0, f: `MAX(0,${IN}${colName(t)}$${shapeRow})` }));
  // the schedule, mirrored row by row
  const open = [], pay = [], intr = [], prin = [], comp = [], close = [];
  const tenor = iv("tenor"), grace = iv("grace");
  for (let t = 1; t <= H; t++) {
    open[t] = t === 1 ? loan : close[t - 1];
    const rr = vals.rate[t], left = tenor - t + 1;
    let p = 0;
    if (t <= tenor && open[t] > 1e-9) {
      if (t <= grace) p = open[t] * rr;
      else {
        let den = 0;
        for (let u = t; u <= H; u++) if (u <= tenor) den += vals.shape[u] * vals.cdf[u];
        const annuity = rr === 0 ? open[t] / left : (open[t] * rr) / (1 - Math.pow(1 + rr, -left));
        p = iv("sculpt") === 1 && den > 0 ? (open[t] * vals.shape[t] * (t === 1 ? 1 : vals.cdf[t - 1])) / den : annuity;
      }
    }
    pay[t] = p;
    intr[t] = t <= tenor ? open[t] * rr : 0;
    prin[t] = p - intr[t];
    const after = t <= tenor ? Math.max(0, open[t] - prin[t]) : 0;
    comp[t] = t === 1 ? Math.min(loan * iv("compPct") / 100, after) : 0;
    close[t] = after - comp[t];
  }
  add("open", "Balance at the start of the year", "EUR", (t) => ({ v: open[t], f: t === 1 ? D("loan") : ref("close", t - 1) }));
  add("pay", "Payment (loan currency)", "EUR", (t) => {
    const o = ref("open", t), rr = ref("rate", t), left = `(${I("tenor")}-${yc(t)}$1+1)`;
    const prev = t === 1 ? "1" : ref("cdf", t - 1);
    const den = `SUMPRODUCT((${yc(t)}$1:$${last}$1<=${I("tenor")})*${yc(t)}${rowRef("shape")}:$${last}$${rowRef("shape")}*${yc(t)}${rowRef("cdf")}:$${last}$${rowRef("cdf")})`;
    const annuity = `IF(${rr}=0,${o}/${left},${o}*${rr}/(1-(1+${rr})^(-${left})))`;
    return { v: pay[t], f: `IF(OR(${yc(t)}$1>${I("tenor")},${o}<=0.000000001),0,IF(${yc(t)}$1<=${I("grace")},${o}*${rr},IF(AND(${I("sculpt")}=1,${den}>0),${o}*${ref("shape", t)}*${prev}/${den},${annuity})))` };
  });
  add("int", "Interest", "EUR", (t) => ({ v: intr[t], f: `IF(${yc(t)}$1>${I("tenor")},0,${ref("open", t)}*${ref("rate", t)})` }));
  add("prin", "Principal", "EUR", (t) => ({ v: prin[t], f: `${ref("pay", t)}-${ref("int", t)}` }));
  add("comp", "Principal compensation", "EUR", (t) => ({ v: comp[t], f: t === 1 ? `MIN(${D("comp")},IF(${yc(t)}$1>${I("tenor")},0,MAX(0,${ref("open", t)}-${ref("prin", t)})))` : "0" }));
  add("close", "Balance at the end of the year", "EUR", (t) => ({ v: close[t], f: `IF(${yc(t)}$1>${I("tenor")},0,MAX(0,${ref("open", t)}-${ref("prin", t)}))-${ref("comp", t)}` }));
  add("fx", "Loan currency to EUR", "", (t) => ({ v: iv("dLocal") === 1 ? Math.pow(1 - iv("dep") / 100, t - 1) : 1, f: `IF(${I("dLocal")}=1,(1-${I("dep")}/100)^(${yc(t)}$1-1),1)` }), { s: "num4" });
  add("ds", "Debt service, EUR", "EUR", (t) => ({ v: vals.pay[t] * vals.fx[t], f: `${ref("pay", t)}*${ref("fx", t)}` }));

  sec("Tax");
  add("dLev", "Depreciation, with the loan", "EUR", (t) => ({ v: t <= f.taxLifeYears ? dv.depLev : 0, f: `IF(${yc(t)}$1<=${I("taxLife")},${D("depLev")},0)` }));
  add("pLev", "Taxable profit before losses, with the loan", "EUR", (t) => ({ v: vals.ebitda[t] - vals.dLev[t] - vals.int[t] * vals.fx[t], f: `${ref("ebitda", t)}-${ref("dLev", t)}-${ref("int", t)}*${ref("fx", t)}` }));
  add("dUnl", "Depreciation, without the loan", "EUR", (t) => ({ v: t <= f.taxLifeYears ? dv.depUnl : 0, f: `IF(${yc(t)}$1<=${I("taxLife")},${D("depUnl")},0)` }));
  add("pUnl", "Taxable profit before losses, without the loan", "EUR", (t) => ({ v: vals.ebitda[t] - vals.dUnl[t], f: `${ref("ebitda", t)}-${ref("dUnl", t)}` }));
  // the loss carry-forward (the Tax sheet), mirrored
  const lossBlock = (profitKey) => {
    const used = [], left = [];
    for (let v = 1; v <= H; v++) { used[v] = []; left[v] = []; }
    const lap = iv("lapse");
    for (let t = 1; t <= H; t++) {
      let room = Math.max(0, vals[profitKey][t]);
      for (let v = 1; v <= H; v++) {
        let u = 0;
        if (t > v && !(lap > 0 && t - v > lap)) { u = Math.min(left[v][t - 1], Math.max(0, room)); room -= u; }
        used[v][t] = u;
        left[v][t] = t < v ? 0 : t === v ? Math.max(0, -vals[profitKey][v]) : left[v][t - 1] - u;
      }
    }
    const taxable = Array.from({ length: H + 1 }, (_, t) => (t ? Math.max(0, vals[profitKey][t]) - used.reduce((s, uRow) => s + (uRow?.[t] || 0), 0) : 0));
    return { used, left, taxable };
  };
  const lossLev = lossBlock("pLev"), lossUnl = lossBlock("pUnl");
  // the Tax sheet's layout: a title row, then per block a heading, the year row, H "used" rows, a spacer, H "left" rows, the taxable row
  const TB = (blockIdx) => 3 + blockIdx * (2 * H + 6);
  const tPos = (blockIdx) => {
    const top = TB(blockIdx);
    return { head: top, years: top + 1, used0: top + 2, left0: top + 2 + H + 1, taxable: top + 2 + 2 * H + 1 };
  };
  add("tLev", "Corporate income tax, with the loan", "EUR", (t) => ({ v: lossLev.taxable[t] * iv("taxPct") / 100, f: `${TX}${colName(t)}${tPos(0).taxable}*${I("taxPct")}/100` }));
  add("tUnl", "Tax the project would pay without the loan", "EUR", (t) => ({ v: lossUnl.taxable[t] * iv("taxPct") / 100, f: `${TX}${colName(t)}${tPos(1).taxable}*${I("taxPct")}/100` }));

  sec("Cover");
  add("cfads", "CFADS (EBITDA less tax less replacements)", "EUR", (t) => ({ v: vals.ebitda[t] - vals.tLev[t] - vals.sus[t], f: `${ref("ebitda", t)}-${ref("tLev", t)}-${ref("sus", t)}` }));
  add("dscr", "DSCR", "", (t) => ({ v: vals.ds[t] > 1e-9 ? vals.cfads[t] / vals.ds[t] : "", f: `IF(${ref("ds", t)}>0.000000001,${ref("cfads", t)}/${ref("ds", t)},"")` }), { s: "x" });
  add("dscrR", "DSCR in a repayment year", "", (t) => ({ v: vals.ds[t] > 1e-9 && vals.prin[t] > 1e-9 ? vals.cfads[t] / vals.ds[t] : "", f: `IF(AND(${ref("ds", t)}>0.000000001,${ref("prin", t)}>0.000000001),${ref("cfads", t)}/${ref("ds", t)},"")` }), { s: "x" });

  sec("Debt service reserve");
  const m = iv("dsra") / 12;
  const rs = { bal: [], net: [] };
  let bal = m * vals.ds[1];
  const opening = bal;
  for (let t = 1; t <= H; t++) {
    const avail = vals.cfads[t] - vals.ds[t];
    let draw = 0, short = 0;
    if (avail < 0) { draw = Math.min(bal, -avail); bal -= draw; short = -avail - draw; }
    let to = avail < 0 ? -short : avail;
    const want = m * (t < H ? vals.ds[t + 1] : 0);
    if (bal < want && to > 0) { const top = Math.min(to, want - bal); bal += top; to -= top; }
    if (bal > want) { to += bal - want; bal = want; }
    rs.net[t] = to - avail; rs.bal[t] = bal;
  }
  add("avail", "CFADS less debt service", "EUR", (t) => ({ v: vals.cfads[t] - vals.ds[t], f: `${ref("cfads", t)}-${ref("ds", t)}` }));
  add("rPrev", "Reserve at the start of the year", "EUR", (t) => ({ v: t === 1 ? opening : rs.bal[t - 1], f: t === 1 ? `${I("dsra")}/12*${ref("ds", 1)}` : ref("rBal", t - 1) }));
  add("rDraw", "Drawn from the reserve", "EUR", (t) => ({ v: vals.avail[t] < 0 ? Math.min(vals.rPrev[t], -vals.avail[t]) : 0, f: `IF(${ref("avail", t)}<0,MIN(${ref("rPrev", t)},-${ref("avail", t)}),0)` }));
  add("rShort", "Shortfall the reserve cannot cover (paid by the sponsor)", "EUR", (t) => ({ v: vals.avail[t] < 0 ? -vals.avail[t] - vals.rDraw[t] : 0, f: `IF(${ref("avail", t)}<0,-${ref("avail", t)}-${ref("rDraw", t)},0)` }));
  add("rWant", "Reserve wanted at the end of the year", "EUR", (t) => ({ v: m * (t < H ? vals.ds[t + 1] : 0), f: t < H ? `${I("dsra")}/12*${ref("ds", t + 1)}` : "0" }));
  add("rTop", "Reserve topped up", "EUR", (t) => {
    const b1 = vals.rPrev[t] - vals.rDraw[t], ts0 = vals.avail[t] < 0 ? -vals.rShort[t] : vals.avail[t];
    return { v: b1 < vals.rWant[t] && ts0 > 0 ? Math.min(ts0, vals.rWant[t] - b1) : 0,
      f: `IF(AND(${ref("rPrev", t)}-${ref("rDraw", t)}<${ref("rWant", t)},IF(${ref("avail", t)}<0,-${ref("rShort", t)},${ref("avail", t)})>0),MIN(IF(${ref("avail", t)}<0,-${ref("rShort", t)},${ref("avail", t)}),${ref("rWant", t)}-(${ref("rPrev", t)}-${ref("rDraw", t)})),0)` };
  });
  add("rRel", "Reserve released", "EUR", (t) => ({ v: Math.max(0, vals.rPrev[t] - vals.rDraw[t] + vals.rTop[t] - vals.rWant[t]), f: `MAX(0,${ref("rPrev", t)}-${ref("rDraw", t)}+${ref("rTop", t)}-${ref("rWant", t)})` }));
  add("rBal", "Reserve at the end of the year", "EUR", (t) => ({ v: vals.rPrev[t] - vals.rDraw[t] + vals.rTop[t] - vals.rRel[t], f: `${ref("rPrev", t)}-${ref("rDraw", t)}+${ref("rTop", t)}-${ref("rRel", t)}` }));
  add("rNet", "Reserve's effect on the sponsor's cash", "EUR", (t) => ({ v: (vals.avail[t] < 0 ? -vals.rShort[t] : vals.avail[t]) - vals.rTop[t] + vals.rRel[t] - vals.avail[t],
    f: `IF(${ref("avail", t)}<0,-${ref("rShort", t)},${ref("avail", t)})-${ref("rTop", t)}+${ref("rRel", t)}-${ref("avail", t)}` }));

  sec("Cash flows");
  add("pcf", "Project cash flow (after the tax without the loan)", "EUR", (t) => ({ v: vals.ebitda[t] - vals.tUnl[t] - vals.sus[t], f: `${ref("ebitda", t)}-${ref("tUnl", t)}-${ref("sus", t)}` }),
    { y0: { v: -capexNet, f: `-${D("capexNet")}` } });
  add("ecf", "Sponsor's cash flow", "EUR", (t) => ({ v: vals.cfads[t] - vals.ds[t] + vals.rNet[t], f: `${ref("cfads", t)}-${ref("ds", t)}+${ref("rNet", t)}` }),
    { y0: { v: -(equity + fee + opening), f: `-(${D("equity")}+${D("fee")}+${ref("rPrev", 1)})` } });

  // results, mirrored, then compared with the app's
  const pcf = [vals.pcf[0], ...vals.pcf.slice(1)];
  const ecf = [vals.ecf[0], ...vals.ecf.slice(1)];
  const npvAt = (cf, rr) => cf.reduce((s, x, n) => s + x / Math.pow(1 + rr, n), 0);
  const irr = (cf) => { let lo = -0.9, hi = 1.5, a = npvAt(cf, lo); if (a * npvAt(cf, hi) > 0) return null; for (let i = 0; i < 200; i++) { const mid = (lo + hi) / 2, v = npvAt(cf, mid); if (a * v <= 0) hi = mid; else { lo = mid; a = v; } } return (lo + hi) / 2; };
  const dscrs = vals.dscr.filter((x) => typeof x === "number");
  const dscrRs = vals.dscrR.filter((x) => typeof x === "number");
  let llcrPv = 0;
  for (let t = 1; t <= Math.min(H, tenor); t++) llcrPv += vals.cfads[t] * vals.cdf[t];
  const R = {
    npv: npvAt(pcf, f.discPct / 100), irr: irr(pcf), eirr: equity + fee + opening > 1e-6 ? irr(ecf) : null,
    dscrMin: dscrs.length ? Math.min(...dscrs) : null, dscrMinR: dscrRs.length ? Math.min(...dscrRs) : null,
    dscrAvg: dscrRs.length ? dscrRs.reduce((s, x) => s + x, 0) / dscrRs.length : (dscrs.length ? dscrs.reduce((s, x) => s + x, 0) / dscrs.length : null),
    llcr: loan > 1e-6 ? llcrPv / loan : null,
  };
  mRows.push([]);
  mRows.push([{ v: "Results", s: "bold" }]);
  const resStart = mRows.length + 1;
  const pcfAll = `$B$${rowRef("pcf")}:$${last}$${rowRef("pcf")}`, ecfAll = `$B$${rowRef("ecf")}:$${last}$${rowRef("ecf")}`;
  const results = [
    ["npv", "NPV of the project cash flow", R.npv, `$B$${rowRef("pcf")}+NPV(${I("disc")}/100,${span("pcf")})`, "eur"],
    ["irr", "Project IRR", R.irr, `IRR(${pcfAll})`, "pct"],
    ["eirr", "Equity IRR", R.eirr, `IRR(${ecfAll})`, "pct"],
    ["dscrMin", "Lowest DSCR, every year with debt service", R.dscrMin, `MIN(${span("dscr")})`, "x"],
    ["dscrMinR", "Lowest DSCR, repayment years", R.dscrMinR, `MIN(${span("dscrR")})`, "x"],
    ["dscrAvg", "Average DSCR, repayment years", R.dscrAvg, `AVERAGE(${span("dscrR")})`, "x"],
    ["llcr", "LLCR at commissioning (CFADS over the tenor at the loan's rates, against the loan)", R.llcr, `IF(${D("loan")}>0,SUMPRODUCT(($C$1:$${last}$1<=${I("tenor")})*${span("cfads")}*${span("cdf")})/${D("loan")},"")`, "x"],
  ];
  const resRow = {};
  results.forEach((x, i) => { resRow[x[0]] = resStart + i; mRows.push([x[1], null, { v: x[2] == null ? "" : x[2], f: x[3], s: x[4] }]); });
  const fill = (x) => (typeof x === "string" ? x.replace(/@@(\w+)@@/g, (_, k2) => String(M[k2])) : x);
  const modelRows = mRows.map((r0) => r0.map((c0) => (c0 && typeof c0 === "object" && c0.f ? { ...c0, f: fill(c0.f) } : c0)));

  // ---------------------------------------------------------------- tax sheet
  const taxRows = [[{ v: `${asset.name || pl.name}: tax losses carried forward, oldest first, each lapsing after the limit on the Inputs sheet`, s: "bold" }], []];
  const block = (blockIdx, title, profitKey, loss) => {
    const P = tPos(blockIdx);
    while (taxRows.length < P.head - 1) taxRows.push([]);
    taxRows.push([{ v: title, s: "bold" }]);
    taxRows.push([{ v: "Loss from year, used in year", s: "head" }, ...Array.from({ length: H }, (_, i) => ({ v: i + 1, s: "head" }))]);
    const yRef = (t) => `${colName(t)}$${P.years}`;
    const profit = (t) => `'${names.model}'!${yc(t)}${M[profitKey]}`;
    for (let v = 1; v <= H; v++) {
      const rowN = P.used0 + v - 1;
      taxRows.push([`Used, loss of year ${v}`, ...Array.from({ length: H }, (_, i) => {
        const t = i + 1;
        const above = v > 1 ? `SUM(${colName(t)}${P.used0}:${colName(t)}${rowN - 1})` : "0";
        const leftPrev = t > 1 ? `${colName(t - 1)}${P.left0 + v - 1}` : "0";
        return { v: loss.used[v][t], s: "eur",
          f: `IF(${yRef(t)}<=${v},0,IF(AND(${I("lapse")}>0,${yRef(t)}-${v}>${I("lapse")}),0,MIN(${leftPrev},MAX(0,MAX(0,${profit(t)})-${above}))))` };
      })]);
    }
    taxRows.push([]);
    for (let v = 1; v <= H; v++) {
      taxRows.push([`Left, loss of year ${v}`, ...Array.from({ length: H }, (_, i) => {
        const t = i + 1;
        const prev = t > 1 ? `${colName(t - 1)}${P.left0 + v - 1}` : "0";
        return { v: loss.left[v][t], s: "eur",
          f: `IF(${yRef(t)}<${v},0,IF(${yRef(t)}=${v},MAX(0,-${profit(v)}),${prev}-${colName(t)}${P.used0 + v - 1}))` };
      })]);
    }
    taxRows.push(["Taxable profit after losses", ...Array.from({ length: H }, (_, i) => {
      const t = i + 1;
      return { v: loss.taxable[t], s: "eur", f: `MAX(0,${profit(t)})-SUM(${colName(t)}${P.used0}:${colName(t)}${P.used0 + H - 1})` };
    })]);
  };
  block(0, "With the loan (interest deducted)", "pLev", lossLev);
  block(1, "Without the loan (for the project's own IRR and NPV)", "pUnl", lossUnl);

  // ---------------------------------------------------------------- checks
  const app = result;
  const sumv = (a) => (a || []).reduce((s, x) => s + num(x), 0);
  const MR = (key) => `'${names.model}'!`;
  const tot = (key) => `SUM(${MR(key)}${span(key)})`;
  const checks = [
    ["Capex", app.capexEur, capex, D("capex"), "eur"],
    ["Loan", app.loanEur, loan, D("loan"), "eur"],
    ["Energy, year 1, MWh", num(app.energyKwh?.[0]) / 1000, vals.energy[1], `${MR()}C${M.energy}`, "eur"],
    ["Revenue over the life", sumv(app.revenue), sumv(vals.revenue.slice(1)), tot("revenue"), "eur"],
    ["EBITDA over the life", sumv(app.ebitda), sumv(vals.ebitda.slice(1)), tot("ebitda"), "eur"],
    ["Replacements over the life", sumv(app.sustaining), sumv(vals.sus.slice(1)), tot("sus"), "eur"],
    ["Tax over the life", sumv(app.tax), sumv(vals.tLev.slice(1)), tot("tLev"), "eur"],
    ["CFADS over the life", sumv(app.cfads), sumv(vals.cfads.slice(1)), tot("cfads"), "eur"],
    ["Debt service over the life", sumv(app.debtService), sumv(vals.ds.slice(1)), tot("ds"), "eur"],
    ["Lowest DSCR", app.dscrMin, R.dscrMin, `${MR()}C${resRow.dscrMin}`, "x"],
    ["Average DSCR, repayment years", app.dscrAvg, R.dscrAvg, `${MR()}C${resRow.dscrAvg}`, "x"],
    ["LLCR", app.llcr0, R.llcr, `${MR()}C${resRow.llcr}`, "x"],
    ["NPV", app.npv, R.npv, `${MR()}C${resRow.npv}`, "eur"],
    ["Project IRR", app.irr, R.irr, `${MR()}C${resRow.irr}`, "pct"],
    ["Equity IRR", app.equityIrr, R.eirr, `${MR()}C${resRow.eirr}`, "pct"],
  ].map(([label, appV, mirror, f2, s]) => ({ label: `${asset.name || pl.name}: ${label}`, app: appV == null ? null : num(appV), mirror: mirror == null ? null : num(mirror), f: fill(f2), s }));

  // where each figure lives, for the lender questions to cite
  const cells = {
    input: Object.fromEntries(Object.entries(rowOf).map(([k2, rr]) => [k2, `${names.inputs}!B${rr}`])),
    row: Object.fromEntries(Object.keys(M).map((k2) => [k2, `${names.model}, row ${M[k2]}`])),
    result: Object.fromEntries(Object.entries(resRow).map(([k2, rr]) => [k2, `${names.model}!C${rr}`])),
    tax: names.tax,
  };
  const agreed = checks.filter((x) => (x.app == null && x.mirror == null) || (x.app != null && x.mirror != null && Math.abs(x.app - x.mirror) <= Math.max(x.s === "eur" ? 1 : 1e-6, Math.abs(x.app) * 1e-9))).length;

  return {
    names, cells, agreed,
    sheets: [
      { name: names.inputs, rows: inputRows, widths: [62, 16, 14, ...Array.from({ length: H }, () => 12)], freeze: { row: 3 } },
      { name: names.model, rows: modelRows, widths: [52, 16, ...Array.from({ length: H }, () => 13)], freeze: { row: 1, col: 2 } },
      { name: names.tax, rows: taxRows, widths: [30, ...Array.from({ length: H }, () => 12)], freeze: { col: 1 } },
    ],
    checks,
  };
}

/**
 * The Checks sheet: each line the app's value, the spreadsheet's (a formula
 * into the model), the difference and OK, on a tolerance of one euro (or a
 * millionth, for a ratio or a rate).
 */
export function checksSheet(checks) {
  const rows = [
    [{ v: "Checks: the spreadsheet against the app", s: "bold" }],
    [{ v: "Column B is the app's own result (lib/plantFinance.js). Column C is this workbook's formula result; it recalculates when an input changes, so after an edit the two differ by design. OK means they agree within 1 EUR, or 0.000001 for a ratio or a rate.", s: "note" }],
    [{ v: "Figure", s: "head" }, { v: "App", s: "head" }, { v: "Spreadsheet", s: "head" }, { v: "Difference", s: "head" }, { v: "Agrees", s: "head" }],
  ];
  checks.forEach((c) => {
    const r = rows.length + 1;
    const tol = c.s === "eur" ? 1 : 0.000001;
    const ok = c.app == null && c.mirror == null ? true : c.app != null && c.mirror != null && Math.abs(c.app - c.mirror) <= Math.max(tol, Math.abs(c.app) * 1e-9);
    rows.push([
      c.label,
      c.app == null ? "" : { v: c.app, s: c.s },
      { v: c.mirror == null ? "" : c.mirror, f: `IFERROR(${c.f},"")`, s: c.s },
      { v: c.app == null || c.mirror == null ? "" : c.mirror - c.app, f: `IF(OR(B${r}="",C${r}=""),"",C${r}-B${r})`, s: c.s === "eur" ? "eur" : "num4" },
      { v: ok ? "OK" : "CHECK", f: `IF(AND(B${r}="",C${r}=""),"OK",IF(OR(B${r}="",C${r}=""),"CHECK",IF(ABS(C${r}-B${r})<=MAX(${tol},ABS(B${r})*0.000000001),"OK","CHECK")))` },
    ]);
  });
  return { name: "Checks", rows, widths: [60, 18, 18, 14, 10], freeze: { row: 3 } };
}
