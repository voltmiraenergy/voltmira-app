"use client";
// components/AddressField.jsx — address input with real disambiguation.
//
// Shared by every surface that asks "where is this roof?": the project editor,
// Studio, the lead widget. A street name alone is ambiguous in both markets —
// there is a Ștefan cel Mare in a dozen Moldovan towns — so a free-text box
// silently sends PVGIS to the wrong town and every number downstream inherits
// that error. This makes the installer PICK a resolved place, and hands back
// the coordinates that came with it.
//
// Three tiers, same output shape ({ address, lat, lng, locality }):
//  1. Google Places Autocomplete, if NEXT_PUBLIC_GOOGLE_MAPS_API_KEY is set —
//     best quality, house-number precise. Falls through cleanly if unset.
//  2. OpenStreetMap/Nominatim, live, via /api/geocode-suggest — the DEFAULT.
//     Free, no key, the same geocoder the PVGIS flow already uses
//     (@voltmira/engine/pvgis geocode()), just asking for several ranked
//     candidates instead of one. This is what makes "Ceucari 2/4" resolve to
//     the real Chișinău street instead of nothing, or a same-named street in
//     the wrong town.
//  3. lib/addressFallback.js — a tiny curated MD+RO dataset, last resort if the
//     network call itself fails.
//
// A resolved pick also shows a small OpenStreetMap tile with a pin (no key
// needed, © OpenStreetMap contributors) so the installer can see the pin lands
// on the right roof before it feeds PVGIS.
//
// The styles travel with the component so it works outside Studio's stylesheet.
import { useEffect, useRef, useState } from "react";
import { searchPlaces } from "../lib/addressFallback.js";

