"use client";
// components/energy/CnedExplorer.jsx — the CNED part of /energy that answers
// "where is the market?": the installer's own areas ("Your market"), the map
// of Moldova's raioane (CnedMap.jsx) with the picked area's profile beside it
// (CnedArea.jsx), where the market is growing (CnedQuadrant.jsx), and every
// area in a table that can be searched and sorted (the map's text view). One
// component so they share one selection: picking an area anywhere shows it
// everywhere.
//
// Data: the rows of lib/cnedStats.js raionStats(), handed over by the server
// page only while CNED_DATA is on; this file never imports the snapshot. The
// outlines (lib/data/mdRaionShapes.js) are public CC BY data. The installer's
// areas are kept in this browser (a convenience, not a record).
import "./cned.css";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { RAION, raionName } from "../../lib/mdRaions.js";
import { marketSummary, nationalPerTenK } from "../../lib/cnedStats.js";
import { ct } from "../../lib/cnedText.js";
import { num } from "../../lib/portfolioFormat.js";
import CnedMap, { power } from "./CnedMap.jsx";
import CnedArea from "./CnedArea.jsx";
import CnedQuadrant from "./CnedQuadrant.jsx";
import { Map as MapIcon, Plus, X, Users, TrendingUp, House, Gauge, ArrowDownUp, Search, Compass, Star, Table2, Eye } from "lucide-react";

