// lib/lenderQuestions.js — "07-lender-questions.docx": the questions a credit
// officer asks of a renewable project, each answered with the model's own
// figure and the spreadsheet cell it comes from, in Romanian then English.
// Goes into the portfolio data room (lib/dataRoom.js) and the per-plant bank
// pack (lib/bankPack.js). Every number is read from the model; where the model
// has nothing (no inverter replacement, no decommissioning), the answer says
// so instead of filling a gap. Pure; no I/O.
import { buildDocx } from "./docx.js";
import { lt } from "./lenderText.js";
import { num, dscr, pct } from "./portfolioFormat.js";
import { normalizePlant, plantEnergy, plantHeadroom, plantReplacements } from "./plantFinance.js";
import { STRESS_DEFAULTS, normalizeScenario } from "./projectFinance.js";
import { plantModelSheets } from "./plantWorkbook.js";
import { cashflowEvents, eventText } from "./cashflowEvents.js";
import { caseLabel } from "./portfolioExport.js";
import { stillMissing, missingLine, gapText, gridText, llcr } from "./bankPack.js";

export const LENDER_LANGS = ["ro", "en"];

/**
 * @param {object} a
 * @param {object} a.model        lib/portfolioModel.js buildModel()
 * @param {string} [a.company]
 * @param {string} [a.generatedAt]  YYYY-MM-DD
 * @param {string} [a.todayKey]
 * @param {string} [a.reportId]
 * @returns {Uint8Array} the .docx
 */
