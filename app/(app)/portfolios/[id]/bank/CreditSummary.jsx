// app/(app)/portfolios/[id]/bank/CreditSummary.jsx — the credit summary of one
// utility plant, the document a bank's credit officer reads first: page 1 is
// the request, the key figures, the proposed terms, sources and uses and the
// plant; page 2 the revenue, the debt cover by year, the room before the
// target, the stress tests and the main risks; page 3 the permit checklist,
// what is still missing before the credit decision, and the basis of the
// figures. Every number comes from the plant's own model (buildModel() of
// lib/bankPack.js plantOnly()), the same as the Excel workbook in the pack.
// Server-rendered plain HTML and SVG: the PDF is printed with scripts blocked.
import { pt } from "../../../../../lib/portfolioText.js";
import { plt, studyCite, p90BasisNote } from "../../../../../lib/plantText.js";
import { bt } from "../../../../../lib/bankText.js";
import { pct, dscr, num, mwhUnit } from "../../../../../lib/portfolioFormat.js";
import { caseLabel, riskRows } from "../../../../../lib/portfolioExport.js";
import { fxNote, taxLine } from "../../../../../lib/portfolioDisplay.js";
import { normalizePlant, plantEnergy, plantHeadroom } from "../../../../../lib/plantFinance.js";
import { llcr, contractYears, stillMissing, missingLine, gapText, gridText } from "../../../../../lib/bankPack.js";
import { WIND_SOURCE } from "../../../../../lib/windData.js";
import DscrChart from "../../../../../components/portfolio/DscrChart.jsx";
import GridAnnex from "../../../../../components/portfolio/GridAnnex.jsx";
import { dt } from "../../../../../lib/dealText.js";
import { basisLine, dataSourceLines, replayLine, monthlyLine } from "../../../../../lib/energyBasis.js";
import { monthlyCover } from "../../../../../lib/monthlyCover.js";
import { weatherReplay } from "../../../../../lib/weatherReplay.js";

const Row = ({ k, v }) => <tr><th scope="row">{k}</th><td>{v}</td></tr>;
const LEVEL = { high: 0, medium: 1, low: 2, unknown: 3 };
const mwUnit = (lang) => (lang === "ru" || lang === "uk" ? "МВт" : "MW");
const mwpUnit = (lang) => ({ ru: "МВт пик", uk: "МВт пік" }[lang] || "MWp");

/** The plant's parts in a line: "wind 40 MW, solar 20 MWp, battery storage 10 MW / 20 MWh". */
export function mixLine(pl, lang) {
  const parts = [];
  if (pl.wind) parts.push(`${plt("c_wind", lang).toLowerCase()} ${num(pl.wind.mw, lang, 1)} ${mwUnit(lang)}`);
  if (pl.solar) parts.push(`${plt("c_solar", lang).toLowerCase()} ${num(pl.solar.mwp, lang, 1)} ${mwpUnit(lang)}`);
  if (pl.bess) parts.push(`${plt("c_bess", lang).toLowerCase()} ${num(pl.bess.mw, lang, 1)} ${mwUnit(lang)} / ${num(pl.bess.mwh, lang, 0)} ${mwhUnit(lang)}`);
  return parts.join(", ");
}

