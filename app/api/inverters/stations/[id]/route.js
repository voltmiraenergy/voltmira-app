// app/api/inverters/stations/[id]/route.js — link a portal station to what it
// powers: a quote (its readings go to production_readings) and/or a Studio job
// (its readings fill that job's monitoring months).
//   PATCH { projectId: uuid|null, studioJobId: string|null }
import { NextResponse } from "next/server";
import { caller } from "../../_caller.js";

export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const JOB_ID = /^[A-Za-z0-9_-]{1,80}$/;

export async function PATCH(req, { params }) {
  const me = await caller();
  if (!me) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!me.canManage) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  let body;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "bad_json" }, { status: 400 }); }

  const { data: st } = await me.admin.from("inverter_stations").select("id")
    .eq("id", params.id).eq("company_id", me.companyId).maybeSingle();
  if (!st) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const patch = {};
  if ("projectId" in (body || {})) {
    const pid = body.projectId || null;
    if (pid) {
      if (!UUID.test(pid)) return NextResponse.json({ error: "bad_project" }, { status: 400 });
      // Only a quote of the caller's own company.
      const { data: p } = await me.admin.from("projects").select("id").eq("id", pid).eq("company_id", me.companyId).maybeSingle();
      if (!p) return NextResponse.json({ error: "bad_project" }, { status: 400 });
    }
    patch.project_id = pid;
  }
  if ("studioJobId" in (body || {})) {
    const jid = body.studioJobId || null;
    if (jid && !JOB_ID.test(jid)) return NextResponse.json({ error: "bad_job" }, { status: 400 });
    patch.studio_job_id = jid;
  }
  if (!Object.keys(patch).length) return NextResponse.json({ error: "nothing_to_change" }, { status: 400 });

  const { data, error } = await me.admin.from("inverter_stations").update(patch).eq("id", st.id)
    .select("id, project_id, studio_job_id").single();
  if (error) return NextResponse.json({ error: "db", message: error.message }, { status: 500 });
  return NextResponse.json({ station: data });
}
