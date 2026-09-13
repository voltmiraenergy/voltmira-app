"use client";
// components/SiteDesigner.jsx — the roof survey surface. Every quote today
// assumes one flat plane at a hardcoded 35°-south tilt (see engine/pvgis.js's
// defaults) and derives panel count backwards from a kW slider
// (lib/supplierCatalog.js's autoBom: kw*1000/panelWatt) instead of from
// anything that actually fits on the roof. This component is where that gets
// fixed: the installer draws the roof (one or more planes, each with its own
// tilt/azimuth) and its obstacles on real satellite imagery.
//
// Esri World Imagery, not Google/Mapbox: free, no API key or billing account,
// good enough resolution for outlining a roof. Leaflet + leaflet-geoman are
// loaded dynamically inside an effect (not a static top-level import) because
// they touch `window` at load time and this file is server-rendered on first
// paint. Auto panel-layout (fitting panels into a plane minus its obstacles)
// is a later pass — see lib/roofLayout.js once it exists; this pass only
// captures the geometry an installer draws, with tilt/azimuth per plane.
import { useEffect, useRef, useState } from "react";
import "leaflet/dist/leaflet.css";
import { fitPanels, compassLabel } from "../lib/roofLayout.js";
import { recommendPanel } from "../lib/supplierCatalog.js";

const t3 = (lang, ro, en, ru) => (lang === "en" ? en : lang === "ru" ? ru : ro);

const PLANE_STYLE = { color: "#2E7D5B", weight: 2, fillColor: "#2E7D5B", fillOpacity: 0.18 };
const OBSTACLE_STYLE = { color: "#B4472F", weight: 2, fillColor: "#B4472F", fillOpacity: 0.35 };

const OBSTACLE_KINDS = ["chimney", "vent", "dormer", "other"];
const KIND_LABEL = {
  chimney: { ro: "Coș", en: "Chimney", ru: "Дымоход" },
  vent: { ro: "Ventilație", en: "Vent", ru: "Вентиляция" },
  dormer: { ro: "Lucarnă", en: "Dormer", ru: "Слуховое окно" },
  other: { ro: "Altul", en: "Other", ru: "Другое" },
};

function uid() { return Math.random().toString(36).slice(2, 10); }

