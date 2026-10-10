// app/api/geocode-suggest/route.js — PUBLIC address-suggestion endpoint.
//
// The paid PVGIS flow already geocodes a finished address string via
// @voltmira/engine/pvgis's geocode() (Nominatim/OpenStreetMap, limit=1 — it
// only needs the best match to fetch a yield). This route is the missing
// counterpart: type-ahead suggestions. Same free geocoder, same identification
// convention (a real email in the query + User-Agent, per Nominatim's usage
// policy), just several ranked candidates instead of one, restricted to MD+RO
// so "Ceucari 2/4" resolves to the real Chișinău street — not silently to
// nothing, and not to a same-named street in the wrong town.
//
// No auth: the address picker is used both on authenticated Studio screens and
// on the public embeddable widget. Rate-limited by IP instead.
import { NextResponse } from "next/server";
import { isRateLimited, clientIp } from "../../../lib/ratelimit.js";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Accept, Content-Type",
};
const J = (body, status = 200) => NextResponse.json(body, { status, headers: CORS });
export function OPTIONS() { return new Response(null, { status: 204, headers: CORS }); }

const EMAIL = process.env.GEOCODER_EMAIL || "contact@voltmira.com";

export async function GET(req) {
  if (await isRateLimited(`geosuggest:${clientIp(req)}`, 30, 60_000)) {
    return J({ error: "rate_limited", results: [] }, 429);
  }

  const url = new URL(req.url);
  const q = (url.searchParams.get("q") || "").trim().slice(0, 120);
  if (q.length < 3) return J({ results: [] });

  // Ask for more than we show: Nominatim often returns the same address twice
  // (the building polygon and the address point), and a picker that lists
  // "Strada Ceucari 2/4, Chișinău" three times looks broken. Dedupe, then trim.
  const nomUrl = "https://nominatim.openstreetmap.org/search?format=jsonv2&addressdetails=1&limit=12" +
    `&countrycodes=md,ro&q=${encodeURIComponent(q)}&email=${encodeURIComponent(EMAIL)}`;

  try {
    const res = await fetch(nomUrl, { headers: { "User-Agent": `VoltMira/1.0 (${EMAIL})` } });
    if (!res.ok) return J({ error: "geocoder_failed", results: [] }, 502);
    const arr = await res.json();
    const mapped = (Array.isArray(arr) ? arr : []).map((r) => ({
      lat: parseFloat(r.lat),
      lon: parseFloat(r.lon),
      display: r.display_name,
      locality: r.address?.city || r.address?.town || r.address?.village || r.address?.municipality || "",
      road: r.address?.road || "",
      houseNumber: r.address?.house_number || "",
      country: r.address?.country || "",
    })).filter((r) => !Number.isNaN(r.lat) && !Number.isNaN(r.lon));

    // Two rows are the same place if they carry the same street + number +
    // locality, or if they sit within ~100 m of each other. Nominatim ranks by
    // relevance, so the first occurrence is the one worth keeping.
    const seen = new Set();
    const results = [];
    for (const r of mapped) {
      const key = [r.road, r.houseNumber, r.locality].join("|").toLowerCase();
      const near = results.some((k) => Math.abs(k.lat - r.lat) < 0.001 && Math.abs(k.lon - r.lon) < 0.001);
      if ((key !== "||" && seen.has(key)) || near) continue;
      seen.add(key);
      results.push(r);
      if (results.length === 6) break;
    }
    return J({ results });
  } catch (e) {
    return J({ error: "geocoder_error", detail: String(e?.message || e), results: [] }, 502);
  }
}