// docCounts: the documents on file per checklist item (lib/dealRoom.js), or
// null where the deal room is not set up; the checklist then shows no column
export default function CreditSummary({ model, lang, company, date, money, fx, todayKey, docCounts = null, rid = "" }) {
  const a = model.assets[0];
  const pl = normalizePlant(a.plant);
  const { agg, fin, sizing } = model;
  const en = plantEnergy(pl);
  const none = pt("na", lang);
  const m = (v) => `${money.full(v)} ${money.cur}`;
  const fd = (v) => (v == null ? none : dscr(v, lang));
  const fp = (v) => (v == null ? none : pct(v, lang));
  const mwh = (v) => `${num(v, lang, 0)} ${mwhUnit(lang)}`;
  const hasDebt = fin.gearingPct > 0 && agg.loanEur > 0;
  const l50 = llcr(agg.cfads, agg.loanEur, fin);
  const l90 = llcr(model.p90.cfads, agg.loanEur, fin);
  const cy = contractYears(pl, fin);
  const hr = plantHeadroom(pl, model.E, model.fin, model.scenario, sizing.p50Dscr);
  const miss = stillMissing(pl, todayKey);
  const capexNet = agg.capexEur - agg.grantEur;
  const t = dscr(sizing.p50Dscr, lang);
  const pc = (v) => `${num(v, lang, 1)}%`;

  // the request, in one sentence; a locality typed as "near X" says "near" once
  const place = pl.locality.replace(/^(near|lângă|около|поблизу)\s+/i, "");
  const where = place ? bt("near", lang, { x: place }) : "";
  const mix = mixLine(pl, lang);
  const lead = hasDebt
    ? bt("lead", lang, {
      borrower: pl.borrower || bt("borrower_none", lang), loan: m(agg.loanEur), t: fin.tenorYears,
      profile: bt(fin.repayment === "sculpted" ? "prof_sculpted" : "prof_annuity", lang), r: num(fin.ratePct, lang, 2), name: pl.name, mix, where,
    })
    : bt("lead_nodebt", lang, { name: pl.name, mix, where });
  const cap = sizing.capacityEur;
  const fit = cap == null ? "" : agg.loanEur <= cap + 0.5 ? bt("fit_ok", lang, { x: m(cap) }) : bt("fit_over", lang, { x: m(agg.loanEur - cap) });

  // the risks a lender weighs for one plant: a single asset is concentrated by design
  const rr = riskRows(model, lang).map((r, i) => ({ r, id: model.risks[i].id, level: model.risks[i].level }))
    .filter((x) => x.id !== "concentration" && (x.level === "high" || x.level === "medium"))
    .sort((x, y) => LEVEL[x.level] - LEVEL[y.level]).slice(0, 5);
  const src = (s) => plt(s === "study" ? "src_study" : s === "screening" ? "src_screening" : s === "none" ? "src_none" : "src_pvgis", lang);
  // a study is cited by who wrote it, when, and the page of its P50
  const srcOf = (part, e) => { const c = e.source === "study" ? studyCite(pl[part]?.study, lang) : ""; return `${src(e.source)}${c ? ` (${c})` : ""}`; };
  const srcLine = [en.wind && `${plt("c_wind", lang)}: ${srcOf("wind", en.wind)}`, en.solar && `${plt("c_solar", lang)}: ${srcOf("solar", en.solar)}`].filter(Boolean).join("; ");
  const basis = p90BasisNote(pl, lang);
  const p90Mwh = a.p90Year1Kwh != null ? a.p90Year1Kwh / 1000 : null;
  const r = pl.revenue;
  const su = model.sourcesUses;
  const grid = gridText(pl, lang, m);
  const dataSources = dataSourceLines(pl, lang);
  const replay = weatherReplay(a.plant, model.E, fin, model.scenario);
  const seasonal = monthlyCover(a.plant, model.E, fin, model.scenario);
  // the construction terms in one line: "18 months to build, 1 year of grace, reserve 6 months"
  const build = [fin.constructionMonths > 0 && pt("build_short", lang, { n: fin.constructionMonths }),
    hasDebt && fin.graceYears > 0 && pt("grace_short", lang, { n: fin.graceYears }),
    hasDebt && fin.dsraMonths > 0 && pt("dsra_short", lang, { n: num(fin.dsraMonths, lang, 1) })].filter(Boolean).join(", ");
  // the stress table's shortfall column, when a reserve is set or a case runs short
  const showShort = fin.dsraMonths > 0 || model.suite.some((s) => s.agg.shortfallEur > 0.5);

  return (
    <article className="rp rp-teaser rp-credit" lang={lang}>
      {/* ---- page 1: the request */}
      <section className="rp-page">
        <div className="rp-cover-top">
          <p className="rp-kicker">{bt("title", lang)}</p>
          <h1>{pl.name}</h1>
          <p className="rp-meta">{[pt("r_prepared", lang, { co: company || "VoltMira" }), date, rid && bt("rid", lang, { x: rid })].filter(Boolean).join(", ")}</p>
        </div>
        {pl.sample && <p className="rp-sample-note"><b>{plt("sample_badge", lang)}.</b> {plt("sample_note", lang)}</p>}
        <p className="rp-lead">{lead}{pl.sponsor ? ` ${bt("sponsor_line", lang, { x: pl.sponsor })}` : ""}</p>
        <div className="rp-facts">
          <div><span>{bt("k_loan", lang)}</span><b>{hasDebt ? money.compact(agg.loanEur) : none}</b><small>{money.cur}{fit ? `, ${fit}` : ""}</small></div>
          <div><span>{pt("k_capex", lang)}</span><b>{money.compact(agg.capexEur)}</b><small>{money.cur}{agg.grantEur > 0 ? `, ${bt("k_net", lang, { x: money.compact(capexNet) })}` : ""}</small></div>
          <div><span>{pt("k_dscr_p50", lang)}</span><b>{fd(agg.dscrMin)}</b><small>P90 {fd(model.p90.dscrMin)}</small></div>
          <div><span>{bt("k_llcr", lang)}</span><b>{fd(l50)}</b><small>P90 {fd(l90)}</small></div>
          <div><span>{bt("k_gear", lang)}</span><b>{capexNet > 0 ? `${num((agg.loanEur / capexNet) * 100, lang, 0)}%` : none}</b><small>{bt("k_gear_s", lang)}</small></div>
          <div><span>{bt("k_pirr", lang)}</span><b>{fp(agg.irr)}</b><small>{pt("k_eirr", lang)} {fp(agg.equityIrr)}</small></div>
        </div>
        <div className="rp-two">
          <div>
            <h3>{bt("terms_h", lang)}</h3>
            <table className="rp-kv"><tbody>
              <Row k={bt("t_amount", lang)} v={hasDebt ? m(agg.loanEur) : none} />
              <Row k={bt("t_currency", lang)} v={fin.debtCurrency === "local" ? bt("lei", lang) : "EUR"} />
              <Row k={pt("f_tenor", lang)} v={fin.tenorYears} />
              <Row k={pt("f_rate", lang)} v={num(fin.ratePct, lang, 2)} />
              {fin.rateSteps && <Row k={bt("t_steps", lang)} v={fin.rateSteps.map((x) => num(x, lang, 2)).join(" / ")} />}
              <Row k={pt("f_repay", lang)} v={pt(fin.repayment === "sculpted" ? "f_repay_sculpted" : "f_repay_annuity", lang)} />
              {build && <Row k={bt("t_build", lang)} v={build} />}
              {fin.feePct > 0 && <Row k={pt("f_fee", lang)} v={num(fin.feePct, lang, 2)} />}
              {fin.grantPct > 0 && <Row k={pt("f_grant", lang)} v={num(fin.grantPct, lang, 1)} />}
              <Row k={pt("r_tax", lang)} v={fin.taxPct > 0 ? `${num(fin.taxPct, lang, 1)}%` : pt("tax_none", lang)} />
              <Row k={bt("t_targets", lang)} v={`${dscr(sizing.p50Dscr, lang)} / ${dscr(sizing.p90Dscr, lang)}`} />
            </tbody></table>
          </div>
          <div>
            <h3>{pt("s_su", lang)}</h3>
            <table className="rp-t rp-su"><tbody>
              <tr className="rp-su-h"><th colSpan={2}>{pt("su_uses", lang)}</th><th className="r">{money.cur}</th></tr>
              <tr><td colSpan={2}>{pt("su_capex", lang)}</td><td className="r">{money.full(su.uses.capexEur)}</td></tr>
              {su.uses.idcEur > 0.5 && <tr><td colSpan={2}>{pt("su_idc", lang)}</td><td className="r">{money.full(su.uses.idcEur)}</td></tr>}
              {su.uses.feeEur > 0.5 && <tr><td colSpan={2}>{pt("su_fee", lang)}</td><td className="r">{money.full(su.uses.feeEur)}</td></tr>}
              {su.uses.dsraEur > 0.5 && <tr><td colSpan={2}>{pt("su_dsra", lang)}</td><td className="r">{money.full(su.uses.dsraEur)}</td></tr>}
              <tr className="rp-su-t"><td colSpan={2}>{pt("su_total", lang)}</td><td className="r">{money.full(su.uses.totalEur)}</td></tr>
              <tr className="rp-su-h"><th>{pt("su_sources", lang)}</th><th className="r">{pt("su_share", lang)}</th><th className="r">{money.cur}</th></tr>
              {[["k_grant", su.sources.grantEur], ["k_debt", su.sources.debtEur], ["su_equity", su.sources.equityEur]].filter(([, v]) => v > 0.5).map(([k, v]) => (
                <tr key={k}><td>{pt(k, lang)}</td><td className="r">{su.sources.totalEur > 0 ? pct(v / su.sources.totalEur, lang, 1) : ""}</td><td className="r">{money.full(v)}</td></tr>
              ))}
              <tr className="rp-su-t"><td colSpan={2}>{pt("su_total", lang)}</td><td className="r">{money.full(su.sources.totalEur)}</td></tr>
            </tbody></table>
          </div>
        </div>
        <h3>{bt("plant_h", lang)}</h3>
        <table className="rp-kv rp-kv-wide"><tbody>
          <Row k={bt("p_place", lang)} v={[pl.locality, pl.lat != null ? `${pl.lat.toFixed(4)}, ${pl.lon.toFixed(4)}` : ""].filter(Boolean).join("; ") || none} />
          {pl.operator && <Row k={plt("f_operator", lang)} v={pl.operator} />}
          {pl.wind && <Row k={plt("c_wind", lang)} v={`${num(pl.wind.mw, lang, 1)} ${mwUnit(lang)}, ${pl.wind.turbines} x ${num(pl.wind.mw / pl.wind.turbines, lang, 2)} ${mwUnit(lang)}, ${num(pl.wind.hubM, lang, 0)} m`} />}
          {pl.solar && <Row k={plt("c_solar", lang)} v={`${num(pl.solar.mwp, lang, 1)} ${mwpUnit(lang)}${pl.solar.yieldKwhKwp ? `, ${num(pl.solar.yieldKwhKwp, lang, 0)} kWh/kWp` : ""}`} />}
          {pl.bess && <Row k={plt("c_bess", lang)} v={`${num(pl.bess.mw, lang, 1)} ${mwUnit(lang)} / ${num(pl.bess.mwh, lang, 0)} ${mwhUnit(lang)}`} />}
          <Row k={bt("p_energy", lang)} v={`${mwh(en.p50Mwh)} / ${p90Mwh == null ? none : mwh(p90Mwh)}${basis ? ` (${basis})` : ""}`} />
          <Row k={bt("p_source", lang)} v={srcLine || none} />
          {grid && <Row k={bt("p_grid", lang)} v={grid} />}
          <Row k={pt("k_co2", lang)} v={`${num(model.co2.tPerYear, lang, 0)} ${pt("es_co2_t", lang)}`} />
        </tbody></table>
      </section>

      {/* ---- page 2: can the plant carry the loan */}
      <section className="rp-page">
        <div className="rp-two">
          <div>
            <h3>{plt("rev_h", lang)}</h3>
            <table className="rp-kv"><tbody>
              <Row k={plt("rev_kind", lang)} v={plt("rk_" + r.kind, lang)} />
              <Row k={plt("rev_price", lang)} v={num(r.priceEurMwh, lang, 2)} />
              {r.kind !== "merchant" && <Row k={plt("rev_years", lang)} v={r.years} />}
              {r.kind !== "merchant" && <Row k={plt("rev_index", lang)} v={pc(r.indexPct)} />}
              {r.kind !== "merchant" && <Row k={plt("rev_after", lang)} v={num(r.afterEurMwh, lang, 2)} />}
              {pl.bess && r.bessEurPerMwYr > 0 && <Row k={plt("b_rev", lang)} v={`${num(r.bessEurPerMwYr, lang, 0)}, ${plt("b_years_v", lang, { n: r.bessYears })}`} />}
            </tbody></table>
            <p className="rp-small">{hasDebt ? (cy.years > 0 ? bt("cover_years", lang, { n: cy.years, t: cy.tenor }) : bt("cover_none", lang)) : ""}</p>
          </div>
          <div>
            <h3>{bt("headroom_h", lang)}</h3>
            {hr.dscrMin == null ? <p className="rp-small">{plt("hr_none", lang)}</p> : (
              <ul className="rp-list">
                {hr.energyHeadroomPct != null && <li>{plt(hr.energyHeadroomPct >= 0 ? "hr_energy_pos" : "hr_energy_neg", lang, { x: pc(Math.abs(hr.energyHeadroomPct)), t })}</li>}
                {hr.capexHeadroomPct != null && <li>{plt(hr.capexHeadroomPct >= 0 ? "hr_capex_pos" : "hr_capex_neg", lang, { x: pc(Math.abs(hr.capexHeadroomPct)), t })}</li>}
              </ul>
            )}
            <table className="rp-kv"><tbody>
              <Row k={pt("ds_capacity", lang)} v={cap == null ? none : m(cap)} />
              <Row k={bt("k_avg", lang)} v={fd(agg.dscrAvg)} />
            </tbody></table>
          </div>
        </div>
        <div className="rp-basis">
          <p className="rp-small"><b>{bt("p_p90basis", lang)}:</b> {basisLine(en, lang, pl.solar)}.</p>
          {replay && <p className="rp-small"><b>{plt("wr_h", lang)}:</b> {replayLine(replay, lang)}.</p>}
          {seasonal && <p className="rp-small"><b>{plt("mc_h", lang)}:</b> {monthlyLine(seasonal, lang, m)}.</p>}
        </div>
        {hasDebt && (
          <>
            <h3>{pt("ch_dscr", lang)}</h3>
            <DscrChart p50={agg.dscrByYear} p90={model.p90.dscrByYear} targets={{ p50: sizing.p50Dscr, p90: sizing.p90Dscr }} lang={lang} bare height={185} />
          </>
        )}
        <h3>{pt("s_stress", lang)}</h3>
        <table className="rp-t rp-stress"><thead><tr>
          <th>{pt("st_case", lang)}</th><th>{bt("col_yield", lang)}</th><th className="r">{bt("col_dscr", lang)}</th><th className="r">{bt("k_pirr", lang)}</th><th className="r">{pt("k_eirr", lang)}</th>
          {showShort && <th className="r">{pt(fin.dsraMonths > 0 ? "st_short_dsra" : "st_short", lang)}, {money.cur}</th>}
        </tr></thead><tbody>
          {model.suite.map((s) => (
            <tr key={s.id}>
              <td>{caseLabel(s.id, lang, "MD")}</td><td>{s.exceed}</td>
              <td className={"r" + (s.agg.dscrMin != null && s.agg.dscrMin < 1 ? " t-bad" : s.agg.dscrMin != null && s.agg.dscrMin < sizing.p50Dscr ? " t-warn" : "")}>{fd(s.agg.dscrMin)}</td>
              <td className="r">{fp(s.agg.irr)}</td><td className="r">{fp(s.agg.equityIrr)}</td>
              {showShort && <td className={"r" + (s.agg.shortfallEur > 0.5 ? " t-bad" : "")}>{money.full(s.agg.shortfallEur || 0)}</td>}
            </tr>
          ))}
        </tbody></table>
        {rr.length > 0 && (
          <>
            <h3>{pt("t_risks", lang)}</h3>
            <table className="rp-t"><tbody>
              {rr.map((x) => <tr key={x.id}><td><b>{x.r[0]}</b></td><td><span className={"rp-lv lv-" + x.level}>{x.r[1]}</span></td><td className="r">{x.r[2]}</td><td className="rp-rule">{x.r[3]}</td></tr>)}
            </tbody></table>
          </>
        )}
      </section>

      {/* ---- page 3: the papers */}
      <section className="rp-page">
        <h3>{bt("docs_h", lang)} <small className="rp-dim">{plt("p_progress", lang, { done: miss.progress.done, total: miss.progress.total })}</small></h3>
        <table className="rp-t rp-permits"><thead><tr>
          <th />{[plt("p_status", lang), plt("pf_by", lang), plt("pf_ref", lang), plt("pf_submitted", lang), plt("pf_due", lang)].map((h) => <th key={h}>{h}</th>)}
          {docCounts && <th className="r">{dt("if_docs", lang)}</th>}
        </tr></thead><tbody>
          {miss.progress.rows.map((row) => (
            <tr key={row.id} className={"ps-" + row.status}>
              <td>{plt("pm_" + row.id, lang)}</td><td className="nw">{plt("ps_" + row.status, lang)}{row.overdue ? `, ${plt("p_overdue", lang)}` : ""}</td>
              <td>{row.by}</td><td>{row.ref}</td><td className="nw">{row.submitted}</td><td className="nw">{row.due}</td>
              {docCounts && <td className="r">{docCounts[row.id] || ""}</td>}
            </tr>
          ))}
          {docCounts?.other > 0 && <tr><td>{plt("pm_other", lang)}</td><td colSpan={5} /><td className="r">{docCounts.other}</td></tr>}
        </tbody></table>
        <p className="rp-small">{plt("permits_p", lang)}</p>
        <h3>{bt("missing_h", lang)}</h3>
        {miss.count === 0 ? <p>{bt("missing_none", lang)}</p> : (
          <ul className="rp-list rp-missing">
            {miss.gaps.map((g) => <li key={g.id}>{gapText(g, lang)}</li>)}
            {miss.items.map((row) => <li key={row.id}>{missingLine(row, lang)}</li>)}
          </ul>
        )}
        <h3>{bt("basis_h", lang)}</h3>
        <p className="rp-small">{bt("basis_p", lang, { src: srcLine || none })}{en.wind?.source === "screening" ? ` ${plt("w_screen_doc", lang)} ${plt("r_wind_src", lang, { src: WIND_SOURCE })}` : ""}</p>
        {dataSources.length > 0 && <p className="rp-small"><b>{bt("ds_h", lang)}:</b> {dataSources.join("; ")}.</p>}
        <p className="rp-small">{bt("tax_basis", lang, { x: taxLine(fin, lang) })} {bt("llcr_note", lang)} {pt("su_h", lang)} {grid ? `${bt("g_note", lang)} ` : ""}{fxNote(lang, money.cur, fx)}</p>
        <p className="rp-small rp-foot">{bt("disclaimer", lang)}</p>
      </section>

      {/* ---- annex: the grid connection, when one was studied */}
      {pl.grid && (
        <section className="rp-page rp-annex">
          <GridAnnex plant={a.plant} lang={lang} money={money} E={model.E} fin={model.fin} scenario={model.scenario} todayKey={todayKey} />
        </section>
      )}
    </article>
  );
}
