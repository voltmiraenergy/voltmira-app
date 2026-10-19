"use client";
// components/energy/CnedArea.jsx — the picked area's profile beside the map in
// CnedExplorer: its four figures with their rank among the 35, against the
// country, the prosumer trend over the snapshot's 25 months, who the
// prosumers are and which scheme they are on, its plants by technology, and
// how it compares with its five nearest areas. Today's figures only; the map
// beside it may be showing an earlier moment.
//
// Data: one lib/cnedStats.js raionStats() row and the rest of them, as props.
import { useState } from "react";
import { raionName } from "../../lib/mdRaions.js";
import { ct, OPERATOR_NAME } from "../../lib/cnedText.js";
import { num } from "../../lib/portfolioFormat.js";
import { LOCALE } from "../../lib/relTime.js";
import { power } from "./CnedMap.jsx";
import { Zap, Users, Gauge, TrendingUp, Star, MapPin, UtilityPole, BatteryCharging } from "lucide-react";

const KI = { size: 15, strokeWidth: 2, "aria-hidden": true };
const kwhU = (lang) => ({ ru: "кВт·ч", uk: "кВт·год" }[lang] || "kWh");
const mwhU = (lang) => ({ ru: "МВт·ч", uk: "МВт·год" }[lang] || "MWh");
const energy = (kwh, lang) => (kwh == null ? "" : kwh >= 1000 ? `${num(kwh / 1000, lang, 1)} ${mwhU(lang)}` : `${num(kwh, lang, 0)} ${kwhU(lang)}`);
const monthName = (ym, lang) => new Date(`${ym}-15T12:00:00Z`).toLocaleDateString(LOCALE[lang] || "en-GB", { month: "short", year: "numeric", timeZone: "UTC" });
const pctText = (p, lang) => `${num(Math.abs(p), lang, 0)}%`;

