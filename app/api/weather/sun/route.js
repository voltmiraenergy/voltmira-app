// app/api/weather/sun/route.js — this year's sunshine per month for a set of
// installed systems, so fleet health can judge each month against the sky it
// actually had (lib/sunshine.js, NASA POWER data). Installers only.
//   POST { year, points: [{ id, lat, lon }] }  ->  { factors: { [id]: (number|null)[12] } }
// Nearby systems share one lookup (rounded to ~1 km), and every result is
// cached until a new month completes, so the monitor stays fast.
import { NextResponse } from "next/server";
import { supabaseServer, supabaseAdmin } from "../../../../lib/supabase.js";
import { isRateLimited } from "../../../../lib/ratelimit.js";
import { getSunFactors } from "../../../../lib/sunshine.js";
import { dbCache } from "../../../../lib/estimateCore.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(req) {
  const { data: { user } } = await (await supabaseServer()).auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (await isRateLimited(`sun:${user.id}`, 30, 600_000)) return NextResponse.json({ error: "rate" }, { status: 429 });

  let b; try { b = await req.json(); } catch { return NextResponse.json({ error: "bad_json" }, { status: 400 }); }
  const year = Number(b?.year) || new Date().getUTCFullYear();
  const points = (Array.isArray(b?.points) ? b.points : []).slice(0, 60)
    .map((p) => ({ id: String(p?.id || ""), lat: Number(p?.lat), lon: Number(p?.lon) }))
    .filter((p) => p.id && Number.isFinite(p.lat) && Number.isFinite(p.lon));

  const cache = dbCache(supabaseAdmin());
  const byPlace = new Map();
  for (const p of points) {
    const k = `${p.lat.toFixed(2)}:${p.lon.toFixed(2)}`;
    if (!byPlace.has(k)) byPlace.set(k, { lat: p.lat, lon: p.lon, ids: [] });
    byPlace.get(k).ids.push(p.id);
  }

  const factors = {};
  const places = [...byPlace.values()];
  // A few at a time: kind to NASA's service, and quick enough for a fleet.
  for (let i = 0; i < places.length; i += 4) {
    await Promise.all(places.slice(i, i + 4).map(async (pl) => {
      let f = null;
      try { f = await getSunFactors({ lat: pl.lat, lon: pl.lon, year, cache }); }
      catch (e) { console.error("[sun] lookup failed", e?.message); }
      for (const id of pl.ids) factors[id] = f;
    }));
  }
  return NextResponse.json({ factors });
}