export function lenderQuestionsDocx({ model, company = "", generatedAt = "", todayKey = generatedAt, reportId = "" }) {
  const { agg, fin, sizing } = model;
  const sc = normalizeScenario(model.scenario);
  const H = agg.cfads.length;
  const plants = model.assets.filter((a) => a.kind === "plant");
  const quotes = model.assets.filter((a) => a.kind !== "plant");
  const live = plants.map((a, k) => ({ a, pl: normalizePlant(a.plant), sheets: plantModelSheets({ asset: a, result: a.result, fin, scenario: sc, E: model.E, idx: k + 1 }) }));
  const hasDebt = fin.gearingPct > 0 && agg.loanEur > 0;
  const market = model.portfolio?.market || (model.markets || [])[0] || "MD";
  const drop = (STRESS_DEFAULTS[market] || STRESS_DEFAULTS.MD).tariffDropPct;
  const curtSt = Math.max(sc.curtailmentPct, (STRESS_DEFAULTS[market] || STRESS_DEFAULTS.MD).curtailmentPct);
  const name = model.portfolio?.name || (plants[0]?.name ?? "");
  const blocks = [];

  const section = (l) => {
    const n0 = (v) => num(v, l, 0), n1 = (v) => num(v, l, 1), n2 = (v) => num(v, l, 2);
    const fd = (v) => (v == null ? lt("na", l) : dscr(v, l));
    const fp = (v) => (v == null ? lt("na", l) : pct(v, l));
    const qa = (q, answers, where = []) => {
      blocks.push({ h2: lt(q, l) });
      for (const a of answers.filter(Boolean)) blocks.push(Array.isArray(a) ? { bullets: a } : { p: a });
      const w = where.filter(Boolean);
      if (w.length) blocks.push({ p: { text: lt("where", l, { x: w.join("; ") }), italic: true, color: "5B6A62", size: 18 } });
    };
    const each = (fn) => live.flatMap((x) => fn(x)).filter(Boolean);
    // a zero the developer never entered is said to be unset, not claimed as a fact
    const orUnset = (v) => (Number(v) > 0 ? n1(v) : lt("unset", l, { x: n1(0) }));
    const clipText = (pl, en) => (pl.solar?.clipCurve ? n1(en.solar?.clipPct || 0) : lt("uncomputed", l, { x: n1(0) }));
    const named = (x, s) => (live.length > 1 ? `${x.a.name}: ${s}` : s);

    blocks.push({ h1: lt("title", l, { name }) });
    blocks.push({ p: { text: lt("by", l, { co: company || "VoltMira", date: generatedAt, rid: reportId }), color: "5B6A62" } });
    blocks.push({ lead: lt("intro", l) });

    // 1. energy
    qa("q_energy", [
      ...each((x) => {
        const en = plantEnergy(x.pl), out = [];
        if (x.pl.wind) {
          const st = x.pl.wind.study;
          if (en.wind.source === "study") out.push(named(x, lt("a_wind_study", l, { by: st.by || "?", date: st.date ? `, ${st.date}` : "", p50: n0(st.p50Mwh), p90: n0(st.p90Mwh), basis: st.p90Basis ? lt("basis_" + st.p90Basis, l) : "", sig: n1(en.wind.sigmaPct) })));
          else if (en.wind.source === "screening") out.push(named(x, lt("a_wind_screen", l, { hub: n0(x.pl.wind.hubM), p50: n0(en.wind.p50Mwh), wl: n1(x.pl.wind.lossesPct), sig: n1(en.wind.sigmaPct) })));
          else out.push(named(x, lt("a_wind_none", l)));
        }
        if (x.pl.solar) {
          const sig = lt(en.solar.sigmaBasis === "study" ? "sig_study" : en.solar.sigmaBasis === "site" ? "sig_site" : "sig_assumed", l);
          if (en.solar.source === "study") out.push(named(x, lt("a_solar_study", l, { p50: n0(en.solar.p50Mwh), sig: n1(en.solar.sigmaPct), basis: sig })));
          else if (en.solar.source === "none") out.push(named(x, lt("a_solar_none", l)));
          else out.push(named(x, lt("a_solar_pvgis", l, { y: n0(x.pl.solar.yieldKwhKwp), years: x.pl.solar.variabilityYears ? lt("years_w", l, { x: x.pl.solar.variabilityYears }) : "",
            av: orUnset(x.pl.solar.availabilityPct), clip: clipText(x.pl, en), p50: n0(en.solar.p50Mwh), sig: n1(en.solar.sigmaPct), basis: sig })));
        }
        const p90 = (x.a.p90Year1Kwh ?? 0) / 1000;
        out.push(named(x, lt("a_p90", l, { p90: n0(p90), p50: n0(en.p50Mwh) })));
        return out;
      }),
      quotes.length ? lt("a_quotes_energy", l, { n: quotes.length }) : null,
    ], each((x) => [x.sheets.cells.input.windP50, x.sheets.cells.input.solarP50, x.sheets.cells.input.z]));

    // 2. losses
    qa("q_losses", each((x) => [
      x.pl.solar ? named(x, lt("a_losses_solar", l, { degr: n2(x.pl.solar.degrPctYr), degr1: orUnset(x.pl.solar.degrFirstPct), av: orUnset(x.pl.solar.availabilityPct), clip: clipText(x.pl, plantEnergy(x.pl)) })) : null,
      x.pl.wind ? named(x, lt("a_losses_wind", l, { x: x.pl.wind.study?.p50Mwh > 0 ? lt("wl_study", l) : lt("wl_screen", l, { n: n1(x.pl.wind.lossesPct) }) })) : null,
      named(x, lt("a_losses_grid", l, { curt: n1(sc.curtailmentPct), st: n1(curtSt), line: n1(x.pl.grid?.applied?.lossPct || 0) })),
    ]), each((x) => [x.sheets.cells.input.degr, x.sheets.cells.input.curt, x.sheets.cells.input.line]));

    // 3. price
    qa("q_price", each((x) => {
      const r = x.pl.revenue;
      const out = [r.kind === "merchant"
        ? named(x, lt("a_price_merchant", l, { price: n2(r.priceEurMwh || r.afterEurMwh), drop }))
        : named(x, lt("a_price_contract", l, { kind: lt(r.kind === "ppa" ? "kind_ppa" : "kind_auction", l), price: n2(r.priceEurMwh), years: r.years, idx: n1(r.indexPct), cur: lt(r.currency === "local" ? "cur_local" : "cur_eur", l), next: r.years + 1, after: n2(r.afterEurMwh), drop }))];
      if (x.pl.bess && r.bessEurPerMwYr > 0) out.push(named(x, lt("a_price_bess", l, { x: n0(r.bessEurPerMwYr), y: r.bessYears })));
      return out;
    }), each((x) => [x.sheets.cells.input.price, x.sheets.cells.input.mBase, x.sheets.cells.row.price]));

    // 4. opex
    qa("q_opex", each((x) => {
      const c = x.pl.costs;
      const lines = [x.pl.wind && lt("op_wind", l, { x: n1(c.opexWindEurPerKwYr) }), x.pl.solar && lt("op_solar", l, { x: n1(c.opexSolarEurPerKwYr) }),
        x.pl.bess && lt("op_bess", l, { x: n1(c.opexBessEurPerKwhYr) }), lt("op_land", l, { x: n0(c.landEurYr) }), lt("op_ins", l, { x: n2(c.insurancePct) })].filter(Boolean);
      const s = lines.join("; ");
      return [named(x, lt("a_opex", l, { lines: s.charAt(0).toUpperCase() + s.slice(1), infl: n1(Number(model.E?.bands?.expc?.infl ?? 2.5)), tot: n0(x.a.result.opex[0]) }))];
    }), each((x) => [x.sheets.cells.input.opW, x.sheets.cells.row.opex]));

    // 5. replacements and reserves
    const reserve = hasDebt && fin.dsraMonths > 0 ? lt("a_dsra_set", l, { m: n1(fin.dsraMonths), eur: n0(agg.dsraEur) }) : lt("a_dsra_none", l);
    qa("q_repl", [
      ...each((x) => {
        const c = x.pl.costs, infl = Number(model.E?.bands?.expc?.infl ?? 2.5) / 100;
        const rep = plantReplacements(x.pl, H, infl);
        const out = [];
        if (x.pl.solar) out.push(named(x, c.invReplaceYear > 0 && c.invReplaceEurPerKw > 0 && c.invReplaceYear <= H ? lt("a_inv_set", l, { y: Math.round(c.invReplaceYear), eur: n0(c.invReplaceEurPerKw), tot: n0(rep[Math.round(c.invReplaceYear) - 1] * sc.capexMultiplier) }) : lt("a_inv_none", l)));
        if (x.pl.bess) out.push(named(x, c.bessAugYear > 0 && c.bessAugEurPerKwh > 0 && c.bessAugYear <= H ? lt("a_aug_set", l, { y: Math.round(c.bessAugYear), eur: n0(c.bessAugEurPerKwh), tot: n0(x.pl.bess.mwh * 1000 * c.bessAugEurPerKwh * Math.pow(1 + infl, Math.round(c.bessAugYear) - 1) * sc.capexMultiplier) }) : lt("a_aug_none", l)));
        return out;
      }),
      quotes.length ? (fin.quoteInvYear > 0 && fin.quoteInvEurPerKw > 0 ? lt("a_qinv_set", l, { y: fin.quoteInvYear, eur: n0(fin.quoteInvEurPerKw) }) : lt("a_qinv_none", l)) : null,
      reserve,
    ], each((x) => [x.sheets.cells.input.invYear, x.sheets.cells.row.sus, x.sheets.cells.input.dsra]));

    // 6. tax
    qa("q_tax", [fin.taxPct > 0
      ? lt("a_tax", l, { rate: n1(fin.taxPct), life: fin.taxLifeYears, lapse: fin.taxLossYears > 0 ? lt("lapse_n", l, { n: fin.taxLossYears }) : lt("lapse_none", l) })
      : lt("a_tax_none", l)], each((x) => [x.sheets.cells.input.taxPct, x.sheets.cells.tax]));

    // 7. debt
    const capexNet = agg.capexEur - agg.grantEur;
    qa("q_debt", [hasDebt
      ? lt("a_debt", l, { loan: n0(agg.loanEur), share: n1((agg.loanEur / Math.max(1, capexNet + agg.idcEur)) * 100), rate: n2(fin.ratePct),
        steps: fin.rateSteps ? lt("steps", l, { x: fin.rateSteps.map((v) => n2(v)).join(" / ") }) : "", tenor: fin.tenorYears, grace: fin.graceYears,
        profile: lt(fin.repayment === "sculpted" ? "prof_sculpted" : "prof_annuity", l), fee: n2(fin.feePct), idc: n0(agg.idcEur), months: fin.constructionMonths,
        cur: lt(fin.debtCurrency === "local" ? "cur_local" : "cur_eur", l) })
      : lt("a_debt_none", l), reserve], each((x) => [x.sheets.cells.input.loan, x.sheets.cells.input.rate, x.sheets.cells.row.pay]));

    // 8. cover
    if (hasDebt) {
      qa("q_cover", [lt("a_cover", l, {
        min: fd(agg.dscrMin), minR: fd(agg.dscrMinRepay), io: agg.dscrIo != null ? lt("io", l, { x: fd(agg.dscrIo) }) : "", p90: fd(model.p90.dscrMin), avg: fd(agg.dscrAvg),
        llcr: fd(llcr(agg.cfads, agg.loanEur, fin)), llcr90: fd(llcr(model.p90.cfads, agg.loanEur, fin)), t50: dscr(sizing.p50Dscr, l), t90: dscr(sizing.p90Dscr, l),
      })], each((x) => [x.sheets.cells.result.dscrMin, x.sheets.cells.result.llcr, x.sheets.cells.row.dscr]));
    }

    // 9. stress and break-evens
    const t = dscr(sizing.p50Dscr, l);
    qa("q_stress", [
      model.suite.map((s) => lt("st_line", l, { case: caseLabel(s.id, l, market), d: fd(s.agg.dscrMin), irr: fp(s.agg.irr) })),
      ...each((x) => {
        if (!hasDebt) return [];
        const hr = plantHeadroom(x.pl, model.E, fin, sc, sizing.p50Dscr);
        return [
          hr.energyHeadroomPct != null ? lt(hr.energyHeadroomPct >= 0 ? "hr_energy" : "hr_energy_neg", l, { name: x.a.name, x: n1(Math.abs(hr.energyHeadroomPct)), t }) : null,
          hr.capexHeadroomPct != null ? lt(hr.capexHeadroomPct >= 0 ? "hr_capex" : "hr_capex_neg", l, { name: x.a.name, x: n1(Math.abs(hr.capexHeadroomPct)), t }) : null,
        ];
      }),
    ], ["Stress"]);

    // 10. the steps in the cash flow
    const ev = cashflowEvents({ agg, fin, scenario: sc, assets: model.assets, E: model.E });
    qa("q_steps", [ev.length ? ev.map((e) => eventText(e, l, (v) => `${n0(v)} EUR`)) : lt("a_steps_none", l)], ["Cashflow", ...each((x) => [x.sheets.cells.row.cfads])]);

    // 11. sources and uses
    const su = model.sourcesUses;
    qa("q_su", [lt("a_su", l, { capex: n0(su.uses.capexEur), idc: n0(su.uses.idcEur), fee: n0(su.uses.feeEur), dsra: n0(su.uses.dsraEur), tu: n0(su.uses.totalEur),
      grant: n0(su.sources.grantEur), debt: n0(su.sources.debtEur), eq: n0(su.sources.equityEur), ts: n0(su.sources.totalEur) })], ["SourcesUses"]);

    // 12. permits, grid and land
    qa("q_permits", [
      ...each((x) => {
        const miss = stillMissing(x.pl, todayKey);
        const grid = gridText(x.pl, l, (v) => `${n0(v)} EUR`);
        return [named(x, lt("a_permits", l, { done: miss.progress.done, total: miss.progress.total }) + (grid ? ` ${grid}` : "")),
          miss.count ? [...miss.gaps.map((g) => gapText(g, l)), ...miss.items.map((r) => missingLine(r, l))] : lt("a_permits_all", l)];
      }),
      quotes.length ? lt("a_docs_quotes", l, { pct: n0(model.readiness.docsPct) }) : null,
    ], ["Documents"]);

    // 13. E&S
    qa("q_es", [lt("a_es", l, { answered: model.esProgress.answered, total: model.esProgress.total, flagged: model.esProgress.flagged })], ["E&S"]);

    // 14. war and political risk
    const ua = model.assets.some((a) => a.market === "UA");
    qa("q_war", [sc.warRiskPremiumPct > 0 ? lt("a_war_base", l, { x: n2(sc.warRiskPremiumPct) }) : lt("a_war_none", l),
      ua ? lt("a_war_stress", l, { x: n2(STRESS_DEFAULTS.UA.warRiskPremiumPct) }) : null, lt("a_war_cover", l)], each((x) => [x.sheets.cells.input.war]));

    // 15. decommissioning
    if (fin.endCostPct > 0 || fin.endValuePct > 0) {
      const g = Math.pow(1 + Number(model.E?.bands?.expc?.infl ?? 2.5) / 100, H - 1);
      const cost = agg.capexEur * (fin.endCostPct / 100) * g, val = agg.capexEur * (fin.endValuePct / 100) * g;
      qa("q_decom", [lt("a_decom_set", l, { h: H, cost: n0(cost), c: n1(fin.endCostPct), val: n0(val), v: n1(fin.endValuePct), net: n0(val - cost) })],
        each((x) => [x.sheets.cells.input.endCost, x.sheets.cells.input.endCash]));
    } else {
      qa("q_decom", [lt("a_decom", l, { h: H })]);
    }

    // 16. who
    qa("q_who", [lt("a_who", l, { co: company || "VoltMira", date: generatedAt, rid: reportId })]);

    // 17. the Excel
    const all = live.reduce((s, x) => s + x.sheets.checks.length, 0);
    const ok = live.reduce((s, x) => s + x.sheets.agreed, 0);
    qa("q_excel", [live.length ? lt("a_excel", l, { n: live[0].sheets.checks.length, ok, all }) : null, quotes.length ? lt("a_excel_quotes", l, { n: quotes.length }) : null], ["Checks"]);
  };

  LENDER_LANGS.forEach((l, i) => { if (i) blocks.push({ pageBreak: true }); section(l); });
  return buildDocx(blocks, { title: lt("title", "en", { name }), subject: reportId, creator: company || "VoltMira" });
}

