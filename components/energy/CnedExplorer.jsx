"use client";
// components/energy/CnedExplorer.jsx — the CNED part of /energy that answers
// "where is the market?": the installer's own areas ("Your market"), the map
// of Moldova's raioane shaded by what is built and how fast prosumers grow,
// the picked area's figures, and every area in a sortable table (the map's
// text view). One component so the four share one selection: picking an area
// on the map, in the table or in "Your market" shows it everywhere.
//
// Data: the rows of lib/cnedStats.js raionStats(), handed over by the server
// page only while CNED_DATA is on; this file never imports the snapshot. The
// outlines (lib/data/mdRaionShapes.js) are public CC BY data. The installer's
// areas are kept in this browser (a convenience, not a record).
//
// Leaflet loads client-side only, as in components/portfolio/AssetMap.jsx,
// with the same quiet Esri grey tiles, light or dark with the app theme.
import "./cned.css";
import "leaflet/dist/leaflet.css";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { SHAPES } from "../../lib/data/mdRaionShapes.js";
import { TILES, TILE_ATTRIBUTION } from "../../lib/portfolioMap.js";
import { RAION, raionName } from "../../lib/mdRaions.js";
import { marketSummary } from "../../lib/cnedStats.js";
import { ct, OPERATOR_NAME } from "../../lib/cnedText.js";
import { num } from "../../lib/portfolioFormat.js";
import { Map as MapIcon, Plus, X, Users, TrendingUp, House, Gauge, ArrowDownUp } from "lucide-react";

const HI = { size: 18, strokeWidth: 1.9, "aria-hidden": true };
const KI = { size: 17, strokeWidth: 1.9, "aria-hidden": true };
const METRICS = ["plants", "prosumers", "per10k", "growth"];
const METRIC_KEY = { plants: "m_plants", prosumers: "m_prosumers", per10k: "m_per10k", growth: "m_growth" };
const TECHS = ["all", "pv", "wind", "hydro"];
const STORE = (co) => `vm_market_${co || "me"}`;
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

const kwU = (lang) => (lang === "ru" || lang === "uk" ? "кВт" : "kW");
const mwU = (lang) => (lang === "ru" || lang === "uk" ? "МВт" : "MW");
const kwhU = (lang) => ({ ru: "кВт·ч", uk: "кВт·год" }[lang] || "kWh");
const mwhU = (lang) => ({ ru: "МВт·ч", uk: "МВт·год" }[lang] || "MWh");
/** 2,500 kW reads as "2.5 MW"; under 1 MW stays in kW. */
export const power = (kw, lang) => (kw == null ? "" : Math.abs(kw) >= 1000 ? `${num(kw / 1000, lang, 1)} ${mwU(lang)}` : `${num(kw, lang, 0)} ${kwU(lang)}`);
const energy = (kwh, lang) => (kwh == null ? "" : kwh >= 1000 ? `${num(kwh / 1000, lang, 1)} ${mwhU(lang)}` : `${num(kwh, lang, 0)} ${kwhU(lang)}`);

const valueOf = (s, metric, tech) => {
  if (!s) return null;
  if (metric === "plants") return tech === "all" ? s.plantsKw : s.plants[tech]?.kw || 0;
  if (metric === "prosumers") return s.prosumers.kw;
  if (metric === "per10k") return s.perTenK;
  return s.growth12?.kw ?? null;
};
const fmtValue = (v, metric, lang) => (v == null ? "" : metric === "per10k" ? num(v, lang, 1) : power(v, lang));

/** Five shades by quintile of the non-zero values; 0 gets the palest, no data none. */
function classer(values) {
  const pos = values.filter((v) => v > 0).sort((a, b) => a - b);
  const cuts = [0.2, 0.4, 0.6, 0.8].map((p) => pos[Math.min(pos.length - 1, Math.floor(p * pos.length))]);
  return (v) => (v == null ? -1 : v <= 0 ? 0 : 1 + cuts.filter((c) => v > c).length);
}
const cssVar = (el, name) => getComputedStyle(el).getPropertyValue(name).trim();

