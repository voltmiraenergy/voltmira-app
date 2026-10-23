// components/photoLayer.js — a photo laid over the satellite map, turned and sized on the ground
// (lib/photoPlace.js). Leaflet's own image overlay only takes an upright box, and a drone photo is hardly ever
// aligned to north, so this layer sets the picture's position, size and turn itself. It sits in its own pane
// between the imagery and the drawn shapes, never takes the pointer, and follows pan and zoom (with the same
// zoom animation Leaflet gives its image overlay). Browser only; L is passed in once Leaflet is loaded.
import { metersPerPixel } from "../lib/photoPlace.js";

export const PHOTO_PANE = "sdPhoto";

/** @returns {typeof import("leaflet").Layer} */
export function makePhotoLayer(L) {
  return L.Layer.extend({
    initialize(url, place, onSize) {
      this._url = url;
      this._place = place;
      this._onSize = onSize;
    },

    onAdd(map) {
      if (!map.getPane(PHOTO_PANE)) {
        const pane = map.createPane(PHOTO_PANE);
        pane.style.zIndex = 250;      // above the tiles (200), below the shapes (400)
        pane.style.pointerEvents = "none";
      }
      const img = (this._img = L.DomUtil.create("img", "sd-photo-layer"));
      img.alt = "";
      img.draggable = false;
      img.style.position = "absolute";
      img.style.left = "0";
      img.style.top = "0";
      img.style.maxWidth = "none";
      img.style.transformOrigin = "50% 50%";
      img.style.pointerEvents = "none";
      img.style.userSelect = "none";
      img.onload = () => {
        this._ready = true;
        if (this._img.naturalWidth && this._img.naturalHeight) this._onSize?.(this._img.naturalWidth / this._img.naturalHeight);
        this._reset();
      };
      img.src = this._url;
      if (map.options.zoomAnimation && L.Browser.any3d) L.DomUtil.addClass(img, "leaflet-zoom-animated");
      map.getPane(PHOTO_PANE).appendChild(img);
      this._reset();
    },

    onRemove() {
      this._img?.remove();
      this._img = null;
    },

    getEvents() {
      const ev = { zoom: this._reset, viewreset: this._reset };
      if (this._map.options.zoomAnimation && L.Browser.any3d) ev.zoomanim = this._animateZoom;
      return ev;
    },

    setPlace(place) {
      this._place = place;
      this._reset();
    },

    // the picture's box at a zoom: its centre on the layer, its size in pixels
    _box(zoom, centerPoint) {
      const p = this._place;
      const mpp = metersPerPixel(p.lat, zoom);
      const w = p.widthM / mpp;
      const h = w / (this._img.naturalWidth && this._img.naturalHeight ? this._img.naturalWidth / this._img.naturalHeight : p.aspect);
      return { w, h, x: centerPoint.x - w / 2, y: centerPoint.y - h / 2 };
    },

    _reset() {
      if (!this._img || !this._map || !this._place) return;
      const map = this._map;
      const b = this._box(map.getZoom(), map.latLngToLayerPoint([this._place.lat, this._place.lon]));
      const s = this._img.style;
      s.width = b.w + "px";
      s.height = b.h + "px";
      s.opacity = String(this._place.opacity);
      s.transform = `translate3d(${b.x}px, ${b.y}px, 0) rotate(${this._place.rotDeg}deg)`;
    },

    // while a zoom animates, the box keeps its size and is scaled, as Leaflet does for its own image overlay
    _animateZoom(e) {
      if (!this._img || !this._place) return;
      const map = this._map;
      const c = map._latLngToNewLayerPoint(L.latLng(this._place.lat, this._place.lon), e.zoom, e.center);
      const b = this._box(map.getZoom(), c);
      this._img.style.transform = `translate3d(${b.x}px, ${b.y}px, 0) rotate(${this._place.rotDeg}deg) scale(${map.getZoomScale(e.zoom)})`;
    },
  });
}
