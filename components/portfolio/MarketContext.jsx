// components/portfolio/MarketContext.jsx — "Market context: Moldova", a
// section of the bankability report for a Moldovan portfolio: where the right
// bank's electricity comes from, renewables' growth, the battery gap, the
// day-ahead market and balancing, the state's objectives and the support a
// lender can count on. Every figure comes from lib/greenData.js as printed on
// the Ministry of Energy's presentation; blanks stay blank. Plain HTML tables, so the
// PDF (rendered with scripts blocked) prints it as it shows on screen.
import {
  COVERAGE, RES_SHARE, CAPACITY_JUL_2026, BESS_STATUS, DAY_AHEAD, BALANCING, AUCTION_2, OBJECTIVES, TARGETS_2050, PROGRAMS,
} from "../../lib/greenData.js";
import { et, sourceLine } from "../../lib/energyText.js";
import { num, mwhUnit } from "../../lib/portfolioFormat.js";
import { fmtDate } from "../../lib/tz.js";
import { LOCALE } from "../../lib/relTime.js";

const mwUnit = (lang) => (lang === "ru" || lang === "uk" ? "МВт" : "MW");
const LEI = { en: "lei", ro: "lei", ru: "лей", uk: "лей" };
const MILLION = { en: "million", ro: "milioane", ru: "млн", uk: "млн" };
const BILLION = { en: "billion", ro: "miliarde", ru: "млрд", uk: "млрд" };

