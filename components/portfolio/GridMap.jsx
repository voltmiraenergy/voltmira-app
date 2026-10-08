"use client";
// components/portfolio/GridMap.jsx — the grid around a plant: the site, the
// lines in one colour per voltage class, the substations as squares, and the
// connection route to the chosen point (drawn by the user, or the straight
// line, dashed, until one is drawn). Satellite or the quiet grey base;
// full screen for drawing. In drawing mode every click adds a bend to the
// route before the connection point and every bend can be dragged; the panel
// (GridPanel.jsx) holds the buttons to undo a bend, clear and finish.
// Leaflet loads client-side only, as in components/portfolio/AssetMap.jsx; the
// options table beside it is the text view.
import { useEffect, useRef } from "react";
import "leaflet/dist/leaflet.css";
import { TILES, TILE_ATTRIBUTION } from "../../lib/portfolioMap.js";
import { roundPos } from "../../lib/sitePick.js";

/** One colour per voltage class, the same as the legend (portfolio.css .gr-k-*). */
export const CLASS_COLOR = { hv: "#B4472F", 110: "#B46A00", 35: "#2A6FC0" };
const ESRI = "https://server.arcgisonline.com/ArcGIS/rest/services";
const SAT = `${ESRI}/World_Imagery/MapServer/tile/{z}/{y}/{x}`;
const SAT_LABELS = `${ESRI}/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}`;
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

/**
 * @param {object} p
 * @param {{lat:number,lon:number}} p.site
 * @param {object[]} p.substations, p.lines, p.paths   the grid record (lib/gridNear.js)
 * @param {object|null} p.chosen    the chosen option (allOptions shape)
 * @param {number[][]|null} p.route the route drawn for it, [lat, lon] points from the site to the point
 * @param {boolean} p.drawing       clicks add bends to the route
 * @param {(pts:number[][]) => void} p.onRoute
 * @param {"sat"|"plain"} p.base
 * @param {number} p.frameKey       change it to frame the map again
 */
