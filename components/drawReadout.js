// components/drawReadout.js — while an outline is being drawn on a Leaflet +
// leaflet-geoman map (the roof designer, the site planner), a small label next
// to the cursor gives the length of the edge being drawn and, from the third
// corner on, the area the outline would close to. Imagery is often soft past
// zoom 18, so a number beats eyeballing an edge. Browser only; uses window.L.

const R = 6371008.8;

/** The area of a ring of Leaflet latlngs, m2 (flat frame round its first corner; fine for a roof or a farm). */
export function ringAreaM2(pts) {
  if (!pts || pts.length < 3) return 0;
  const k = Math.PI / 180, lat0 = pts[0].lat;
  const xy = pts.map((p) => [(p.lng - pts[0].lng) * k * R * Math.cos(lat0 * k), (p.lat - lat0) * k * R]);
  let a = 0;
  for (let i = 0; i < xy.length; i++) { const p = xy[i], q = xy[(i + 1) % xy.length]; a += p[0] * q[1] - q[0] * p[1]; }
  return Math.abs(a) / 2;
}

/**
 * Show the readout for the next polygon drawn on `map`, until it is finished
 * or drawing stops. Returns a function that removes it.
 * @param {any} map  a Leaflet map with leaflet-geoman
 * @param {(lengthM:number, areaM2:number|null) => string} text  what the label says
 */
export function drawReadout(map, text) {
  const L = typeof window !== "undefined" ? window.L : null;
  if (!L || !map) return () => {};
  let layer = null, label = null;
  const pts = () => {
    const ll = layer?.getLatLngs?.();
    return Array.isArray(ll) ? (Array.isArray(ll[0]) ? ll[0] : ll) : [];
  };
  // where the next corner would go: the snapped hint marker when geoman has one, else the cursor
  const cursorAt = (e) => map.pm?.Draw?.Polygon?._hintMarker?.getLatLng?.() || e.latlng;
  const onMove = (e) => {
    const p = pts();
    if (!p.length) { if (label) { map.removeLayer(label); label = null; } return; }
    const at = cursorAt(e);
    const len = map.distance(p[p.length - 1], at);
    const area = p.length >= 2 ? ringAreaM2([...p, at]) : null;
    const html = `<span class="sd-dim-label sd-live">${text(len, area)}</span>`;
    if (!label) label = L.marker(at, { interactive: false, keyboard: false, icon: L.divIcon({ className: "sd-dim-icon", html, iconSize: null, iconAnchor: [-14, 26] }) }).addTo(map);
    else { label.setLatLng(at); const el = label.getElement(); if (el) el.innerHTML = html; }
  };
  const onStart = (e) => { layer = e.workingLayer || null; };
  const stop = () => {
    map.off("mousemove", onMove); map.off("pm:drawstart", onStart); map.off("pm:drawend", stop);
    if (label) { map.removeLayer(label); label = null; }
    layer = null;
  };
  map.on("pm:drawstart", onStart);
  map.on("mousemove", onMove);
  map.on("pm:drawend", stop);
  return stop;
}

// The drawing tool's own hints, in the app's words: the library's speak of
// "vertices" and "markers" (in Romanian, half in English).
const TIPS = {
  en: { firstVertex: "Click the first corner", continueLine: "Click the next corner", finishPoly: "Click the first corner to close the shape", startCircle: "Click the trunk", finishCircle: "Click the edge of the crown" },
  ro: { firstVertex: "Apasă pe primul colț", continueLine: "Apasă pe colțul următor", finishPoly: "Apasă pe primul colț ca să închizi forma", startCircle: "Apasă pe trunchi", finishCircle: "Apasă pe marginea coroanei" },
  ru: { firstVertex: "Нажмите на первый угол", continueLine: "Нажмите на следующий угол", finishPoly: "Нажмите на первый угол, чтобы замкнуть фигуру", startCircle: "Нажмите на ствол", finishCircle: "Нажмите на край кроны" },
  uk: { firstVertex: "Натисніть на перший кут", continueLine: "Натисніть на наступний кут", finishPoly: "Натисніть на перший кут, щоб замкнути фігуру", startCircle: "Натисніть на стовбур", finishCircle: "Натисніть на край крони" },
};

/** Set leaflet-geoman to the app's language, with the app's own drawing hints. */
export function drawLang(map, lang) {
  const code = lang === "ru" ? "ru" : lang === "uk" ? "ua" : lang === "ro" ? "ro" : "en";
  map?.pm?.setLang(code, { tooltips: TIPS[lang] || TIPS.en }, code);
}
