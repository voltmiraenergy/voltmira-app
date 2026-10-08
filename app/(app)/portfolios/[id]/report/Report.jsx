// app/(app)/portfolios/[id]/report/Report.jsx — the bankability report, as a
// document: a cover, contents and key messages, then the assets, the technical
// basis, the financing and debt sizing, cash flow and cover, sensitivity, the
// risk matrix, the E&S screening, readiness and documents, and the sources and
// limits. Server-rendered from the same model the page, the teaser and the
// Excel workbook use (lib/portfolioModel.js), in the language the caller picked
// and the display currency they chose. The PDF route captures this page with
// scripts blocked, so every chart here is plain SVG or HTML.
import { pt } from "../../../../../lib/portfolioText.js";
import { pct, dscr, num, mwhUnit, kwpUnit, dscrTone, capacity } from "../../../../../lib/portfolioFormat.js";
import { caseLabel, riskRows, documentRows, esRows, presetSources } from "../../../../../lib/portfolioExport.js";
import { keyMessages, fxNote, structureName, termsLine, taxLine } from "../../../../../lib/portfolioDisplay.js";
import { sortTornado } from "../../../../../lib/portfolioSensitivity.js";
import { SIGMA_PCT, Z } from "../../../../../lib/projectFinance.js";
import { GRID_EMISSION_FACTOR } from "../../../../../lib/esScreening.js";
import { FINANCING_PRESETS } from "../../../../../lib/financingPresets.js";
import { TILE_ATTRIBUTION } from "../../../../../lib/portfolioMap.js";
import CashflowChart from "../../../../../components/CashflowChart.jsx";
import DscrChart from "../../../../../components/portfolio/DscrChart.jsx";
import TornadoChart from "../../../../../components/portfolio/TornadoChart.jsx";
import SourcesUses from "../../../../../components/portfolio/SourcesUses.jsx";
import StaticMap from "../../../../../components/portfolio/StaticMap.jsx";
import ReadinessPanel from "../../../../../components/portfolio/ReadinessPanel.jsx";
import MarketContext from "../../../../../components/portfolio/MarketContext.jsx";
import { et } from "../../../../../lib/energyText.js";
import { plt } from "../../../../../lib/plantText.js";
import PlantReport from "../../../../../components/portfolio/PlantReport.jsx";
import { mdDayKey } from "../../../../../lib/tz.js";

const Row = ({ k, v }) => <tr><th scope="row">{k}</th><td>{v}</td></tr>;
/** Today in Moldova, for what is overdue on a plant's checklist. */
const todayKey = () => mdDayKey(Date.now());

/** The numbered sections, in order: the contents list and the headings read
 *  the same table. A Moldovan portfolio adds the market context after the
 *  summary (components/portfolio/MarketContext.jsx). */
const SECTIONS = ["r_summary", "r_assets", "r_technical", "r_debt", "r_cover_cf", "r_sensitivity", "r_risks", "r_es", "r_ready", "r_sources"];
/** The sections this portfolio's report has: the market context for Moldova,
 *  the map page when an asset has a position, the plants when there are any. */
function sectionsFor(market, { map = false, plants = false } = {}) {
  const out = [];
  for (const id of SECTIONS) {
    out.push(id);
    if (id === "r_summary" && market === "MD") out.push("r_market");
    if (id === "r_assets" && map) out.push("r_map");
    if (id === "r_technical" && plants) out.push("r_plants");
  }
  return out;
}
const sectionName = (id, lang) => (id === "r_market" ? et("mk_title", lang) : id === "r_map" ? plt("r_map", lang) : id === "r_plants" ? plt("r_plants", lang) : pt(id, lang));
const H2 = ({ id, lang, sections }) => <h2><span className="rp-num">{sections.indexOf(id) + 1}</span>{sectionName(id, lang)}</h2>;