function tilePixel(lat, lng, z) {
  const n = 2 ** z;
  const x = ((lng + 180) / 360) * n;
  const rad = (lat * Math.PI) / 180;
  const y = ((1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2) * n;
  const xt = Math.floor(x), yt = Math.floor(y);
  return { xt, yt, px: Math.floor((x - xt) * 256), py: Math.floor((y - yt) * 256) };
}

function MapPin({ lat, lng, lang, size }) {
  const [ok, setOk] = useState(true);
  if (lat == null || lng == null) return null;
  const z = 15;
  const { xt, yt, px, py } = tilePixel(lat, lng, z);
  const SIZE = size || 200;
  if (!ok) return null;
  return (
    <div className="af-map">
      <div className="af-map-box" style={{ width: SIZE, height: SIZE }}>
        <img
          src={`https://tile.openstreetmap.org/${z}/${xt}/${yt}.png`}
          width={256} height={256}
          style={{ position: "absolute", left: 0, top: 0, width: 256, height: 256 }}
          alt="" onError={() => setOk(false)} />
        <svg className="af-pin" width="22" height="28" viewBox="0 0 22 28"
          style={{ left: (px / 256) * 256 - 11, top: (py / 256) * 256 - 26 }}>
          <path d="M11 27C11 27 20 16.5 20 10.5C20 5.26 15.97 1 11 1C6.03 1 2 5.26 2 10.5C2 16.5 11 27 11 27Z" fill="#1E6B4E" stroke="#fff" strokeWidth="1.6" />
          <circle cx="11" cy="10.5" r="3.6" fill="#fff" />
        </svg>
      </div>
      <span className="af-map-attr">
        {lat.toFixed(4)}, {lng.toFixed(4)} · {lang === "en" ? "map data" : lang === "ru" ? "карта" : "date hartă"} © OpenStreetMap contributors
      </span>
    </div>
  );
}

// A compact label from a Nominatim row: "Strada Ceucari 2/4, Chișinău" rather
// than its full verbose display_name (postcode, region, country and all).
export function shortLabel(r) {
  // The locality is the half that matters — it is what tells two identically
  // named streets apart — so keep it even when Nominatim gives no `road` and
  // the street has to come out of the display string's first segment.
  const street = r.road
    ? r.road + (r.houseNumber ? " " + r.houseNumber : "")
    : String(r.display || "").split(",")[0].trim();
  const label = [street, r.locality].filter(Boolean).join(", ");
  return label || String(r.display || "").split(",").slice(0, 2).join(",").trim();
}

/**
 * @param {string}  value            current address text
 * @param {number?} lat,lng          coordinates of the last resolved pick (draws the pin)
 * @param {(p:{address,lat,lng,locality})=>void} onPick
 * @param {((s:string)=>void)?} onText  every keystroke — hosts that persist the field
 *   need this, otherwise an address nobody picked from the list is never saved.
 *   The text no longer matches the pin at that point, so hosts should drop the
 *   stored coordinates when it fires.
 * @param {string?} inputClassName   host's own input class ("input" in the app, "pv-input" in Studio)
 * @param {boolean?} showMap         draw the OSM pin preview (default true)
 */
export default function AddressField({
  lang, value, lat, lng, onPick, onText, placeholder, inputClassName = "input", showMap = true, mapSize,
}) {
  const [q, setQ] = useState(value || "");
  const [open, setOpen] = useState(false);
  const [googleReady, setGoogleReady] = useState(false);
  const [live, setLive] = useState({ state: "idle", results: [] }); // idle | loading | ok | error
  const inputRef = useRef(null);
  const acRef = useRef(null);

  useEffect(() => { setQ(value || ""); }, [value]);

  // Tier 1 — Google, only if a key is configured.
  useEffect(() => {
    const key = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
    if (!key || typeof window === "undefined") return;
    if (window.google?.maps?.places) { setGoogleReady(true); return; }
    if (document.getElementById("gmaps-places-sdk")) return;
    const s = document.createElement("script");
    s.id = "gmaps-places-sdk";
    s.src = `https://maps.googleapis.com/maps/api/js?key=${key}&libraries=places&loading=async`;
    s.async = true;
    s.onload = () => setGoogleReady(true);
    document.head.appendChild(s);
  }, []);

  useEffect(() => {
    if (!googleReady || !inputRef.current || acRef.current) return;
    const ac = new window.google.maps.places.Autocomplete(inputRef.current, {
      componentRestrictions: { country: ["md", "ro"] },
      fields: ["formatted_address", "geometry", "address_components"],
      types: ["address"],
    });
    ac.addListener("place_changed", () => {
      const place = ac.getPlace();
      if (!place?.geometry) return;
      const locality = (place.address_components || []).find((c) => c.types.includes("locality"))?.long_name || "";
      onPick({
        address: place.formatted_address,
        lat: place.geometry.location.lat(),
        lng: place.geometry.location.lng(),
        locality,
      });
      setQ(place.formatted_address);
      setOpen(false);
    });
    acRef.current = ac;
  }, [googleReady, onPick]);

  // Tier 2 — live OpenStreetMap suggestions, debounced. Skipped entirely once
  // Google is driving the input (it has its own dropdown).
  useEffect(() => {
    if (googleReady) return;
    const needle = q.trim();
    if (needle.length < 3) { setLive({ state: "idle", results: [] }); return; }
    setLive((s) => ({ ...s, state: "loading" }));
    const id = setTimeout(async () => {
      try {
        const res = await fetch(`/api/geocode-suggest?q=${encodeURIComponent(needle)}`);
        const data = await res.json();
        setLive({ state: "ok", results: Array.isArray(data.results) ? data.results : [] });
      } catch {
        setLive({ state: "error", results: [] });
      }
    }, 400);
    return () => clearTimeout(id);
  }, [q, googleReady]);

  // Tier 3 — tiny curated fallback, only surfaced if the live call errored out.
  const fallback = live.state === "error" ? searchPlaces(q) : [];

  // Kept short on purpose: the badge sits inside the input, and a long label
  // would run under the address text in any host whose base font is larger
  // than Studio's.
  const badgeText = googleReady ? "Google Maps"
    : live.state === "error" ? tx3(lang, "mod local", "offline", "офлайн")
    : "OpenStreetMap";

  return (
    <div className="af-wrap">
      <div className="af-inputrow">
        <input ref={inputRef} className={inputClassName} value={q}
          placeholder={placeholder || tx3(lang, "Stradă, localitate…", "Street, locality…", "Улица, населённый пункт…")}
          onChange={(e) => { setQ(e.target.value); setOpen(true); onText?.(e.target.value); }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)} />
        <span className={"af-mode " + (googleReady ? "live" : live.state === "error" ? "demo" : "live")}>
          {badgeText}
        </span>
      </div>

      {open && !googleReady && live.state === "ok" && live.results.length > 0 && (
        <ul className="af-drop">
          {live.results.map((r, i) => (
            <li key={i} onMouseDown={() => {
              const full = shortLabel(r);
              onPick({ address: full, lat: r.lat, lng: r.lon, locality: r.locality });
              setQ(full); setOpen(false);
            }}>
              <b>{shortLabel(r)}</b>
              <span>{r.country}</span>
            </li>
          ))}
        </ul>
      )}
      {open && !googleReady && live.state === "ok" && q.trim().length >= 3 && live.results.length === 0 && (
        <ul className="af-drop"><li className="af-empty">{tx3(lang, "nicio adresă găsită", "no address found", "адрес не найден")}</li></ul>
      )}
      {open && !googleReady && live.state === "error" && fallback.length > 0 && (
        <ul className="af-drop">
          {fallback.map((p, i) => (
            <li key={i} onMouseDown={() => {
              const full = `str. ${p.street}, ${p.locality}`;
              onPick({ address: full, lat: p.lat, lng: p.lng, locality: p.locality });
              setQ(full); setOpen(false);
            }}>
              <b>str. {p.street}</b>
              <span>{p.locality} · {p.region}</span>
            </li>
          ))}
        </ul>
      )}
      {showMap && <MapPin lat={lat} lng={lng} lang={lang} size={mapSize} />}

      <style dangerouslySetInnerHTML={{ __html: `
        .af-wrap{position:relative}
        .af-inputrow{position:relative;display:flex;align-items:center}
        .af-inputrow input{flex:1;padding-right:106px}
        .af-mode{position:absolute;right:8px;top:50%;transform:translateY(-50%);font-size:9.5px;font-weight:700;
          letter-spacing:.02em;padding:3px 8px;border-radius:99px;pointer-events:none;white-space:nowrap}
        .af-mode.demo{background:var(--amber-tint);color:#B4700F}
        .af-mode.live{background:var(--green-tint);color:var(--green-soft)}
        .af-drop{position:absolute;z-index:20;top:calc(100% + 4px);left:0;right:0;background:var(--paper-2);
          border:1px solid var(--line);border-radius:11px;box-shadow:var(--shadow-lg,var(--shadow));list-style:none;
          margin:0;padding:6px;display:grid;gap:2px;max-height:260px;overflow-y:auto}
        .af-drop li{padding:8px 10px;border-radius:8px;cursor:pointer;display:flex;flex-direction:column;gap:1px}
        .af-drop li:hover{background:var(--green-tint)}
        .af-drop li b{font-size:13px;color:var(--ink);font-weight:600}
        .af-drop li span{font-size:11px;color:var(--muted)}
        .af-drop li.af-empty{cursor:default;color:var(--muted);font-size:12px}
        .af-drop li.af-empty:hover{background:none}
        .af-map{margin-top:10px;display:inline-flex;flex-direction:column;gap:5px}
        .af-map-box{position:relative;border-radius:11px;overflow:hidden;border:1px solid var(--line);background:var(--paper)}
        .af-pin{position:absolute}
        .af-map-attr{font-size:10px;color:var(--muted)}
      ` }} />
    </div>
  );
}

function tx3(lang, ro, en, ru) { return lang === "en" ? en : lang === "ru" ? ru : ro; }