export default function MarketContext({ lang = "en", heading }) {
  const loc = LOCALE[lang] || "en-GB";
  const pc = (v) => (v == null ? "" : `${num(v, lang, 1)}%`);
  const mw = (v) => `${num(v, lang, 2)} ${mwUnit(lang)}`;
  const mwh = (v) => `${num(v, lang, 1)} ${mwhUnit(lang)}`;
  const day = (d) => fmtDate(d + "T12:00:00Z", loc, { day: "numeric", month: "long", year: "numeric" }).replace(/\.$/, "");
  const month = (p) => {
    const s = new Date(p + "-15T12:00:00Z").toLocaleDateString(loc, { month: "long", year: "numeric", timeZone: "UTC" });
    return s.charAt(0).toUpperCase() + s.slice(1);
  };
  const leiAmount = (v) => {
    if (v >= 1e9) return `${num(v / 1e9, lang, 1)} ${BILLION[lang] || BILLION.en} ${LEI[lang] || "lei"}`;
    if (v >= 1e6) return `${num(v / 1e6, lang, 0)} ${MILLION[lang] || MILLION.en} ${LEI[lang] || "lei"}`;
    return `${num(v, lang, 0)} ${LEI[lang] || "lei"}`;
  };
  const eurMwh = (v) => `${num(v, lang, 2)} EUR/${mwhUnit(lang)}`;

  const res = RES_SHARE.byYear;
  const cap = CAPACITY_JUL_2026;
  const parts = Object.values(cap.mw).reduce((s, v) => s + v, 0) + cap.excludedPrintedMw;
  const rows = [
    ...COVERAGE.yearly.filter((r) => r.period >= "2022").map((r) => ({ ...r, label: et("mk_year", lang, { y: r.period }) })),
    ...["2025-01", "2025-06", "2025-12", "2026-06"].map((p) => COVERAGE.monthly.find((r) => r.period === p)).map((r) => ({ ...r, label: month(r.period) })),
  ];
  const g = PROGRAMS.find((p) => p.id === "bess_guarantee");
  const customs = PROGRAMS.find((p) => p.id === "law112_customs");
  const product = { fcr: "FCR", afrr: "aFRR", mfrr_12h: "mFRR (12 h)", mfrr_2h: "mFRR (2 h)" };

  return (
    <>
      {heading}
      <p className="rp-small">{et("mk_intro", lang)}</p>

      <div className="rp-kpis">
        <div><span>{et("mk_k_res", lang)}</span><b>{pc(res[2026])}</b><small>{et("mk_k_res_s", lang, { a: pc(res[2024]), b: pc(res[2018]) })}</small></div>
        <div><span>{et("mk_k_cap", lang)}</span><b>{mw(cap.statedTotalMw)}</b><small>{et("mk_k_cap_s", lang, { s: mw(cap.mw.solar), w: mw(cap.mw.wind), p: mw(cap.mw.solar_prosumers) })}</small></div>
        <div><span>{et("mk_k_bess", lang)}</span><b>{mwh(BESS_STATUS.installedMwh)}</b><small>{et("mk_k_bess_s", lang, { need: mwh(BESS_STATUS.neededMwh) })}</small></div>
        <div><span>{et("mk_k_auction", lang)}</span><b>{eurMwh(AUCTION_2.priceEurMwh)}</b><small>{et("mk_k_auction_s", lang, { mw: mw(AUCTION_2.awardedWindMw), mwh: mwh(AUCTION_2.awardedBessMwh) })}</small></div>
        {DAY_AHEAD.averagePriceEurMwh.map((d) => (
          <div key={d.date}><span>{et("mk_dam_h", lang)}</span><b>{eurMwh(d.value)}</b><small>{day(d.date)}</small></div>
        ))}
      </div>
      <p className="rp-small">{et("mk_cap_gap", lang, { total: mw(cap.statedTotalMw), parts: mw(Math.round(parts * 100) / 100) })}</p>

      <div className="rp-keep">
        <h3>{et("mk_mix_h", lang)}</h3>
        <table className="rp-t"><thead><tr>
          <th>{et("mk_c_period", lang)}</th><th className="r">{et("mk_c_right", lang)}</th><th className="r">{et("mk_c_left", lang)}</th>
          <th className="r">{et("mk_c_ua", lang)}</th><th className="r">{et("mk_c_ro", lang)}</th>
        </tr></thead><tbody>
          {rows.map((r) => (
            <tr key={r.period}><td>{r.label}</td><td className="r">{pc(r.right)}</td><td className="r">{pc(r.left)}</td><td className="r">{pc(r.ua)}</td><td className="r">{pc(r.ro)}</td></tr>
          ))}
        </tbody></table>
        <p className="rp-small">{et("mk_mix_note", lang)}</p>
      </div>

      <div className="rp-keep">
        <h3>{et("mk_res_h", lang)}</h3>
        <table className="rp-t rp-res"><thead><tr>
          {Object.keys(res).map((y) => <th key={y} className="r">{y}</th>)}
        </tr></thead><tbody><tr>
          {Object.values(res).map((v, i) => <td key={i} className="r">{pc(v)}</td>)}
        </tr></tbody></table>
        <p className="rp-small">{et("mk_dam_vol", lang, { min: pc(DAY_AHEAD.august2026ShareOfConsumptionPct.min), max: pc(DAY_AHEAD.august2026ShareOfConsumptionPct.max), rec: pc(DAY_AHEAD.august2026ShareOfConsumptionPct.recordDay) })}</p>
      </div>

      <div className="rp-keep">
        <h3>{et("mk_bal_h", lang)}</h3>
        <table className="rp-t"><thead><tr>
          <th>{et("mk_c_product", lang)}</th><th className="r">{et("mk_c_req", lang)}</th><th className="r">{et("mk_c_got", lang)}</th><th className="r">{et("mk_c_gap", lang)}</th>
        </tr></thead><tbody>
          {BALANCING.tender.map((t) => {
            const sym = t.symmetric ? "±" : "+";
            return (
              <tr key={t.product}><td>{product[t.product]}</td><td className="r">{sym}{num(t.requestMw, lang, 0)}</td>
                <td className="r">{sym}{num(t.resultMw, lang, 0)}{t.resultAvgMw ? <small>{et("mk_avg", lang, { x: num(t.resultAvgMw, lang, 0) })}</small> : null}</td>
                <td className="r">{num(Math.max(0, t.requestMw - t.resultMw), lang, 0)}</td></tr>
            );
          })}
        </tbody></table>
        <p className="rp-small">{et("mk_bal_note", lang, { date: day(BALANCING.dates.results) })}</p>
      </div>

      <div className="rp-keep">
        <h3>{et("mk_obj_h", lang)}</h3>
        <table className="rp-kv rp-kv-wide"><tbody>
          <tr><th scope="row">{et("mk_obj_import", lang)}</th><td>{et("mk_obj_import_v", lang, {
            a: pc(OBJECTIVES.importDependencePct.from), y1: OBJECTIVES.importDependencePct.fromYear,
            b: pc(OBJECTIVES.importDependencePct.to), y2: OBJECTIVES.importDependencePct.toYear,
          })}</td></tr>
          <tr><th scope="row">{et("mk_obj_2050", lang)}</th><td>{et("mk_obj_2050_v", lang, {
            w: mw(TARGETS_2050.mw.wind), s: mw(TARGETS_2050.mw.solar), st: mw(TARGETS_2050.mw.storage), stmwh: mwh(TARGETS_2050.storageMwh),
          })}</td></tr>
        </tbody></table>
      </div>
      <div className="rp-keep">
        <h3>{et("mk_sup_h", lang)}</h3>
        <table className="rp-kv rp-kv-wide"><tbody>
          <tr><th scope="row">{et("mk_sup_g", lang)}</th><td>{et("mk_sup_g_v", lang, {
            pct: g.sharePct, cap: leiAmount(g.cap.amount), months: g.maxMonths, fee: g.feePctYear,
            budget: leiAmount(g.budget.amount), lev: leiAmount(g.budget.amount * g.budget.leverage), date: day(g.validUntil),
          })}</td></tr>
          <tr><th scope="row">{et("mk_sup_law", lang)}</th><td>{et("mk_sup_law_v", lang, { from: customs.dutyFromPct, to: customs.dutyToPct })}</td></tr>
        </tbody></table>
      </div>
      <p className="rp-small">{et("src", lang, { src: sourceLine(g.sources, lang) })}</p>
    </>
  );
}
