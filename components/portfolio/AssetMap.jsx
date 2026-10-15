"use client";
// components/portfolio/AssetMap.jsx — where the portfolio's assets are, on a
// quiet grey base map (Esri Canvas tiles, light or dark with the app theme).
// Leaflet is loaded client-side only, as components/SiteDesigner.jsx does.
//
// One series, so one colour (--pf-a) and no legend box; the marker's AREA
// follows capacity. Every marker carries a label with its name, capacity and
// yearly energy (permanent while the map is not crowded), and opens its
// details on click, tap or Enter: energy, capex, debt and cover, grid area and
// where the position comes from. A position looked up from the town only is
// drawn with a dashed ring and says "approximate". Markers that share a spot
// are spread apart (lib/geoPlace.js spread). The asset table above is the
// table view.
import { useEffect, useRef } from "react";
import "leaflet/dist/leaflet.css";
import { TILES, TILE_ATTRIBUTION, located, markerRadius } from "../../lib/portfolioMap.js";
import { spread } from "../../lib/geoPlace.js";

const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
/** Above this many markers, labels show on hover and focus instead of all the time. */
const LABELS_ALWAYS = 25;
const OFFSET = { right: (r) => [r + 2, 0], left: (r) => [-(r + 2), 0], top: (r) => [0, -(r + 2)], bottom: (r) => [0, r + 2] };
const area = (a, b) => Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x)) * Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y));

function bindLabel(e, dir, permanent) {
  e.m.unbindTooltip();
  e.m.bindTooltip(e.html, { permanent, direction: dir, offset: OFFSET[dir](e.r), opacity: 1, className: "pf-maplabel" });
}

/**
 * Where each label goes so labels do not cover one another or other markers:
 * right, left, above or below its marker, the bigger plants choosing first. A
 * label that cannot find a clear spot shows on hover and focus instead. Runs
 * after the view is set and again after every zoom.
 */
function layoutLabels(st) {
  const { map, entries } = st;
  if (!map || !entries || !entries.length) return;
  const size = map.getSize();
  // the label's real size, measured once from a first, permanent placement
  for (const e of entries) {
    if (e.w) continue;
    const el = e.m.getTooltip()?.getElement();
    const rect = el ? el.getBoundingClientRect() : null;
    e.w = rect && rect.width ? rect.width : 150;
    e.h = rect && rect.height ? rect.height : 34;
  }
  const at = entries.map((e) => map.latLngToContainerPoint(e.m.getLatLng()));
  const pins = entries.map((e, i) => ({ x: at[i].x - e.r, y: at[i].y - e.r, w: e.r * 2, h: e.r * 2 }));
  const taken = [];
  const order = entries.map((_, i) => i).sort((a, b) => (entries[b].kw || 0) - (entries[a].kw || 0));
  for (const i of order) {
    const e = entries[i], c = at[i], g = e.r + 4;
    const spots = {
      right: { x: c.x + g, y: c.y - e.h / 2 }, left: { x: c.x - g - e.w, y: c.y - e.h / 2 },
      top: { x: c.x - e.w / 2, y: c.y - g - e.h }, bottom: { x: c.x - e.w / 2, y: c.y + g },
    };
    let best = "right", bestCost = Infinity, bestBox = null;
    for (const [dir, s] of Object.entries(spots)) {
      const box = { x: s.x, y: s.y, w: e.w, h: e.h };
      let cost = taken.reduce((sum, b) => sum + area(box, b), 0) + pins.reduce((sum, b, j) => (j === i ? sum : sum + area(box, b)), 0);
      cost += (Math.max(0, -box.x) + Math.max(0, box.x + box.w - size.x) + Math.max(0, -box.y) + Math.max(0, box.y + box.h - size.y)) * e.h;
      if (cost < bestCost) { best = dir; bestCost = cost; bestBox = box; }
      if (cost === 0) break;
    }
    const show = bestCost <= e.w * e.h * 0.08;
    if (show) taken.push(bestBox);
    bindLabel(e, best, show);
  }
}

/** Frame the markers in the map's current size (again whenever that size changes). */
function frame(st) {
  const { map, markers, pts } = st;
  if (!map) return;
  map.invalidateSize();
  if (pts && pts.length === 1) map.setView([pts[0].lat, pts[0].lon], 10);
  else if (pts && pts.length && markers) map.fitBounds(markers.getBounds(), { padding: [40, 40], maxZoom: 12 });
  else map.setView([47.2, 28.6], 6);
}

