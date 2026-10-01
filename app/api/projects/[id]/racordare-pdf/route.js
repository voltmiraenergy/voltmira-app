// app/api/projects/[id]/racordare-pdf/route.js — downloads the distribution
// operator's REAL prosumer connection application, filled with this project's
// real data: Premier Energy Distribution's (lib/racordarePdf.js) for the centre
// and south, RED Nord's (lib/racordareRedNordPdf.js) for Bălți and the north.
// ?op=premier|rednord picks one; without it, the operator saved on the quote's
// grid file, else the one its address suggests (lib/mdGrid.js).
// Auth-scoped like the invoice route: RLS confines the read to the caller's
// own company, so a project outside it simply isn't found.
import { NextResponse } from "next/server";
import { supabaseServer } from "../../../../../lib/supabase.js";
import { currentUser, currentCompany } from "../../../../../lib/session.js";
import { fillRacordarePdf } from "../../../../../lib/racordarePdf.js";
import { fillRedNordPdf } from "../../../../../lib/racordareRedNordPdf.js";
import { suggestOperator, OPERATORS } from "../../../../../lib/mdGrid.js";
import { designCheck } from "../../../../../lib/designCheck.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UUID_RE = /^[0-9a-f-]{36}$/i;

export async function GET(req, props) {
  const params = await props.params;
  const { id } = params;
  if (!UUID_RE.test(id)) return NextResponse.json({ error: "bad_id" }, { status: 400 });

  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const co = await currentCompany();
  if (!co) return NextResponse.json({ error: "no_company" }, { status: 403 });

  const { data: project } = await (await supabaseServer())
    .from("projects").select("*").eq("id", id).maybeSingle();
  if (!project) return NextResponse.json({ error: "not_found" }, { status: 404 });
  if (project.market !== "MD")
    return NextResponse.json({ error: "md_only" }, { status: 400 });

  const want = new URL(req.url).searchParams.get("op");
  const saved = project.install_progress?.gridFile?.operator;
  // The title usually names the town ("Casa Rusu, Bălți") when the address is short.
  const op = OPERATORS[want] ? want : OPERATORS[saved] ? saved : suggestOperator([project.address, project.title].filter(Boolean).join(", "));

  try {
    let bytes;
    if (op === "rednord") {
      // The chosen inverter's AC power and phases, when the bill of materials
      // names one; otherwise the system size, and the voltage left to the installer.
      const bom = Array.isArray(project.bom) ? project.bom : [];
      const dc = designCheck({ bom, kw: Number(project.kw) || 0, battKwh: project.batt ? Number(project.batt_kwh) || 0 : 0, market: "MD" });
      const known = Boolean(dc.fromBom?.inverter);
      bytes = await fillRedNordPdf({
        clientName: project.client_name, clientEmail: project.client_email || "",
        siteAddress: project.address,
        productionKw: known ? dc.acKw : project.kw,
        hasBattery: !!project.batt, battKwh: project.batt_kwh,
        phases: known ? dc.ph : null,
      });
    } else {
      bytes = await fillRacordarePdf({
        clientName: project.client_name, clientAddress: project.address,
        systemKw: project.kw, hasBattery: !!project.batt, battKwh: project.batt_kwh,
      });
    }
    const file = op === "rednord" ? "cerere-racordare-red-nord.pdf" : "cerere-racordare-premier-energy.pdf";
    return new NextResponse(bytes, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="${file}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    console.error("[racordare-pdf] fill failed:", e?.message || e);
    return NextResponse.json({ error: "fill_failed" }, { status: 500 });
  }
}