export default function Report({ model, lang, company, date, money, fx }) {
  const { agg, fin, scenario, suite, risks, assets, sizing } = model;
  const market = model.portfolio?.market || "MD";
  const hasPlants = model.assets.some((a) => a.kind === "plant");
  const sections = sectionsFor(market, { map: model.assets.some((a) => a.lat != null), plants: hasPlants });
  const anySample = model.assets.some((a) => a.kind === "plant" && a.plant.sample);
  const p90f = 1 - (Z.P90 * SIGMA_PCT) / 100;
  const preset = FINANCING_PRESETS.find((x) => x.id === model.portfolio?.finance?.preset);
  const impact = model.es?.impact || {};
  const rr = riskRows(model, lang);
  // the stress table's shortfall column, when a reserve is set or a case runs short
  const showShort = fin.dsraMonths > 0 || suite.some((s) => s.agg.shortfallEur > 0.5);
  const docs = documentRows(model, lang);
  const es = esRows(model, lang);
  const none = pt("na", lang);
  const f = (v) => (v == null ? none : pct(v, lang));
  const fd = (v) => (v == null ? none : dscr(v, lang));
  const years = agg.cfads.length;
  const shown = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 12, 15, 20, years].filter((y, i, a) => y <= years && a.indexOf(y) === i);
  const cur = money.cur;
  const msgs = keyMessages(model, lang, money);
  const hasDebt = fin.gearingPct > 0;
  const torMetric = hasDebt && agg.dscrMin != null ? "dscrMin" : "npv";
  const torRows = sortTornado(model.sensitivity, torMetric);
  const located = assets.filter((a) => a.lat != null);
  const sources = presetSources(model.portfolio?.finance, lang);
  const p90Dscr = model.p90.dscrByYear;
  const recoLabel = pt("ds_reco", lang, { g: "" }).replace(/:\s*%$/, "");

  return (
    <article className="rp" lang={lang}>
      {/* ---- cover */}
      <section className="rp-page rp-cover">
        <div className="rp-cover-top">
          <p className="rp-kicker">{pt("r_title", lang)}</p>
          <h1>{model.portfolio?.name || ""}</h1>
          <p className="rp-meta">{[pt("r_prepared", lang, { co: company || "VoltMira" }), date].filter(Boolean).join(", ")}</p>
        </div>
        <div className="rp-facts">
          <div><span>{pt("k_assets", lang)}</span><b>{agg.count}</b><small>{capacity(agg.kwp, lang)}, {pt(market === "UA" ? "market_ua" : "market_md", lang)}</small></div>
          <div><span>{pt("k_capex", lang)}</span><b>{money.compact(agg.capexEur)}</b><small>{cur}</small></div>
          <div><span>{pt("ds_capacity", lang)}</span><b>{money.compact(sizing.capacityEur)}</b><small>{cur}, {dscr(sizing.p50Dscr, lang)} P50, {dscr(sizing.p90Dscr, lang)} P90</small></div>
          <div><span>{pt("k_dscr_p50", lang)}</span><b>{fd(agg.dscrMin)}</b><small>P90 {fd(model.p90.dscrMin)}</small></div>
          <div><span>{pt("k_irr", lang)}</span><b>{f(agg.irr)}</b><small>{pt("k_eirr", lang)} {f(agg.equityIrr)}</small></div>
          <div><span>{pt("s_ready", lang)}</span><b>{Math.round(model.readiness.score)}</b><small>{pt("rd_of", lang)}</small></div>
        </div>
        <div className="rp-cover-foot">
          <p>{pt("r_for", lang)}</p>
          <p className="rp-small">{fxNote(lang, cur, fx)}</p>
          {anySample && <p className="rp-sample-note"><b>{plt("sample_badge", lang)}.</b> {plt("sample_note", lang)}</p>}
        </div>
      </section>

      {/* ---- contents and summary */}
      <section className="rp-page">
        <h2 className="rp-plain">{pt("r_contents", lang)}</h2>
        <ol className="rp-toc">{sections.map((id) => <li key={id}>{sectionName(id, lang)}</li>)}</ol>
        <H2 sections={sections} id="r_summary" lang={lang} />
        <h3>{pt("r_messages", lang)}</h3>
        <ul className="rp-msgs">{msgs.map((m, i) => <li key={i}>{m}</li>)}</ul>
        <div className="rp-kpis">
          <div><span>{pt("k_assets", lang)}</span><b>{agg.count}</b><small>{capacity(agg.kwp, lang)}, {num(agg.year1Mwh, lang, 0)} {mwhUnit(lang)}</small></div>
          <div><span>{pt("k_capex", lang)}</span><b>{money.compact(agg.capexEur)}</b><small>{pt("k_debt", lang)} {money.compact(agg.loanEur)}, {pt("su_equity", lang)} {money.compact(agg.equityEur + agg.feeEur)}</small></div>
          <div><span>{pt("ds_capacity", lang)}</span><b>{money.compact(sizing.capacityEur)}</b><small>{sizing.recommendedGearingPct == null ? "" : pt("ds_reco", lang, { g: num(sizing.recommendedGearingPct, lang, 1) })}</small></div>
          <div className={"t-" + dscrTone(agg.dscrMin)}><span>{pt("k_dscr_p50", lang)}</span><b>{fd(agg.dscrMin)}</b><small>{agg.dscrMin == null ? pt("no_debt", lang) : `P90 ${fd(model.p90.dscrMin)}`}</small></div>
          <div><span>{pt("k_irr", lang)}</span><b>{f(agg.irr)}</b><small>{pt("k_eirr", lang)} {f(agg.equityIrr)}</small></div>
          <div><span>{pt("k_npv", lang)}</span><b>{money.compact(agg.npv)}</b><small>{num(fin.discPct, lang, 1)}%, {pt("k_payback", lang)} {agg.paybackYears == null ? "25+" : num(agg.paybackYears, lang, 1)} {pt("years_w", lang)}</small></div>
        </div>
        <table className="rp-kv"><tbody>
          <Row k={pt("k_weakest", lang)} v={agg.weakest ? `${agg.weakest.name}, DSCR ${dscr(agg.weakest.dscrMin, lang)}` : none} />
          <Row k={pt("k_energy", lang)} v={`${num(agg.year1Mwh, lang, 0)} ${mwhUnit(lang)}, ${pt("k_co2", lang)} ${num(model.co2.tPerYear, lang, 0)} t`} />
          <Row k={pt("k_readiness", lang)} v={`${Math.round(model.readiness.docsPct)}%`} />
          <Row k={pt("k_screening", lang)} v={`${model.esProgress.answered}/${model.esProgress.total}`} />
        </tbody></table>
      </section>

      {/* ---- market context, Moldova */}
      {sections.includes("r_market") && (
        <section className="rp-page">
          <MarketContext lang={lang} heading={<H2 sections={sections} id="r_market" lang={lang} />} />
        </section>
      )}

      {/* ---- assets */}
      <section className="rp-page">
        <H2 sections={sections} id="r_assets" lang={lang} />
        <table className="rp-t"><thead><tr>
          <th className="r">{pt("r_no", lang)}</th><th>{pt("col_asset", lang)}</th><th>{pt("col_area", lang)}</th><th className="r">{kwpUnit(lang)}</th><th className="r">{pt("col_capex", lang)}, {cur}</th>
          <th className="r">{pt("k_debt", lang)}</th><th className="r">{pt("col_irr", lang)}</th><th className="r">{pt("col_npv", lang)}</th><th className="r">DSCR P50</th><th className="r">P90</th>
        </tr></thead><tbody>
          {assets.map((a, i) => (
            <tr key={a.id}><td className="r rp-dim">{i + 1}</td><td><b>{a.name}</b><small>{pt(a.market === "UA" ? "market_ua" : "market_md", lang)}{a.address ? `, ${a.address}` : ""}</small></td>
              <td>{a.regionName || ""}</td><td className="r">{num(a.kw, lang, 1)}</td><td className="r">{money.full(a.result.capexEur)}</td><td className="r">{money.full(a.result.loanEur)}</td>
              <td className="r">{f(a.result.irr)}</td><td className="r">{money.full(a.result.npv)}</td><td className={"r t-" + dscrTone(a.result.dscrMin)}>{a.result.dscrMin == null ? "" : dscr(a.result.dscrMin, lang)}</td>
              <td className="r">{a.dscrMinP90 == null ? "" : dscr(a.dscrMinP90, lang)}</td></tr>
          ))}
        </tbody><tfoot><tr><td /><td>{pt("k_assets", lang)}: {agg.count}</td><td /><td className="r">{num(agg.kwp, lang, 1)}</td><td className="r">{money.full(agg.capexEur)}</td><td className="r">{money.full(agg.loanEur)}</td><td className="r">{f(agg.irr)}</td><td className="r">{money.full(agg.npv)}</td><td className="r">{fd(agg.dscrMin)}</td><td className="r">{fd(model.p90.dscrMin)}</td></tr></tfoot></table>
        {agg.byRegion.filter((r) => r.key).length > 0 && (
          <>
            <h3>{pt("by_area", lang)}</h3>
            <table className="rp-kv"><tbody>
              {agg.byRegion.map((r) => <Row key={r.key || "none"} k={r.key ? assets.find((x) => x.region === r.key)?.regionName || r.key : pt("unknown_area", lang)} v={`${Math.round(r.sharePct)}%`} />)}
            </tbody></table>
          </>
        )}
      </section>

      {/* ---- where the assets are: a page of its own, markers never overlap */}
      {sections.includes("r_map") && (
        <section className="rp-page rp-mappage">
          <H2 sections={sections} id="r_map" lang={lang} />
          <StaticMap assets={assets} label={pt("map_label", lang)} width={720} height={430} />
          <p className="rp-small">{pt("map_h", lang)} {plt("r_map_list", lang)}</p>
          <table className="rp-t rp-maplist"><thead><tr>
            <th className="r">{pt("r_no", lang)}</th><th>{pt("col_asset", lang)}</th><th>{plt("f_locality", lang)}</th><th className="r">{kwpUnit(lang)}</th><th className="r">{pt("k_energy", lang)}, {mwhUnit(lang)}</th><th>{plt("r_source", lang)}</th>
          </tr></thead><tbody>
            {assets.map((a, i) => (
              <tr key={a.id}><td className="r rp-dim">{i + 1}</td><td><b>{a.name}</b></td><td>{a.address || a.regionName || ""}</td>
                <td className="r">{num(a.kw, lang, 1)}</td><td className="r">{num(a.result.year1Kwh / 1000, lang, 0)}</td>
                <td>{a.lat == null ? pt("unknown_area", lang) : a.loc === "locality" ? plt("r_loc_approx", lang) : ""}</td></tr>
            ))}
          </tbody></table>
        </section>
      )}

      {/* ---- technical basis */}
      <section className="rp-page">
        <H2 sections={sections} id="r_technical" lang={lang} />
        <p>{pt("r_tech_p", lang)}</p>
        {hasPlants && <p className="rp-small">{plt("r_tech_plants", lang, { n: sections.indexOf("r_plants") + 1 })}</p>}
        <table className="rp-t"><thead><tr>
          <th className="r">{pt("r_no", lang)}</th><th>{pt("col_asset", lang)}</th><th className="r">{kwpUnit(lang)}</th><th className="r">P50, {mwhUnit(lang)}</th><th className="r">P90, {mwhUnit(lang)}</th><th className="r">{pt("k_energy", lang)}, {lang === "ru" ? "кВт·ч" : lang === "uk" ? "кВт·год" : "kWh"}/{kwpUnit(lang)}</th>
        </tr></thead><tbody>
          {assets.map((a, i) => (
            <tr key={a.id}><td className="r rp-dim">{i + 1}</td><td>{a.name}</td><td className="r">{num(a.kw, lang, 1)}</td><td className="r">{num(a.result.year1Kwh / 1000, lang, 1)}</td>
              <td className="r">{num((a.p90Year1Kwh != null ? a.p90Year1Kwh : a.result.year1Kwh * p90f) / 1000, lang, 1)}</td><td className="r">{a.kw > 0 ? num(a.result.year1Kwh / a.kw, lang, 0) : ""}</td></tr>
          ))}
        </tbody></table>
        <p className="rp-small">{model.markets.map((m) => `${m}: ${GRID_EMISSION_FACTOR[m]?.tPerMwh} t CO2/MWh (${GRID_EMISSION_FACTOR[m]?.source})`).join(". ")}.</p>
      </section>

      {/* ---- plants: sources, revenue, costs, cover and permits */}
      {hasPlants && (
        <section className="rp-page rp-plants">
          <H2 sections={sections} id="r_plants" lang={lang} />
          <PlantReport assets={assets} lang={lang} money={money} E={model.E} fin={fin} scenario={scenario}
            target={sizing.p50Dscr} todayKey={todayKey()} />
        </section>
      )}

      {/* ---- financing and debt sizing */}
      <section className="rp-page">
        <H2 sections={sections} id="r_debt" lang={lang} />
        <h3>{pt("r_assumptions", lang)}</h3>
        <div className="rp-two">
          <table className="rp-kv"><tbody>
            <Row k={pt("f_gearing", lang)} v={`${num(fin.gearingPct, lang, 1)}%`} />
            <Row k={pt("f_rate", lang)} v={`${num(fin.ratePct, lang, 2)}%`} />
            {fin.rateSteps && <Row k={pt("f_steps", lang)} v={fin.rateSteps.join(", ")} />}
            <Row k={pt("f_tenor", lang)} v={fin.tenorYears} />
            <Row k={pt("f_repay", lang)} v={pt(fin.repayment === "sculpted" ? "f_repay_sculpted" : "f_repay_annuity", lang)} />
            {fin.constructionMonths > 0 && <Row k={pt("f_build", lang)} v={fin.constructionMonths} />}
            {fin.graceYears > 0 && <Row k={pt("f_grace", lang)} v={fin.graceYears} />}
            {fin.dsraMonths > 0 && <Row k={pt("f_dsra", lang)} v={num(fin.dsraMonths, lang, 1)} />}
            <Row k={pt("f_disc", lang)} v={`${num(fin.discPct, lang, 1)}%`} />
            <Row k={pt("r_tax", lang)} v={taxLine(fin, lang)} />
            <Row k={pt("f_currency", lang)} v={fin.debtCurrency === "local" ? pt("f_cur_local", lang) : "EUR"} />
            {fin.grantPct > 0 && <Row k={pt("f_grant", lang)} v={`${num(fin.grantPct, lang, 1)}%${fin.grantCapEur ? `, max ${num(fin.grantCapEur, lang, 0)} EUR` : ""}`} />}
            {fin.principalCompensationPct > 0 && <Row k={pt("f_comp", lang)} v={`${num(fin.principalCompensationPct, lang, 1)}%`} />}
            {fin.feePct > 0 && <Row k={pt("f_fee", lang)} v={`${num(fin.feePct, lang, 2)}%`} />}
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
        {preset && <p className="rp-small"><b>{preset.name[lang] || preset.name.en}</b> ({pt(preset.status === "published" ? "f_published" : "f_placeholder", lang)}) {preset.note[lang] || preset.note.en}</p>}
        <p className="rp-small">{pt("f_note", lang)}</p>

        <h3>{pt("s_su", lang)}</h3>
        <SourcesUses su={model.sourcesUses} money={money} lang={lang} />

        <h3>{pt("s_debt", lang)}</h3>
        <div className="rp-two">
          <table className="rp-kv"><tbody>
            <Row k={pt("ds_p50", lang)} v={dscr(sizing.p50Dscr, lang)} />
            <Row k={pt("ds_p90", lang)} v={dscr(sizing.p90Dscr, lang)} />
            <Row k={pt("ds_cap", lang)} v={`${num(sizing.maxGearingPct, lang, 1)}%`} />
            <Row k={`${pt("ds_capacity", lang)}, P50`} v={`${money.full(sizing.p50.loanEur)} ${cur}`} />
            <Row k={`${pt("ds_capacity", lang)}, P90`} v={`${money.full(sizing.p90.loanEur)} ${cur}`} />
            <Row k={pt("ds_capacity", lang)} v={<><b>{money.full(sizing.capacityEur)} {cur}</b><small className="rp-dim"> {sizing.binding === "gearing" ? pt("ds_bind_gearing", lang, { n: num(sizing.maxGearingPct, lang, 1) }) : pt((sizing.binding === "p50" ? "ds_bind_p50" : "ds_bind_p90") + (sizing.repayment === "sculpted" ? "_s" : ""), lang, { y: (sizing.binding === "p50" ? sizing.p50 : sizing.p90).bindingYear })}</small></>} />
            <Row k={pt("ds_current", lang)} v={`${money.full(sizing.currentLoanEur)} ${cur}`} />
            <Row k={pt(sizing.withinCapacity ? "ds_headroom" : "ds_over", lang)} v={`${money.full(Math.abs(sizing.headroomEur))} ${cur}`} />
            <Row k={recoLabel} v={sizing.recommendedGearingPct == null ? none : `${num(sizing.recommendedGearingPct, lang, 1)}%`} />
          </tbody></table>
          <div>
            <table className="rp-t"><thead><tr><th>{pt("f_tenor", lang)}</th><th className="r">{pt("ds_capacity", lang)}, {cur}</th><th className="r">{pt("ds_share", lang)}</th></tr></thead>
              <tbody>{sizing.byTenor.map((t) => (
                <tr key={t.tenorYears} className={t.tenorYears === fin.tenorYears ? "rp-on" : ""}><td>{t.tenorYears}</td><td className="r">{money.full(t.capacityEur)}</td><td className="r">{t.pct == null ? "" : `${num(t.pct, lang, 1)}%`}</td></tr>
              ))}</tbody></table>
            <p className="rp-small">{sizing.repayment === "sculpted"
              ? pt("ds_level", lang, { x: `${money.full(sizing.levelEur)} ${cur}` })
              : pt("ds_sculpted", lang, { x: `${money.full(sizing.sculptedEur)} ${cur}` })}</p>
          </div>
        </div>
        <p className="rp-small">{pt(sizing.repayment === "sculpted" ? "ds_rule_s" : "ds_rule", lang)} {pt("ds_targets_h", lang)}</p>

        {model.structures.length > 1 && (
          <div className="rp-keep">
            <h3>{pt("s_compare", lang)}</h3>
            <table className="rp-t rp-cmp"><thead><tr><th />{model.structures.map((s) => <th key={s.id} className="r">{structureName(s, lang)}</th>)}</tr></thead>
              <tbody>
                <tr><th scope="row">{pt("cmp_terms", lang)}</th>{model.structures.map((s) => <td key={s.id} className="r">{termsLine(s.fin, lang)}</td>)}</tr>
                <tr><th scope="row">{pt("k_grant", lang)}</th>{model.structures.map((s) => <td key={s.id} className="r">{money.full(s.grantEur)}</td>)}</tr>
                <tr><th scope="row">{pt("k_debt", lang)}</th>{model.structures.map((s) => <td key={s.id} className="r">{money.full(s.loanEur)}</td>)}</tr>
                <tr><th scope="row">{pt("su_equity", lang)}</th>{model.structures.map((s) => <td key={s.id} className="r">{money.full(s.equityEur)}</td>)}</tr>
                <tr><th scope="row">DSCR P50, P90</th>{model.structures.map((s) => <td key={s.id} className="r">{s.loanEur > 0 ? `${fd(s.dscrMin)}, ${fd(s.dscrMinP90)}` : none}</td>)}</tr>
                <tr><th scope="row">{pt("m_irr", lang)}</th>{model.structures.map((s) => <td key={s.id} className="r">{f(s.irr)}</td>)}</tr>
                <tr><th scope="row">{pt("m_equityIrr", lang)}</th>{model.structures.map((s) => <td key={s.id} className="r">{f(s.equityIrr)}</td>)}</tr>
                <tr><th scope="row">{pt("k_npv", lang)}</th>{model.structures.map((s) => <td key={s.id} className="r">{money.full(s.npv)}</td>)}</tr>
                <tr><th scope="row">{pt("ds_capacity", lang)}</th>{model.structures.map((s) => <td key={s.id} className="r">{money.full(s.capacityEur)}</td>)}</tr>
                <tr><th scope="row">{pt("cmp_within", lang)}</th>{model.structures.map((s) => <td key={s.id} className="r">{s.loanEur > 0 ? pt(s.withinCapacity ? "yes" : "no", lang) : ""}</td>)}</tr>
              </tbody></table>
          </div>
        )}
      </section>

      {/* ---- cash flow and cover */}
      <section className="rp-page">
        <H2 sections={sections} id="r_cover_cf" lang={lang} />
        <h3>{pt("r_cashflow", lang)}, {cur}</h3>
        <CashflowChart cfads={agg.cfads} debtService={agg.debtService} lang={lang} years={years} bare rate={money.rate} />
        {hasDebt && <><h3>{pt("ch_dscr", lang)}</h3><DscrChart p50={agg.dscrByYear} p90={p90Dscr} targets={{ p50: sizing.p50Dscr, p90: sizing.p90Dscr }} lang={lang} bare /></>}
        <table className="rp-t rp-cf"><thead><tr>
          <th>{pt("r_year", lang)}</th><th className="r">{pt("r_cfads", lang)}</th><th className="r">{pt("r_ds", lang)}</th><th className="r">DSCR P50</th><th className="r">DSCR P90</th>
        </tr></thead><tbody>
          {shown.map((y) => (
            <tr key={y}><td>{y}</td><td className="r">{money.full(agg.cfads[y - 1])}</td><td className="r">{agg.debtService[y - 1] > 1e-9 ? money.full(agg.debtService[y - 1]) : ""}</td>
              <td className="r">{agg.debtService[y - 1] > 1e-9 ? fd(agg.dscrByYear[y - 1]) : ""}</td><td className="r">{agg.debtService[y - 1] > 1e-9 ? fd(p90Dscr[y - 1]) : ""}</td></tr>
          ))}
        </tbody></table>
      </section>

      {/* ---- sensitivity */}
      <section className="rp-page">
        <H2 sections={sections} id="r_sensitivity" lang={lang} />
        <h3>{pt("tor_title", lang)}: {pt("m_" + torMetric, lang)}</h3>
        <p className="rp-small">{pt("tor_h", lang)}</p>
        <TornadoChart rows={torRows} base={model.sensitivity.base ? model.sensitivity.base[torMetric] : null} metric={torMetric} rate={money.rate} lang={lang} bare />
        <h3>{pt("s_stress", lang)}</h3>
        <p className="rp-small">{pt("st_h", lang)}</p>
        {showShort && <p className="rp-small">{pt(fin.dsraMonths > 0 ? "st_short_dsra_h" : "st_short_h", lang)}</p>}
        <table className="rp-t"><thead><tr>
          <th>{pt("st_case", lang)}</th><th className="r">{pt("col_dscr", lang)}</th><th className="r">{pt("col_irr", lang)}</th><th className="r">{pt("col_npv", lang)}, {cur}</th><th className="r">{pt("st_dnpv", lang)}</th>
          {showShort && <th className="r">{pt(fin.dsraMonths > 0 ? "st_short_dsra" : "st_short", lang)}, {cur}</th>}
        </tr></thead><tbody>
          {suite.map((s) => (
            <tr key={s.id}><td>{caseLabel(s.id, lang, market)}</td>
              <td className={"r t-" + dscrTone(s.agg.dscrMin)}>{fd(s.agg.dscrMin)}</td>
              <td className="r">{f(s.agg.irr)}</td><td className="r">{money.full(s.agg.npv)}</td>
              <td className="r">{s.id === "base" ? "" : `${s.agg.npv - suite[0].agg.npv >= 0 ? "+" : "−"}${money.full(Math.abs(s.agg.npv - suite[0].agg.npv))}`}</td>
              {showShort && <td className={"r" + (s.agg.shortfallEur > 0.5 ? " t-bad" : "")}>{money.full(s.agg.shortfallEur || 0)}</td>}</tr>
          ))}
        </tbody></table>
      </section>

      {/* ---- risks */}
      <section className="rp-page">
        <H2 sections={sections} id="r_risks" lang={lang} />
        <p className="rp-small">{pt("rk_h", lang)}</p>
        <table className="rp-t"><thead><tr><th>{pt("s_risks", lang)}</th><th>{pt("r_status", lang)}</th><th className="r" /><th /></tr></thead><tbody>
          {rr.map((r, i) => (
            <tr key={i}><td><b>{r[0]}</b></td><td><span className={"rp-lv lv-" + risks[i].level}>{r[1]}</span></td><td className="r">{r[2]}</td><td className="rp-rule">{r[3]}</td></tr>
          ))}
        </tbody></table>
      </section>

      {/* ---- E&S */}
      <section className="rp-page">
        <H2 sections={sections} id="r_es" lang={lang} />
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

      {/* ---- readiness and documents */}
      <section className="rp-page">
        <H2 sections={sections} id="r_ready" lang={lang} />
        <ReadinessPanel readiness={model.readiness} lang={lang} all />
        <h3>{pt("r_docs", lang)}</h3>
        <p className="rp-small">{pt("docs_h", lang)}</p>
        <table className="rp-t rp-docs"><thead><tr>{docs[0].map((h, i) => <th key={i}>{h}</th>)}</tr></thead><tbody>
          {docs.slice(1).map((r, i) => <tr key={i}>{r.map((c, j) => <td key={j} className={j ? "ds-" + (c === pt("ds_done", lang) ? "done" : c === pt("ds_draft", lang) ? "draft" : "missing") : ""}>{c}</td>)}</tr>)}
        </tbody></table>
      </section>

      {/* ---- sources and limits */}
      <section className="rp-page">
        <H2 sections={sections} id="r_sources" lang={lang} />
        <table className="rp-kv rp-src"><tbody>
          {sources.map((s, i) => <Row key={i} k={pt("r_sources_presets", lang)} v={s} />)}
          <Row k={pt("r_sources_fx", lang)} v={fxNote(lang, cur, fx)} />
          {model.markets.map((m) => <Row key={m} k={`${pt("r_sources_co2", lang)}, ${m}`} v={`${GRID_EMISSION_FACTOR[m]?.tPerMwh} t/MWh: ${GRID_EMISSION_FACTOR[m]?.source}`} />)}
          {located.length > 0 && <Row k={pt("r_sources_map", lang)} v={TILE_ATTRIBUTION} />}
        </tbody></table>
        <h3>{pt("r_limits", lang)}</h3>
        <p>{pt("r_limits_p", lang)}</p>
      </section>
    </article>
  );
}
