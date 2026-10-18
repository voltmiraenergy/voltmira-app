// app/api/projects/[id]/tickets/route.js — the installer's side of
// maintenance (docs/MARKETPLACE.md). The installer's own project only.
// POST { action: "open", title, detail, kind }
//      { action: "status", ticketId, to: "scheduled"|"resolved"|"closed"|"open", visitAt?, outcome? }
import { NextResponse } from "next/server";
import { supabaseAdmin } from "../../../../../lib/supabase.js";
import { isRateLimited, clientIp } from "../../../../../lib/ratelimit.js";
import { billingGuard } from "../../../../../lib/invoiceServer.js";
import { openTicket, updateTicket } from "../../../../../lib/ticketFlow.js";
import { ticketNotifier } from "../../../../../lib/ticketServer.js";

export async function POST(req, props) {
  const { id } = await props.params;
  if (await isRateLimited(`tickets:${clientIp(req)}`, 40, 60_000)) return NextResponse.json({ error: "rate" }, { status: 429 });
  const g = await billingGuard(id);
  if (g instanceof Response) return g;
  let body;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "bad_json" }, { status: 400 }); }
  const db = supabaseAdmin();
  const { user, co, project } = g;
  const actor = { id: user.id, email: user.email };
  const io = ticketNotifier({ db, co });
  const r = body.action === "status"
    ? await updateTicket(db, { companyId: co.id, project, ticketId: String(body.ticketId || ""), to: String(body.to || ""), visitAt: body.visitAt, outcome: body.outcome, source: "installer", actor, io })
    : await openTicket(db, { project, source: "installer", input: { kind: body.kind, title: body.title, detail: body.detail }, actor, io });
  const status = r.ok ? 200 : r.error === "needs_db" ? 503 : r.error === "not_found" ? 404 : 400;
  return NextResponse.json(r, { status });
}
