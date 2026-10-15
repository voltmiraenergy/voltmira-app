"use client";
// components/portfolio/SitePicker.jsx — choose where a plant stands by
// clicking a map: satellite imagery to see the fields and roads, or the quiet
// grey base. A click or a dragged pin sets the point; the search box finds a
// village in Moldova or takes pasted coordinates. The portfolio's other assets
// show as grey dots, so a new plant is not placed on top of one. OpenStreetMap
// names the village under the point (lib/geoActions.js placeAt), and a point
// outside Moldova is pointed out. Used to move a plant (PlantsPanel's "Choose
// on the map") and to add one where the user clicks. Leaflet loads
// client-side only, as in components/portfolio/AssetMap.jsx.
import { useEffect, useRef, useState } from "react";
import "leaflet/dist/leaflet.css";
import { TILES, TILE_ATTRIBUTION } from "../../lib/portfolioMap.js";
import { parseCoords, roundPos, kmBetween, DRIFT_KM } from "../../lib/sitePick.js";
import { placeAt, findPlaces } from "../../lib/geoActions.js";
import { plt } from "../../lib/plantText.js";
import { num as fnum } from "../../lib/portfolioFormat.js";

const ESRI = "https://server.arcgisonline.com/ArcGIS/rest/services";
const SAT = `${ESRI}/World_Imagery/MapServer/tile/{z}/{y}/{x}`;
// village names drawn over the imagery
const SAT_LABELS = `${ESRI}/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}`;
const MOLDOVA = [47.0, 28.6];
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

/**
 * @param {object} p
 * @param {string} p.id                 unique per picker on the page
 * @param {{lat:number,lon:number}|null} p.start  where the plant is now
 * @param {Array<{name:string,lat:number,lon:number}>} p.others  the portfolio's other located assets
 * @param {string} p.locality           the plant's locality now
 * @param {boolean} p.hasParts          the plant has wind or solar to look up again
 * @param {"move"|"add"} p.mode
 * @param {(r:{lat:number,lon:number,locality:string|null,rescreen:boolean}) => void} p.onPick
 */
