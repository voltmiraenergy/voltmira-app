// app/(app)/energy/page.jsx — "Green energy": the Moldovan market an
// installer and their lenders decide in. Where the right bank's electricity
// comes from, renewables' growth against the 2050 targets, the day-ahead
// market and balancing, the second renewables auction, the support a job can
// get, and the grid and permit picture. Every figure comes from
// lib/greenData.js, as printed in the Ministry of Energy's presentation; nothing is
// estimated from a chart, and what is not published stays out. Hourly
// day-ahead prices wait on OPEM's consent to their reuse.
import "../dx.css";
import "./energy.css";
import Link from "next/link";
import { currentCompany } from "../../../lib/session.js";
import { normLang } from "../../../lib/i18n.js";
import { appTitle } from "../../../lib/pageTitle.js";
import {
  DAY_SUPPLY, RES_SHARE, CAPACITY_JUL_2026, TARGETS_2050, OBJECTIVES, BESS_STATUS, DAY_AHEAD, BALANCING, AUCTION_2, RAA, EVO, PROGRAMS,
} from "../../../lib/greenData.js";
import { et, sourceLine } from "../../../lib/energyText.js";
import { num, mwhUnit } from "../../../lib/portfolioFormat.js";
import { fmtDate } from "../../../lib/tz.js";
import { LOCALE } from "../../../lib/relTime.js";
import SupplyMix from "../../../components/energy/SupplyMix.jsx";

export const dynamic = "force-dynamic";
export const generateMetadata = appTitle((lang) => et("nav", lang));

const mwUnit = (lang) => (lang === "ru" || lang === "uk" ? "МВт" : "MW");
const LEI = { en: "lei", ro: "lei", ru: "лей", uk: "лей" };
const MILLION = { en: "million", ro: "milioane", ru: "млн", uk: "млн" };
const BILLION = { en: "billion", ro: "miliarde", ru: "млрд", uk: "млрд" };

