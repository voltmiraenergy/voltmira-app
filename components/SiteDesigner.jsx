"use client";
// components/SiteDesigner.jsx — the roof survey surface. Every quote today
// assumes one flat plane at a hardcoded 35°-south tilt (see engine/pvgis.js's
// defaults) and derives panel count backwards from a kW slider
// (lib/supplierCatalog.js's autoBom: kw*1000/panelWatt) instead of from
// anything that actually fits on the roof. This component is where that gets
// fixed: the installer draws the roof (one or more planes, each with its own
// tilt/azimuth) and its obstacles on real satellite imagery, picks a real
// module, and sees real payback/CO2 numbers for whatever the layout implies —
// before ever touching the main kW field.
//
// Esri World Imagery is the default base layer: free, no API key or billing
// account, good enough resolution for outlining a roof. When a real
// NEXT_PUBLIC_GOOGLE_MAPS_API_KEY is set (installer's own Google Cloud
// project, billing enabled — see .env.example), the map switches to Google's
// satellite tiles instead, via the official Maps JavaScript API loaded under
// leaflet.gridlayer.googlemutant (not raw google tile-server URLs, which
// aren't licensed for direct use outside that API). No key set: unchanged
// Esri behavior. Leaflet + leaflet-geoman are loaded dynamically inside an
// effect (not a static top-level import) because they touch `window` at load
// time and this file is server-rendered on first paint.
import { useEffect, useMemo, useRef, useState } from "react";
import "leaflet/dist/leaflet.css";
import { fitPanels, compassLabel, project } from "../lib/roofLayout.js";
import { PANELS, findPanel, recommendPanel } from "../lib/supplierCatalog.js";
import { SOLAR_SEASON, effectiveConsumption } from "@voltmira/engine";
import { CashflowSVG, MonthlySVG } from "../app/p/[code]/charts.jsx";

const t3 = (lang, ro, en, ru) => (lang === "en" ? en : lang === "ru" ? ru : ro);

const PLANE_STYLE = { color: "#2E7D5B", weight: 2, fillColor: "#2E7D5B", fillOpacity: 0.18 };
const OBSTACLE_STYLE = { color: "#B4472F", weight: 2, fillColor: "#B4472F", fillOpacity: 0.35 };
const TREE_STYLE = { color: "#5B7A3A", weight: 2, fillColor: "#5B7A3A", fillOpacity: 0.35 };