function planePopupHtml(layer, lang) {
  const tilt = layer._sdTilt ?? 35;
  const az = layer._sdAzimuth ?? 0;
  // A drag can't land on an exact degree — a paired number box lets the
  // installer type a figure from a real site survey instead of hunting for
  // it on the slider.
  return `<div class="sd-pop">
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

function ringToLatLon(layer) {
  const ring = layer.getLatLngs()[0] || [];
  return ring.map((ll) => [ll.lat, ll.lng]);
}

function centroidOf(ring) {
  let sx = 0, sy = 0;
  for (const [a, b] of ring) { sx += a; sy += b; }
  return [sx / ring.length, sy / ring.length];
}

export default function SiteDesigner({ lang, lat, lon, siteDesign, onChange, onApply, applying = false }) {
  const mapEl = useRef(null);
  const mapRef = useRef(null);
  const Lref = useRef(null);
  const planeLayers = useRef(new Map());
  const obstacleLayers = useRef(new Map());
  const panelGroupRef = useRef(null);
  const pendingKind = useRef(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const [ready, setReady] = useState(false);
  const [counts, setCounts] = useState({ planes: 0, obstacles: 0 });
  const [layout, setLayout] = useState(null);

  useEffect(() => {
    let cancelled = false;

    function syncToParent() {
      const planes = [...planeLayers.current.entries()].map(([id, layer]) => ({
        id, polygon: ringToLatLon(layer), tiltDeg: layer._sdTilt ?? 35, azimuthDeg: layer._sdAzimuth ?? 0,
      }));
      const obstacles = [...obstacleLayers.current.entries()].map(([id, layer]) => ({
        id, polygon: ringToLatLon(layer), kind: layer._sdObstacleKind || "chimney",
      }));
      setCounts({ planes: planes.length, obstacles: obstacles.length });
      onChangeRef.current?.({ planes, obstacles });
      // The geometry moved — any previously fitted panel layout no longer
      // reflects what's actually drawn, so it must be redone before applying.
      setLayout(null);
      panelGroupRef.current?.clearLayers();
    }

    function attachPlane(layer, id, tiltDeg, azimuthDeg) {
      layer._sdKind = "plane"; layer._sdId = id;
      layer._sdTilt = tiltDeg ?? 35; layer._sdAzimuth = azimuthDeg ?? 0;
      layer.setStyle?.(PLANE_STYLE);
      layer.bindPopup(planePopupHtml(layer, lang));
      planeLayers.current.set(id, layer);
    }
    function attachObstacle(layer, id, kind) {
      layer._sdKind = "obstacle"; layer._sdId = id;
      layer._sdObstacleKind = kind || "chimney";
      layer.setStyle?.(OBSTACLE_STYLE);
      layer.bindPopup(obstaclePopupHtml(layer, lang));
      obstacleLayers.current.set(id, layer);
    }

    (async () => {
      const [{ default: L }] = await Promise.all([
        import("leaflet"),
        import("@geoman-io/leaflet-geoman-free"),
      ]);
      await import("@geoman-io/leaflet-geoman-free/dist/leaflet-geoman.css");
      if (cancelled || !mapEl.current) return;
      Lref.current = L;

      // Esri's real imagery resolution varies a lot by place — most of RO/MD
      // has nothing past ~z18, and requesting further just gets back Esri's
      // own "Map data not yet available" filler tile. maxNativeZoom stops
      // fetching there and lets Leaflet upscale that last real tile instead,
      // so zooming in shows a blurrier roof rather than a blank grid.
      const map = L.map(mapEl.current, { zoomControl: true }).setView([lat, lon], 18);
      L.tileLayer(
        "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
        { maxZoom: 21, maxNativeZoom: 18, attribution: "Tiles &copy; Esri" }
      ).addTo(map);
      L.marker([lat, lon]).addTo(map);

      map.pm.addControls({
        position: "topleft",
        drawMarker: false, drawCircleMarker: false, drawCircle: false,
        drawPolyline: false, drawRectangle: false, drawText: false,
        drawPolygon: false, // we supply our own two polygon buttons below the map
        editMode: true, dragMode: true, removalMode: true,
        cutPolygon: false, rotateMode: false,
      });

      // Redraw whatever was already saved for this project.
      (siteDesign?.planes || []).forEach((pl) => {
        if (!Array.isArray(pl.polygon) || pl.polygon.length < 3) return;
        const layer = L.polygon(pl.polygon.map(([a, b]) => [a, b])).addTo(map);
        attachPlane(layer, pl.id || uid(), pl.tiltDeg, pl.azimuthDeg);
      });
      (siteDesign?.obstacles || []).forEach((ob) => {
        if (!Array.isArray(ob.polygon) || ob.polygon.length < 3) return;
        const layer = L.polygon(ob.polygon.map(([a, b]) => [a, b])).addTo(map);
        attachObstacle(layer, ob.id || uid(), ob.kind);
      });
      setCounts({ planes: planeLayers.current.size, obstacles: obstacleLayers.current.size });

      map.on("pm:create", (e) => {
        if (e.shape !== "Polygon") return;
        const kind = pendingKind.current || "plane";
        pendingKind.current = null;
        map.pm.disableDraw("Polygon");
        if (kind === "plane") attachPlane(e.layer, uid());
        else attachObstacle(e.layer, uid());
        syncToParent();
      });
      map.on("pm:remove", (e) => {
        const id = e.layer?._sdId;
        if (id) { planeLayers.current.delete(id); obstacleLayers.current.delete(id); syncToParent(); }
      });
      map.on("pm:edit pm:dragend pm:markerdragend pm:vertexadded pm:vertexremoved", (e) => {
        if (e.layer?._sdKind) syncToParent();
      });
      map.on("popupopen", (e) => {
        const layer = e.popup._source;
        if (!layer?._sdKind) return;
        const el = e.popup.getElement();
        if (layer._sdKind === "plane") {
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
          if (sel) sel.onchange = () => { layer._sdObstacleKind = sel.value; syncToParent(); };
        }
      });

      mapRef.current = map;
      setReady(true);
    })();

    return () => {
      cancelled = true;
      mapRef.current?.remove();
      mapRef.current = null;
      planeLayers.current.clear();
      obstacleLayers.current.clear();
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

  // Fits the installer's actually-recommended panel into every drawn roof
  // plane, skipping every obstacle — replacing autoBom's kw*1000/panelWatt
  // guess with a real, physical count. Draws the result on the map so the
  // installer can see what's assumed before applying it to the quote.
  function runAutoLayout() {
    const L = Lref.current, map = mapRef.current;
    if (!L || !map || planeLayers.current.size === 0) return;
    const panel = recommendPanel();
    const { w, h } = panel.dimensionsMm || { w: 1909, h: 1134 };
    const obstaclePolys = [...obstacleLayers.current.values()].map(ringToLatLon);

    if (!panelGroupRef.current) panelGroupRef.current = L.layerGroup().addTo(map);
    panelGroupRef.current.clearLayers();

    let totalCount = 0;
    const perPlane = [];
    for (const [id, layer] of planeLayers.current) {
      const polygon = ringToLatLon(layer);
      // Conventional portrait mounting: the panel's long side (w) runs
      // up-slope, its short side (h) runs along the ridge.
      const { panels, count } = fitPanels(polygon, obstaclePolys, h, w, { orientation: "portrait" });
      totalCount += count;
      const [clat, clon] = centroidOf(polygon);
      perPlane.push({ id, tiltDeg: layer._sdTilt ?? 35, azimuthDeg: layer._sdAzimuth ?? 0, lat: clat, lon: clon, count });
      panels.forEach((corners) => {
        L.polygon(corners, { color: "#2E5BFF", weight: 1, fillColor: "#2E5BFF", fillOpacity: 0.45, interactive: false })
          .addTo(panelGroupRef.current);
      });
    }
    const kw = Math.round((totalCount * panel.watt / 1000) * 10) / 10;
    setLayout({ totalCount, kw, perPlane, panelBrand: panel.brand, panelModel: panel.model, panelWatt: panel.watt });
  }

  return (
    <div className="sd-wrap">
      <div className="sd-toolbar">
        <button type="button" className="btn ghost sm" onClick={() => startDraw("plane")}>
          {t3(lang, "+ Acoperiș", "+ Roof plane", "+ Скат крыши")}
        </button>
        <button type="button" className="btn ghost sm" onClick={() => startDraw("obstacle")}>
          {t3(lang, "+ Obstacol", "+ Obstacle", "+ Препятствие")}
        </button>
        <button type="button" className="btn amber sm" disabled={counts.planes === 0} onClick={runAutoLayout}>
          {t3(lang, "Așază panourile automat", "Auto-layout panels", "Авторазмещение панелей")}
        </button>
        <span className="sd-counts">
          {t3(lang, `${counts.planes} acoperiș(uri) · ${counts.obstacles} obstacol(e)`,
            `${counts.planes} roof plane(s) · ${counts.obstacles} obstacle(s)`,
            `${counts.planes} скат(ов) · ${counts.obstacles} препятствий`)}
        </span>
      </div>
      <div ref={mapEl} className="sd-map" />
      {!ready && (
        <div className="sd-loading">
          {t3(lang, "Se încarcă imaginea satelitară…", "Loading satellite imagery…", "Загрузка изображения…")}
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
      <p className="sd-hint">
        {t3(lang,
          "Desenează conturul unui acoperiș (click pe fiecare colț, apoi click pe primul punct pentru a termina). Apasă pe o formă ca să-i setezi înclinarea și orientarea, sau tipul obstacolului.",
          "Draw a roof plane's outline (click each corner, then click the first point to finish). Click a shape to set its tilt/azimuth, or an obstacle's type.",
          "Обведите контур ската крыши (щёлкайте по углам, затем по первой точке, чтобы завершить). Щёлкните форму, чтобы задать наклон/азимут или тип препятствия.")}
      </p>
      <style dangerouslySetInnerHTML={{ __html: `
        .sd-modal{width:min(920px,96vw)}
        .sd-wrap{position:relative}
        .sd-toolbar{display:flex;align-items:center;gap:8px;margin-bottom:10px;flex-wrap:wrap}
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
