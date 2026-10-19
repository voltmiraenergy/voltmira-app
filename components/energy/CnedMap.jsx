"use client";
// components/energy/CnedMap.jsx — the map in CnedExplorer: Moldova's raioane
// coloured by what is built or how fast prosumers grow, at any moment CNED's
// series keep (plants by year since 2018, prosumers by month over the last 25
// months), with a play button that steps through them. The value sits on each
// area, hovering one shows its figure and rank, clicking one opens its
// profile beside the map. Plants can be drawn as circles by technology.
//
// The colours keep today's five classes (quintiles) at every moment, so an
// area that darkens over time really grew. Plant circles are today's plants:
// the snapshot has no year for a position, so they show at the last moment
// only.
//
// Data comes as props (lib/cnedStats.js raionStats() rows, the plant points),
// only while CNED_DATA is on; this file never imports the snapshot. Leaflet
// loads client-side only, on the same quiet Esri grey tiles as the other maps.
import "leaflet/dist/leaflet.css";
import { useEffect, useMemo, useRef, useState } from "react";
import { SHAPES, CENTRES } from "../../lib/data/mdRaionShapes.js";
import { TILES, TILE_ATTRIBUTION } from "../../lib/portfolioMap.js";
import { raionName } from "../../lib/mdRaions.js";
import { MAP_METRICS, timeline, valueAt, quintileCuts, classOf } from "../../lib/cnedStats.js";
import { ct } from "../../lib/cnedText.js";
import { num } from "../../lib/portfolioFormat.js";
import { LOCALE } from "../../lib/relTime.js";
import { Zap, Users, Gauge, TrendingUp, Plus, Minus, Maximize2, Minimize2, LocateFixed, Play, Pause, Tag, CircleDot } from "lucide-react";

const METRIC_KEY = { plants: "m_plants", prosumers: "m_prosumers", per10k: "m_per10k", growth: "m_growth" };
const METRIC_SHORT = { plants: "ms_plants", prosumers: "ms_prosumers", per10k: "ms_per10k", growth: "ms_growth" };
const LEGEND_KEY = { plants: "lg_plants", prosumers: "lg_prosumers", per10k: "m_per10k", growth: "lg_growth" };
const METRIC_ICON = { plants: Zap, prosumers: Users, per10k: Gauge, growth: TrendingUp };
const TECHS = ["all", "pv", "wind", "hydro"];
const PLANT_TECHS = ["pv", "wind", "hydro"];
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const cssVar = (el, name) => getComputedStyle(el).getPropertyValue(name).trim();

const kwU = (lang) => (lang === "ru" || lang === "uk" ? "кВт" : "kW");
const mwU = (lang) => (lang === "ru" || lang === "uk" ? "МВт" : "MW");
/** 2,500 kW reads as "2.5 MW"; under 1 MW stays in kW. */
export const power = (kw, lang) => (kw == null ? "" : Math.abs(kw) >= 1000 ? `${num(kw / 1000, lang, 1)} ${mwU(lang)}` : `${num(kw, lang, 0)} ${kwU(lang)}`);
/** The figure printed on an area: short, whole megawatts from 10 MW up. */
const shortPower = (kw, lang) => (Math.abs(kw) >= 10000 ? `${num(kw / 1000, lang, 0)} ${mwU(lang)}` : power(kw, lang));
export const fmtValue = (v, metric, lang, short = false) => {
  if (v == null) return "";
  if (metric === "per10k") return num(v, lang, 1);
  const p = short ? shortPower(v, lang) : power(v, lang);
  return metric === "growth" && v > 0 ? `+${p}` : p;
};

/** The legend's numbers in one unit, the unit once at the end: MW when the largest is 10 MW or more. */
function legendFmt(metric, max, lang) {
  if (metric === "per10k") return (v) => num(v, lang, 1);
  const mw = max >= 10000;
  return (v, last = false) => {
    const x = mw ? num(v / 1000, lang, v < 10000 ? 1 : 0) : num(v, lang, 0);
    return last ? `${x} ${mw ? mwU(lang) : kwU(lang)}` : x;
  };
}