export default async function EnergyPage() {
  const co = await currentCompany();
  const lang = normLang(co?.lang);
  const loc = LOCALE[lang] || "en-GB";
  const pc = (v) => `${num(v, lang, 1)}%`;
  const mw = (v) => `${num(v, lang, 2)} ${mwUnit(lang)}`;
  const mwh = (v) => `${num(v, lang, 1)} ${mwhUnit(lang)}`;
  const eurMwh = (v) => `${num(v, lang, 2)} EUR/${mwhUnit(lang)}`;
  const day = (d) => fmtDate(d + "T12:00:00Z", loc, { day: "numeric", month: "long", year: "numeric" }).replace(/\.$/, "");
  const lei = (v) => (v >= 1e9 ? `${num(v / 1e9, lang, 1)} ${BILLION[lang] || BILLION.en} ${LEI[lang]}`
    : v >= 1e6 ? `${num(v / 1e6, lang, 0)} ${MILLION[lang] || MILLION.en} ${LEI[lang]}` : `${num(v, lang, 0)} ${LEI[lang]}`);

  const res = RES_SHARE.byYear;
  const resMax = Math.max(...Object.values(res));
  const cap = CAPACITY_JUL_2026;
  const solarNow = cap.mw.solar + cap.mw.solar_prosumers;
  const targets = [
    { id: "wind", now: cap.mw.wind, target: TARGETS_2050.mw.wind, fmt: mw },
    { id: "solar", now: solarNow, target: TARGETS_2050.mw.solar, fmt: mw },
    { id: "storage", now: BESS_STATUS.installedMwh, target: TARGETS_2050.storageMwh, fmt: mwh },
    { id: "hydrogen", now: null, target: TARGETS_2050.mw.hydrogen, fmt: mw },
  ];
  const balMax = Math.max(...BALANCING.tender.map((t) => t.requestMw));
  const product = { fcr: "FCR", afrr: "aFRR", mfrr_12h: "mFRR (12 h)", mfrr_2h: "mFRR (2 h)" };
  const P = Object.fromEntries(PROGRAMS.map((p) => [p.id, p]));
  const src = et("src", lang, { src: sourceLine(["mbw2026"], lang) });

  return (
    <div className="dx en">
      <header className="dx-head">
        <div className="dx-hello">
          <p className="dx-date">{et("nav", lang)}</p>
          <h1>{et("pg_h1", lang)}</h1>
          <p className="dx-summary">{et("pg_sub", lang)}</p>
        </div>
      </header>

      {/* ---- the headline numbers */}
      <section className="en-kpis" aria-label={et("pg_h1", lang)}>
        <div className="en-kpi"><span>{et("mk_k_res", lang)}</span><b>{pc(res[2026])}</b><small>{et("mk_k_res_s", lang, { a: pc(res[2024]), b: pc(res[2018]) })}</small></div>
        <div className="en-kpi"><span>{et("mk_k_cap", lang)}</span><b>{mw(cap.statedTotalMw)}</b><small>{et("mk_k_cap_s", lang, { s: mw(cap.mw.solar), w: mw(cap.mw.wind), p: mw(cap.mw.solar_prosumers) })}</small></div>
        <div className="en-kpi"><span>{et("mk_k_bess", lang)}</span><b>{mwh(BESS_STATUS.installedMwh)}</b><small>{et("mk_k_bess_s", lang, { need: mwh(BESS_STATUS.neededMwh) })}</small></div>
        <div className="en-kpi"><span>{et("mk_obj_import", lang)}</span><b>{pc(OBJECTIVES.importDependencePct.from)}</b><small>{et("mk_obj_import_v", lang, { a: pc(OBJECTIVES.importDependencePct.from), y1: OBJECTIVES.importDependencePct.fromYear, b: pc(OBJECTIVES.importDependencePct.to), y2: OBJECTIVES.importDependencePct.toYear })}</small></div>
      </section>

      {/* ---- supply */}
      <section className="dx-card" aria-labelledby="en-supply-h">
        <header className="dx-card-head"><div><h2 id="en-supply-h">{et("sec_supply", lang)}</h2><p>{et("sec_supply_s", lang)}</p></div></header>
        <SupplyMix lang={lang} />
        <p className="en-note">{et("mk_mix_note", lang)}</p>
        <p className="en-note">{et("day_split", lang, { res: pc(DAY_SUPPLY.resPct), imp: pc(DAY_SUPPLY.importPct), chp: pc(DAY_SUPPLY.chpPct) })}</p>
      </section>

      <div className="en-two">
        {/* ---- growth */}
        <section className="dx-card" aria-labelledby="en-growth-h">
          <header className="dx-card-head"><div><h2 id="en-growth-h">{et("sec_growth", lang)}</h2><p>{et("sec_growth_s", lang)}</p></div></header>
          <ol className="en-bars" aria-label={et("sec_growth", lang)}>
            {Object.entries(res).map(([y, v]) => (
              <li key={y}>
                <b>{v.toLocaleString(loc, { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%</b>
                <span className="en-bar" style={{ height: `${(v / resMax) * 100}%` }} aria-hidden="true" />
                <small>{y}</small>
              </li>
            ))}
          </ol>
        </section>

        {/* ---- targets */}
        <section className="dx-card" aria-labelledby="en-targets-h">
          <header className="dx-card-head"><div><h2 id="en-targets-h">{et("sec_targets", lang)}</h2></div></header>
          <ul className="en-targets">
            {targets.map((t) => (
              <li key={t.id}>
                <div className="en-t-top"><b>{et("t_" + t.id, lang)}</b><span>{t.now == null ? et("t_none_now", lang) : et("t_now", lang, { x: t.fmt(t.now) })}</span></div>
                <div className="en-t-bar" aria-hidden="true"><i style={{ width: `${t.now == null ? 0 : Math.min(100, (t.now / t.target) * 100)}%` }} /></div>
                <small>{et("t_target", lang, { x: t.fmt(t.target) })}{t.id === "storage" ? `, ${mw(TARGETS_2050.mw.storage)}` : ""}</small>
              </li>
            ))}
          </ul>
          <p className="en-note">{et("t_solar_note", lang)}</p>
        </section>
      </div>

      {/* ---- prices and balancing */}
      <section className="dx-card" aria-labelledby="en-market-h">
        <header className="dx-card-head"><div><h2 id="en-market-h">{et("sec_market", lang)}</h2></div></header>
        <div className="en-two in">
          <div>
            <h3>{et("mk_dam_h", lang)}</h3>
            <div className="en-dam">
              {DAY_AHEAD.averagePriceEurMwh.map((d) => (
                <div key={d.date}><b>{eurMwh(d.value)}</b><small>{day(d.date)}</small></div>
              ))}
            </div>
            <p className="en-note">{et("mk_dam_vol", lang, { min: pc(DAY_AHEAD.august2026ShareOfConsumptionPct.min), max: pc(DAY_AHEAD.august2026ShareOfConsumptionPct.max), rec: pc(DAY_AHEAD.august2026ShareOfConsumptionPct.recordDay) })}</p>
            <p className="en-note">{et("dam_pending", lang)}</p>
          </div>
          <div>
            <h3>{et("mk_bal_h", lang)}</h3>
            <ul className="en-bal">
              {BALANCING.tender.map((t) => (
                <li key={t.product}>
                  <span className="en-bal-n">{product[t.product]}</span>
                  <span className="en-bal-bars" aria-hidden="true">
                    <i className="req" style={{ width: `${(t.requestMw / balMax) * 100}%` }} />
                    <i className="got" style={{ width: `${(t.resultMw / balMax) * 100}%` }} />
                  </span>
                  <span className="en-bal-v">{num(t.resultMw, lang, 0)} / {num(t.requestMw, lang, 0)} {mwUnit(lang)}</span>
                </li>
              ))}
            </ul>
            <p className="en-legend-s"><i className="got" />{et("mk_c_got", lang)}<i className="req" />{et("mk_c_req", lang)}</p>
            <p className="en-note">{et("mk_bal_note", lang, { date: day(BALANCING.dates.results) })}</p>
          </div>
        </div>
      </section>

      <div className="en-two">
        {/* ---- the auction */}
        <section className="dx-card" aria-labelledby="en-au-h">
          <header className="dx-card-head"><div><h2 id="en-au-h">{et("sec_auction", lang)}</h2></div></header>
          <p className="en-big">{eurMwh(AUCTION_2.priceEurMwh)}<small>{num(AUCTION_2.priceMdlKwh, lang, 4)} {LEI[lang]}/kWh</small></p>
          <p className="en-p">{et("au_line", lang, {
            bids: AUCTION_2.bids, omw: mw(AUCTION_2.offeredMw), omwh: mwh(AUCTION_2.offeredMwh), tmw: mw(AUCTION_2.tenderedMw), tmwh: mwh(AUCTION_2.tenderedMwh),
            wins: AUCTION_2.winningBids, wmw: mw(AUCTION_2.awardedWindMw), wmwh: mwh(AUCTION_2.awardedBessMwh), price: eurMwh(AUCTION_2.priceEurMwh),
          })}</p>
          <p className="en-note">{et("au_more", lang, { inv: `${num(AUCTION_2.investmentEurM, lang, 0)} ${MILLION[lang] || MILLION.en} EUR`, co2: num(AUCTION_2.co2ReductionT, lang, 0) })}</p>
        </section>

        {/* ---- support */}
        <section className="dx-card" aria-labelledby="en-sup-h">
          <header className="dx-card-head">
            <div><h2 id="en-sup-h">{et("sec_support", lang)}</h2><p>{et("sec_support_s", lang)}</p></div>
            <Link className="dx-link" href="/projects">{et("open_quotes", lang)}</Link>
          </header>
          <ul className="en-prog">
            <li><b>{et("pg_casa_verde", lang)}</b><span>{et("cv_line", lang, { pct: P.casa_verde.sharePct, cap: lei(P.casa_verde.cap.amount) })}</span></li>
            <li><b>{et("pg_bess_guarantee", lang)}</b><span>{et("g_line", lang, { pct: P.bess_guarantee.sharePct, cap: lei(P.bess_guarantee.cap.amount), months: P.bess_guarantee.maxMonths, fee: P.bess_guarantee.feePctYear })}</span></li>
            <li><b>{et("mk_sup_law", lang)}</b><span>{et("mk_sup_law_v", lang, { from: P.law112_customs.dutyFromPct, to: P.law112_customs.dutyToPct })}</span></li>
            <li><b>{et("pg_facem_373", lang)}</b><span>{et("facem_line", lang, { pct: P.facem_373.upToPct })}</span></li>
          </ul>
        </section>
      </div>

      {/* ---- grid and permits */}
      <section className="dx-card" aria-labelledby="en-grid-h">
        <header className="dx-card-head"><div><h2 id="en-grid-h">{et("sec_grid", lang)}</h2></div></header>
        <div className="en-three">
          <div>
            <h3>{et("ic_h", lang)}</h3>
            <ul className="en-ic">
              {OBJECTIVES.interconnections.map((ic) => (
                <li key={ic.id}><span className={"en-ic-c c-" + ic.country}>{et(ic.country === "RO" ? "ic_ro" : "ic_ua", lang)}</span><b>{ic.ends.join(", ")}</b><small>{ic.kv} kV</small></li>
              ))}
            </ul>
            <p className="en-note">{et("ic_note", lang)}</p>
          </div>
          <div>
            <h3>{et("raa_h", lang)}</h3>
            <p className="en-sub">{et("raa_steps_h", lang)}</p>
            <ol className="en-steps">{RAA.steps.map((s) => <li key={s}>{et("raa_s_" + s, lang)}</li>)}</ol>
            <p className="en-sub">{et("raa_benefits_h", lang)}</p>
            <ul className="en-list">{RAA.benefits.map((b) => <li key={b}>{et("raa_b_" + b, lang)}</li>)}</ul>
            {RAA.zones.length === 0 && <p className="en-note">{et("raa_none", lang)}</p>}
          </div>
          <div>
            <h3>{et("evo_h", lang)}</h3>
            <ul className="en-list">{EVO.principles.map((k) => <li key={k}>{et("evo_" + k, lang)}</li>)}</ul>
          </div>
        </div>
      </section>

      <p className="en-src">{src}. {et("pg_scope", lang)}</p>
    </div>
  );
}
