// app/api/projects/[id]/racordare-pdf/route.js — downloads Premier Energy
// Distribution's real prosumer connection-request PDF, filled with this
// project's real data (lib/racordarePdf.js). Auth-scoped like the invoice
// route: RLS confines the read to the caller's own company, so a project
// outside it simply isn't found.
import { NextResponse } from "next/server";
import { supabaseServer } from "../../../../../lib/supabase.js";
import { currentUser, currentCompany } from "../../../../../lib/session.js";
import { fillRacordarePdf } from "../../../../../lib/racordarePdf.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UUID_RE = /^[0-9a-f-]{36}$/i;

export async function GET(req, { params }) {
  const { id } = params;
  if (!UUID_RE.test(id)) return NextResponse.json({ error: "bad_id" }, { status: 400 });

  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const co = await currentCompany();
  if (!co) return NextResponse.json({ error: "no_company" }, { status: 403 });

  const { data: project } = await supabaseServer()
    .from("projects").select("client_name, address, kw, batt, batt_kwh, market").eq("id", id).maybeSingle();
  if (!project) return NextResponse.json({ error: "not_found" }, { status: 404 });
  if (project.market !== "MD")
    return NextResponse.json({ error: "md_only" }, { status: 400 });

  try {
    const bytes = await fillRacordarePdf({
      clientName: project.client_name, clientAddress: project.address,
      systemKw: project.kw, hasBattery: !!project.batt, battKwh: project.batt_kwh,
    });
    return new NextResponse(bytes, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": 'inline; filename="cerere-racordare-premier-energy.pdf"',
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    console.error("[racordare-pdf] fill failed:", e?.message || e);
    return NextResponse.json({ error: "fill_failed" }, { status: 500 });
  }
}
