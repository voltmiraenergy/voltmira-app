// lib/mapLabels.js — place and road names over satellite imagery, for the
// roof designer (components/SiteDesigner.jsx), the plant designer
// (components/portfolio/PlantDesigner.jsx) and the printed site plan
// (components/portfolio/SiteLayoutPlan.jsx): Esri's reference layers, roads
// with their names and towns and villages, transparent tiles drawn over the
// imagery. Esri has them to zoom 19 over Moldova; past it Leaflet stretches
// the last one. Pure.

const ESRI = "https://server.arcgisonline.com/ArcGIS/rest/services";

/** Roads with their names, then towns, villages and boundaries, bottom to top. */
export const LABEL_TILES = [
  `${ESRI}/Reference/World_Transportation/MapServer/tile/{z}/{y}/{x}`,
  `${ESRI}/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}`,
];

/** The deepest zoom the label tiles exist at. */
export const LABEL_MAX_NATIVE = 19;

const PREF = "vm-map-names";
/** Whether this person last left the names on (on by default). */
export function namesPref() {
  try { return localStorage.getItem(PREF) !== "off"; } catch { return true; }
}
export function setNamesPref(on) {
  try { localStorage.setItem(PREF, on ? "on" : "off"); } catch { /* storage blocked */ }
}

/** A Leaflet layer group of the label tiles, above whatever imagery is already on the map. */
export function labelLayer(L, { maxZoom = 21 } = {}) {
  return L.layerGroup(LABEL_TILES.map((url) => L.tileLayer(url, { maxZoom, maxNativeZoom: LABEL_MAX_NATIVE, opacity: 0.95 })));
}
