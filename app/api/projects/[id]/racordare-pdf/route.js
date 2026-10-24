// app/api/projects/[id]/racordare-pdf/route.js — downloads the distribution
// operator's REAL prosumer connection application, filled with this project's
// real data: Premier Energy Distribution's (lib/racordarePdf.js) for the centre
// and south, RED Nord's (lib/racordareRedNordPdf.js) for Bălți and the north.
// ?op=premier|rednord picks one; without it, the operator saved on the quote's
// grid file, else the one its address suggests (lib/mdGrid.js).
// Auth-scoped like the invoice route: RLS confines the read to the caller's
// own company, so a project outside it simply isn't found.
import { NextResponse } from "next/server";
import { supabaseServer, supabaseAdmin } from "../../../../../lib/supabase.js";
import { currentUser, currentCompany } from "../../../../../lib/session.js";
import { projectVisibility } from "../../../../../lib/projectAccess.js";
import { fillApplication, applicationFileName } from "../../../../../lib/racordareFill.js";
import { suggestOperator, OPERATORS } from "../../../../../lib/mdGrid.js";
import { jobGate } from "../../../../../lib/jobFeeServer.js";

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
  if (!project || !(await projectVisibility(user, co))(project)) return NextResponse.json({ error: "not_found" }, { status: 404 });
  if (project.market !== "MD")
    return NextResponse.json({ error: "md_only" }, { status: 400 });

  // A won job's paperwork waits on its fee once the 14 days to pay are over (lib/jobFees.js); the link opens in a
  // new tab, so a locked one goes to the quote with the payment open rather than to a bare error.
  const gate = await jobGate(supabaseAdmin(), { project, co, user });
  if (gate.locked) return NextResponse.redirect(new URL(`/projects/${project.id}?fee=${gate.error === "needs_idno" ? "idno" : "locked"}`, req.url));

  const want = new URL(req.url).searchParams.get("op");
  const saved = project.install_progress?.gridFile?.operator;
  // The title usually names the town ("Casa Rusu, Bălți") when the address is short.
  const op = OPERATORS[want] ? want : OPERATORS[saved] ? saved : suggestOperator([project.address, project.title].filter(Boolean).join(", "));

  try {
    const bytes = await fillApplication(project, op);
    const file = applicationFileName(op);
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
