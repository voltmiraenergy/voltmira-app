// app/api/cned/grid/route.js — what is already connected round a plant, for
// its grid section (components/portfolio/GridPanel.jsx): the renewable plants
// in operation in its district and within about 15 km, from CNED's register.
// GET ?lat=&lon=
//
// Answers 404 unless CNED_DATA is on (lib/cnedData.js): while CNED has not
// confirmed in writing that VoltMira may reuse its register, this route does
// not exist outside the owner's machine. Nothing it answers is saved with the
// plant, so turning the flag off takes it off every page at once. Signed-in
// users only; aggregates only, never anything about one producer.
import { NextResponse } from "next/server";
import { currentUser } from "../../../../lib/session.js";
import { cnedSnapshot, raionStats, gridContext } from "../../../../lib/cnedData.js";
import { SHAPES } from "../../../../lib/data/mdRaionShapes.js";

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

  const ctx = gridContext(snap, statsOf(snap), lat, lon, SHAPES);
  return NextResponse.json({ context: ctx, dataTo: snap.source.dataTo }, { headers: { "Cache-Control": "private, max-age=3600" } });
}
