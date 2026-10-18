// app/api/proposal/[code]/qsign/route.js — the client starts a qualified
// signature of the offer (MSign with MPass, docs/INTEGRATIONS.md).
// POST -> { redirectUrl }: the provider's page (or the simulation outside
// production). The code is the capability, as for the rest of the offer.
import { NextResponse } from "next/server";
import { supabaseAdmin } from "../../../../../lib/supabase.js";
import { isRateLimited, clientIp } from "../../../../../lib/ratelimit.js";
import { qsignAdapterFor } from "../../../../../lib/qsign.js";
import { qsignMode, startQualified } from "../../../../../lib/qsignFlow.js";
import { offerDocument } from "../../../../../lib/qsignServer.js";

export async function POST(req, props) {
  const { code } = await props.params;
  if (await isRateLimited(`qsign:start:${clientIp(req)}`, 10, 60_000))
    return NextResponse.json({ error: "rate" }, { status: 429 });
  if (!qsignMode()) return NextResponse.json({ error: "not_available" }, { status: 404 });

  const db = supabaseAdmin();
  const { data: prop } = await db.from("proposals").select("code, company_id, project_id, accepted_at").eq("code", code).maybeSingle();
  if (!prop) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const doc = await offerDocument(db, code);
  if (!doc) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const base = new URL(req.url).origin;
  const adapter = qsignAdapterFor({ baseUrl: base });
  const r = await startQualified(db, { prop, documentHash: doc.hash, adapter, returnFor: (id) => `${base}/api/qsign/return?r=${encodeURIComponent(id)}` });
  if (!r.ok) {
    const status = r.error === "already_signed" ? 409 : r.error === "needs_db" || r.error === "not_configured" ? 503 : 502;
    return NextResponse.json({ error: r.error }, { status });
  }
  return NextResponse.json({ ok: true, redirectUrl: r.redirectUrl });
}
