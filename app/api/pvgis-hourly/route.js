// app/api/pvgis-hourly/route.js — authenticated endpoint: lat/lon → real
// hourly production shape (two representative days, cold/warm season), for
// the peak-shaving simulation (components/PeakShaving.jsx). Same auth/cache
// pattern as app/api/pvgis/route.js — shares the pvgis_cache table, distinct
// key prefix (lib/pvgis.js's hourlyCacheKey), so the two never collide.
import { NextResponse } from "next/server";
import { supabaseServer, supabaseAdmin } from "../../../lib/supabase.js";
import { getHourlySolarShape } from "@voltmira/engine/pvgis";

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
  const sb = supabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const url = new URL(req.url);
  const lat = parseFloat(url.searchParams.get("lat"));
  const lon = parseFloat(url.searchParams.get("lon"));
  const angle = parseFloat(url.searchParams.get("angle") || "35");
  const aspect = parseFloat(url.searchParams.get("aspect") || "0");
  if (isNaN(lat) || isNaN(lon))
    return NextResponse.json({ error: "need lat/lon" }, { status: 400 });

  try {
    const admin = supabaseAdmin();
    const r = await getHourlySolarShape(lat, lon, { angle, aspect, cache: dbCache(admin) });
    return NextResponse.json({ lat, lon, angle, aspect, ...r });
  } catch (e) {
    return NextResponse.json({ error: "pvgis_failed", detail: String(e.message) }, { status: 502 });
  }
}