/** The prosumer capacity over the snapshot's months: a line over a soft area, with the month under the pointer. */
function Trend({ monthly, lang }) {
  const [hover, setHover] = useState(null);
  const W = 300, H = 92, PAD = 4;
  const max = Math.max(...monthly.map((m) => m[1]), 1);
  const min = Math.min(...monthly.map((m) => m[1]));
  const lo = Math.max(0, min - (max - min) * 0.25);
  const x = (i) => PAD + (i / (monthly.length - 1)) * (W - PAD * 2);
  const y = (v) => H - 6 - ((v - lo) / Math.max(1, max - lo)) * (H - 22);
  const line = monthly.map((m, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(m[1]).toFixed(1)}`).join("");
  const area = `${line}L${x(monthly.length - 1).toFixed(1)},${H}L${x(0).toFixed(1)},${H}Z`;
  const h = hover == null ? monthly.length - 1 : hover;
  const m = monthly[h];
  const onMove = (e) => {
    const r = e.currentTarget.getBoundingClientRect();
    const i = Math.round(((e.clientX - r.left) / r.width) * (monthly.length - 1));
    setHover(Math.max(0, Math.min(monthly.length - 1, i)));
  };
  return (
    <div className="cn-trend2">
      <div className="cn-trend2-top">
        <span>{monthName(m[0], lang)}</span>
        <b>{power(m[1], lang)}</b>
        <small>{ct("p_trend_n", lang, { n: num(m[2], lang, 0) })}</small>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" role="img" onMouseMove={onMove} onMouseLeave={() => setHover(null)}
        aria-label={`${ct("p_trend", lang)}: ${power(monthly[0][1], lang)}, ${power(monthly.at(-1)[1], lang)}`}>
        <defs>
          <linearGradient id="cn-tg" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" stopColor="var(--cn-c4)" stopOpacity=".34" />
            <stop offset="1" stopColor="var(--cn-c4)" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={area} fill="url(#cn-tg)" />
        <path d={line} fill="none" stroke="var(--cn-c4)" strokeWidth="2" vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
        <line x1={x(h)} x2={x(h)} y1="8" y2={H} className="cn-trend2-x" vectorEffect="non-scaling-stroke" />
      </svg>
      <span className="cn-trend2-dot" style={{ left: `${(x(h) / W) * 100}%`, top: `${(y(m[1]) / H) * 100}%` }} aria-hidden="true" />
      <p className="cn-trend2-l"><span>{monthName(monthly[0][0], lang)}</span><span>{monthName(monthly.at(-1)[0], lang)}</span></p>
    </div>
  );
}

export default function CnedArea({ lang = "en", s, stats = [], byId = {}, national, inMarket, onToggleMarket, onSelect }) {
  if (!s) return null;
  const total = stats.length;
  const rank = (k) => s.rank?.[k] ?? null;
  const vs = national && s.perTenK != null ? ((s.perTenK - national) / national) * 100 : null;
  const near = [s.id, ...(s.near || [])].map((id) => byId[id]).filter(Boolean).sort((a, b) => (b.perTenK ?? 0) - (a.perTenK ?? 0));
  const nearMax = Math.max(1, ...near.map((r) => r.perTenK ?? 0));
  const techs = ["pv", "wind", "hydro"].filter((t) => s.plants[t].kw > 0);
  const share = (a, b) => `${(a / Math.max(1, b)) * 100}%`;

  return (
    <div className="cn-area">
      <div className="cn-area-head">
        <div>
          <h3 className="cn-area-name">{raionName(s.id, lang)}</h3>
          <p className="cn-area-meta">
            {s.population ? <span><MapPin {...KI} />{ct("p_pop", lang, { n: num(s.population, lang, 0) })}</span> : null}
            {s.operator ? <span className={"cn-op op-" + s.operator}><UtilityPole {...KI} />{OPERATOR_NAME[s.operator]}</span> : null}
          </p>
        </div>
        <button type="button" className={"cn-star" + (inMarket ? " on" : "")} aria-pressed={inMarket} onClick={() => onToggleMarket?.(s.id)}
          title={ct(inMarket ? "p_in_market" : "p_add_market", lang)}>
          <Star size={15} strokeWidth={2} fill={inMarket ? "currentColor" : "none"} aria-hidden="true" />
          <span>{ct(inMarket ? "p_in_market" : "p_add_market", lang)}</span>
        </button>
      </div>

      <div className="cn-tiles">
        <div className="cn-tile">
          <span className="cn-tile-l"><Users {...KI} />{ct("p_prosumers", lang)}</span>
          <b>{num(s.prosumers.n, lang, 0)}</b>
          <small>{power(s.prosumers.kw, lang)}{rank("prosumersKw") ? <em>{ct("p_rank", lang, { r: rank("prosumersKw"), t: total })}</em> : null}</small>
        </div>
        <div className="cn-tile">
          <span className="cn-tile-l"><Gauge {...KI} />{ct("p_per10k", lang)}</span>
          <b>{num(s.perTenK, lang, 1)}</b>
          <small>
            {vs == null ? "" : ct(vs >= 0 ? "p_vs_up" : "p_vs_down", lang, { p: pctText(vs, lang), x: num(national, lang, 1) })}
            {rank("perTenK") ? <em>{ct("p_rank", lang, { r: rank("perTenK"), t: total })}</em> : null}
          </small>
        </div>
        <div className="cn-tile">
          <span className="cn-tile-l"><TrendingUp {...KI} />{ct("p_growth", lang)}</span>
          <b className={s.growth12?.kw > 0 ? "up" : ""}>{s.growth12 ? `+${power(s.growth12.kw, lang)}` : ""}</b>
          <small>
            {s.growth12 ? ct("p_growth_s", lang, { n: num(s.growth12.n, lang, 0), p: s.growth12.pctKw == null ? "" : `+${pctText(s.growth12.pctKw, lang)}` }) : ""}
            {rank("growth") ? <em>{ct("p_rank", lang, { r: rank("growth"), t: total })}</em> : null}
          </small>
        </div>
        <div className="cn-tile">
          <span className="cn-tile-l"><Zap {...KI} />{ct("p_plants", lang)}</span>
          <b>{power(s.plantsKw, lang)}</b>
          <small>{ct("p_plants_n", lang, { n: num(s.plantsN, lang, 0) })}{rank("plantsKw") ? <em>{ct("p_rank", lang, { r: rank("plantsKw"), t: total })}</em> : null}</small>
        </div>
      </div>

      {s.monthly?.length > 1 && (
        <section className="cn-area-sec">
          <h4>{ct("p_trend", lang)}</h4>
          <Trend monthly={s.monthly} lang={lang} />
        </section>
      )}

      <section className="cn-area-sec">
        <h4>{ct("p_who", lang)}</h4>
        <div className="cn-split" aria-hidden="true"><i className="a" style={{ width: share(s.prosumers.pf.n, s.prosumers.n) }} /><i className="b" /></div>
        <p className="cn-split-l"><span><b className="a" />{ct("households_n", lang, { n: num(s.prosumers.pf.n, lang, 0) })}</span><span><b className="b" />{ct("companies_n", lang, { n: num(s.prosumers.pj.n, lang, 0) })}</span></p>
        <h4>{ct("p_scheme", lang)}</h4>
        <div className="cn-split" aria-hidden="true"><i className="c" style={{ width: share(s.prosumers.cn.n, s.prosumers.n) }} /><i className="d" /></div>
        <p className="cn-split-l"><span><b className="c" />{ct("cn_n", lang, { n: num(s.prosumers.cn.n, lang, 0) })}</span><span><b className="d" />{ct("fn_n", lang, { n: num(s.prosumers.fn.n, lang, 0) })}</span></p>
      </section>

      <section className="cn-area-sec">
        <h4>{ct("p_mix", lang)}</h4>
        {techs.length ? (
          <>
            <div className="cn-split" aria-hidden="true">{techs.map((t) => <i key={t} className={"d-" + t} style={{ width: share(s.plants[t].kw, s.plantsKw) }} />)}</div>
            <p className="cn-split-l">{techs.map((t) => <span key={t}><b className={"d-" + t} />{ct("tech_" + t, lang)} {power(s.plants[t].kw, lang)}</span>)}</p>
          </>
        ) : <p className="cn-area-none">{ct("p_no_plants", lang)}</p>}
        {s.bess && <p className="cn-area-bess"><BatteryCharging {...KI} />{ct("p_bess", lang, { kwh: energy(s.bess.kwh, lang), n: num(s.bess.n, lang, 0) })}</p>}
      </section>

      {near.length > 1 && (
        <section className="cn-area-sec">
          <h4>{ct("p_near", lang)}</h4>
          <ul className="cn-near">
            {near.map((r) => (
              <li key={r.id} className={r.id === s.id ? "on" : ""}>
                <button type="button" onClick={() => onSelect?.(r.id)} disabled={r.id === s.id}>{raionName(r.id, lang)}</button>
                <span className="cn-near-bar" aria-hidden="true"><i style={{ width: `${((r.perTenK ?? 0) / nearMax) * 100}%` }} /></span>
                <em>{num(r.perTenK, lang, 1)}</em>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
