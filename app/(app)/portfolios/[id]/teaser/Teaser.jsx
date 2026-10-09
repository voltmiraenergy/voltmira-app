// app/(app)/portfolios/[id]/teaser/Teaser.jsx — the investor teaser: what the
// opportunity is, the key figures, sources and uses, the debt cover, the
// assets and where they are, the main risks, and what is ready to share.
// When a plant has a site plan, the largest one gets a sheet of its own (the
// aerial plan, its legend and figures) between the figures and the cover of
// the debt: what an investor wants to see first is the plant itself.
// Server-rendered; every chart is plain SVG or HTML (the PDF blocks scripts).
import { pt } from "../../../../../lib/portfolioText.js";
import { bt } from "../../../../../lib/bankText.js";
import { plt } from "../../../../../lib/plantText.js";
import { pct, dscr, num, mwhUnit, kwpUnit, capacity } from "../../../../../lib/portfolioFormat.js";
import { riskRows } from "../../../../../lib/portfolioExport.js";
import { fxNote } from "../../../../../lib/portfolioDisplay.js";
import DscrChart from "../../../../../components/portfolio/DscrChart.jsx";
import SourcesUses from "../../../../../components/portfolio/SourcesUses.jsx";
import StaticMap from "../../../../../components/portfolio/StaticMap.jsx";
import SiteLayoutPlan, { hasLayout } from "../../../../../components/portfolio/SiteLayoutPlan.jsx";
import { normalizePlant } from "../../../../../lib/plantFinance.js";

const MAX_ROWS = 10;
const LEVEL = { high: 0, medium: 1, low: 2, unknown: 3 };

