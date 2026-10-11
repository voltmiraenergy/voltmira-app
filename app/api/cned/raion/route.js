// app/api/cned/raion/route.js — the area a position falls in, and CNED's
// figures for it, for the area card on a Moldovan quote
// (components/RaionCard.jsx). GET ?lat=&lon=
//
// Answers 404 unless CNED_DATA is on (lib/cnedData.js): while CNED has not
// confirmed in writing that VoltMira may reuse its register, this route does
// not exist outside the owner's machine. Signed-in users only; the answer
// holds aggregates for one area, never anything about a producer.
import { NextResponse } from "next/server";
import { currentUser } from "../../../../lib/session.js";
import { cnedSnapshot, raionStats, raionBrief, raionFor } from "../../../../lib/cnedData.js";
import { SHAPES } from "../../../../lib/data/mdRaionShapes.js";
import { RAION } from "../../../../lib/mdRaions.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

let cache = null; // the stats of the snapshot this server was built with
const statsOf = (snap) => (cache?.snap === snap ? cache.stats : (cache = { snap, stats: raionStats(snap) }).stats);

export async function GET(req) {
  const snap = cnedSnapshot();
  if (!snap) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const q = new URL(req.url).searchParams;
  const lat = Number(q.get("lat")), lon = Number(q.get("lon"));
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return NextResponse.json({ error: "bad_position" }, { status: 400 });

  const id = raionFor(lat, lon, SHAPES);
  const stats = statsOf(snap);
  const brief = id && RAION[id]?.covered ? raionBrief(stats, id) : null;
  return NextResponse.json({ raion: id, covered: !!brief, brief, areas: stats.length, dataTo: snap.source.dataTo },
    { headers: { "Cache-Control": "private, max-age=3600" } });
}
