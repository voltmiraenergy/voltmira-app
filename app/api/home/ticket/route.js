// app/api/home/ticket/route.js — the homeowner's maintenance requests
// (docs/MARKETPLACE.md).
// POST { projectId, kind, title, detail }          a new request
// POST { projectId, ticketId, to: "open"|"closed" } reopen what was resolved, or confirm it
import { NextResponse } from "next/server";
import { isRateLimited, clientIp } from "../../../../lib/ratelimit.js";
import { homeGuard } from "../../../../lib/homeGuard.js";
import { openTicket, updateTicket } from "../../../../lib/ticketFlow.js";
import { ticketNotifier } from "../../../../lib/ticketServer.js";
import { HOMEOWNER_KINDS } from "../../../../lib/maintenance.js";

export async function POST(req) {
  if (await isRateLimited(`home-ticket:${clientIp(req)}`, 10, 60 * 60_000)) return NextResponse.json({ error: "rate" }, { status: 429 });
  let body;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "bad_json" }, { status: 400 }); }
  const g = await homeGuard(body.projectId);
  if (g instanceof Response) return g;
  const { user, project, co, db } = g;
  const io = ticketNotifier({ db, co });
  const actor = { id: user.id, email: user.email };
  const r = body.ticketId
    ? await updateTicket(db, { companyId: project.company_id, project, ticketId: String(body.ticketId), to: body.to === "closed" ? "closed" : "open", source: "homeowner", actor, io })
    : await openTicket(db, { project, source: "homeowner", input: { kind: HOMEOWNER_KINDS.includes(body.kind) ? body.kind : "other", title: body.title, detail: body.detail }, actor, io });
  const status = r.ok ? 200 : r.error === "needs_db" ? 503 : r.error === "not_found" ? 404 : 400;
  return NextResponse.json(r, { status });
}
