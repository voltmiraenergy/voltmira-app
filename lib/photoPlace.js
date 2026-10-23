// lib/photoPlace.js — where a drone or phone photo lies on the map.
// The installer lays the photo over the satellite imagery in the roof designer (so the vents, pipes and
// chimneys the satellite cannot show become visible and can be traced), and the offer shows the same photo
// with the panels drawn on it. Both need the photo's place: the point under its centre, its width on the
// ground in metres, and how far it is turned (clockwise degrees: the direction its top edge points, 0 =
// north). The height follows from the picture's own shape. Pure geometry, no I/O.
import { project, unproject } from "./roofLayout.js";

export const PHOTO_WIDTH_MIN = 5;
export const PHOTO_WIDTH_MAX = 600;
export const PHOTO_OPACITY_MIN = 0.2;

const num = (v) => (typeof v === "number" ? v : typeof v === "string" && v.trim() !== "" ? Number(v) : NaN);
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const round = (v, d) => { const f = 10 ** d; return Math.round(v * f) / f; };

/** The place as it is kept: finite numbers within range, or null when it cannot be used. */
export function cleanPlace(raw) {
  if (!raw || typeof raw !== "object") return null;
  const lat = num(raw.lat), lon = num(raw.lon), widthM = num(raw.widthM);
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || !Number.isFinite(widthM)) return null;
  if (Math.abs(lat) > 90 || Math.abs(lon) > 180) return null;
  const rot = Number.isFinite(num(raw.rotDeg)) ? num(raw.rotDeg) : 0;
  const op = Number.isFinite(num(raw.opacity)) ? num(raw.opacity) : 0.7;
  const aspect = Number.isFinite(num(raw.aspect)) && num(raw.aspect) > 0 ? num(raw.aspect) : 4 / 3;
  return {
    lat: round(lat, 7), lon: round(lon, 7),
    widthM: round(clamp(widthM, PHOTO_WIDTH_MIN, PHOTO_WIDTH_MAX), 1),
    rotDeg: round((((rot + 180) % 360) + 360) % 360 - 180, 1),
    opacity: round(clamp(op, PHOTO_OPACITY_MIN, 1), 2),
    aspect: round(clamp(aspect, 0.2, 5), 4),
  };
}

/** Ground metres in one screen pixel of a web-mercator map at a latitude and zoom. */
export function metersPerPixel(lat, zoom) {
  return (156543.03392 * Math.cos(lat * Math.PI / 180)) / 2 ** zoom;
}

/** A first place for a photo: at the middle of what the map shows, about two thirds of its width. */
export function startPlace(center, viewWidthM, aspect = 4 / 3) {
  return cleanPlace({ lat: center.lat, lon: center.lon, widthM: viewWidthM * 0.66, rotDeg: 0, opacity: 0.7, aspect });
}

// a point's offset from the photo's centre, in the photo's own axes (u to its right, v up), in metres
function inPhotoAxes(place, lat, lon) {
  const [[e, n]] = project([[lat, lon]], place.lat, place.lon);
  const r = place.rotDeg * Math.PI / 180;
  return { u: e * Math.cos(r) - n * Math.sin(r), v: e * Math.sin(r) + n * Math.cos(r) };
}

/** Where a point of the ground falls on the photo: x and y as fractions of its width and height, from the top left. */
export function projectToPhoto(place, lat, lon) {
  const { u, v } = inPhotoAxes(place, lat, lon);
  const heightM = place.widthM / place.aspect;
  return { x: 0.5 + u / place.widthM, y: 0.5 - v / heightM };
}

/** The photo's four corners on the ground, clockwise from its top left, as [lat, lon]. */
export function photoCorners(place) {
  const r = place.rotDeg * Math.PI / 180;
  const hw = place.widthM / 2, hh = place.widthM / place.aspect / 2;
  const xy = [[-hw, hh], [hw, hh], [hw, -hh], [-hw, -hh]].map(([u, v]) => [u * Math.cos(r) + v * Math.sin(r), -u * Math.sin(r) + v * Math.cos(r)]);
  return unproject(xy, place.lat, place.lon);
}

/** The handle at the middle of the photo's right edge: dragging it sets the photo's width and its turn. */
export function handleLatLon(place) {
  const r = place.rotDeg * Math.PI / 180;
  const half = place.widthM / 2;
  const [[lat, lon]] = unproject([[half * Math.cos(r), -half * Math.sin(r)]], place.lat, place.lon);
  return [lat, lon];
}

/** The place after the right-edge handle is dragged to a point. */
export function placeFromHandle(place, lat, lon) {
  const [[e, n]] = project([[lat, lon]], place.lat, place.lon);
  const d = Math.hypot(e, n);
  if (d < 0.5) return place;
  return cleanPlace({ ...place, widthM: d * 2, rotDeg: Math.atan2(-n, e) * 180 / Math.PI });
}

/** The place after the centre handle is dragged to a point. */
export function placeAt(place, lat, lon) {
  return cleanPlace({ ...place, lat, lon });
}
