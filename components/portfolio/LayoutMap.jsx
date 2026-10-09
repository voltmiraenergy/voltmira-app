"use client";
// components/portfolio/LayoutMap.jsx — the plot of a plant on aerial imagery:
// click to add the corners of the plot, drag a corner to move it, and the panel
// tables, inverter stations and cable of the generated layout
// (lib/siteLayout.js) are drawn inside it as it changes. Leaflet loads
// client-side only, as in components/portfolio/GridMap.jsx; the panel
// (LayoutPanel.jsx) holds the buttons and the figures.
import { useEffect, useRef } from "react";
import "leaflet/dist/leaflet.css";

const ESRI = "https://server.arcgisonline.com/ArcGIS/rest/services";
const SAT = `${ESRI}/World_Imagery/MapServer/tile/{z}/{y}/{x}`;
const COLOR = { plot: "#FFD54A", table: "#1E3A5F", tableLine: "#CFE3FF", cable: "#FF9F1C", station: "#D946EF", conn: "#E11D48" };
const round = (v) => Math.round(v * 1e6) / 1e6;

/**
 * @param {object} p
 * @param {{lat:number,lon:number}} p.site          where the plant is
 * @param {number[][]} p.boundary                   the plot, [lat, lon] corners
 * @param {boolean} p.drawing                       clicks add corners
 * @param {(b:number[][]) => void} p.onBoundary
 * @param {object|null} p.layout                    generateLayout() result to draw
 * @param {number} p.frameKey                       change it to frame the map again
 */
export default function LayoutMap({ site, boundary = [], drawing = false, onBoundary, layout = null, frameKey = 0, label }) {
  const el = useRef(null);
  const st = useRef({ map: null, L: null, layer: null, canvas: null });
  const live = useRef({ boundary, drawing, onBoundary });
  useEffect(() => { live.current = { boundary, drawing, onBoundary }; });

  // the map, once
  useEffect(() => {
    let cancelled = false, sizer = null;
    const s = st.current;
    (async () => {
      const { default: L } = await import("leaflet");
      if (cancelled || !el.current) return;
      const map = L.map(el.current, { scrollWheelZoom: true, maxZoom: 19, zoomSnap: 0.25, zoomDelta: 0.5, wheelPxPerZoomLevel: 90, preferCanvas: true });
      map.attributionControl.setPrefix(false);
      s.map = map; s.L = L; s.canvas = L.canvas({ padding: 0.5 });
      L.tileLayer(SAT, { maxZoom: 19, maxNativeZoom: 19, attribution: "Imagery © Esri, Maxar, Earthstar Geographics" }).addTo(map).bringToBack();
      map.on("click", (e) => {
        const { drawing: on, boundary: b, onBoundary: cb } = live.current;
        if (!on || !cb) return;
        cb([...b, [round(e.latlng.lat), round(e.latlng.lng)]]);
      });
      if (typeof ResizeObserver !== "undefined") { sizer = new ResizeObserver(() => map.invalidateSize()); sizer.observe(el.current); }
      draw(s, { boundary, drawing, layout, site }, live);
      frame(s, { boundary, site });
    })();
    return () => {
      cancelled = true;
      sizer?.disconnect();
      s.map?.remove();
      Object.assign(s, { map: null, L: null, layer: null, canvas: null });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const drawKey = JSON.stringify([boundary, drawing, layout ? [layout.tables.length, layout.stations.length, layout.connection] : null, site]);
  useEffect(() => {
    draw(st.current, { boundary, drawing, layout, site }, live);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drawKey]);

  useEffect(() => {
    frame(st.current, { boundary, site });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [frameKey]);

  return <div ref={el} className={"gr-map ly-map" + (drawing ? " drawing" : "")} role="application" aria-label={label} />;
}

function draw(s, { boundary, drawing, layout, site }, live) {
  const { map, L, canvas } = s;
  if (!map || !L) return;
  s.layer?.remove();
  const g = L.featureGroup();
  if (layout) {
    for (const t of layout.tables) L.polygon(t.corners, { renderer: canvas, color: COLOR.tableLine, weight: 0.5, fillColor: COLOR.table, fillOpacity: 0.9, interactive: false }).addTo(g);
    for (const c of layout.cables) L.polyline(c, { renderer: canvas, color: COLOR.cable, weight: 2, dashArray: "5 3", interactive: false }).addTo(g);
    for (const st of layout.stations) L.polygon(st.corners, { renderer: canvas, color: "#ffffff", weight: 1, fillColor: COLOR.station, fillOpacity: 1, interactive: false }).addTo(g);
    L.circleMarker([layout.connection.lat, layout.connection.lon], { renderer: canvas, radius: 6, color: "#ffffff", weight: 2, fillColor: COLOR.conn, fillOpacity: 1, interactive: false }).addTo(g);
  }
  if (boundary.length >= 3) L.polygon(boundary, { color: COLOR.plot, weight: 2.5, fillColor: COLOR.plot, fillOpacity: 0.06, interactive: false }).addTo(g);
  else if (boundary.length === 2) L.polyline(boundary, { color: COLOR.plot, weight: 2.5, interactive: false }).addTo(g);
  // the corners, draggable while drawing
  if (drawing) {
    boundary.forEach((q, i) => {
      const icon = L.divIcon({ className: "gr-bend-wrap", html: '<span class="gr-bend"></span>', iconSize: [14, 14], iconAnchor: [7, 7] });
      const m = L.marker(q, { icon, draggable: true, keyboard: false });
      m.on("dragend", () => {
        const { boundary: b, onBoundary: cb } = live.current;
        if (!cb) return;
        const ll = m.getLatLng();
        cb(b.map((p, j) => (j === i ? [round(ll.lat), round(ll.lng)] : p)));
      });
      m.addTo(g);
    });
  }
  if (site) L.marker([site.lat, site.lon], { icon: L.divIcon({ className: "pk-pin-wrap", html: '<span class="pk-pin"></span>', iconSize: [24, 24], iconAnchor: [12, 12] }), interactive: false, keyboard: false }).addTo(g);
  g.addTo(map);
  s.layer = g;
}

/** The plot, or the site when there is none yet. */
function frame(s, { boundary, site }) {
  const { map, L } = s;
  if (!map || !L) return;
  map.invalidateSize();
  if (boundary.length >= 2) map.fitBounds(L.latLngBounds(boundary), { padding: [30, 30], maxZoom: 18 });
  else if (site) map.setView([site.lat, site.lon], 16);
}
