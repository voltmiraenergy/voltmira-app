// app/api/pvgis/route.js — authenticated endpoint: address or lat/lon → real yield.
// Caches in the pvgis_cache table (30-day TTL handled by created_at check).
import { NextResponse } from "next/server";
import { supabaseServer, supabaseAdmin } from "../../../lib/supabase.js";
import { getSolarYield, geocode, cacheKey } from "@voltmira/engine/pvgis";

function dbCache(admin) {
  const TTL = 30 * 24 * 3600 * 1000;
  return {
    async get(k) {
      const { data } = await admin.from("pvgis_cache").select("value, created_at").eq("key", k).single();
      if (!data) return null;
      if (Date.now() - new Date(data.created_at).getTime() > TTL) return null;
      return data.value;
    },
    async set(k, v) {
      await admin.from("pvgis_cache").upsert({ key: k, value: v, created_at: new Date().toISOString() });
    },
  };
}

export async function GET(req) {
  // must be a signed-in installer
  const sb = supabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const url = new URL(req.url);
  let lat = parseFloat(url.searchParams.get("lat"));
  let lon = parseFloat(url.searchParams.get("lon"));
  const address = url.searchParams.get("address");
  const angle = parseFloat(url.searchParams.get("angle") || "35");
  const aspect = parseFloat(url.searchParams.get("aspect") || "0");

  try {
    if ((isNaN(lat) || isNaN(lon)) && address) {
      const g = await geocode(address, { email: process.env.GEOCODER_EMAIL });
      if (!g) return NextResponse.json({ error: "address_not_found" }, { status: 404 });
      lat = g.lat; lon = g.lon;
    }
    if (isNaN(lat) || isNaN(lon))
      return NextResponse.json({ error: "need lat/lon or address" }, { status: 400 });

    const admin = supabaseAdmin();
    const r = await getSolarYield(lat, lon, { angle, aspect, cache: dbCache(admin) });
    return NextResponse.json({ lat, lon, angle, aspect, ...r });
  } catch (e) {
    return NextResponse.json({ error: "pvgis_failed", detail: String(e.message) }, { status: 502 });
  }
}