/** "aug. 2026" for a month, "end of 2021" for a year, the data date for the last year. */
function momentLabel(kind, key, last, lang, dateLabel) {
  if (!key) return "";
  if (kind === "year") return last ? ct("tl_to", lang, { date: dateLabel }) : ct("tl_year", lang, { y: key });
  return new Date(`${key}-15T12:00:00Z`).toLocaleDateString(LOCALE[lang] || "en-GB", { month: "short", year: "numeric", timeZone: "UTC" });
}

export default function CnedMap({ lang = "en", stats = [], byId = {}, points = [], unlocatedKw = 0, current, mine = [], onSelect, dateLabel = "" }) {
  const [metric, setMetric] = useState("per10k");
  const [tech, setTech] = useState("all");
  const [showPlants, setShowPlants] = useState(false);
  const [labels, setLabels] = useState(true);
  const [frame, setFrame] = useState(null); // null: the last moment
  const [playing, setPlaying] = useState(false);
  const [full, setFull] = useState(false);
  const [theme, setTheme] = useState(0);

  // ---------------------------------------------------------------- the moment shown
  const tl = useMemo(() => timeline(stats, metric), [stats, metric]);
  const lastIdx = tl.keys.length - 1;
  const idx = frame == null ? lastIdx : Math.min(frame, lastIdx);
  const key = tl.keys[idx] ?? null;
  const atLast = idx === lastIdx;
  const moment = momentLabel(tl.kind, key, atLast, lang, dateLabel);
  const pickMetric = (m) => { setMetric(m); setFrame(null); setPlaying(false); };

  useEffect(() => {
    if (!playing) return undefined;
    const t = setInterval(() => setFrame((i) => Math.min((i ?? lastIdx) + 1, lastIdx)), tl.kind === "year" ? 850 : 420);
    return () => clearInterval(t);
  }, [playing, lastIdx, tl.kind]);
  // stop at the last moment
  if (playing && atLast && frame != null) { setPlaying(false); setFrame(null); }
  const play = () => {
    if (playing) { setPlaying(false); return; }
    if (atLast) setFrame(0);
    setPlaying(true);
  };

  const values = useMemo(() => Object.fromEntries(stats.map((s) => [s.id, valueAt(s, metric, tech, key)])), [stats, metric, tech, key]);
  // today's classes at every moment, so a darker area really grew
  const cuts = useMemo(() => quintileCuts(stats.map((s) => valueAt(s, metric, tech))), [stats, metric, tech]);
  const ranks = useMemo(() => {
    const order = stats.filter((s) => values[s.id] != null).sort((a, b) => values[b.id] - values[a.id]);
    return Object.fromEntries(order.map((s, i) => [s.id, i + 1]));
  }, [stats, values]);
  const legendMax = useMemo(() => Math.max(0, ...stats.map((s) => valueAt(s, metric, tech) ?? 0)), [stats, metric, tech]);

  // ---------------------------------------------------------------- the map
  const wrap = useRef(null);
  const el = useRef(null);
  const st = useRef({ map: null, L: null, geo: null, dots: null, labels: null, tiles: [], styleFor: null });
  // what the hover cards read, current after every render
  const view = useRef({});
  useEffect(() => { view.current = { metric, values, ranks, moment, byId, lang, total: stats.length, onSelect }; });

  const legendEl = useRef(null);
  const fit = () => {
    const s = st.current;
    if (!s.map || !s.geo) return;
    // on a phone the legend spans the top, so the country starts below it
    const narrow = el.current?.clientWidth < 560;
    const top = narrow ? (legendEl.current?.offsetHeight || 60) + 20 : 18;
    s.map.fitBounds(s.geo.getBounds(), { paddingTopLeft: [narrow ? 8 : 24, top], paddingBottomRight: [narrow ? 8 : 24, narrow ? 84 : 86] });
  };

  useEffect(() => {
    let cancelled = false, observer = null, sizer = null;
    const s = st.current;
    (async () => {
      const { default: L } = await import("leaflet");
      if (cancelled || !el.current) return;
      // a phone has no room for 35 figures: they start off there
      if (el.current.clientWidth < 560) setLabels(false);
      const map = L.map(el.current, { zoomControl: false, scrollWheelZoom: false, attributionControl: true, maxZoom: 11, minZoom: 6, zoomSnap: 0.25, zoomDelta: 0.5 });
      map.attributionControl.setPrefix(false);
      map.attributionControl.addAttribution("geoBoundaries (CC BY 3.0 IGO)");
      map.createPane("cnLabels").style.zIndex = 450;
      map.getPane("cnLabels").style.pointerEvents = "none";
      Object.assign(s, { map, L });
      const setTiles = () => {
        const dark = document.documentElement.getAttribute("data-theme") === "dark";
        const set = dark ? TILES.dark : TILES.light;
        s.tiles.forEach((l) => l.remove());
        s.tiles = [L.tileLayer(set.base, { maxZoom: 16, attribution: TILE_ATTRIBUTION, className: "cn-basemap" }).addTo(map)];
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
            if (!r) return `<div class="cn-tt"><b>${name}</b><span class="cn-tt-m">${esc(ct("no_data", v.lang))}</span></div>`;
            const val = v.values[id];
            return `<div class="cn-tt"><b>${name}</b>`
              + `<span class="cn-tt-v">${esc(val == null ? "" : fmtValue(val, v.metric, v.lang))}</span>`
              + `<span class="cn-tt-m">${esc(ct(METRIC_KEY[v.metric], v.lang))}, ${esc(v.moment)}</span>`
              + (v.ranks[id] ? `<span class="cn-tt-r">${esc(ct("p_rank", v.lang, { r: v.ranks[id], t: v.total }))}</span>` : "")
              + `<span class="cn-tt-c">${esc(ct("tip_click", v.lang))}</span></div>`;
          }, { sticky: true, className: "cn-tip", direction: "top", offset: [0, -10], opacity: 1 });
          layer.on("click", () => { if (view.current.byId[id]) view.current.onSelect?.(id); });
          layer.on("mouseover", () => {
            if (!view.current.byId[id]) return;
            layer.setStyle({ weight: 2.6, color: cssVar(el.current, "--cn-hover") });
            layer.bringToFront();
          });
          layer.on("mouseout", () => { s.styleFor?.(layer); });
        },
      }).addTo(map);
      fit();
      map.setMaxBounds(s.geo.getBounds().pad(0.4));
      if (typeof ResizeObserver !== "undefined") {
        let last = "";
        sizer = new ResizeObserver(([e]) => {
          const k = `${Math.round(e.contentRect.width)}x${Math.round(e.contentRect.height)}`;
          if (k === last || !e.contentRect.width) return;
          last = k; map.invalidateSize(); fit();
        });
        sizer.observe(el.current);
      }
      setTheme((t) => t + 1);
    })();
    return () => {
      cancelled = true; observer?.disconnect(); sizer?.disconnect(); s.map?.remove();
      Object.assign(s, { map: null, L: null, geo: null, dots: null, labels: null, tiles: [], styleFor: null });
    };
  }, []);

  // colour the areas, write the figures, draw the plants whenever what is shown changes
  useEffect(() => {
    const s = st.current;
    if (!s.map || !s.geo || !el.current) return;
    const c = (n) => cssVar(el.current, n);
    const shades = [0, 1, 2, 3, 4, 5].map((i) => c(`--cn-c${i}`));
    const mineSet = new Set(mine);
    s.styleFor = (layer) => {
      const id = layer.feature.properties.id, has = !!byId[id];
      const k = has ? classOf(values[id], cuts) : -1;
      const isSel = id === current, isMine = mineSet.has(id);
      layer.setStyle({
        fillColor: k < 0 ? c("--cn-nd") : shades[k], fillOpacity: k < 0 ? 0.5 : 0.88,
        color: isSel ? c("--cn-sel") : isMine ? c("--cn-mine") : c("--cn-edge"),
        weight: isSel ? 3 : isMine ? 2.2 : 0.9, dashArray: isMine && !isSel ? "5 4" : null,
      });
      layer.getElement?.()?.classList.toggle("cn-area-sel", isSel);
      layer.getElement?.()?.classList.toggle("cn-area-nd", !has);
    };
    s.geo.eachLayer((layer) => s.styleFor(layer));
    s.geo.eachLayer((layer) => { if (layer.feature.properties.id === current) layer.bringToFront(); });

    const L = s.L;
    s.labels?.remove(); s.labels = null;
    if (labels) {
      s.labels = L.layerGroup(stats.filter((r) => CENTRES[r.id] && values[r.id] != null && values[r.id] !== 0).map((r) => {
        const k = classOf(values[r.id], cuts);
        return L.marker(CENTRES[r.id], {
          pane: "cnLabels", interactive: false, keyboard: false,
          icon: L.divIcon({ className: "cn-lbl" + (k >= 4 ? " dk" : "") + (r.id === current ? " sel" : ""), html: `<span>${esc(fmtValue(values[r.id], metric, lang, true))}</span>`, iconSize: [0, 0] }),
        });
      })).addTo(s.map);
    }

    s.dots?.remove(); s.dots = null;
    if (showPlants && atLast) {
      const colour = { pv: c("--cn-pv"), wind: c("--cn-wind"), hydro: c("--cn-hydro") };
      const ring = c("--cn-ring");
      const shown = points.filter((p) => tech === "all" || p[2] === tech).sort((a, b) => b[3] - a[3]);
      s.dots = L.layerGroup(shown.map(([lat, lon, t, kw, n]) =>
        L.circleMarker([lat, lon], { radius: Math.min(18, 3 + Math.sqrt(kw / 1000) * 1.9), color: ring, weight: 1.2, fillColor: colour[t], fillOpacity: 0.9 })
          .bindTooltip(esc(ct("plant_tip", lang, { t: ct("tech_" + t, lang), kw: power(kw, lang), n })), { className: "cn-tip", direction: "top" }),
      )).addTo(s.map);
    }
  }, [metric, tech, showPlants, labels, mine, current, byId, stats, points, lang, theme, values, cuts, atLast]);

  // ---------------------------------------------------------------- the map's buttons
  useEffect(() => {
    const onFs = () => {
      const on = document.fullscreenElement === wrap.current;
      setFull(on);
      const m = st.current.map;
      if (m) { if (on) m.scrollWheelZoom.enable(); else m.scrollWheelZoom.disable(); }
    };
    document.addEventListener("fullscreenchange", onFs);
    return () => document.removeEventListener("fullscreenchange", onFs);
  }, []);
  const toggleFull = () => {
    if (document.fullscreenElement) document.exitFullscreen?.();
    else wrap.current?.requestFullscreen?.().catch(() => {});
  };
  const zoom = (d) => st.current.map?.setZoom(st.current.map.getZoom() + d);

  const techShown = metric === "plants" || showPlants;
  const ramp = [1, 2, 3, 4, 5].slice(0, cuts.length + 1);
  const lf = legendFmt(metric, legendMax, lang);

  return (
    <div className="cn-mapbox">
      <div className="cn-toolbar">
        <div className="cn-metrics" role="group" aria-label={ct("metric_l", lang)}>
          {MAP_METRICS.map((m) => {
            const Icon = METRIC_ICON[m];
            return (
              <button key={m} type="button" className={metric === m ? "on" : ""} aria-pressed={metric === m} onClick={() => pickMetric(m)} title={ct(METRIC_KEY[m], lang)}>
                <Icon size={15} strokeWidth={2} aria-hidden="true" /><span>{ct(METRIC_SHORT[m], lang)}</span>
              </button>
            );
          })}
        </div>
        <div className="cn-toggles">
          <button type="button" className={"cn-tgl" + (labels ? " on" : "")} aria-pressed={labels} onClick={() => setLabels((v) => !v)}>
            <Tag size={14} strokeWidth={2} aria-hidden="true" />{ct("labels_on", lang)}
          </button>
          <button type="button" className={"cn-tgl" + (showPlants ? " on" : "")} aria-pressed={showPlants} onClick={() => setShowPlants((v) => !v)}>
            <CircleDot size={14} strokeWidth={2} aria-hidden="true" />{ct("dots_short", lang)}
          </button>
        </div>
      </div>
      {techShown && (
        <div className="cn-techs" role="group" aria-label={ct("tech_l", lang)}>
          {TECHS.map((t) => (
            <button key={t} type="button" className={tech === t ? "on" : ""} aria-pressed={tech === t} onClick={() => setTech(t)}>
              {t !== "all" && <b className={"d-" + t} aria-hidden="true" />}{ct("tech_" + t, lang)}
            </button>
          ))}
        </div>
      )}

      <div ref={wrap} className={"cn-mapwrap" + (full ? " is-full" : "")}>
        <div ref={el} className="cn-map" role="region" aria-label={ct("map_aria", lang)} />

        {/* the legend */}
        <div ref={legendEl} className="cn-ov cn-legend2" aria-hidden="true">
          <b>{ct(LEGEND_KEY[metric], lang)}{metric === "plants" && tech !== "all" ? `, ${ct("tech_" + tech, lang).toLowerCase()}` : ""}</b>
          <small>{moment}</small>
          <div className="cn-ramp">
            <span className="cn-ramp-z"><i className="c0" /><em>0</em></span>
            <span className="cn-ramp-s">
              <span className="cn-ramp-bar">{ramp.map((i) => <i key={i} className={"c" + i} />)}</span>
              <span className="cn-ramp-t">
                {cuts.map((v, i) => <em key={i} style={{ left: `${((i + 1) / ramp.length) * 100}%` }}>{lf(v)}</em>)}
                <em className="end">{lf(legendMax, true)}</em>
              </span>
            </span>
          </div>
          <span className="cn-lg-nd"><i />{ct("no_data_short", lang)}</span>
          {showPlants && atLast && (
            <span className="cn-lg-dots">{PLANT_TECHS.map((t) => <span key={t}><b className={"d-" + t} />{ct("tech_" + t, lang)}</span>)}</span>
          )}
        </div>

        {/* zoom, the whole country, full screen */}
        <div className="cn-ov cn-tools">
          <button type="button" onClick={() => zoom(0.5)} title={ct("zoom_in", lang)} aria-label={ct("zoom_in", lang)}><Plus size={16} strokeWidth={2.2} aria-hidden="true" /></button>
          <button type="button" onClick={() => zoom(-0.5)} title={ct("zoom_out", lang)} aria-label={ct("zoom_out", lang)}><Minus size={16} strokeWidth={2.2} aria-hidden="true" /></button>
          <button type="button" onClick={fit} title={ct("reset_view", lang)} aria-label={ct("reset_view", lang)}><LocateFixed size={16} strokeWidth={2} aria-hidden="true" /></button>
          <button type="button" onClick={toggleFull} title={ct(full ? "full_exit" : "full", lang)} aria-label={ct(full ? "full_exit" : "full", lang)}>
            {full ? <Minimize2 size={16} strokeWidth={2} aria-hidden="true" /> : <Maximize2 size={16} strokeWidth={2} aria-hidden="true" />}
          </button>
        </div>

        {/* the timeline */}
        {tl.keys.length > 1 && (
          <div className="cn-ov cn-time">
            <button type="button" className="cn-play" onClick={play} aria-label={ct(playing ? "pause" : "play", lang)} title={ct(playing ? "pause" : "play", lang)}>
              {playing ? <Pause size={16} strokeWidth={2.2} aria-hidden="true" /> : <Play size={16} strokeWidth={2.2} aria-hidden="true" />}
            </button>
            <div className="cn-time-track">
              <input type="range" min={0} max={lastIdx} step={1} value={idx} aria-label={ct("tl_label", lang)} aria-valuetext={moment}
                style={{ "--p": `${lastIdx ? (idx / lastIdx) * 100 : 100}%` }}
                onChange={(e) => { setPlaying(false); const i = Number(e.target.value); setFrame(i === lastIdx ? null : i); }} />
              <span className="cn-time-ends" aria-hidden="true">
                <span>{tl.kind === "year" ? tl.keys[0] : momentLabel(tl.kind, tl.keys[0], false, lang, dateLabel)}</span>
                <span>{tl.kind === "year" ? tl.keys[lastIdx] : momentLabel(tl.kind, tl.keys[lastIdx], true, lang, dateLabel)}</span>
              </span>
            </div>
            <output className="cn-time-now" aria-live="polite">{moment}</output>
          </div>
        )}
      </div>
      {showPlants && !atLast && <p className="en-note">{ct("tl_plants_note", lang)}</p>}
      {showPlants && atLast && <p className="en-note">{ct("dots_note", lang, { x: power(unlocatedKw, lang) })}</p>}
    </div>
  );
}