export default function CnedExplorer({ lang = "en", stats = [], points = [], unlocatedKw = 0, companyId, sources }) {
  const byId = useMemo(() => Object.fromEntries(stats.map((s) => [s.id, s])), [stats]);
  const names = useMemo(() => [...stats].sort((a, b) => raionName(a.id, lang).localeCompare(raionName(b.id, lang), lang)), [stats, lang]);
  const national = useMemo(() => {
    const pop = stats.reduce((a, s) => a + (s.population || 0), 0);
    const n = stats.reduce((a, s) => a + s.prosumers.n, 0);
    return pop ? Math.round((n / pop) * 100000) / 10 : null;
  }, [stats]);

  const [metric, setMetric] = useState("per10k");
  const [tech, setTech] = useState("all");
  const [dots, setDots] = useState(false);
  const [mine, setMine] = useState([]);
  const [selected, setSelected] = useState(null);
  const [sort, setSort] = useState({ key: "per10k", dir: -1 });
  const [theme, setTheme] = useState(0);

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

  const current = selected || mine[0] || [...stats].sort((a, b) => b.prosumers.kw - a.prosumers.kw)[0]?.id || null;
  const sel = current ? byId[current] : null;
  const market = useMemo(() => marketSummary(stats, mine), [stats, mine]);

  // ---------------------------------------------------------------- the map
  const el = useRef(null);
  const st = useRef({ map: null, L: null, geo: null, dots: null, tiles: [] });
  // what the hover labels read, kept current after every render
  const view = useRef({});
  useEffect(() => { view.current = { metric, tech, dots, mine, current, byId, lang, theme }; });

  useEffect(() => {
    let cancelled = false, observer = null, sizer = null;
    const s = st.current;
    (async () => {
      const { default: L } = await import("leaflet");
      if (cancelled || !el.current) return;
      const map = L.map(el.current, { zoomControl: true, scrollWheelZoom: false, attributionControl: true, maxZoom: 11, minZoom: 6, zoomSnap: 0.25, zoomDelta: 0.5 });
      map.attributionControl.setPrefix(false);
      map.attributionControl.addAttribution("geoBoundaries (CC BY 3.0 IGO)");
      Object.assign(s, { map, L });
      const setTiles = () => {
        const dark = document.documentElement.getAttribute("data-theme") === "dark";
        const set = dark ? TILES.dark : TILES.light;
        s.tiles.forEach((l) => l.remove());
        s.tiles = [L.tileLayer(set.base, { maxZoom: 16, attribution: TILE_ATTRIBUTION }).addTo(map)];
        setTheme((t) => t + 1);
      };
      setTiles();
      observer = new MutationObserver(setTiles);
      observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
      s.geo = L.geoJSON(SHAPES, {
        onEachFeature: (f, layer) => {
          const id = f.properties.id;
          layer.bindTooltip(() => {
            const v = view.current, r = v.byId[id];
            const name = esc(raionName(id, v.lang));
            if (!r) return `<b>${name}</b><br>${esc(ct("no_data", v.lang))}`;
            return `<b>${name}</b><br>${esc(ct(METRIC_KEY[v.metric], v.lang))}: ${esc(fmtValue(valueOf(r, v.metric, v.tech), v.metric, v.lang))}`;
          }, { sticky: true, className: "cn-tip", direction: "top", offset: [0, -6] });
          layer.on("click", () => { if (view.current.byId[id]) setSelected(id); });
        },
      }).addTo(map);
      map.fitBounds(s.geo.getBounds(), { padding: [6, 6] });
      map.setMaxBounds(s.geo.getBounds().pad(0.35));
      if (typeof ResizeObserver !== "undefined") {
        let last = "";
        sizer = new ResizeObserver(([e]) => {
          const k = `${Math.round(e.contentRect.width)}x${Math.round(e.contentRect.height)}`;
          if (k === last || !e.contentRect.width) return;
          last = k; map.invalidateSize(); map.fitBounds(s.geo.getBounds(), { padding: [6, 6] });
        });
        sizer.observe(el.current);
      }
      setTheme((t) => t + 1);
    })();
    return () => {
      cancelled = true; observer?.disconnect(); sizer?.disconnect(); s.map?.remove();
      Object.assign(s, { map: null, L: null, geo: null, dots: null, tiles: [] });
    };
  }, []);

  // shade the areas and draw the plants whenever what is shown changes
  useEffect(() => {
    const s = st.current;
    if (!s.map || !s.geo || !el.current) return;
    const c = (n) => cssVar(el.current, n);
    const shades = [0, 1, 2, 3, 4, 5].map((i) => c(`--cn-c${i}`));
    const vals = stats.map((r) => valueOf(r, metric, tech));
    const cls = classer(vals);
    const mineSet = new Set(mine);
    s.geo.eachLayer((layer) => {
      const id = layer.feature.properties.id, r = byId[id];
      const k = r ? cls(valueOf(r, metric, tech)) : -1;
      const isSel = id === current, isMine = mineSet.has(id);
      layer.setStyle({
        fillColor: k < 0 ? c("--cn-nd") : shades[k], fillOpacity: k < 0 ? 0.55 : 0.82,
        color: isSel ? c("--cn-sel") : isMine ? c("--cn-mine") : c("--cn-edge"),
        weight: isSel ? 2.6 : isMine ? 2 : 0.8, dashArray: isMine && !isSel ? "5 4" : null,
      });
      if (isSel) layer.bringToFront();
    });
    s.dots?.remove(); s.dots = null;
    if (dots) {
      const L = s.L, colour = { pv: c("--cn-pv"), wind: c("--cn-wind"), hydro: c("--cn-hydro") };
      const ring = c("--cn-ring");
      s.dots = L.layerGroup(points.filter((p) => tech === "all" || p[2] === tech).map(([lat, lon, t, kw, n]) =>
        L.circleMarker([lat, lon], { radius: Math.min(16, 3 + Math.sqrt(kw / 1000) * 1.6), color: ring, weight: 1, fillColor: colour[t], fillOpacity: 0.92 })
          .bindTooltip(esc(ct("plant_tip", lang, { t: ct("tech_" + t, lang), kw: power(kw, lang), n }))),
      )).addTo(s.map);
    }
  }, [metric, tech, dots, mine, current, byId, stats, points, lang, theme]);

  // ---------------------------------------------------------------- the table
  const rows = useMemo(() => {
    const get = {
      name: (s) => raionName(s.id, lang), plants: (s) => s.plantsKw, pros_n: (s) => s.prosumers.n, pros_kw: (s) => s.prosumers.kw,
      per10k: (s) => s.perTenK ?? -1, growth: (s) => s.growth12?.kw ?? -1,
    }[sort.key];
    return [...stats].sort((a, b) => {
      const x = get(a), y = get(b);
      return (typeof x === "string" ? x.localeCompare(y, lang) : x - y) * sort.dir;
    });
  }, [stats, sort, lang]);
  const sortBtn = (key, label, right = false) => (
    <th className={right ? "r" : ""} aria-sort={sort.key === key ? (sort.dir > 0 ? "ascending" : "descending") : "none"}>
      <button type="button" className="cn-sort" onClick={() => setSort((p) => ({ key, dir: p.key === key ? -p.dir : key === "name" ? 1 : -1 }))} title={ct("sort_by", lang, { c: label })}>
        {label}{sort.key === key && <ArrowDownUp size={12} aria-hidden="true" />}
      </button>
    </th>
  );

  const legendVals = stats.map((r) => valueOf(r, metric, tech)).filter((v) => v != null);
  const lo = legendVals.length ? Math.min(...legendVals) : 0, hi = legendVals.length ? Math.max(...legendVals) : 0;
  const trendMax = sel ? Math.max(...sel.monthly.map((m) => m[1]), 1) : 1;

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
              <button type="button" className="cn-chip-n" onClick={() => setSelected(id)}>{raionName(id, lang)}</button>
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
          <p className="en-note">{ct("mk_empty", lang)}</p>
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
                      <button type="button" onClick={() => setSelected(s.id)}>{raionName(s.id, lang)}</button>
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
                        <button type="button" onClick={() => setSelected(s.id)}>{raionName(s.id, lang)}</button>
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
      <section className="dx-card" aria-labelledby="cn-map-h" id="cned-map">
        <header className="dx-card-head"><div><h2 id="cn-map-h"><MapIcon {...HI} />{ct("map_h", lang)}</h2><p>{ct("map_s", lang)}</p></div></header>
        <div className="cn-controls">
          <div className="seg2 cn-seg" role="group" aria-label={ct("metric_l", lang)}>
            {METRICS.map((m) => <button key={m} type="button" className={metric === m ? "on" : ""} aria-pressed={metric === m} onClick={() => setMetric(m)}>{ct(METRIC_KEY[m], lang)}</button>)}
          </div>
          <div className="cn-row">
            {(metric === "plants" || dots) && (
              <div className="seg2 cn-seg sm" role="group" aria-label={ct("tech_l", lang)}>
                {TECHS.map((t) => <button key={t} type="button" className={tech === t ? "on" : ""} aria-pressed={tech === t} onClick={() => setTech(t)}>{ct("tech_" + t, lang)}</button>)}
              </div>
            )}
            <label className="cn-check"><input id="cn-dots" type="checkbox" checked={dots} onChange={(e) => setDots(e.target.checked)} />{ct("dots", lang)}</label>
          </div>
        </div>
        <div className="cn-grid">
          <div>
            <div ref={el} className="cn-map" role="region" aria-label={ct("map_aria", lang)} />
            <div className="cn-legend" aria-hidden="true">
              <span>{ct("less", lang)} {fmtValue(lo, metric, lang)}</span>
              {[0, 1, 2, 3, 4, 5].map((i) => <i key={i} className={"c" + i} />)}
              <span>{fmtValue(hi, metric, lang)} {ct("more", lang)}</span>
              <i className="nd" /><span>{ct("no_data", lang)}</span>
              {dots && <>{["pv", "wind", "hydro"].map((t) => <span key={t} className="cn-dot-l"><b className={"d-" + t} />{ct("tech_" + t, lang)}</span>)}</>}
            </div>
            {dots && <p className="en-note">{ct("dots_note", lang, { x: power(unlocatedKw, lang) })}</p>}
          </div>

          <aside className="cn-panel" aria-live="polite">
            <label className="cn-pick" htmlFor="cn-pick">{ct("p_select", lang)}</label>
            <select id="cn-pick" className="input" value={current || ""} onChange={(e) => setSelected(e.target.value)}>
              {names.map((s) => <option key={s.id} value={s.id}>{raionName(s.id, lang)}</option>)}
            </select>
            {sel && (
              <>
                <h3 className="cn-p-name">{raionName(sel.id, lang)}</h3>
                <p className="cn-p-meta">
                  {sel.population ? ct("p_pop", lang, { n: num(sel.population, lang, 0) }) : ""}
                  {sel.operator ? `, ${ct("p_operator", lang, { op: OPERATOR_NAME[sel.operator] })}` : ""}
                </p>
                <dl className="cn-facts">
                  <div><dt>{ct("p_plants", lang)}</dt><dd>{ct("p_plants_v", lang, { kw: power(sel.plantsKw, lang), n: num(sel.plantsN, lang, 0) })}{sel.plantsN > 0 && <small>{["pv", "wind", "hydro"].filter((t) => sel.plants[t].kw > 0).map((t, i) => { const l = ct("tech_" + t, lang); return `${i && l !== l.toUpperCase() ? l.toLowerCase() : l} ${power(sel.plants[t].kw, lang)}`; }).join(", ")}</small>}</dd></div>
                  <div><dt>{ct("p_prosumers", lang)}</dt><dd>{ct("p_prosumers_v", lang, { n: num(sel.prosumers.n, lang, 0), kw: power(sel.prosumers.kw, lang) })}</dd></div>
                  <div><dt>{ct("p_per10k", lang)}</dt><dd>{num(sel.perTenK, lang, 1)}<small>{ct("p_rank", lang, { r: sel.rank?.perTenK ?? "", t: stats.length })}</small></dd></div>
                  {sel.growth12 && <div><dt>{ct("p_growth", lang)}</dt><dd>{ct("p_growth_v", lang, { n: num(sel.growth12.n, lang, 0), kw: power(sel.growth12.kw, lang) })}</dd></div>}
                </dl>
                <p className="cn-split-h">{ct("p_who", lang)}</p>
                <div className="cn-split" aria-hidden="true"><i className="a" style={{ width: `${(sel.prosumers.pf.n / Math.max(1, sel.prosumers.n)) * 100}%` }} /><i className="b" /></div>
                <p className="cn-split-l"><span><b className="a" />{ct("households_n", lang, { n: num(sel.prosumers.pf.n, lang, 0) })}</span><span><b className="b" />{ct("companies_n", lang, { n: num(sel.prosumers.pj.n, lang, 0) })}</span></p>
                <p className="cn-split-h">{ct("p_scheme", lang)}</p>
                <div className="cn-split" aria-hidden="true"><i className="c" style={{ width: `${(sel.prosumers.cn.n / Math.max(1, sel.prosumers.n)) * 100}%` }} /><i className="d" /></div>
                <p className="cn-split-l"><span><b className="c" />{ct("cn_n", lang, { n: num(sel.prosumers.cn.n, lang, 0) })}</span><span><b className="d" />{ct("fn_n", lang, { n: num(sel.prosumers.fn.n, lang, 0) })}</span></p>
                {sel.monthly.length > 1 && (
                  <>
                    <p className="cn-split-h">{ct("p_trend", lang)}</p>
                    <svg className="cn-trend" viewBox={`0 0 ${sel.monthly.length * 10} 60`} preserveAspectRatio="none" role="img"
                      aria-label={`${ct("p_trend", lang)}: ${power(sel.monthly[0][1], lang)}, ${power(sel.monthly.at(-1)[1], lang)}`}>
                      {sel.monthly.map((m, i) => { const h = Math.max(1, (m[1] / trendMax) * 58); return <rect key={m[0]} x={i * 10 + 1.5} y={60 - h} width="7" height={h} rx="1.5" />; })}
                    </svg>
                    <p className="cn-trend-l"><span>{sel.monthly[0][0]}</span><span>{sel.monthly.at(-1)[0]}</span></p>
                  </>
                )}
                {sel.bess && <p className="en-note">{ct("p_bess", lang, { kwh: energy(sel.bess.kwh, lang), n: num(sel.bess.n, lang, 0) })}</p>}
                {!mine.includes(sel.id) && <button type="button" className="btn ghost sm cn-p-add" onClick={() => addArea(sel.id)}><Plus size={14} aria-hidden="true" />{ct("mk_add", lang)}</button>}
              </>
            )}
          </aside>
        </div>
        <p className="en-note">{sources}</p>
      </section>

      {/* ---- every area */}
      <section className="dx-card" aria-labelledby="cn-t-h">
        <header className="dx-card-head"><div><h2 id="cn-t-h">{ct("t_h", lang)}</h2></div></header>
        <div className="en-table-wrap cn-table-wrap">
          <table className="en-table cn-table">
            <thead><tr>
              {sortBtn("name", ct("col_raion", lang))}
              {sortBtn("plants", ct("col_plants", lang), true)}
              {sortBtn("pros_n", ct("col_pros_n", lang), true)}
              {sortBtn("pros_kw", ct("col_pros_kw", lang), true)}
              {sortBtn("per10k", ct("col_per10k", lang), true)}
              {sortBtn("growth", ct("col_growth", lang), true)}
            </tr></thead>
            <tbody>
              {rows.map((s) => (
                <tr key={s.id} className={s.id === current ? "on" : ""}>
                  <td><button type="button" className="cn-rowbtn" onClick={() => { setSelected(s.id); document.getElementById("cned-map")?.scrollIntoView({ behavior: "smooth", block: "start" }); }}>{raionName(s.id, lang)}</button></td>
                  <td className="r">{num(s.plantsKw, lang, 0)}</td>
                  <td className="r">{num(s.prosumers.n, lang, 0)}</td>
                  <td className="r">{num(s.prosumers.kw, lang, 0)}</td>
                  <td className="r">{num(s.perTenK, lang, 1)}</td>
                  <td className="r">{s.growth12 ? `+${num(s.growth12.kw, lang, 0)}` : ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="en-note">{sources}</p>
      </section>
    </div>
  );
}
