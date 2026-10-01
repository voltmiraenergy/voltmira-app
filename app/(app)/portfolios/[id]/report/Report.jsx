// app/(app)/portfolios/[id]/report/Report.jsx — the bankability report, as a
// document: summary, projects, technical basis, financial model, sensitivity,
// risk matrix, environmental and social screening, document register, and what
// the report is not. Server-rendered from the same model the page and the Excel
// workbook use (lib/portfolioModel.js), in the language the caller picked. The
// PDF route captures this page; on screen it is a preview.
import { pt } from "../../../../../lib/portfolioText.js";
import { eur, eurCompact, pct, dscr, num, mwhUnit, kwpUnit, dscrTone } from "../../../../../lib/portfolioFormat.js";
import { caseLabel, riskRows, documentRows, esRows } from "../../../../../lib/portfolioExport.js";
import { SIGMA_PCT, Z } from "../../../../../lib/projectFinance.js";
import { GRID_EMISSION_FACTOR } from "../../../../../lib/esScreening.js";
import { FINANCING_PRESETS } from "../../../../../lib/financingPresets.js";
import CashflowChart from "../../../../../components/CashflowChart.jsx";

const Row = ({ k, v }) => <tr><th scope="row">{k}</th><td>{v}</td></tr>;

export default function Report({ model, lang, company, date }) {
  const { agg, fin, scenario, suite, risks, assets } = model;
  const market = model.portfolio?.market || "MD";
  const p90f = 1 - (Z.P90 * SIGMA_PCT) / 100;
  const preset = FINANCING_PRESETS.find((x) => x.id === fin.preset || x.id === model.portfolio?.finance?.preset);
  const impact = model.es?.impact || {};
  const answers = model.es?.answers || {};
  const rr = riskRows(model, lang);
  const docs = documentRows(model, lang);
  const es = esRows(model, lang);
  const none = pt("na", lang);
  const f = (v) => (v == null ? none : pct(v, lang));
  const years = agg.cfads.length;
  const shown = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 12, 15, 20, years].filter((y, i, a) => y <= years && a.indexOf(y) === i);
  const mw = agg.kwp >= 1000 ? `${num(agg.kwp / 1000, lang, 2)} MW` : `${num(agg.kwp, lang, 0)} ${kwpUnit(lang)}`;

  return (
    <article className="rp" lang={lang}>
      {/* ---- 1: summary */}
      <section className="rp-page rp-cover">
        <p className="rp-kicker">{pt("r_title", lang)}</p>
        <h1>{model.portfolio?.name || ""}</h1>
        <p className="rp-meta">{[pt("r_prepared", lang, { co: company || "VoltMira" }), date, pt(market === "UA" ? "market_ua" : "market_md", lang), pt("all_eur", lang)].filter(Boolean).join(", ")}</p>
        <h2>{pt("r_summary", lang)}</h2>
        <div className="rp-kpis">
          <div><span>{pt("k_assets", lang)}</span><b>{agg.count}</b><small>{mw}</small></div>
          <div><span>{pt("k_capex", lang)}</span><b>{eurCompact(agg.capexEur, lang)}</b><small>{pt("k_debt", lang)} {eurCompact(agg.loanEur, lang)}, {pt("k_equity", lang)} {eurCompact(agg.equityEur, lang)}</small></div>
          <div><span>{pt("k_irr", lang)}</span><b>{f(agg.irr)}</b><small>{pt("k_eirr", lang)} {f(agg.equityIrr)}</small></div>
          <div><span>{pt("k_npv", lang)}</span><b>{eurCompact(agg.npv, lang)}</b><small>{fin.discPct}%</small></div>
          <div className={"t-" + dscrTone(agg.dscrMin)}><span>{pt("k_dscr", lang)}</span><b>{agg.dscrMin == null ? none : dscr(agg.dscrMin, lang)}</b><small>{agg.dscrMin == null ? pt("no_debt", lang) : `${pt("k_dscr_avg", lang)} ${dscr(agg.dscrAvg, lang)}`}</small></div>
          <div><span>{pt("k_energy", lang)}</span><b>{num(agg.year1Mwh, lang, 0)}</b><small>{mwhUnit(lang)}, {pt("k_co2", lang)} {num(model.co2.tPerYear, lang, 0)} t</small></div>
        </div>
        <table className="rp-kv"><tbody>
          <Row k={pt("k_weakest", lang)} v={agg.weakest ? `${agg.weakest.name}, DSCR ${dscr(agg.weakest.dscrMin, lang)}` : none} />
          <Row k={pt("k_payback", lang)} v={agg.paybackYears == null ? "25+ " + pt("years_w", lang) : `${num(agg.paybackYears, lang, 1)} ${pt("years_w", lang)}`} />
          <Row k={pt("k_readiness", lang)} v={`${Math.round(model.readiness.docsPct)}%`} />
          <Row k={pt("k_screening", lang)} v={`${model.esProgress.answered}/${model.esProgress.total}`} />
        </tbody></table>
        <CashflowChart cfads={agg.cfads} debtService={agg.debtService} lang={lang} years={years} bare />
      </section>

      {/* ---- 2: projects */}
      <section className="rp-page">
        <h2>{pt("r_projects", lang)}</h2>
        <table className="rp-t"><thead><tr>
          <th>{pt("col_asset", lang)}</th><th>{pt("col_area", lang)}</th><th className="r">{kwpUnit(lang)}</th><th className="r">{pt("col_capex", lang)}</th>
          <th className="r">{pt("k_debt", lang)}</th><th className="r">{pt("col_irr", lang)}</th><th className="r">{pt("col_npv", lang)}</th><th className="r">{pt("col_dscr", lang)}</th>
        </tr></thead><tbody>
          {assets.map((a) => (
            <tr key={a.id}><td><b>{a.name}</b><small>{pt(a.market === "UA" ? "market_ua" : "market_md", lang)}{a.address ? `, ${a.address}` : ""}</small></td>
              <td>{a.regionName || ""}</td><td className="r">{num(a.kw, lang, 1)}</td><td className="r">{eur(a.result.capexEur, lang)}</td><td className="r">{eur(a.result.loanEur, lang)}</td>
              <td className="r">{f(a.result.irr)}</td><td className="r">{eur(a.result.npv, lang)}</td><td className="r">{a.result.dscrMin == null ? "" : dscr(a.result.dscrMin, lang)}</td></tr>
          ))}
        </tbody><tfoot><tr><td>{pt("k_assets", lang)}: {agg.count}</td><td /><td className="r">{num(agg.kwp, lang, 1)}</td><td className="r">{eur(agg.capexEur, lang)}</td><td className="r">{eur(agg.loanEur, lang)}</td><td className="r">{f(agg.irr)}</td><td className="r">{eur(agg.npv, lang)}</td><td className="r">{agg.dscrMin == null ? "" : dscr(agg.dscrMin, lang)}</td></tr></tfoot></table>
        {agg.byRegion.filter((r) => r.key).length > 0 && (
          <>
            <h3>{pt("by_area", lang)}</h3>
            <table className="rp-kv"><tbody>
              {agg.byRegion.map((r) => <Row key={r.key || "none"} k={r.key ? assets.find((x) => x.region === r.key)?.regionName || r.key : pt("unknown_area", lang)} v={`${Math.round(r.sharePct)}%`} />)}
            </tbody></table>
          </>
        )}
      </section>

      {/* ---- 3: technical basis */}
      <section className="rp-page">
        <h2>{pt("r_technical", lang)}</h2>
        <p>{pt("r_tech_p", lang)}</p>
        <table className="rp-t"><thead><tr>
          <th>{pt("col_asset", lang)}</th><th className="r">{kwpUnit(lang)}</th><th className="r">P50, {mwhUnit(lang)}</th><th className="r">P90, {mwhUnit(lang)}</th><th className="r">{pt("k_energy", lang)}, {lang === "ru" ? "кВт·ч" : lang === "uk" ? "кВт·год" : "kWh"}/{kwpUnit(lang)}</th>
        </tr></thead><tbody>
          {assets.map((a) => (
            <tr key={a.id}><td>{a.name}</td><td className="r">{num(a.kw, lang, 1)}</td><td className="r">{num(a.result.year1Kwh / 1000, lang, 0)}</td>
              <td className="r">{num((a.result.year1Kwh * p90f) / 1000, lang, 0)}</td><td className="r">{a.kw > 0 ? num(a.result.year1Kwh / a.kw, lang, 0) : ""}</td></tr>
          ))}
        </tbody></table>
        <p className="rp-small">{model.markets.map((m) => `${m}: ${GRID_EMISSION_FACTOR[m]?.tPerMwh} t CO2/MWh (${GRID_EMISSION_FACTOR[m]?.source})`).join(". ")}.</p>
      </section>

      {/* ---- 4: financial model */}
      <section className="rp-page">
        <h2>{pt("r_financial", lang)}</h2>
        <h3>{pt("r_assumptions", lang)}</h3>
        <div className="rp-two">
          <table className="rp-kv"><tbody>
            <Row k={pt("f_gearing", lang)} v={`${fin.gearingPct}%`} />
            <Row k={pt("f_rate", lang)} v={`${fin.ratePct}%`} />
            {fin.rateSteps && <Row k={pt("f_steps", lang)} v={fin.rateSteps.join(", ")} />}
            <Row k={pt("f_tenor", lang)} v={fin.tenorYears} />
            <Row k={pt("f_disc", lang)} v={`${fin.discPct}%`} />
            <Row k={pt("f_currency", lang)} v={fin.debtCurrency === "local" ? pt("f_cur_local", lang) : "EUR"} />
            {fin.grantPct > 0 && <Row k={pt("f_grant", lang)} v={`${fin.grantPct}%${fin.grantCapEur ? `, max ${eur(fin.grantCapEur, lang)}` : ""}`} />}
            {fin.principalCompensationPct > 0 && <Row k={pt("f_comp", lang)} v={`${fin.principalCompensationPct}%`} />}
          </tbody></table>
          <table className="rp-kv"><tbody>
            <Row k={pt("sc_tariff", lang)} v={`${Math.round(scenario.tariffMultiplier * 100)}%`} />
            <Row k={pt("sc_esc", lang)} v={scenario.tariffEscalationPct == null ? pt("sc_esc_engine", lang) : `${scenario.tariffEscalationPct}%`} />
            <Row k={pt("sc_curt", lang)} v={`${scenario.curtailmentPct}%`} />
            <Row k={pt("sc_delay", lang)} v={scenario.delayMonths} />
            <Row k={pt("sc_dep", lang)} v={`${scenario.localDepreciationPctYr}%`} />
            <Row k={pt("sc_war", lang)} v={`${scenario.warRiskPremiumPct}%`} />
            <Row k={pt("sc_capex", lang)} v={`${Math.round(scenario.capexMultiplier * 100)}%`} />
            <Row k={pt("ppa_h", lang)} v={scenario.ppa ? `${scenario.ppa.sharePct}%, ${scenario.ppa.priceEurMwh} EUR/MWh, ${scenario.ppa.years} ${pt("years_w", lang)}` : pt("ppa_none", lang)} />
          </tbody></table>
        </div>
        {preset && <p className="rp-small">{preset.name[lang] || preset.name.en}: {preset.note[lang] || preset.note.en}{preset.source ? ` (${preset.source.label}, ${preset.source.url})` : ""}</p>}
        <p className="rp-small">{pt("f_note", lang)}</p>
        <h3>{pt("r_cashflow", lang)}</h3>
        <table className="rp-t rp-cf"><thead><tr>
          <th>{pt("r_year", lang)}</th><th className="r">{pt("r_cfads", lang)}</th><th className="r">{pt("r_ds", lang)}</th><th className="r">DSCR</th>
        </tr></thead><tbody>
          {shown.map((y) => (
            <tr key={y}><td>{y}</td><td className="r">{eur(agg.cfads[y - 1], lang)}</td><td className="r">{agg.debtService[y - 1] > 1e-9 ? eur(agg.debtService[y - 1], lang) : ""}</td>
              <td className="r">{agg.debtService[y - 1] > 1e-9 ? dscr(agg.dscrByYear[y - 1], lang) : ""}</td></tr>
          ))}
        </tbody></table>
      </section>

      {/* ---- 5: sensitivity */}
      <section className="rp-page">
        <h2>{pt("r_sensitivity", lang)}</h2>
        <p className="rp-small">{pt("st_h", lang)}</p>
        <table className="rp-t"><thead><tr>
          <th>{pt("st_case", lang)}</th><th className="r">{pt("col_dscr", lang)}</th><th className="r">{pt("col_irr", lang)}</th><th className="r">{pt("col_npv", lang)}</th><th className="r">{pt("st_dnpv", lang)}</th>
        </tr></thead><tbody>
          {suite.map((s) => (
            <tr key={s.id}><td>{caseLabel(s.id, lang, market)}</td>
              <td className={"r t-" + dscrTone(s.agg.dscrMin)}>{s.agg.dscrMin == null ? none : dscr(s.agg.dscrMin, lang)}</td>
              <td className="r">{f(s.agg.irr)}</td><td className="r">{eur(s.agg.npv, lang)}</td>
              <td className="r">{s.id === "base" ? "" : `${s.agg.npv - suite[0].agg.npv >= 0 ? "+" : "−"}${eur(Math.abs(s.agg.npv - suite[0].agg.npv), lang)}`}</td></tr>
          ))}
        </tbody></table>
      </section>

      {/* ---- 6: risks */}
      <section className="rp-page">
        <h2>{pt("r_risks", lang)}</h2>
        <p className="rp-small">{pt("rk_h", lang)}</p>
        <table className="rp-t"><thead><tr><th>{pt("s_risks", lang)}</th><th>{pt("r_status", lang)}</th><th className="r" /><th /></tr></thead><tbody>
          {rr.map((r, i) => (
            <tr key={i}><td><b>{r[0]}</b></td><td><span className={"rp-lv lv-" + risks[i].level}>{r[1]}</span></td><td className="r">{r[2]}</td><td className="rp-rule">{r[3]}</td></tr>
          ))}
        </tbody></table>
      </section>

      {/* ---- 7: E&S */}
      <section className="rp-page">
        <h2>{pt("r_es", lang)}</h2>
        <p className="rp-small">{pt("es_h", lang)}</p>
        <table className="rp-t rp-es"><thead><tr><th>Standard</th><th /><th>{pt("r_status", lang)}</th><th>{pt("es_note", lang)}</th></tr></thead><tbody>
          {es.slice(1).map((r, i) => <tr key={i}><td className="nw">{r[0]}</td><td>{r[1]}</td><td className="nw">{r[2]}</td><td>{r[3]}</td></tr>)}
        </tbody></table>
        <h3>{pt("es_impact", lang)}</h3>
        <table className="rp-kv"><tbody>
          <Row k={`${pt("k_co2", lang)} (t)`} v={num(model.co2.tPerYear, lang, 0)} />
          <Row k={`${pt("es_co2_l", lang)} (t)`} v={num(model.co2.tLifetime, lang, 0)} />
          <Row k={pt("es_jobs_c", lang)} v={impact.jobsConstruction === "" || impact.jobsConstruction == null ? "-" : num(impact.jobsConstruction, lang, 0)} />
          <Row k={pt("es_jobs_p", lang)} v={impact.jobsPermanent === "" || impact.jobsPermanent == null ? "-" : num(impact.jobsPermanent, lang, 0)} />
          <Row k={pt("es_women", lang)} v={impact.womenPct === "" || impact.womenPct == null ? "-" : `${num(impact.womenPct, lang, 0)}%`} />
        </tbody></table>
        <p className="rp-small">{pt("es_cbam", lang)}</p>
      </section>

      {/* ---- 8: documents, and the limits */}
      <section className="rp-page">
        <h2>{pt("r_docs", lang)}</h2>
        <p className="rp-small">{pt("docs_h", lang)}</p>
        <table className="rp-t rp-docs"><thead><tr>{docs[0].map((h, i) => <th key={i}>{h}</th>)}</tr></thead><tbody>
          {docs.slice(1).map((r, i) => <tr key={i}>{r.map((c, j) => <td key={j} className={j ? "ds-" + (c === pt("ds_done", lang) ? "done" : c === pt("ds_draft", lang) ? "draft" : "missing") : ""}>{c}</td>)}</tr>)}
        </tbody></table>
        <h2 className="rp-limits-h">{pt("r_limits", lang)}</h2>
        <p>{pt("r_limits_p", lang)}</p>
      </section>
    </article>
  );
}
