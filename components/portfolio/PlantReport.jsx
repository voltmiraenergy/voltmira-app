// components/portfolio/PlantReport.jsx — the report's plant section: for each
// utility plant, its sources with their P50 and P90 and where each figure
// comes from (an independent study, the public-data screening, PVGIS), the
// revenue contract, the costs, what a lender would test (lowest cover and
// the room before the target), and the permit checklist as the EVO portal
// will track it. Server-rendered plain HTML, so the PDF prints it as shown.
import { normalizePlant, plantEnergy, plantHeadroom } from "../../lib/plantFinance.js";
import { permitProgress } from "../../lib/plantPermits.js";
import { plt, studyCite } from "../../lib/plantText.js";
import { num, mwhUnit, dscr } from "../../lib/portfolioFormat.js";
import { WIND_SOURCE } from "../../lib/windData.js";
import { gridText } from "../../lib/bankPack.js";
import { bt } from "../../lib/bankText.js";
import { connectionGroups } from "../../lib/gridOptions.js";
import GridAnnex from "./GridAnnex.jsx";

const Row = ({ k, v }) => <tr><th scope="row">{k}</th><td>{v}</td></tr>;

export default function PlantReport({ assets, lang, money, E, fin, scenario, target, todayKey }) {
  const plants = assets.map((a, i) => ({ a, n: i + 1 })).filter((x) => x.a.kind === "plant");
  const mwh = (v) => `${num(v, lang, 0)} ${mwhUnit(lang)}`;
  const pc = (v) => `${num(v, lang, 1)}%`;
  const src = (s) => plt(s === "study" ? "src_study" : s === "screening" ? "src_screening" : s === "none" ? "src_none" : "src_pvgis", lang);
  // a study is cited by who wrote it, when, and the page of its P50
  const cite = (s, study) => { const c = s === "study" ? studyCite(study, lang) : ""; return c ? `${src(s)} (${c})` : src(s); };
  const status = (s) => plt("ps_" + s, lang);
  const anyScreening = plants.some(({ a }) => plantEnergy(a.plant).wind?.source === "screening");
  // plants that connect at the same point are checked together
  const groups = connectionGroups(plants.map(({ a }) => a.plant));
  return (
    <>
      {plants.map(({ a, n }) => {
        const pl = normalizePlant(a.plant);
        const en = plantEnergy(pl);
        const hr = plantHeadroom(pl, E, fin, scenario, target);
        const prog = permitProgress(pl.permits, todayKey);
        const p90 = (x) => x.p50Mwh * Math.max(0, 1 - (1.2816 * x.sigmaPct) / 100);
        const r = pl.revenue;
        const grid = gridText(pl, lang, (v) => `${money.full(v)} ${money.cur}`);
        const t = dscr(target, lang);
        return (
          <div key={a.id} className="rp-plant">
            <h3><span className="rp-num">{n}</span>{pl.name}{pl.sample ? <em className="rp-sample"> {plt("sample_badge", lang)}</em> : null}</h3>
            {pl.sample && <p className="rp-small">{plt("sample_note", lang)}</p>}
            <table className="rp-t"><thead><tr>
              <th />{[plt("r_cap", lang), plt("s_p50", lang), plt("s_p90", lang)].map((h) => <th key={h} className="r">{h}</th>)}<th>{plt("r_source", lang)}</th>
            </tr></thead><tbody>
              {en.wind && <tr><td>{plt("c_wind", lang)}{pl.wind ? `, ${pl.wind.turbines} x ${num(pl.wind.mw / pl.wind.turbines, lang, 1)} MW, ${num(pl.wind.hubM, lang, 0)} m` : ""}</td><td className="r">{num(pl.wind.mw, lang, 1)}</td><td className="r">{mwh(en.wind.p50Mwh)}</td><td className="r">{mwh(p90(en.wind))}</td><td>{cite(en.wind.source, pl.wind.study)}{en.wind.cfPct ? `, ${pc(en.wind.cfPct)}` : ""}</td></tr>}
              {en.solar && <tr><td>{plt("c_solar", lang)}</td><td className="r">{num(pl.solar.mwp, lang, 1)}</td><td className="r">{mwh(en.solar.p50Mwh)}</td><td className="r">{mwh(p90(en.solar))}</td><td>{cite(en.solar.source, pl.solar.study)}{pl.solar.yieldKwhKwp ? `, ${num(pl.solar.yieldKwhKwp, lang, 0)} kWh/kWp` : ""}</td></tr>}
              {pl.bess && <tr><td>{plt("c_bess", lang)}</td><td className="r">{num(pl.bess.mw, lang, 1)}</td><td className="r" colSpan={2}>{mwh(pl.bess.mwh)}</td><td>{r.bessEurPerMwYr > 0 ? `${money.full(r.bessEurPerMwYr)} ${money.cur}/MW, ${plt("b_years_v", lang, { n: r.bessYears })}` : plt("b_note", lang)}</td></tr>}
            </tbody></table>
            {en.wind?.source === "screening" && <p className="rp-small">{plt("w_screen_doc", lang)}</p>}
            {grid && <p className="rp-small"><b>{plt("grid_h", lang)}:</b> {grid}. {bt("g_note", lang)}</p>}
            <div className="rp-two">
              <table className="rp-kv"><tbody>
                <Row k={plt("rev_kind", lang)} v={plt("rk_" + r.kind, lang)} />
                <Row k={plt("rev_price", lang)} v={num(r.priceEurMwh, lang, 2)} />
                {r.kind !== "merchant" && <Row k={plt("rev_years", lang)} v={r.years} />}
                {r.kind !== "merchant" && <Row k={plt("rev_index", lang)} v={pc(r.indexPct)} />}
                {r.kind !== "merchant" && <Row k={plt("rev_after", lang)} v={num(r.afterEurMwh, lang, 2)} />}
              </tbody></table>
              <table className="rp-kv"><tbody>
                <Row k={plt("r_capex", lang)} v={`${money.full(a.result.capexEur)} ${money.cur}`} />
                <Row k={plt("r_lcoe", lang)} v={a.result.lcoe == null ? "-" : `${num(a.result.lcoe * 1000 * money.rate, lang, 1)} ${money.cur}/${mwhUnit(lang)}`} />
                <Row k={plt("r_dscr", lang)} v={hr.dscrMin == null ? "-" : dscr(hr.dscrMin, lang)} />
                {hr.energyHeadroomPct != null && <Row k={plt("hr_energy_k", lang)} v={plt(hr.energyHeadroomPct >= 0 ? "hr_energy_pos" : "hr_energy_neg", lang, { x: pc(Math.abs(hr.energyHeadroomPct)), t })} />}
                {hr.capexHeadroomPct != null && <Row k={plt("hr_capex_k", lang)} v={plt(hr.capexHeadroomPct >= 0 ? "hr_capex_pos" : "hr_capex_neg", lang, { x: pc(Math.abs(hr.capexHeadroomPct)), t })} />}
              </tbody></table>
            </div>
            <h3 className="rp-sub">{plt("permits_h", lang)} <small className="rp-dim">{plt("p_progress", lang, { done: prog.done, total: prog.total })}</small></h3>
            <table className="rp-t rp-permits"><thead><tr>
              <th />{[plt("p_status", lang), plt("pf_by", lang), plt("pf_ref", lang), plt("pf_submitted", lang), plt("pf_due", lang)].map((h) => <th key={h}>{h}</th>)}
            </tr></thead><tbody>
              {prog.rows.map((row) => (
                <tr key={row.id} className={"ps-" + row.status}>
                  <td>{plt("pm_" + row.id, lang)}</td><td className="nw">{status(row.status)}{row.overdue ? `, ${plt("p_overdue", lang)}` : ""}</td>
                  <td>{row.by}</td><td>{row.ref}</td><td className="nw">{row.submitted}</td><td className="nw">{row.due}</td>
                </tr>
              ))}
            </tbody></table>
            <GridAnnex plant={a.plant} lang={lang} money={money} E={E} fin={fin} scenario={scenario} groups={groups} todayKey={todayKey} title={false} />
          </div>
        );
      })}
      <p className="rp-small">{plt("permits_p", lang)}{anyScreening ? ` ${plt("r_wind_src", lang, { src: WIND_SOURCE })}` : ""}</p>
    </>
  );
}