export default function GridMap({ site, substations = [], lines = [], paths = [], chosen = null, route = null, drawing = false, onRoute, base = "plain", label, nameOf = (x) => x.name || "", frameKey = 0 }) {
  const el = useRef(null);
  const st = useRef({ map: null, L: null, layer: null, edit: null, tiles: [] });
  const live = useRef({ route, chosen, site, onRoute, drawing });
  useEffect(() => { live.current = { route, chosen, site, onRoute, drawing }; });

  // the map, once
  useEffect(() => {
    let cancelled = false, observer = null, sizer = null;
    const s = st.current;
    (async () => {
      const { default: L } = await import("leaflet");
      if (cancelled || !el.current) return;
      const map = L.map(el.current, { scrollWheelZoom: true, maxZoom: 18, zoomSnap: 0.25, zoomDelta: 0.5, wheelPxPerZoomLevel: 90 });
      map.attributionControl.setPrefix(false);
      s.map = map; s.L = L;
      // in drawing mode a click adds a bend before the connection point
      map.on("click", (e) => {
        const { drawing: on, route: r, chosen: c, site: at, onRoute: cb } = live.current;
        if (!on || !c || !cb) return;
        const end = c.to ? [c.to.lat, c.to.lon] : null;
        const pts = r && r.length >= 2 ? r : [[at.lat, at.lon], end].filter(Boolean);
        const next = [...pts.slice(0, -1), [roundPos(e.latlng.lat), roundPos(e.latlng.lng)], pts[pts.length - 1]];
        cb(next);
      });
      observer = new MutationObserver(() => drawTiles(s, s.base));
      observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
      if (typeof ResizeObserver !== "undefined") { sizer = new ResizeObserver(() => map.invalidateSize()); sizer.observe(el.current); }
      s.base = base;
      drawTiles(s, base);
      draw(s, { site, substations, lines, paths, chosen, route, drawing, nameOf }, live);
      frame(s, { site, substations, chosen, route });
    })();
    return () => {
      cancelled = true;
      observer?.disconnect(); sizer?.disconnect();
      s.map?.remove();
      Object.assign(s, { map: null, L: null, layer: null, edit: null, tiles: [] });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { const s = st.current; s.base = base; drawTiles(s, base); }, [base]);

  const drawKey = JSON.stringify([site, substations.map((x) => x.id), lines.map((x) => x.id), paths.length, chosen?.key, route, drawing]);
  useEffect(() => {
    draw(st.current, { site, substations, lines, paths, chosen, route, drawing, nameOf }, live);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drawKey]);

  // frame again when asked (a new lookup, a new choice, leaving full screen)
  useEffect(() => {
    frame(st.current, { site, substations, chosen, route });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [frameKey, chosen?.key]);

  return <div ref={el} className={"gr-map" + (drawing ? " drawing" : "")} role="application" aria-label={label} />;
}

function drawTiles(s, base) {
  const { map, L } = s;
  if (!map || !L) return;
  s.tiles.forEach((t) => t.remove());
  if (base === "sat") {
    s.tiles = [L.tileLayer(SAT, { maxZoom: 18, attribution: "Tiles © Esri; grid © OpenStreetMap contributors" }).addTo(map), L.tileLayer(SAT_LABELS, { maxZoom: 18 }).addTo(map)];
  } else {
    const set = document.documentElement.getAttribute("data-theme") === "dark" ? TILES.dark : TILES.light;
    s.tiles = [L.tileLayer(set.base, { maxZoom: 18, maxNativeZoom: 16, attribution: `${TILE_ATTRIBUTION}; grid © OpenStreetMap contributors` }).addTo(map),
      L.tileLayer(set.ref, { maxZoom: 18, maxNativeZoom: 16 }).addTo(map)];
  }
  s.tiles.forEach((t) => t.bringToBack());
}

function draw(s, { site, substations, lines, paths, chosen, route, drawing, nameOf }, live) {
  const { map, L } = s;
  if (!map || !L || !site) return;
  s.layer?.remove();
  const g = L.featureGroup();
  for (const p of paths) {
    L.polyline(p.path, { color: CLASS_COLOR[p.cls] || "#5B6A62", weight: p.cls === "35" ? 2 : 3, opacity: 0.9, interactive: false }).addTo(g);
  }
  if (!paths.length) for (const l of lines) if (l.near) L.circleMarker([l.near.lat, l.near.lon], { radius: 3, color: CLASS_COLOR[l.cls], fillColor: CLASS_COLOR[l.cls], fillOpacity: 1, weight: 1, interactive: false }).addTo(g);
  for (const sub of substations) {
    const isChosen = chosen && chosen.kind === "sub" && chosen.id === sub.id;
    const icon = L.divIcon({ className: "gr-sq-wrap", html: `<span class="gr-sq${isChosen ? " on" : ""}" style="background:${CLASS_COLOR[sub.cls]}"></span>`, iconSize: [14, 14], iconAnchor: [7, 7] });
    const nm = nameOf(sub);
    const m = L.marker([sub.lat, sub.lon], { icon, keyboard: true, title: nm });
    m.bindTooltip(`<b>${esc(nm)}</b> ${esc(sub.kv.join("/"))} kV`, { direction: "auto", offset: [0, -7], className: "pk-dot-label", permanent: isChosen });
    m.addTo(g);
  }
  // the connection: the drawn route, or the straight line, dashed, to the chosen point
  const end = chosen?.to ? [chosen.to.lat, chosen.to.lon] : null;
  if (end) {
    const pts = route && route.length >= 2 ? route : [[site.lat, site.lon], end];
    L.polyline(pts, route ? { color: "#0B1F17", weight: 4, opacity: 0.95, interactive: false } : { color: "#0B1F17", weight: 2.5, dashArray: "7 7", interactive: false }).addTo(g);
    if (route) L.polyline(pts, { color: "#ffffff", weight: 1.5, opacity: 0.9, dashArray: "2 8", interactive: false }).addTo(g);
    if (chosen.kind === "line") L.circleMarker(end, { radius: 6, color: "#0B1F17", weight: 2, fillColor: "#fff", fillOpacity: 1, interactive: false }).addTo(g);
    // the bends, draggable while drawing
    if (drawing && route) {
      route.slice(1, -1).forEach((q, i) => {
        const icon = L.divIcon({ className: "gr-bend-wrap", html: '<span class="gr-bend"></span>', iconSize: [14, 14], iconAnchor: [7, 7] });
        const m = L.marker(q, { icon, draggable: true, keyboard: false });
        m.on("dragend", () => {
          const { route: r, onRoute: cb } = live.current;
          if (!r || !cb) return;
          const ll = m.getLatLng();
          cb(r.map((p, j) => (j === i + 1 ? [roundPos(ll.lat), roundPos(ll.lng)] : p)));
        });
        m.addTo(g);
      });
    }
  }
  const pin = L.divIcon({ className: "pk-pin-wrap", html: '<span class="pk-pin"></span>', iconSize: [24, 24], iconAnchor: [12, 12] });
  L.marker([site.lat, site.lon], { icon: pin, interactive: false, keyboard: false }).addTo(g);
  g.addTo(map);
  s.layer = g;
}

/** The site, the chosen point and its route, and the nearest substation of each class within reach. */
function frame(s, { site, substations, chosen, route }) {
  const { map, L } = s;
  if (!map || !L || !site) return;
  map.invalidateSize();
  const pts = [[site.lat, site.lon]];
  if (chosen?.to) pts.push([chosen.to.lat, chosen.to.lon]);
  (route || []).forEach((q) => pts.push(q));
  for (const c of ["hv", "110", "35"]) {
    const n = substations.find((x) => (x.classes || [x.cls]).includes(c));
    if (n && n.km < 15) pts.push([n.lat, n.lon]);
  }
  if (pts.length > 1) map.fitBounds(L.latLngBounds(pts), { padding: [40, 40], maxZoom: 13 });
  else map.setView([site.lat, site.lon], 12);
}
