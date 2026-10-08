"use server";
// lib/geoActions.js — look up where quotes are, for the portfolio map, when
// the installer has not pinned them in the quote (lib/geoPlace.js decides what
// to ask). OpenStreetMap's Nominatim, as app/api/geocode-suggest does: a real
// contact in the query and the User-Agent, one request a second at most, and
// a few quotes per call so a page never waits long. Signed-in callers only,
// rate-limited per user. Nothing is written here: the portfolio page keeps the
// answers on the portfolio, never on the quote.
import { supabaseServer } from "./supabase.js";
import { isRateLimited } from "./ratelimit.js";
import { placeQueries, placeKey, precisionOf } from "./geoPlace.js";
import { placeFromAddress, roundPos } from "./sitePick.js";

const EMAIL = process.env.GEOCODER_EMAIL || "contact@voltmira.com";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const PER_CALL = 4;
const GAP_MS = 1100;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function nominatim(q, country) {
  const url = "https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&addressdetails=0" +
    `&countrycodes=${encodeURIComponent(country)}&q=${encodeURIComponent(q)}&email=${encodeURIComponent(EMAIL)}`;
  const res = await fetch(url, { headers: { "User-Agent": `VoltMira/1.0 (${EMAIL})` }, signal: AbortSignal.timeout(8000), cache: "no-store" });
  if (!res.ok) throw new Error(`geocoder_${res.status}`);
  const arr = await res.json();
  const r = Array.isArray(arr) ? arr[0] : null;
  if (!r) return null;
  const lat = parseFloat(r.lat), lon = parseFloat(r.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  return { lat, lon, addresstype: r.addresstype || r.type || "", name: r.name || "" };
}

/**
 * @param {Array<{ id: string, address?: string, title?: string, market?: string }>} items
 * @returns {Promise<{ ok: boolean, error?: string, placed: Array<{id,lat,lon,precision,q,place}>, notFound: string[] }>}
 */
export async function geocodeProjects(items) {
  const out = { ok: true, placed: [], notFound: [] };
  const sb = await supabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return { ...out, ok: false, error: "auth" };
  if (await isRateLimited(`geo:${user.id}`, 40, 60_000)) return { ...out, ok: false, error: "rate_limited" };

  const list = (Array.isArray(items) ? items : []).filter((it) => it && UUID.test(String(it.id || ""))).slice(0, PER_CALL)
    .map((it) => ({ id: it.id, address: String(it.address || "").slice(0, 200), title: String(it.title || "").slice(0, 200), market: ["MD", "UA", "RO"].includes(it.market) ? it.market : "MD" }));
  let first = true;
  for (const it of list) {
    let hit = null;
    for (const q of placeQueries(it)) {
      if (!first) await sleep(GAP_MS);
      first = false;
      try {
        const r = await nominatim(q.q, q.country);
        if (r) { hit = { id: it.id, lat: r.lat, lon: r.lon, precision: precisionOf(r.addresstype, q.kind), q: placeKey(it), place: r.name }; break; }
      } catch {
        // the geocoder is down or slow: stop this call, the page tries again later
        return { ...out, ok: out.placed.length > 0 || out.notFound.length > 0, error: "geocoder" };
      }
    }
    if (hit) out.placed.push(hit); else out.notFound.push(it.id);
  }
  return out;
}

const LANGS = { en: "en", ro: "ro", ru: "ru", uk: "uk" };
const okNum = (v, max) => Number.isFinite(Number(v)) && Math.abs(Number(v)) <= max;

async function signedInUser() {
  const sb = await supabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  return user;
}

/**
 * The place at a point a user clicked on the plant's map
 * (components/portfolio/SitePicker.jsx): the village or town, the district,
 * and the country, so a point outside Moldova can be pointed out.
 * @returns {Promise<{ ok: boolean, error?: string, place?: { locality: string, district: string, country: string } }>}
 */
export async function placeAt(lat, lon, lang = "ro") {
  const user = await signedInUser();
  if (!user) return { ok: false, error: "auth" };
  if (!okNum(lat, 90) || !okNum(lon, 180)) return { ok: false, error: "bad_point" };
  if (await isRateLimited(`georev:${user.id}`, 30, 60_000)) return { ok: false, error: "rate_limited" };
  const url = "https://nominatim.openstreetmap.org/reverse?format=jsonv2&zoom=14&addressdetails=1" +
    `&lat=${roundPos(lat)}&lon=${roundPos(lon)}&accept-language=${LANGS[lang] || "ro"}&email=${encodeURIComponent(EMAIL)}`;
  try {
    const res = await fetch(url, { headers: { "User-Agent": `VoltMira/1.0 (${EMAIL})` }, signal: AbortSignal.timeout(8000), cache: "no-store" });
    if (!res.ok) return { ok: false, error: "geocoder" };
    const r = await res.json();
    return { ok: true, place: placeFromAddress(r?.address) };
  } catch {
    return { ok: false, error: "geocoder" };
  }
}

/**
 * Localities matching what a user typed in the map's search box, in Moldova
 * first; up to five, each with the point to fly to.
 * @returns {Promise<{ ok: boolean, error?: string, places: Array<{ name: string, detail: string, lat: number, lon: number }> }>}
 */
export async function findPlaces(q, lang = "ro") {
  const user = await signedInUser();
  if (!user) return { ok: false, error: "auth", places: [] };
  const text = String(q || "").replace(/\s+/g, " ").trim().slice(0, 120);
  if (text.length < 2) return { ok: true, places: [] };
  if (await isRateLimited(`geofind:${user.id}`, 30, 60_000)) return { ok: false, error: "rate_limited", places: [] };
  const url = "https://nominatim.openstreetmap.org/search?format=jsonv2&limit=5&addressdetails=1&countrycodes=md" +
    `&q=${encodeURIComponent(text)}&accept-language=${LANGS[lang] || "ro"}&email=${encodeURIComponent(EMAIL)}`;
  try {
    const res = await fetch(url, { headers: { "User-Agent": `VoltMira/1.0 (${EMAIL})` }, signal: AbortSignal.timeout(8000), cache: "no-store" });
    if (!res.ok) return { ok: false, error: "geocoder", places: [] };
    const arr = await res.json();
    const places = (Array.isArray(arr) ? arr : []).map((r) => {
      const p = placeFromAddress(r.address);
      const lat = parseFloat(r.lat), lon = parseFloat(r.lon);
      return { name: String(r.name || p.locality || "").slice(0, 80), detail: p.district, lat, lon };
    }).filter((p) => p.name && Number.isFinite(p.lat) && Number.isFinite(p.lon));
    // one town can come back as its boundary, its centre and its station: name it once
    const seen = new Set();
    return { ok: true, places: places.filter((p) => { const k = `${p.name}|${p.detail}`; if (seen.has(k)) return false; seen.add(k); return true; }) };
  } catch {
    return { ok: false, error: "geocoder", places: [] };
  }
}