/** Put one marker per located asset on the map and frame them. */
function drawMarkers(st, points) {
  const { map, L } = st;
  if (!map || !L) return;
  st.markers?.remove();
  const pts = spread(located(points));
  const maxKw = Math.max(1, ...pts.map((p) => p.kw || 0));
  const always = pts.length <= LABELS_ALWAYS;
  const group = L.featureGroup();
  const entries = [];
  for (const p of pts) {
    const r = markerRadius(p.kw, maxKw);
    const icon = L.divIcon({ className: "pf-pin-wrap", html: `<span class="pf-pin${p.approx ? " approx" : ""}" style="width:${r * 2}px;height:${r * 2}px"></span>`, iconSize: [r * 2, r * 2], iconAnchor: [r, r] });
    const m = L.marker([p.lat, p.lon], { icon, keyboard: true, title: p.name, alt: p.name, riseOnHover: true });
    const entry = { m, r, kw: p.kw, html: `<b>${esc(p.name)}</b><span>${esc(p.label || "")}</span>` };
    entries.push(entry);
    bindLabel(entry, "right", always);
    const rows = (p.rows || []).map(([k, v]) => `<tr><th scope="row">${esc(k)}</th><td>${esc(v)}</td></tr>`).join("");
    m.bindPopup(`<div class="pf-mappop"><b>${esc(p.name)}</b><span>${esc(p.label || "")}</span>${rows ? `<table>${rows}</table>` : ""}</div>`, {
      className: "pf-mappop-wrap", maxWidth: 300, offset: [0, -r],
    });
    m.on("add", () => {
      const node = m.getElement();
      if (!node) return;
      node.setAttribute("aria-label", `${p.name}: ${p.label || ""}`);
      // a label hidden to keep the map readable still shows on keyboard focus
      node.addEventListener("focus", () => m.openTooltip());
      node.addEventListener("blur", () => { if (!m.getTooltip()?.options.permanent) m.closeTooltip(); });
    });
    group.addLayer(m);
  }
  group.addTo(map);
  st.markers = group;
  st.entries = always ? entries : null;
  st.pts = pts;
  frame(st);
  // labels are laid out once the view has settled, and again after each zoom
  requestAnimationFrame(() => layoutLabels(st));
}

export default function AssetMap({ points, label, height = 400 }) {
  const el = useRef(null);
  const state = useRef({ map: null, L: null, layers: [], markers: null, entries: null, pts: null });
  const pointsRef = useRef(points);
  // redraw only when what is drawn changes, not on every parent render
  const key = JSON.stringify(points.map((p) => [p.id, p.lat, p.lon, p.kw, p.label, p.approx, p.rows]));

  // create the map once
  useEffect(() => {
    let cancelled = false;
    let observer = null;
    let sizer = null;
    const st = state.current;
    (async () => {
      const { default: L } = await import("leaflet");
      if (cancelled || !el.current) return;
      // quarter zoom steps: a wide, short box can then frame Moldova tightly
      // instead of falling back a whole level and showing half of Europe
      const map = L.map(el.current, { zoomControl: true, scrollWheelZoom: false, attributionControl: true, maxZoom: 16, zoomSnap: 0.25, zoomDelta: 0.5 });
      map.attributionControl.setPrefix(false);
      st.map = map; st.L = L;
      map.on("zoomend", () => layoutLabels(st));
      const setTiles = () => {
        const dark = document.documentElement.getAttribute("data-theme") === "dark";
        const set = dark ? TILES.dark : TILES.light;
        st.layers.forEach((l) => l.remove());
        st.layers = [
          L.tileLayer(set.base, { maxZoom: 16, attribution: TILE_ATTRIBUTION }).addTo(map),
          L.tileLayer(set.ref, { maxZoom: 16 }).addTo(map),
        ];
      };
      setTiles();
      observer = new MutationObserver(setTiles);
      observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
      // a map drawn before its box had its final size frames the markers far
      // too wide: frame again whenever the box changes size
      if (typeof ResizeObserver !== "undefined") {
        let last = "";
        sizer = new ResizeObserver(([e]) => {
          const k = `${Math.round(e.contentRect.width)}x${Math.round(e.contentRect.height)}`;
          if (k === last || !e.contentRect.width) return;
          last = k;
          frame(st);
          requestAnimationFrame(() => layoutLabels(st));
        });
        sizer.observe(el.current);
      }
      drawMarkers(st, pointsRef.current);
    })();
    return () => {
      cancelled = true;
      observer?.disconnect();
      sizer?.disconnect();
      st.map?.remove();
      Object.assign(st, { map: null, L: null, layers: [], markers: null, entries: null });
    };
  }, []);

  useEffect(() => {
    pointsRef.current = points;
    drawMarkers(state.current, points);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return <div ref={el} className="pf-map" style={{ height }} role="region" aria-label={label} />;
}