export default function SitePicker({ id, lang = "en", start = null, others = [], locality = "", hasParts = false, mode = "move", onPick, onCancel }) {
  const el = useRef(null);
  const st = useRef({ map: null, L: null, layers: [], pin: null });
  const [pt, setPt] = useState(start);
  const [base, setBase] = useState("sat");
  const [place, setPlace] = useState(null);
  const [looking, setLooking] = useState(false);
  const [q, setQ] = useState("");
  const [hits, setHits] = useState(null);
  const [findMsg, setFindMsg] = useState(null);
  const [setLocTick, setSetLocTick] = useState(null);   // null until the user decides
  const [rescreen, setRescreen] = useState(true);
  const [ready, setReady] = useState(false);   // the map exists: the pin can be drawn
  const seq = useRef(0);

  // the map, once
  useEffect(() => {
    let cancelled = false, sizer = null;
    const s = st.current;
    (async () => {
      const { default: L } = await import("leaflet");
      if (cancelled || !el.current) return;
      const map = L.map(el.current, { scrollWheelZoom: true, maxZoom: 18, zoomSnap: 0.25, zoomDelta: 0.5 });
      map.attributionControl.setPrefix(false);
      s.map = map; s.L = L;
      map.on("click", (e) => setPt({ lat: roundPos(e.latlng.lat), lon: roundPos(e.latlng.lng) }));
      const dots = others.filter((o) => Number.isFinite(o.lat) && Number.isFinite(o.lon));
      for (const o of dots) {
        L.circleMarker([o.lat, o.lon], { radius: 6, color: "#ffffff", weight: 2, fillColor: "#5B6A62", fillOpacity: 0.95, interactive: true })
          .bindTooltip(esc(o.name), { direction: "top", offset: [0, -6], permanent: dots.length <= 8, className: "pk-dot-label" })
          .addTo(map);
      }
      if (start) map.setView([start.lat, start.lon], 13);
      else if (dots.length > 1) map.fitBounds(L.latLngBounds(dots.map((o) => [o.lat, o.lon])), { padding: [40, 40], maxZoom: 11 });
      else if (dots.length === 1) map.setView([dots[0].lat, dots[0].lon], 11);
      else map.setView(MOLDOVA, 7);
      s.ready = true;
      drawTiles(s, "sat");
      setReady(true);
      if (typeof ResizeObserver !== "undefined") {
        sizer = new ResizeObserver(() => map.invalidateSize());
        sizer.observe(el.current);
      }
    })();
    return () => {
      cancelled = true;
      sizer?.disconnect();
      s.map?.remove();
      Object.assign(s, { map: null, L: null, layers: [], pin: null, ready: false });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // the base map
  useEffect(() => { if (st.current.ready) drawTiles(st.current, base); }, [base]);

  // the pin follows the chosen point; dragging it moves the point
  useEffect(() => {
    const s = st.current;
    if (!s.map || !s.L) return;
    if (!pt) { s.pin?.remove(); s.pin = null; return; }
    if (s.pin) { s.pin.setLatLng([pt.lat, pt.lon]); return; }
    const icon = s.L.divIcon({ className: "pk-pin-wrap", html: '<span class="pk-pin"></span>', iconSize: [24, 24], iconAnchor: [12, 12] });
    s.pin = s.L.marker([pt.lat, pt.lon], { icon, draggable: true, keyboard: false, title: plt("pick_h", lang) }).addTo(s.map);
    s.pin.on("dragend", () => { const ll = s.pin.getLatLng(); setPt({ lat: roundPos(ll.lat), lon: roundPos(ll.lng) }); });
  }, [pt, lang, ready]);

  // the village under the point, a moment after it stops moving
  useEffect(() => {
    if (!pt) return undefined;
    const n = ++seq.current;
    const t = setTimeout(async () => {
      setLooking(true);
      const r = await placeAt(pt.lat, pt.lon, lang).catch(() => null);
      if (n !== seq.current) return;
      setLooking(false);
      setPlace(r && r.ok ? r.place : null);
    }, 450);
    return () => clearTimeout(t);
  }, [pt, lang]);

  async function search(e) {
    e.preventDefault();
    setFindMsg(null); setHits(null);
    const c = parseCoords(q);
    const map = st.current.map;
    if (c) { setPt(c); map?.setView([c.lat, c.lon], 14); return; }
    if (q.trim().length < 2) return;
    const r = await findPlaces(q, lang).catch(() => null);
    if (!r || !r.ok) { setFindMsg(plt("pick_geofail", lang)); return; }
    if (!r.places.length) { setFindMsg(plt("pick_noplace", lang, { q: q.trim() })); return; }
    map?.setView([r.places[0].lat, r.places[0].lon], 13);
    setHits(r.places.length > 1 ? r.places : null);
  }

  const movedKm = start && pt ? kmBetween(start, pt) : null;
  const far = movedKm == null ? !!pt : movedKm > DRIFT_KM;
  const newLoc = place && place.locality && place.locality !== locality ? place.locality : null;
  const setLoc = setLocTick == null ? !locality || far : setLocTick;
  const offerRescreen = hasParts && mode === "move" && far;
  const posText = pt ? `${fnum(pt.lat, lang, 5)}, ${fnum(pt.lon, lang, 5)}` : "";

  return (
    <div className="pk" role="group" aria-labelledby={`pk-h-${id}`}>
      <div className="pk-top">
        <h5 id={`pk-h-${id}`}>{plt(mode === "add" ? "pick_add" : "pick_h", lang)}</h5>
        <div className="pk-base" role="group" aria-label={plt("pick_sat", lang)}>
          {["sat", "map"].map((b) => (
            <button key={b} type="button" className={"btn ghost sm" + (base === b ? " on" : "")} aria-pressed={base === b} onClick={() => setBase(b)}>
              {plt(b === "sat" ? "pick_sat" : "pick_map", lang)}
            </button>
          ))}
        </div>
      </div>
      <p className="pf-hint">{plt("pick_hint", lang)}</p>
      {/* not a <form>: the picker also sits inside the guided start's form (a form in a form is
          invalid HTML), so Enter in the box searches here and never submits the page's form */}
      <div className="pk-search" role="search">
        <label htmlFor={`pk-q-${id}`} className="pk-vh">{plt("pick_search", lang)}</label>
        <input id={`pk-q-${id}`} className="input" value={q} onChange={(e) => setQ(e.target.value)} placeholder={plt("pick_search", lang)}
          onKeyDown={(e) => { if (e.key === "Enter") search(e); }} />
        <button type="button" className="btn sm" onClick={search}>{plt("pick_go", lang)}</button>
      </div>
      {findMsg && <small className="pf-warn" role="status">{findMsg}</small>}
      {hits && (
        <div className="pk-hits">
          {hits.map((h, i) => (
            <button key={i} type="button" className="btn ghost sm" onClick={() => st.current.map?.setView([h.lat, h.lon], 13)}>
              {h.name}{h.detail ? `, ${h.detail}` : ""}
            </button>
          ))}
        </div>
      )}
      <div ref={el} className="pk-map" role="application" aria-label={plt("pick_hint", lang)} />
      <div className="pk-out" aria-live="polite">
        <p className="pl-line">{pt ? plt("pick_at", lang, { pos: posText }) : plt("pick_none", lang)}
          {movedKm != null && movedKm > 0.05 ? <small> {plt("pick_moved", lang, { km: fnum(movedKm, lang, 1) })}</small> : null}</p>
        {pt && looking && <small className="pf-hint">{plt("pick_looking", lang)}</small>}
        {pt && !looking && place && (place.locality || place.district) && (
          <small className="pf-hint">{place.locality ? plt("pick_near", lang, { x: place.locality, d: place.district }).replace(/, $/, "") : place.district}</small>
        )}
        {pt && !looking && place && place.country && place.country !== "md" && <p className="pf-warn">{plt("pick_outside", lang)}</p>}
        {pt && newLoc && (
          <label className="pk-check" htmlFor={`pk-loc-${id}`}>
            <input id={`pk-loc-${id}`} type="checkbox" checked={setLoc} onChange={(e) => setSetLocTick(e.target.checked)} />
            {plt("pick_set_loc", lang, { x: newLoc })}
          </label>
        )}
        {pt && offerRescreen && (
          <label className="pk-check" htmlFor={`pk-rs-${id}`}>
            <input id={`pk-rs-${id}`} type="checkbox" checked={rescreen} onChange={(e) => setRescreen(e.target.checked)} />
            {plt("pick_rescreen", lang)}
          </label>
        )}
      </div>
      <div className="pl-row">
        <button type="button" className="btn primary sm" disabled={!pt}
          onClick={() => onPick({ lat: pt.lat, lon: pt.lon, locality: setLoc && newLoc ? newLoc : null, rescreen: offerRescreen && rescreen })}>
          {plt(mode === "add" ? "pick_create" : "pick_use", lang)}
        </button>
        <button type="button" className="btn ghost sm" onClick={onCancel}>{plt("pick_cancel", lang)}</button>
      </div>
    </div>
  );
}

/** Satellite imagery with village names over it, or the quiet grey base in the app's theme. */
function drawTiles(s, base) {
  const { map, L } = s;
  if (!map || !L) return;
  s.layers.forEach((l) => l.remove());
  if (base === "sat") {
    s.layers = [
      L.tileLayer(SAT, { maxZoom: 18, attribution: "Tiles © Esri" }).addTo(map),
      L.tileLayer(SAT_LABELS, { maxZoom: 18 }).addTo(map),
    ];
  } else {
    const set = document.documentElement.getAttribute("data-theme") === "dark" ? TILES.dark : TILES.light;
    s.layers = [
      L.tileLayer(set.base, { maxZoom: 18, maxNativeZoom: 16, attribution: TILE_ATTRIBUTION }).addTo(map),
      L.tileLayer(set.ref, { maxZoom: 18, maxNativeZoom: 16 }).addTo(map),
    ];
  }
}