const HI = { size: 18, strokeWidth: 1.9, "aria-hidden": true };
const KI = { size: 17, strokeWidth: 1.9, "aria-hidden": true };
const STORE = (co) => `vm_market_${co || "me"}`;
const fold = (x) => String(x || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

/** A row's prosumer capacity over the snapshot's months, as a small line. */
function Spark({ monthly }) {
  if (!monthly?.length) return null;
  const v = monthly.map((m) => m[1]);
  const max = Math.max(...v, 1), min = Math.min(...v);
  const d = v.map((y, i) => `${i ? "L" : "M"}${((i / (v.length - 1)) * 76 + 2).toFixed(1)},${(20 - ((y - min) / Math.max(1, max - min)) * 16).toFixed(1)}`).join("");
  return <svg className="cn-spark" viewBox="0 0 80 22" aria-hidden="true"><path d={d} /></svg>;
}

export default function CnedExplorer({ lang = "en", stats = [], points = [], unlocatedKw = 0, companyId, sources, dateLabel = "" }) {
  const byId = useMemo(() => Object.fromEntries(stats.map((s) => [s.id, s])), [stats]);
  const names = useMemo(() => [...stats].sort((a, b) => raionName(a.id, lang).localeCompare(raionName(b.id, lang), lang)), [stats, lang]);
  const national = useMemo(() => nationalPerTenK(stats), [stats]);

  const [mine, setMine] = useState([]);
  const [selected, setSelected] = useState(null);
  const [sort, setSort] = useState({ key: "per10k", dir: -1 });
  const [query, setQuery] = useState("");

  // the installer's areas, kept in this browser
  useEffect(() => {
    try {
      const v = JSON.parse(localStorage.getItem(STORE(companyId)) || "[]");
      if (Array.isArray(v)) setMine(v.filter((id) => RAION[id]?.covered));
    } catch { /* private window: start empty */ }
  }, [companyId]);
  const saveMine = (next) => {
    setMine(next);
    try { localStorage.setItem(STORE(companyId), JSON.stringify(next)); } catch { /* not kept */ }
  };
  const addArea = (id) => { if (id && !mine.includes(id)) saveMine([...mine, id]); setSelected(id); };
  const removeArea = (id) => saveMine(mine.filter((x) => x !== id));
  const toggleArea = (id) => (mine.includes(id) ? removeArea(id) : addArea(id));

  const current = selected || mine[0] || [...stats].sort((a, b) => b.prosumers.kw - a.prosumers.kw)[0]?.id || null;
  const sel = current ? byId[current] : null;
  const market = useMemo(() => marketSummary(stats, mine), [stats, mine]);
  // with no areas chosen yet: the fastest growing, to start from
  const starters = useMemo(() => [...stats].sort((a, b) => (b.growth12?.kw || 0) - (a.growth12?.kw || 0)).slice(0, 5), [stats]);
  const toMap = () => document.getElementById("cned-map")?.scrollIntoView({ behavior: "smooth", block: "start" });

  // ---------------------------------------------------------------- the table
  const rows = useMemo(() => {
    const get = {
      name: (s) => raionName(s.id, lang), plants: (s) => s.plantsKw, pros_n: (s) => s.prosumers.n, pros_kw: (s) => s.prosumers.kw,
      per10k: (s) => s.perTenK ?? -1, growth: (s) => s.growth12?.kw ?? -1,
    }[sort.key];
    const q = fold(query.trim());
    return [...stats].filter((s) => !q || fold(raionName(s.id, lang)).includes(q) || fold(s.id).includes(q)).sort((a, b) => {
      const x = get(a), y = get(b);
      return (typeof x === "string" ? x.localeCompare(y, lang) : x - y) * sort.dir;
    });
  }, [stats, sort, lang, query]);
  const maxPer10k = Math.max(1, ...stats.map((s) => s.perTenK ?? 0));
  const maxGrowth = Math.max(1, ...stats.map((s) => s.growth12?.kw ?? 0));
  const sortBtn = (key, label, right = false) => (
    <th className={right ? "r" : ""} aria-sort={sort.key === key ? (sort.dir > 0 ? "ascending" : "descending") : "none"}>
      <button type="button" className={"cn-sort" + (sort.key === key ? " on" : "")} onClick={() => setSort((p) => ({ key, dir: p.key === key ? -p.dir : key === "name" ? 1 : -1 }))} title={ct("sort_by", lang, { c: label })}>
        {label}<ArrowDownUp size={12} aria-hidden="true" />
      </button>
    </th>
  );

  return (
    <div className="cn">
      {/* ---- your market */}
      <section className="dx-card" aria-labelledby="cn-mk-h">
        <header className="dx-card-head">
          <div><h2 id="cn-mk-h"><Gauge {...HI} />{ct("mk_h", lang)}</h2><p>{ct("mk_s", lang)}</p></div>
          <Link className="dx-link" href="/leads">{ct("mk_leads", lang)}</Link>
        </header>
        <div className="cn-mine">
          {mine.map((id) => (
            <span key={id} className={"cn-chip" + (id === current ? " on" : "")}>
              <button type="button" className="cn-chip-n" onClick={() => { setSelected(id); toMap(); }}>{raionName(id, lang)}</button>
              <button type="button" className="cn-chip-x" onClick={() => removeArea(id)} aria-label={ct("mk_remove", lang, { x: raionName(id, lang) })}><X size={14} aria-hidden="true" /></button>
            </span>
          ))}
          <label className="cn-add">
            <Plus size={15} aria-hidden="true" />
            <span className="sr-only">{ct("mk_add", lang)}</span>
            <select id="cn-add" value="" onChange={(e) => addArea(e.target.value)}>
              <option value="">{ct("mk_add", lang)}</option>
              {names.filter((s) => !mine.includes(s.id)).map((s) => <option key={s.id} value={s.id}>{raionName(s.id, lang)}</option>)}
            </select>
          </label>
          {mine.length > 0 && <small className="cn-kept">{ct("mk_kept", lang)}</small>}
        </div>
        {!market ? (
          <div className="cn-empty">
            <span className="cn-empty-i"><Compass size={20} strokeWidth={1.9} aria-hidden="true" /></span>
            <div>
              <p>{ct("mk_empty", lang)}</p>
              <p className="cn-empty-s">{ct("mk_start", lang)}</p>
              <div className="cn-starters">
                {starters.map((s) => (
                  <button key={s.id} type="button" className="cn-starter" onClick={() => addArea(s.id)}>
                    <Plus size={13} strokeWidth={2.2} aria-hidden="true" />{raionName(s.id, lang)}<small>+{power(s.growth12?.kw ?? 0, lang)}</small>
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <>
            <div className="cn-kpis">
              <div className="en-kpi"><span className="en-kpi-l"><i className="en-ico"><Users {...KI} /></i>{ct("mk_k_pros", lang)}</span><b>{num(market.n, lang, 0)}</b><small>{ct("mk_k_pros_s", lang, { kw: power(market.kw, lang) })}</small></div>
              <div className="en-kpi"><span className="en-kpi-l"><i className="en-ico"><TrendingUp {...KI} /></i>{ct("mk_k_new", lang)}</span><b>+{num(market.growth12.n, lang, 0)}</b><small>{ct("mk_k_new_s", lang, { kw: power(market.growth12.kw, lang), p: market.growth12.pctKw == null ? "" : `${num(market.growth12.pctKw, lang, 0)}%` })}</small></div>
              <div className="en-kpi"><span className="en-kpi-l"><i className="en-ico"><Gauge {...KI} /></i>{ct("mk_k_per10k", lang)}</span><b>{num(market.perTenK, lang, 1)}</b><small>{ct("mk_k_per10k_s", lang, { x: num(national, lang, 1) })}</small></div>
              <div className="en-kpi"><span className="en-kpi-l"><i className="en-ico"><House {...KI} /></i>{ct("mk_k_house", lang)}</span><b>{num(market.households, lang, 0)}</b><small>{ct("mk_k_house_s", lang, { p: `${num((market.households / Math.max(1, market.n)) * 100, lang, 0)}%`, c: num(market.companies, lang, 0) })}</small></div>
            </div>
            <div className="en-two in cn-mk-lists">
              <div>
                <h3>{ct("mk_rows_h", lang)}</h3>
                <ul className="cn-rank">
                  {market.rows.map((s) => (
                    <li key={s.id}>
                      <button type="button" onClick={() => { setSelected(s.id); toMap(); }}>{raionName(s.id, lang)}</button>
                      <span>{ct("p_growth_v", lang, { n: num(s.growth12?.n ?? 0, lang, 0), kw: power(s.growth12?.kw ?? 0, lang) })}</span>
                      <em>{num(s.perTenK, lang, 1)}<small>{ct("col_per10k", lang)}</small></em>
                    </li>
                  ))}
                </ul>
              </div>
              {market.nearby.length > 0 && (
                <div>
                  <h3>{ct("mk_near_h", lang)}</h3>
                  <ul className="cn-rank">
                    {market.nearby.map((s) => (
                      <li key={s.id}>
                        <button type="button" onClick={() => { setSelected(s.id); toMap(); }}>{raionName(s.id, lang)}</button>
                        <span>{ct("p_growth_v", lang, { n: num(s.growth12?.n ?? 0, lang, 0), kw: power(s.growth12?.kw ?? 0, lang) })}</span>
                        <button type="button" className="btn ghost sm" onClick={() => addArea(s.id)} aria-label={ct("mk_near_add", lang, { x: raionName(s.id, lang) })}><Plus size={14} aria-hidden="true" /></button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </>
        )}
      </section>

      {/* ---- the map and the picked area */}
      <section className="dx-card cn-mapcard" aria-labelledby="cn-map-h" id="cned-map">
        <header className="dx-card-head">
          <div><h2 id="cn-map-h"><MapIcon {...HI} />{ct("map_h", lang)}</h2><p>{ct("map_s2", lang)}</p></div>
          <div className="cn-badges">
            <span className="cn-badge local"><Eye size={13} strokeWidth={2.2} aria-hidden="true" />{ct("preview_badge", lang)}</span>
            {dateLabel && <span className="cn-badge">{ct("data_date", lang, { date: dateLabel })}</span>}
          </div>
        </header>
        <div className="cn-grid">
          <CnedMap lang={lang} stats={stats} byId={byId} points={points} unlocatedKw={unlocatedKw} current={current} mine={mine} onSelect={setSelected} dateLabel={dateLabel} />
          <aside className="cn-panel" aria-live="polite">
            <label className="cn-pick" htmlFor="cn-pick">
              <span>{ct("p_select", lang)}</span>
              <select id="cn-pick" value={current || ""} onChange={(e) => setSelected(e.target.value)}>
                {names.map((s) => <option key={s.id} value={s.id}>{raionName(s.id, lang)}</option>)}
              </select>
            </label>
            <CnedArea lang={lang} s={sel} stats={stats} byId={byId} national={national} inMarket={!!sel && mine.includes(sel.id)} onToggleMarket={toggleArea} onSelect={setSelected} />
          </aside>
        </div>
        <p className="en-note">{sources}</p>
      </section>

      {/* ---- where the market is growing */}
      <section className="dx-card" aria-labelledby="cn-q-h">
        <header className="dx-card-head"><div><h2 id="cn-q-h"><Compass {...HI} />{ct("q4_h", lang)}</h2><p>{ct("q4_s", lang)}</p></div></header>
        <CnedQuadrant lang={lang} stats={stats} byId={byId} current={current} mine={mine} onSelect={setSelected} onToggleMarket={toggleArea} />
      </section>

      {/* ---- every area */}
      <section className="dx-card" aria-labelledby="cn-t-h">
        <header className="dx-card-head">
          <div><h2 id="cn-t-h"><Table2 {...HI} />{ct("t_h", lang)}</h2></div>
          <label className="cn-search">
            <Search size={15} strokeWidth={2} aria-hidden="true" />
            <span className="sr-only">{ct("t_search", lang)}</span>
            <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder={ct("t_search", lang)} />
          </label>
        </header>
        <div className="en-table-wrap cn-table-wrap">
          <table className="en-table cn-table">
            <thead><tr>
              {sortBtn("name", ct("col_raion", lang))}
              {sortBtn("plants", ct("col_plants", lang), true)}
              {sortBtn("pros_n", ct("col_pros_n", lang), true)}
              {sortBtn("pros_kw", ct("col_pros_kw", lang), true)}
              {sortBtn("per10k", ct("col_per10k", lang), true)}
              {sortBtn("growth", ct("col_growth", lang), true)}
              <th className="r cn-th-spark">{ct("col_trend", lang)}</th>
            </tr></thead>
            <tbody>
              {rows.map((s) => (
                <tr key={s.id} className={s.id === current ? "on" : ""}>
                  <td>
                    <button type="button" className="cn-rowbtn" onClick={() => { setSelected(s.id); toMap(); }}>
                      {raionName(s.id, lang)}{mine.includes(s.id) && <Star size={12} strokeWidth={2} fill="currentColor" className="cn-row-star" aria-label={ct("p_in_market", lang)} />}
                    </button>
                  </td>
                  <td className="r">{num(s.plantsKw, lang, 0)}</td>
                  <td className="r">{num(s.prosumers.n, lang, 0)}</td>
                  <td className="r">{num(s.prosumers.kw, lang, 0)}</td>
                  <td className="r cn-barcell"><span>{num(s.perTenK, lang, 1)}</span><i style={{ width: `${((s.perTenK ?? 0) / maxPer10k) * 100}%` }} aria-hidden="true" /></td>
                  <td className="r cn-barcell g"><span>{s.growth12 ? `+${num(s.growth12.kw, lang, 0)}` : ""}</span><i style={{ width: `${((s.growth12?.kw ?? 0) / maxGrowth) * 100}%` }} aria-hidden="true" /></td>
                  <td className="r cn-td-spark"><Spark monthly={s.monthly} /></td>
                </tr>
              ))}
              {!rows.length && <tr><td colSpan={7} className="cn-t-none">{ct("t_none", lang)}</td></tr>}
            </tbody>
          </table>
        </div>
        <p className="en-note">{sources}</p>
      </section>
    </div>
  );
}