export default function Teaser({ model, lang, company, date, money, fx, rid = "" }) {
  const { agg, fin, sizing, assets } = model;
  const market = model.portfolio?.market || "MD";
  const none = pt("na", lang);
  const f = (v) => (v == null ? none : pct(v, lang));
  const fd = (v) => (v == null ? none : dscr(v, lang));
  const hasDebt = fin.gearingPct > 0;
  const rr = riskRows(model, lang).map((r, i) => ({ r, level: model.risks[i].level }))
    .filter((x) => x.level === "high" || x.level === "medium").sort((a, b) => LEVEL[a.level] - LEVEL[b.level]).slice(0, 4);
  const located = assets.filter((a) => a.lat != null);
  // the plants with a site plan, largest first: the first gets the site sheet
  const planned = assets.filter((a) => a.kind === "plant").map((a) => ({ a, pl: normalizePlant(a.plant) }))
    .filter((x) => hasLayout(x.pl)).sort((x, y) => (y.a.kw || 0) - (x.a.kw || 0));
  const site = planned[0] || null;
  // the debt sought: what the model carries, never more than the cash flow supports
  const sought = hasDebt ? Math.min(sizing.capacityEur, sizing.currentLoanEur) : sizing.capacityEur;
  // what the assets are: rooftop quotes are solar; a plant names its sources
  const plants = assets.filter((a) => a.kind === "plant").map((a) => a.plant);
  const kinds = [
    (plants.some((p) => p.wind) ? "c_wind" : null),
    (plants.some((p) => p.solar) || plants.length < assets.length ? "c_solar" : null),
    (plants.some((p) => p.bess) ? "c_bess" : null),
  ].filter(Boolean).map((k) => plt(k, lang).toLowerCase()).join(", ");
  const where = { n: agg.count, mw: capacity(agg.kwp, lang), m: pt(market === "UA" ? "market_ua" : "market_md", lang), kinds };
  const what = pt(plants.length ? "t_what_mix" : "t_what_solar", lang, where);
  const ask = pt("t_ask", lang, {
    what, capex: `${money.full(agg.capexEur)} ${money.cur}`, debt: `${money.full(sought)} ${money.cur}`,
    t50: dscr(sizing.p50Dscr, lang), t90: dscr(sizing.p90Dscr, lang), y: fin.tenorYears,
  }) + (hasDebt && !sizing.withinCapacity ? ` ${pt("t_over", lang, { x: `${money.full(sizing.currentLoanEur)} ${money.cur}` })}` : "");

  return (
    <article className="rp rp-teaser" lang={lang}>
      <section className="rp-page">
        <div className="rp-cover-top">
          <p className="rp-kicker">{pt("t_title", lang)}</p>
          <h1>{model.portfolio?.name || ""}</h1>
          <p className="rp-meta">{[pt("r_prepared", lang, { co: company || "VoltMira" }), date, rid && bt("rid", lang, { x: rid })].filter(Boolean).join(", ")}</p>
        </div>
        <p className="rp-lead">{ask}</p>
        <h3>{pt("t_highlights", lang)}</h3>
        <div className="rp-facts">
          <div><span>{pt("k_assets", lang)}</span><b>{agg.count}</b><small>{capacity(agg.kwp, lang)}, {num(agg.year1Mwh, lang, 0)} {mwhUnit(lang)}</small></div>
          <div><span>{pt("k_capex", lang)}</span><b>{money.compact(agg.capexEur)}</b><small>{money.cur}</small></div>
          <div><span>{pt("ds_capacity", lang)}</span><b>{money.compact(sizing.capacityEur)}</b><small>{money.cur}{sizing.capacityPct == null ? "" : `, ${num(sizing.capacityPct, lang, 0)}%`}</small></div>
          <div><span>{pt("k_dscr_p50", lang)}</span><b>{fd(agg.dscrMin)}</b><small>P90 {fd(model.p90.dscrMin)}</small></div>
          <div><span>{pt("k_irr", lang)}</span><b>{f(agg.irr)}</b><small>{pt("k_eirr", lang)} {f(agg.equityIrr)}</small></div>
          <div><span>{pt("k_co2", lang)}</span><b>{num(model.co2.tPerYear, lang, 0)}</b><small>{pt("es_co2_t", lang)}</small></div>
        </div>
        <h3>{pt("s_su", lang)}</h3>
        <SourcesUses su={model.sourcesUses} money={money} lang={lang} />
      </section>

      {site && (
        <section className="rp-page rp-site">
          <h3>{plt("ly_h_doc", lang)}{assets.length > 1 ? `: ${site.a.name}` : ""}</h3>
          <SiteLayoutPlan pl={site.pl} lang={lang} heading={false} note={false} width={720} height={500} />
          {planned.length > 1 && <p className="rp-small">{plt("ly_teaser_more", lang, { n: planned.length - 1 })}</p>}
        </section>
      )}

      <section className="rp-page">
        {/* the cover of the debt opens the second page: the first is full with the figures and the sources */}
        {hasDebt && (
          <>
            <h3>{pt("ch_dscr", lang)}</h3>
            <DscrChart p50={agg.dscrByYear} p90={model.p90.dscrByYear} targets={{ p50: sizing.p50Dscr, p90: sizing.p90Dscr }} lang={lang} bare height={190} />
          </>
        )}
        <h3>{pt("t_assets", lang)}</h3>
        <table className="rp-t"><thead><tr>
          <th className="r">{pt("r_no", lang)}</th><th>{pt("col_asset", lang)}</th><th>{pt("col_area", lang)}</th><th className="r">{kwpUnit(lang)}</th>
          <th className="r">{pt("col_capex", lang)}, {money.cur}</th><th className="r">{pt("col_irr", lang)}</th><th className="r">DSCR P50</th>
        </tr></thead><tbody>
          {assets.slice(0, MAX_ROWS).map((a, i) => (
            <tr key={a.id}><td className="r rp-dim">{i + 1}</td><td><b>{a.name}</b></td><td>{a.regionName || ""}</td><td className="r">{num(a.kw, lang, 1)}</td>
              <td className="r">{money.full(a.result.capexEur)}</td><td className="r">{f(a.result.irr)}</td><td className="r">{a.result.dscrMin == null ? "" : dscr(a.result.dscrMin, lang)}</td></tr>
          ))}
        </tbody></table>
        {assets.length > MAX_ROWS && <p className="rp-small">{pt("t_more", lang, { n: assets.length - MAX_ROWS })}</p>}
        {located.length > 0 && (!site || located.length > 1) && <StaticMap assets={assets.slice(0, MAX_ROWS)} label={pt("map_label", lang)} width={700} height={170} />}
        {rr.length > 0 && (
          <>
            <h3>{pt("t_risks", lang)}</h3>
            <table className="rp-t"><tbody>
              {rr.map((x, i) => <tr key={i}><td><b>{x.r[0]}</b></td><td><span className={"rp-lv lv-" + x.level}>{x.r[1]}</span></td><td className="r">{x.r[2]}</td><td className="rp-rule">{x.r[3]}</td></tr>)}
            </tbody></table>
          </>
        )}
        <div className="rp-two">
          <div>
            <h3>{pt("s_ready", lang)}</h3>
            <p className="rp-big">{Math.round(model.readiness.score)} <small>{pt("rd_of", lang)}</small></p>
            <p className="rp-small">{pt("k_readiness", lang)} {Math.round(model.readiness.docsPct)}%; {pt("k_screening", lang)} {model.esProgress.answered}/{model.esProgress.total}</p>
          </div>
          <div>
            <h3>{pt("t_next", lang)}</h3>
            <p className="rp-small">{pt("t_next_p", lang)}</p>
            <h3>{pt("t_contact", lang)}</h3>
            <p>{company || "VoltMira"}</p>
          </div>
        </div>
        <p className="rp-small rp-foot">{pt("t_note", lang)} {fxNote(lang, money.cur, fx)}</p>
      </section>
    </article>
  );
}