let googleMapsScriptPromise = null;
function loadGoogleMapsScript(key) {
  if (window.google?.maps) return Promise.resolve();
  if (!googleMapsScriptPromise) {
    googleMapsScriptPromise = new Promise((resolve, reject) => {
      const s = document.createElement("script");
      s.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(key)}`;
      s.async = true;
      s.onload = () => resolve();
      s.onerror = () => reject(new Error("google maps script failed to load"));
      document.head.appendChild(s);
    });
  }
  return googleMapsScriptPromise;
}

// Real Google satellite tiles, via the official Maps JavaScript API (never
// raw mt0/mt1.google.com tile URLs — those aren't licensed for direct use
// outside that API and Google actively blocks scraped traffic). Any failure
// — bad key, network, billing not enabled on the installer's own Google
// Cloud project — resolves to null so the caller falls back to Esri instead
// of leaving the map blank.
async function loadGoogleSatelliteLayer(L, key) {
  try {
    await loadGoogleMapsScript(key);
    await import("leaflet.gridlayer.googlemutant");
    return L.gridLayer.googleMutant({ type: "satellite", maxZoom: 21 });
  } catch {
    return null;
  }
}

// Matches lib/supplierCatalog.js's ROOF_TYPE_MOUNT_TEST keys exactly, so a
// plane's chosen roof type maps straight to a real, verified mount SKU (or
// honestly to none, for "flat" — see that file's own comment).
const ROOF_TYPES = ["tile", "trapezoidal", "standingSeam", "flat", "ground"];
const ROOF_TYPE_LABEL = {
  tile: { ro: "Țiglă", en: "Tile", ru: "Черепица" },
  trapezoidal: { ro: "Tablă cutată", en: "Trapezoidal sheet", ru: "Профлист" },
  standingSeam: { ro: "Falț stâlp", en: "Standing-seam metal", ru: "Фальцевая кровля" },
  flat: { ro: "Terasă (acoperiș plat)", en: "Flat roof / terrace", ru: "Плоская крыша" },
  ground: { ro: "Sol / carport", en: "Ground / carport", ru: "Грунт / навес" },
};

const OBSTACLE_KINDS = ["chimney", "vent", "dormer", "tree", "other"];
const KIND_LABEL = {
  chimney: { ro: "Coș", en: "Chimney", ru: "Дымоход" },
  vent: { ro: "Ventilație", en: "Vent", ru: "Вентиляция" },
  dormer: { ro: "Lucarnă", en: "Dormer", ru: "Слуховое окно" },
  tree: { ro: "Copac", en: "Tree", ru: "Дерево" },
  other: { ro: "Altul", en: "Other", ru: "Другое" },
};

// Draggable, cosmetic-only points for a lightweight single-line layout —
// real electrical validation lives in the separate String Designer.
const MARKER_TYPES = ["mainPanel", "meter", "inverter", "secondaryPanel"];
const MARKER_LABEL = {
  mainPanel: { ro: "Tablou principal", en: "Main panel", ru: "Главный щит" },
  meter: { ro: "Contor", en: "Meter", ru: "Счётчик" },
  inverter: { ro: "Invertor", en: "Inverter", ru: "Инвертор" },
  secondaryPanel: { ro: "Tablou secundar", en: "Secondary panel", ru: "Доп. щит" },
};
const MARKER_ABBR = { mainPanel: "TP", meter: "C", inverter: "INV", secondaryPanel: "TS" };

// Same per-market kg CO2/kWh factors as PrintSheet.jsx's MKT table, kept as a
// separate copy rather than an import so this modal's bundle doesn't pull in
// the whole PDF-rendering module for three numbers.
const CO2_FACTOR = { RO: 0.30, MD: 0.40, DE: 0.35 };

function uid() { return Math.random().toString(36).slice(2, 10); }

function planePopupHtml(layer, lang) {
  const tilt = layer._sdTilt ?? 35;
  const az = layer._sdAzimuth ?? 0;
  const roofType = layer._sdRoofType || "tile";
  const roofOpts = ROOF_TYPES.map((k) =>
    `<option value="${k}"${k === roofType ? " selected" : ""}>${ROOF_TYPE_LABEL[k][lang] || ROOF_TYPE_LABEL[k].ro}</option>`
  ).join("");
  // A drag can't land on an exact degree — a paired number box lets the
  // installer type a figure from a real site survey instead of hunting for
  // it on the slider.
  return `<div class="sd-pop">
    <div class="sd-pop-row">
      <label>${t3(lang, "Tip acoperiș", "Roof material", "Тип крыши")}</label>
      <select class="sd-pop-roof">${roofOpts}</select>
    </div>
    <div class="sd-pop-row">
      <label>${t3(lang, "Înclinare", "Tilt", "Наклон")}</label>
      <div class="sd-pop-inrow">
        <input type="range" class="sd-pop-tilt" min="0" max="60" step="1" value="${tilt}">
        <input type="number" class="sd-pop-tiltnum" min="0" max="60" step="1" value="${Math.round(tilt)}">
      </div>
    </div>
    <div class="sd-pop-row">
      <label>${t3(lang, "Orientare", "Azimuth", "Азимут")}</label>
      <div class="sd-pop-inrow">
        <input type="range" class="sd-pop-az" min="-180" max="180" step="5" value="${az}">
        <input type="number" class="sd-pop-aznum" min="-180" max="180" step="5" value="${Math.round(az)}">
      </div>
      <span class="sd-pop-val sd-pop-azval">${compassLabel(az, lang)}</span>
    </div>
  </div>`;
}

function obstaclePopupHtml(layer, lang) {
  const kind = layer._sdObstacleKind || "chimney";
  const opts = OBSTACLE_KINDS.map((k) =>
    `<option value="${k}"${k === kind ? " selected" : ""}>${KIND_LABEL[k][lang] || KIND_LABEL[k].ro}</option>`
  ).join("");
  return `<div class="sd-pop">
    <div class="sd-pop-row">
      <label>${t3(lang, "Tip obstacol", "Obstacle type", "Тип препятствия")}</label>
      <select class="sd-pop-kind">${opts}</select>
    </div>
  </div>`;
}

function markerPopupHtml(lang) {
  return `<div class="sd-pop">
    <button type="button" class="sd-pop-remove">${t3(lang, "Șterge markerul", "Remove marker", "Удалить маркер")}</button>
  </div>`;
}

function ringToLatLon(layer) {
  const ring = layer.getLatLngs()[0] || [];
  return ring.map((ll) => [ll.lat, ll.lng]);
}

function centroidOf(ring) {
  let sx = 0, sy = 0;
  for (const [a, b] of ring) { sx += a; sy += b; }
  return [sx / ring.length, sy / ring.length];
}

// A circle drawn by geoman is converted to a plain polygon ring immediately
// on creation, so it flows through the exact same obstacle pipeline
// (fitPanels, storage, redraw) as a hand-drawn polygon obstacle — no second
// shape type anywhere downstream.
function circleToRing(center, radiusM, n) {
  const R = 6371000;
  const latRad = (center.lat * Math.PI) / 180;
  const dLat = (radiusM / R) * (180 / Math.PI);
  const dLon = (radiusM / (R * Math.cos(latRad))) * (180 / Math.PI);
  const ring = [];
  for (let i = 0; i < n; i++) {
    const a = (2 * Math.PI * i) / n;
    ring.push([center.lat + dLat * Math.sin(a), center.lng + dLon * Math.cos(a)]);
  }
  return ring;
}

// A plain flat-blue rectangle doesn't read as "a solar panel" at a glance.
// This defines one shared SVG pattern — a small cell grid with a soft
// highlight, sized as a fraction of each shape's own bounding box (so it
// automatically fits any panel's rectangle regardless of zoom or panel
// size) — reused as the fill for every placed panel instead of a per-panel
// texture, so drawing hundreds of panels costs the same as drawing hundreds
// of plain rectangles. Not a claim about the selected module's real cell
// count/layout — just enough texture to read as a module from above.
function ensurePanelPattern(map) {
  const svg = map.getPanes().overlayPane.querySelector("svg");
  if (!svg || svg.querySelector("#sdPanelCells")) return;
  const NS = "http://www.w3.org/2000/svg";
  let defs = svg.querySelector("defs");
  if (!defs) { defs = document.createElementNS(NS, "defs"); svg.insertBefore(defs, svg.firstChild); }
  const pattern = document.createElementNS(NS, "pattern");
  pattern.setAttribute("id", "sdPanelCells");
  pattern.setAttribute("patternUnits", "objectBoundingBox");
  pattern.setAttribute("patternContentUnits", "objectBoundingBox");
  pattern.setAttribute("width", "0.2");
  pattern.setAttribute("height", "0.1");
  const bg = document.createElementNS(NS, "rect");
  bg.setAttribute("width", "1"); bg.setAttribute("height", "1"); bg.setAttribute("fill", "#0F2A4A");
  const shine = document.createElementNS(NS, "rect");
  shine.setAttribute("x", "0.08"); shine.setAttribute("y", "0.08");
  shine.setAttribute("width", "0.5"); shine.setAttribute("height", "0.3");
  shine.setAttribute("fill", "#3D6FA8"); shine.setAttribute("opacity", "0.4");
  const grid = document.createElementNS(NS, "rect");
  grid.setAttribute("width", "1"); grid.setAttribute("height", "1"); grid.setAttribute("fill", "none");
  grid.setAttribute("stroke", "#4A7FB5"); grid.setAttribute("stroke-width", "0.06");
  pattern.appendChild(bg); pattern.appendChild(shine); pattern.appendChild(grid);
  defs.appendChild(pattern);
}

// Screen-upright bearing (degrees) from a to b, via the same local-meters
// projection fitPanels uses — accurate enough at roof scale, and stable
// under Leaflet's own pan/zoom since it never rotates the map itself.
function edgeAngleDeg(a, b) {
  const [p0, p1] = project([a, b], a[0], a[1]);
  const dx = p1[0] - p0[0], dy = p1[1] - p0[1];
  let deg = (Math.atan2(-dy, dx) * 180) / Math.PI;
  if (deg > 90 || deg < -90) deg += 180; // keep the label upright, never upside-down
  return deg;
}

export default function SiteDesigner({
  lang, lat, lon, siteDesign, onChange, onApply, applying = false,
  projectInputs = {}, onComputeQuote,
}) {
  const mapEl = useRef(null);
  const mapRef = useRef(null);
  const Lref = useRef(null);
  const planeLayers = useRef(new Map());
  const obstacleLayers = useRef(new Map());
  const markerLayers = useRef(new Map());
  const panelGroupRef = useRef(null);
  const dimensionGroupRef = useRef(null);
  const pendingKind = useRef(null);
  const pendingMarkerType = useRef(null);
  const measuringRef = useRef(false);
  const measurePtsRef = useRef([]);
  const measureLayerRef = useRef(null);
  const showDimensionsRef = useRef(true);
  const debounceTimer = useRef(null);
  const runAutoLayoutRef = useRef(null);
  const renderDimensionLabelsRef = useRef(null);
  const undoRef = useRef(null);
  const redoRef = useRef(null);
  const historyRef = useRef([]);
  const historyIndexRef = useRef(-1);
  const restoringRef = useRef(false);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const [ready, setReady] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [counts, setCounts] = useState({ planes: 0, obstacles: 0, markers: 0 });
  const [layout, setLayout] = useState(null);

  const [selectedPanelId, setSelectedPanelId] = useState(() => recommendPanel().id);
  const [orientation, setOrientation] = useState("portrait");
  const [rowSpacingCm, setRowSpacingCm] = useState(2);
  const [colSpacingCm, setColSpacingCm] = useState(2);
  const [setbackCm, setSetbackCm] = useState(30);
  const [clusterMaxW, setClusterMaxW] = useState(0);
  const [clusterMaxH, setClusterMaxH] = useState(0);
  const [clusterGap, setClusterGap] = useState(0);
  const [markerType, setMarkerType] = useState("mainPanel");
  const [measuring, setMeasuring] = useState(false);
  const [measureResult, setMeasureResult] = useState(null);
  const [showDimensions, setShowDimensions] = useState(true);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);
  measuringRef.current = measuring;

  useEffect(() => {
    let cancelled = false;

    function placeMarker(latlng, type, id) {
      const L = Lref.current;
      const icon = L.divIcon({
        className: "sd-marker-wrap",
        html: `<div class="sd-marker-dot">${MARKER_ABBR[type] || "?"}</div>`,
        iconSize: [24, 24], iconAnchor: [12, 12],
      });
      const m = L.marker(latlng, { icon, draggable: true }).addTo(mapRef.current);
      const mid = id || uid();
      m._sdMarkerType = type; m._sdId = mid;
      // Native Leaflet dragging only — geoman auto-patches every layer type it
      // supports, and its own drag/edit machinery would otherwise fight the
      // simple dragend handler this needs.
      if (m.pm && typeof m.pm.disable === "function") m.pm.disable();
      m.bindPopup(markerPopupHtml(lang));
      m.on("dragend", () => syncToParent());
      markerLayers.current.set(mid, m);
      return m;
    }

    function attachPlane(layer, id, tiltDeg, azimuthDeg, roofType) {
      layer._sdKind = "plane"; layer._sdId = id;
      layer._sdTilt = tiltDeg ?? 35; layer._sdAzimuth = azimuthDeg ?? 0;
      layer._sdRoofType = ROOF_TYPES.includes(roofType) ? roofType : "tile";
      layer.setStyle?.(PLANE_STYLE);
      layer.bindPopup(planePopupHtml(layer, lang));
      planeLayers.current.set(id, layer);
    }
    function attachObstacle(layer, id, kind) {
      layer._sdKind = "obstacle"; layer._sdId = id;
      layer._sdObstacleKind = kind || "chimney";
      layer.setStyle?.(layer._sdObstacleKind === "tree" ? TREE_STYLE : OBSTACLE_STYLE);
      layer.bindPopup(obstaclePopupHtml(layer, lang));
      obstacleLayers.current.set(id, layer);
    }

    // Every edge of every drawn plane/obstacle, labeled with its real length —
    // recomputed from the live geometry, never stored, so it can never drift
    // from what's actually drawn.
    function renderDimensionLabels() {
      const map = mapRef.current, L = Lref.current;
      if (!map || !L) return;
      if (!dimensionGroupRef.current) dimensionGroupRef.current = L.layerGroup().addTo(map);
      dimensionGroupRef.current.clearLayers();
      if (!showDimensionsRef.current) return;
      const shapes = [...planeLayers.current.values(), ...obstacleLayers.current.values()];
      for (const layer of shapes) {
        const ring = ringToLatLon(layer);
        for (let i = 0; i < ring.length; i++) {
          const a = ring[i], b = ring[(i + 1) % ring.length];
          const lengthM = map.distance(L.latLng(a), L.latLng(b));
          const mid = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
          const deg = edgeAngleDeg(a, b);
          const icon = L.divIcon({
            className: "sd-dim-icon",
            html: `<div class="sd-dim-label" style="transform:rotate(${deg.toFixed(1)}deg)">${lengthM.toFixed(1)}m</div>`,
            iconSize: [50, 18], iconAnchor: [25, 9],
          });
          L.marker(mid, { icon, interactive: false }).addTo(dimensionGroupRef.current);
        }
      }
    }
    renderDimensionLabelsRef.current = renderDimensionLabels;

    function currentSnapshot() {
      const planes = [...planeLayers.current.entries()].map(([id, layer]) => ({
        id, polygon: ringToLatLon(layer), tiltDeg: layer._sdTilt ?? 35, azimuthDeg: layer._sdAzimuth ?? 0,
        roofType: layer._sdRoofType || "tile",
      }));
      const obstacles = [...obstacleLayers.current.entries()].map(([id, layer]) => ({
        id, polygon: ringToLatLon(layer), kind: layer._sdObstacleKind || "chimney",
      }));
      const markers = [...markerLayers.current.entries()].map(([id, layer]) => {
        const ll = layer.getLatLng();
        return { id, type: layer._sdMarkerType, lat: ll.lat, lon: ll.lng };
      });
      return { planes, obstacles, markers };
    }

    function clearAllLayers() {
      const map = mapRef.current;
      for (const layer of planeLayers.current.values()) map.removeLayer(layer);
      for (const layer of obstacleLayers.current.values()) map.removeLayer(layer);
      for (const layer of markerLayers.current.values()) map.removeLayer(layer);
      planeLayers.current.clear(); obstacleLayers.current.clear(); markerLayers.current.clear();
    }

    // Shared by the initial mount redraw AND undo/redo — one code path that
    // turns a stored/historical {planes,obstacles,markers} snapshot into
    // real map layers.
    function loadSnapshot(snap) {
      clearAllLayers();
      (snap?.planes || []).forEach((pl) => {
        if (!Array.isArray(pl.polygon) || pl.polygon.length < 3) return;
        const layer = Lref.current.polygon(pl.polygon.map(([a, b]) => [a, b])).addTo(mapRef.current);
        attachPlane(layer, pl.id || uid(), pl.tiltDeg, pl.azimuthDeg, pl.roofType);
      });
      (snap?.obstacles || []).forEach((ob) => {
        if (!Array.isArray(ob.polygon) || ob.polygon.length < 3) return;
        const layer = Lref.current.polygon(ob.polygon.map(([a, b]) => [a, b])).addTo(mapRef.current);
        attachObstacle(layer, ob.id || uid(), ob.kind);
      });
      (snap?.markers || []).forEach((mk) => {
        if (mk.lat == null || mk.lon == null || !MARKER_ABBR[mk.type]) return;
        placeMarker([mk.lat, mk.lon], mk.type, mk.id);
      });
      setCounts({
        planes: planeLayers.current.size, obstacles: obstacleLayers.current.size,
        markers: markerLayers.current.size,
      });
      renderDimensionLabels();
    }

    function pushHistory(snap) {
      if (restoringRef.current) return;
      const trimmed = historyRef.current.slice(0, historyIndexRef.current + 1);
      trimmed.push(snap);
      while (trimmed.length > 50) trimmed.shift();
      historyRef.current = trimmed;
      historyIndexRef.current = trimmed.length - 1;
      setCanUndo(historyIndexRef.current > 0);
      setCanRedo(false);
    }

    function restoreHistoryStep(nextIndex) {
      restoringRef.current = true;
      historyIndexRef.current = nextIndex;
      const snap = historyRef.current[nextIndex];
      loadSnapshot(snap);
      onChangeRef.current?.(snap);
      restoringRef.current = false;
      setCanUndo(historyIndexRef.current > 0);
      setCanRedo(historyIndexRef.current < historyRef.current.length - 1);
      clearTimeout(debounceTimer.current);
      debounceTimer.current = setTimeout(() => runAutoLayoutRef.current?.(), 400);
    }
    function undo() { if (historyIndexRef.current > 0) restoreHistoryStep(historyIndexRef.current - 1); }
    function redo() { if (historyIndexRef.current < historyRef.current.length - 1) restoreHistoryStep(historyIndexRef.current + 1); }
    undoRef.current = undo;
    redoRef.current = redo;

    function syncToParent() {
      const snap = currentSnapshot();
      setCounts({ planes: snap.planes.length, obstacles: snap.obstacles.length, markers: snap.markers.length });
      onChangeRef.current?.(snap);
      renderDimensionLabels();
      pushHistory(snap);
      // The geometry moved — any previously fitted panel layout no longer
      // reflects what's actually drawn. Clear the drawing immediately (so a
      // stale layout never looks current) but recompute the real numbers
      // after a short pause, so a mid-drag isn't spending real CPU on every
      // frame.
      panelGroupRef.current?.clearLayers();
      clearTimeout(debounceTimer.current);
      debounceTimer.current = setTimeout(() => runAutoLayoutRef.current?.(), 400);
    }

    async function init() {
      // leaflet-geoman-free's dist bundle references a bare, unimported `L`
      // (it's built to run after Leaflet's own <script> tag, which used to set
      // window.L as a side effect) — it never imports Leaflet itself. Loading
      // it as an ES module via a bundler skips that side effect, so its
      // top-level `L.PM.initialize()` throws "L is not defined" the instant
      // it's evaluated, aborting this whole function before setReady(true)
      // ever runs — the map then sits on "Loading satellite imagery…" forever
      // with no visible error. Leaflet must be imported AND published to
      // window.L first, in that order, before geoman is imported at all.
      const { default: L } = await import("leaflet");
      if (cancelled || !mapEl.current) return;
      window.L = L;
      await import("@geoman-io/leaflet-geoman-free");
      await import("@geoman-io/leaflet-geoman-free/dist/leaflet-geoman.css");
      if (cancelled || !mapEl.current) return;
      Lref.current = L;

      const map = L.map(mapEl.current, { zoomControl: true }).setView([lat, lon], 18);
      mapRef.current = map; // set early: loadSnapshot/clearAllLayers below read it via the ref

      const googleKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
      const googleLayer = googleKey ? await loadGoogleSatelliteLayer(L, googleKey) : null;
      if (googleLayer) {
        googleLayer.addTo(map);
      } else {
        // Esri's real imagery resolution varies a lot by place — most of
        // RO/MD has nothing past ~z18, and requesting further just gets back
        // Esri's own "Map data not yet available" filler tile. maxNativeZoom
        // stops fetching there and lets Leaflet upscale that last real tile
        // instead, so zooming in shows a blurrier roof rather than a blank
        // grid.
        L.tileLayer(
          "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
          { maxZoom: 21, maxNativeZoom: 18, attribution: "Tiles &copy; Esri" }
        ).addTo(map);
      }
      if (cancelled || !mapEl.current) return;
      L.marker([lat, lon]).addTo(map);

      map.pm.addControls({
        position: "topleft",
        drawMarker: false, drawCircleMarker: false, drawCircle: false,
        drawPolyline: false, drawRectangle: false, drawText: false,
        drawPolygon: false, // we supply our own shape buttons below the map
        editMode: true, dragMode: true, removalMode: true,
        cutPolygon: false, rotateMode: false,
      });

      // Redraw whatever was already saved for this project, then seed the
      // undo history so the very first undo step returns to this baseline.
      loadSnapshot(siteDesign);
      historyRef.current = [currentSnapshot()];
      historyIndexRef.current = 0;
      setCanUndo(false); setCanRedo(false);

      map.on("pm:create", (e) => {
        if (e.shape === "Polygon") {
          const kind = pendingKind.current || "plane";
          pendingKind.current = null;
          map.pm.disableDraw("Polygon");
          if (kind === "plane") attachPlane(e.layer, uid());
          else attachObstacle(e.layer, uid());
          syncToParent();
        } else if (e.shape === "Circle") {
          map.pm.disableDraw("Circle");
          const center = e.layer.getLatLng();
          const radiusM = e.layer.getRadius();
          map.removeLayer(e.layer);
          const ring = circleToRing(center, radiusM, 24);
          const poly = L.polygon(ring).addTo(map);
          attachObstacle(poly, uid(), "tree");
          syncToParent();
        }
      });
      map.on("pm:remove", (e) => {
        const id = e.layer?._sdId;
        if (id) {
          planeLayers.current.delete(id); obstacleLayers.current.delete(id); markerLayers.current.delete(id);
          syncToParent();
        }
      });
      map.on("pm:edit pm:dragend pm:markerdragend pm:vertexadded pm:vertexremoved", (e) => {
        if (e.layer?._sdKind) syncToParent();
      });
      map.on("click", (e) => {
        if (pendingMarkerType.current) {
          const type = pendingMarkerType.current;
          pendingMarkerType.current = null;
          map.getContainer().style.cursor = "";
          placeMarker(e.latlng, type);
          syncToParent();
          return;
        }
        if (measuringRef.current) {
          measurePtsRef.current.push(e.latlng);
          if (measurePtsRef.current.length === 1) {
            if (measureLayerRef.current) map.removeLayer(measureLayerRef.current);
            measureLayerRef.current = L.circleMarker(e.latlng, { radius: 4, color: "#2E5BFF" }).addTo(map);
          } else {
            const [p1, p2] = measurePtsRef.current;
            if (measureLayerRef.current) map.removeLayer(measureLayerRef.current);
            measureLayerRef.current = L.polyline([p1, p2], { color: "#2E5BFF", weight: 2, dashArray: "5 5" }).addTo(map);
            setMeasureResult(map.distance(p1, p2));
            measurePtsRef.current = [];
          }
        }
      });
      map.on("popupopen", (e) => {
        const layer = e.popup._source;
        if (layer?._sdMarkerType) {
          const el = e.popup.getElement();
          const btn = el.querySelector(".sd-pop-remove");
          if (btn) btn.onclick = () => {
            map.removeLayer(layer);
            markerLayers.current.delete(layer._sdId);
            syncToParent();
          };
          return;
        }
        if (!layer?._sdKind) return;
        const el = e.popup.getElement();
        if (layer._sdKind === "plane") {
          const roofEl = el.querySelector(".sd-pop-roof");
          if (roofEl) roofEl.onchange = () => { layer._sdRoofType = roofEl.value; syncToParent(); };
          const tiltEl = el.querySelector(".sd-pop-tilt");
          const azEl = el.querySelector(".sd-pop-az");
          const tiltNum = el.querySelector(".sd-pop-tiltnum");
          const azNum = el.querySelector(".sd-pop-aznum");
          const azVal = el.querySelector(".sd-pop-azval");
          // Slider and number box both drive the same value — typing a
          // figure moves the slider too, and vice versa, so neither goes
          // stale while the popup is open.
          const setTilt = (v) => {
            layer._sdTilt = v;
            if (tiltEl) tiltEl.value = v;
            if (tiltNum) tiltNum.value = Math.round(v);
            syncToParent();
          };
          const setAz = (v) => {
            layer._sdAzimuth = v;
            if (azEl) azEl.value = v;
            if (azNum) azNum.value = Math.round(v);
            if (azVal) azVal.textContent = compassLabel(v, lang);
            syncToParent();
          };
          if (tiltEl) tiltEl.oninput = () => setTilt(+tiltEl.value);
          if (tiltNum) tiltNum.oninput = () => { const v = +tiltNum.value; if (!Number.isNaN(v)) setTilt(Math.min(60, Math.max(0, v))); };
          if (azEl) azEl.oninput = () => setAz(+azEl.value);
          if (azNum) azNum.oninput = () => { const v = +azNum.value; if (!Number.isNaN(v)) setAz(Math.min(180, Math.max(-180, v))); };
        } else if (layer._sdKind === "obstacle") {
          const sel = el.querySelector(".sd-pop-kind");
          if (sel) sel.onchange = () => {
            layer._sdObstacleKind = sel.value;
            layer.setStyle?.(sel.value === "tree" ? TREE_STYLE : OBSTACLE_STYLE);
            syncToParent();
          };
        }
      });

      setReady(true);
      // Show real numbers immediately for a roof that was already drawn on a
      // previous visit, instead of waiting for the installer to press the
      // button again.
      if (planeLayers.current.size > 0) setTimeout(() => runAutoLayoutRef.current?.(), 50);
    }

    init().catch((e) => {
      if (cancelled) return;
      console.error("SiteDesigner failed to load:", e?.message || e);
      setLoadError(true);
    });

    return () => {
      cancelled = true;
      clearTimeout(debounceTimer.current);
      mapRef.current?.remove();
      mapRef.current = null;
      planeLayers.current.clear();
      obstacleLayers.current.clear();
      markerLayers.current.clear();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    };
  }, []); // fresh mount every time the modal opens, at the address the project has right now

  function startDraw(kind) {
    pendingKind.current = kind;
    mapRef.current?.pm.enableDraw("Polygon", {
      pathOptions: kind === "plane" ? PLANE_STYLE : OBSTACLE_STYLE,
      snappable: true, snapDistance: 12,
    });
  }
  function startDrawCircle() {
    mapRef.current?.pm.enableDraw("Circle", { pathOptions: TREE_STYLE, snappable: true });
  }
  function toggleMeasure() {
    const map = mapRef.current;
    const next = !measuring;
    if (!next) {
      if (measureLayerRef.current) { map?.removeLayer(measureLayerRef.current); measureLayerRef.current = null; }
      measurePtsRef.current = [];
    } else {
      setMeasureResult(null);
    }
    setMeasuring(next);
    if (map) map.getContainer().style.cursor = next ? "crosshair" : "";
  }
  function armMarkerPlacement() {
    pendingMarkerType.current = markerType;
    if (mapRef.current) mapRef.current.getContainer().style.cursor = "copy";
  }
  function toggleShowDimensions(checked) {
    setShowDimensions(checked);
    showDimensionsRef.current = checked;
    renderDimensionLabelsRef.current?.();
  }

  // Fits the SELECTED panel into every drawn roof plane, skipping every
  // obstacle — replacing autoBom's kw*1000/panelWatt guess with a real,
  // physical count. Draws the result on the map so the installer can see
  // what's assumed before applying it to the quote.
  function runAutoLayout() {
    const L = Lref.current, map = mapRef.current;
    if (!L || !map) return;
    if (planeLayers.current.size === 0) {
      panelGroupRef.current?.clearLayers();
      setLayout(null); // e.g. undo removed the only plane — don't leave a stale result on screen
      return;
    }
    const panel = findPanel(selectedPanelId) || recommendPanel();
    const { w, h } = panel.dimensionsMm || { w: 1909, h: 1134 };
    const obstaclePolys = [...obstacleLayers.current.values()].map(ringToLatLon);
    const fitOpts = {
      orientation,
      rowSpacingM: rowSpacingCm / 100,
      colSpacingM: colSpacingCm / 100,
      marginM: setbackCm / 100,
      clusterMaxWidthM: clusterMaxW > 0 ? clusterMaxW : 0,
      clusterMaxHeightM: clusterMaxH > 0 ? clusterMaxH : 0,
      clusterGapM: clusterGap > 0 ? clusterGap : 0,
    };

    if (!panelGroupRef.current) panelGroupRef.current = L.layerGroup().addTo(map);
    panelGroupRef.current.clearLayers();
    ensurePanelPattern(map);

    let totalCount = 0;
    const perPlane = [];
    for (const [id, layer] of planeLayers.current) {
      const polygon = ringToLatLon(layer);
      // Conventional portrait mounting: the panel's long side (w) runs
      // up-slope, its short side (h) runs along the ridge — orientation/auto
      // then decides which axis actually gets which side.
      const { panels, count, rows } = fitPanels(polygon, obstaclePolys, h, w, fitOpts);
      totalCount += count;
      const [clat, clon] = centroidOf(polygon);
      perPlane.push({
        id, tiltDeg: layer._sdTilt ?? 35, azimuthDeg: layer._sdAzimuth ?? 0,
        roofType: layer._sdRoofType || "tile", lat: clat, lon: clon, count,
      });
      // Rails drawn first, panels on top — same real row geometry
      // lib/mountingEstimate.js sizes the materials list from, just shown
      // instead of counted.
      rows.forEach((r) => {
        L.polyline(r.rail1, { color: "#5B6B7A", weight: 3, opacity: 0.85, interactive: false }).addTo(panelGroupRef.current);
        L.polyline(r.rail2, { color: "#5B6B7A", weight: 3, opacity: 0.85, interactive: false }).addTo(panelGroupRef.current);
      });
      panels.forEach((corners) => {
        L.polygon(corners, { color: "#B9C4CE", weight: 1, fillColor: "url(#sdPanelCells)", fillOpacity: 1, interactive: false })
          .addTo(panelGroupRef.current);
      });
    }
    const kw = Math.round((totalCount * panel.watt / 1000) * 10) / 10;
    setLayout({ totalCount, kw, perPlane, panelId: panel.id, panelBrand: panel.brand, panelModel: panel.model, panelWatt: panel.watt });
  }
  runAutoLayoutRef.current = runAutoLayout;

  // Any layout-affecting setting change recomputes automatically, same as a
  // geometry edit — no separate "apply settings" step to remember.
  useEffect(() => {
    if (!ready || planeLayers.current.size === 0) return;
    clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => runAutoLayoutRef.current?.(), 400);
    return () => clearTimeout(debounceTimer.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, selectedPanelId, orientation, rowSpacingCm, colSpacingCm, setbackCm, clusterMaxW, clusterMaxH, clusterGap]);

  // Real payback/CO2 for the layout's own kWp — same engine call the main
  // quote uses, just with kw swapped, so the two can never disagree.
  const quoteResult = useMemo(
    () => (layout && typeof onComputeQuote === "function" ? onComputeQuote(layout.kw) : null),
    [layout, onComputeQuote]);
  const loc = lang === "en" ? "en-US" : lang === "ru" ? "ru-RU" : "ro-RO";
  const fmtEur = (n) => "€" + Math.round(n).toLocaleString("en-IE");
  let bands = null, prodMonthly = null, consMonthly = null, co2Year = 0;
  if (quoteResult) {
    bands = { pess: quoteResult.p, expc: quoteResult.e, opti: quoteResult.o };
    const shape = Array.isArray(projectInputs?.monthlyYieldShape) && projectInputs.monthlyYieldShape.length === 12
      ? projectInputs.monthlyYieldShape : SOLAR_SEASON;
    const shapeSum = shape.reduce((a, b) => a + (Number(b) || 0), 0) || 1;
    prodMonthly = shape.map((f) => (quoteResult.e.prod0 * (Number(f) || 0)) / shapeSum);
    const consEff = Math.max(0, Number(effectiveConsumption(projectInputs || {})) || 0);
    consMonthly = (projectInputs?.useMonthly && Array.isArray(projectInputs.consMonthly) && projectInputs.consMonthly.length === 12)
      ? projectInputs.consMonthly.map((v) => Number(v) || 0)
      : new Array(12).fill(consEff / 12);
    const co2Factor = CO2_FACTOR[projectInputs?.market] ?? CO2_FACTOR.RO;
    co2Year = quoteResult.e.prod0 * co2Factor;
  }

  return (
    <div className="sd-wrap">
      <div className="sd-toolbar">
        <button type="button" className="btn ghost sm" disabled={!ready || !canUndo}
          onClick={() => undoRef.current?.()} title={t3(lang, "Anulează", "Undo", "Отменить")}>↶</button>
        <button type="button" className="btn ghost sm" disabled={!ready || !canRedo}
          onClick={() => redoRef.current?.()} title={t3(lang, "Refă", "Redo", "Повторить")}>↷</button>
        <button type="button" className="btn ghost sm" onClick={() => startDraw("plane")}>
          {t3(lang, "+ Acoperiș", "+ Roof plane", "+ Скат крыши")}
        </button>
        <button type="button" className="btn ghost sm" onClick={() => startDraw("obstacle")}>
          {t3(lang, "+ Obstacol", "+ Obstacle", "+ Препятствие")}
        </button>
        <button type="button" className="btn ghost sm" onClick={startDrawCircle}>
          {t3(lang, "+ Copac (cerc)", "+ Tree (circle)", "+ Дерево (круг)")}
        </button>
        <button type="button" className="btn amber sm" disabled={counts.planes === 0} onClick={runAutoLayout}>
          {t3(lang, "Așază panourile automat", "Auto-layout panels", "Авторазмещение панелей")}
        </button>
        <span className="sd-counts">
          {t3(lang, `${counts.planes} acoperiș(uri) · ${counts.obstacles} obstacol(e) · ${counts.markers} marker(e)`,
            `${counts.planes} roof plane(s) · ${counts.obstacles} obstacle(s) · ${counts.markers} marker(s)`,
            `${counts.planes} скат(ов) · ${counts.obstacles} препятствий · ${counts.markers} маркеров`)}
        </span>
      </div>

      <div className="sd-toolbar sd-toolbar2">
        <label className="sd-inline">
          {t3(lang, "Panou", "Module", "Модуль")}
          <select className="sd-sel" value={selectedPanelId} onChange={(e) => setSelectedPanelId(e.target.value)}>
            {PANELS.map((pnl) => (
              <option key={pnl.id} value={pnl.id}>{pnl.brand} {pnl.model} · {pnl.watt}W</option>
            ))}
          </select>
        </label>
        <label className="sd-inline">
          {t3(lang, "Orientare", "Orientation", "Ориентация")}
          <select className="sd-sel" value={orientation} onChange={(e) => setOrientation(e.target.value)}>
            <option value="portrait">{t3(lang, "Portret", "Portrait", "Портрет")}</option>
            <option value="landscape">{t3(lang, "Peisaj", "Landscape", "Ландшафт")}</option>
            <option value="auto">{t3(lang, "Automat (maxim)", "Auto (max fit)", "Авто (максимум)")}</option>
          </select>
        </label>
        <label className="sd-check">
          <input type="checkbox" checked={showDimensions} onChange={(e) => toggleShowDimensions(e.target.checked)} />
          {t3(lang, "Arată dimensiunile", "Show dimensions", "Показать размеры")}
        </label>
      </div>

      <div className="sd-toolbar sd-toolbar3">
        <button type="button" className={"btn sm" + (measuring ? " amber" : " ghost")} onClick={toggleMeasure}>
          {measuring
            ? t3(lang, "Anulează măsurarea", "Cancel measuring", "Отменить измерение")
            : t3(lang, "Măsoară distanța", "Measure distance", "Измерить расстояние")}
        </button>
        {measureResult != null && <span className="sd-measure-out">{measureResult.toFixed(1)} m</span>}
        <label className="sd-inline">
          <select className="sd-sel" value={markerType} onChange={(e) => setMarkerType(e.target.value)}>
            {MARKER_TYPES.map((mt) => (
              <option key={mt} value={mt}>{MARKER_LABEL[mt][lang] || MARKER_LABEL[mt].ro}</option>
            ))}
          </select>
        </label>
        <button type="button" className="btn ghost sm" onClick={armMarkerPlacement}>
          {t3(lang, "+ Marker electric", "+ Electrical marker", "+ Электрический маркер")}
        </button>
      </div>

      <div ref={mapEl} className="sd-map" />
      {!ready && (
        <div className="sd-loading">
          {loadError
            ? t3(lang, "Harta nu s-a putut încărca. Reîncearcă.", "The map failed to load. Try again.", "Не удалось загрузить карту. Попробуйте снова.")
            : t3(lang, "Se încarcă imaginea satelitară…", "Loading satellite imagery…", "Загрузка изображения…")}
        </div>
      )}
      {layout && (
        <div className="sd-layout">
          <div>
            <b>{layout.totalCount}</b> {t3(lang, "panouri", "panels", "панелей")} · <b>{layout.kw}</b> kW
            <span className="sd-layout-panel"> · {layout.panelBrand} {layout.panelModel}</span>
            {layout.totalCount === 0 && (
              <div className="sd-layout-empty">
                {t3(lang, "Niciun panou nu încape — verifică dimensiunile acoperișului sau obstacolele.",
                  "No panel fits — check the roof size or the obstacles.",
                  "Ни одна панель не помещается — проверьте размеры крыши или препятствия.")}
              </div>
            )}
          </div>
          <button type="button" className="btn primary sm" disabled={!layout.totalCount || applying}
            onClick={() => onApply?.(layout)}>
            {applying
              ? t3(lang, "Se aplică…", "Applying…", "Применение…")
              : t3(lang, "Aplică la ofertă", "Apply to quote", "Применить к предложению")}
          </button>
        </div>
      )}

      <details className="sd-adv">
        <summary>{t3(lang, "Distanțare și grupare avansată", "Advanced spacing & clustering", "Расширенные настройки")}</summary>
        <div className="sd-adv-grid">
          <label>{t3(lang, "Distanță rânduri (cm)", "Row spacing (cm)", "Расст. рядов (см)")}
            <input type="number" min="0" max="20" value={rowSpacingCm} onChange={(e) => setRowSpacingCm(+e.target.value || 0)} /></label>
          <label>{t3(lang, "Distanță module (cm)", "Module spacing (cm)", "Расст. модулей (см)")}
            <input type="number" min="0" max="20" value={colSpacingCm} onChange={(e) => setColSpacingCm(+e.target.value || 0)} /></label>
          <label>{t3(lang, "Retragere margine (cm)", "Edge setback (cm)", "Отступ от края (см)")}
            <input type="number" min="0" max="100" value={setbackCm} onChange={(e) => setSetbackCm(+e.target.value || 0)} /></label>
          <label>{t3(lang, "Lățime max. grup (m)", "Max cluster width (m)", "Макс. ширина группы (м)")}
            <input type="number" min="0" max="30" value={clusterMaxW} onChange={(e) => setClusterMaxW(+e.target.value || 0)} placeholder="0" /></label>
          <label>{t3(lang, "Înălțime max. grup (m)", "Max cluster height (m)", "Макс. высота группы (м)")}
            <input type="number" min="0" max="30" value={clusterMaxH} onChange={(e) => setClusterMaxH(+e.target.value || 0)} placeholder="0" /></label>
          <label>{t3(lang, "Interval între grupuri (m)", "Gap between clusters (m)", "Промежуток между группами (м)")}
            <input type="number" min="0" max="10" step="0.1" value={clusterGap} onChange={(e) => setClusterGap(+e.target.value || 0)} placeholder="0" /></label>
        </div>
        <p className="sd-adv-hint">
          {t3(lang, "Lasă lățimea/înălțimea grupului pe 0 pentru un singur câmp continuu de panouri.",
            "Leave cluster width/height at 0 for one continuous panel field.",
            "Оставьте ширину/высоту группы на 0 для одного сплошного поля панелей.")}
        </p>
      </details>

      {layout && quoteResult && (
        <div className="sd-results">
          <div className="sd-results-kpis">
            <div><b>{layout.totalCount}</b><span>{t3(lang, "panouri", "panels", "панелей")}</span></div>
            <div><b>{layout.kw}</b><span>kWp</span></div>
            <div><b>{fmtEur(quoteResult.e.cost)}</b><span>{t3(lang, "cost estimat", "estimated cost", "ориент. стоимость")}</span></div>
            <div><b>{quoteResult.e.payback == null ? "25+" : quoteResult.e.payback.toFixed(1)}</b>
              <span>{t3(lang, "ani recuperare (mediu)", "yrs payback (expected)", "лет окупаемости")}</span></div>
            <div><b>{Math.round(co2Year).toLocaleString(loc)} kg</b><span>CO₂ / {t3(lang, "an", "year", "год")}</span></div>
          </div>
          <div className="sd-chart-wrap">
            <div className="sd-chart-box">
              <h5>{t3(lang, "Producție lunară", "Monthly production", "Ежемесячная выработка")}</h5>
              <MonthlySVG prod={prodMonthly} cons={consMonthly} lang={lang} loc={loc} />
            </div>
            <div className="sd-chart-box">
              <h5>{t3(lang, "Flux de numerar", "Cashflow", "Денежный поток")}</h5>
              <CashflowSVG bands={bands} cost={quoteResult.e.cost} horizon={quoteResult.e.horizon} lang={lang} money={fmtEur} />
            </div>
          </div>
        </div>
      )}

      <p className="sd-hint">
        {t3(lang,
          "Desenează conturul unui acoperiș (click pe fiecare colț, apoi click pe primul punct pentru a termina). Apasă pe o formă ca să-i setezi înclinarea și orientarea, sau tipul obstacolului.",
          "Draw a roof plane's outline (click each corner, then click the first point to finish). Click a shape to set its tilt/azimuth, or an obstacle's type.",
          "Обведите контур ската крыши (щёлкайте по углам, затем по первой точке, чтобы завершить). Щёлкните форму, чтобы задать наклон/азимут или тип препятствия.")}
      </p>
      <style dangerouslySetInnerHTML={{ __html: `
        .sd-modal{width:min(1080px,96vw)}
        .sd-wrap{position:relative}
        .sd-toolbar{display:flex;align-items:center;gap:8px;margin-bottom:10px;flex-wrap:wrap}
        .sd-toolbar2,.sd-toolbar3{display:flex;align-items:center;gap:14px;margin-bottom:10px;flex-wrap:wrap}
        .sd-inline{display:flex;align-items:center;gap:6px;font-size:12.5px;color:var(--muted)}
        .sd-check{display:flex;align-items:center;gap:6px;font-size:12.5px;color:var(--muted);cursor:pointer}
        .sd-check input{cursor:pointer}
        .sd-sel{padding:4px 6px;font-size:12.5px;border:1px solid #ccc;border-radius:6px;color-scheme:light;
          background:#fff;color:#222;max-width:220px}
        .sd-measure-out{font-size:12.5px;font-weight:600;color:#2E5BFF;font-variant-numeric:tabular-nums}
        .sd-counts{font-size:12px;color:var(--muted);margin-left:auto}
        .sd-map{width:100%;height:520px;border-radius:12px;overflow:hidden;background:#e8e8e8}
        .sd-loading{position:absolute;inset:0;display:grid;place-items:center;font-size:13px;color:var(--muted);
          background:rgba(255,255,255,.6);pointer-events:none}
        .sd-hint{font-size:12.5px;color:var(--muted);margin-top:10px;line-height:1.5}
        .sd-layout{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-top:12px;
          padding:10px 13px;background:var(--paper,#f5f5f0);border:1px solid var(--line,#ddd);border-radius:10px;
          font-size:13.5px;flex-wrap:wrap}
        .sd-layout-panel{color:var(--muted);font-size:12px}
        .sd-layout-empty{font-size:12px;color:#B4472F;margin-top:3px}
        .sd-adv{margin-top:10px;font-size:12.5px}
        .sd-adv summary{cursor:pointer;color:var(--muted)}
        .sd-adv-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:10px;margin-top:8px}
        .sd-adv-grid label{display:flex;flex-direction:column;gap:3px;font-size:11.5px;color:#555}
        .sd-adv-grid input{padding:4px 6px;font-size:12.5px;border:1px solid #ccc;border-radius:6px;color-scheme:light;
          background:#fff;color:#222;font-variant-numeric:tabular-nums}
        .sd-adv-hint{color:var(--muted);font-size:11.5px;margin-top:6px}
        .sd-marker-dot{width:24px;height:24px;border-radius:50%;background:#B4472F;color:#fff;display:flex;
          align-items:center;justify-content:center;font-size:9px;font-weight:700;border:2px solid #fff;
          box-shadow:0 1px 3px rgba(0,0,0,.4);cursor:move}
        .sd-dim-label{background:rgba(20,20,20,.82);color:#fff;font-size:10px;font-weight:700;padding:2px 6px;
          border-radius:4px;white-space:nowrap;display:inline-block;font-variant-numeric:tabular-nums}
        .sd-results{margin-top:16px;border-top:1px solid var(--line,#ddd);padding-top:14px}
        .sd-results-kpis{display:flex;gap:16px;flex-wrap:wrap;margin-bottom:12px}
        .sd-results-kpis div{display:flex;flex-direction:column;gap:2px;font-size:12px;color:var(--muted)}
        .sd-results-kpis b{font-size:16px;font-variant-numeric:tabular-nums}
        .sd-chart-wrap{display:flex;gap:16px;flex-wrap:wrap}
        .sd-chart-box{flex:1;min-width:280px}
        .sd-chart-box h5{font-size:12px;color:var(--muted);margin:0 0 6px}
        .sd-chart-box .p-chart{width:100%;height:auto;display:block;border:1px solid #E5E2D6;border-radius:8px;background:#FCFBF7}
        .sd-pop{min-width:200px;font-size:12.5px}
        .sd-pop-row{display:flex;flex-direction:column;gap:4px;margin-bottom:8px}
        .sd-pop-row:last-child{margin-bottom:0}
        .sd-pop-row label{font-weight:600;color:#333}
        /* The popup itself is Leaflet's own chrome — always white, regardless
           of the app's own light/dark theme — but a plain native input still
           takes its dark/light rendering from the PAGE's color-scheme, not
           the popup's background. Pin it, or these go dark-on-dark under the
           app's dark mode. */
        .sd-pop-row select{width:100%;padding:4px;font-size:12.5px;color-scheme:light;
          background:#fff;color:#222;border:1px solid #ccc;border-radius:6px}
        .sd-pop-remove{width:100%;padding:6px;font-size:12px;color:#B4472F;background:#fff;
          border:1px solid #B4472F;border-radius:6px;cursor:pointer}
        .sd-pop-val{font-variant-numeric:tabular-nums;color:#555}
        .sd-pop-inrow{display:flex;align-items:center;gap:8px}
        .sd-pop-inrow input[type=range]{flex:1;min-width:0}
        .sd-pop-inrow input[type=number]{width:52px;flex:none;text-align:right;font-size:12.5px;
          padding:3px 5px;border:1px solid #ccc;border-radius:6px;font-variant-numeric:tabular-nums;
          color-scheme:light;background:#fff;color:#222}
      ` }} />
    </div>
  );
}
