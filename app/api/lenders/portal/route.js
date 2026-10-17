// app/api/lenders/portal/route.js — a lender updates an application from its
// portal (app/l/[token]): the same forward-only rules as the webhook
// (lib/loanFlow.js applyStatus). The token is the lender's portal link; only
// its SHA-256 is stored, and it reaches only that lender's applications. Each
// click carries its own event id, so a double click is one change.
//   POST { token, applicationId, status, eventId, lenderRef?, note? }
import { NextResponse } from "next/server";
import { supabaseAdmin } from "../../../../lib/supabase.js";
import { isRateLimited, clientIp } from "../../../../lib/ratelimit.js";
import { hashToken } from "../../../../lib/lenderSignature.js";
import { applyStatus } from "../../../../lib/loanFlow.js";
import { notifyLoanStatus } from "../../../../lib/loanNotify.js";

export const dynamic = "force-dynamic";

export async function POST(req) {
  if (await isRateLimited(`lportal:${clientIp(req)}`, 60, 60_000)) return NextResponse.json({ error: "rate" }, { status: 429 });
  let b;
  try { b = await req.json(); } catch { return NextResponse.json({ error: "bad_json" }, { status: 400 }); }
  const token = String(b.token || "");
  if (token.length < 20) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const db = supabaseAdmin();
  const { data: lender } = await db.from("lenders").select("id, code, name, active").eq("portal_token_hash", hashToken(token)).maybeSingle();
  if (!lender || lender.active === false) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const r = await applyStatus(db, {
    applicationId: b.applicationId, to: String(b.status || ""), source: "portal", eventId: `portal-${String(b.eventId || "").slice(0, 60)}`,
    note: b.note || "", lenderRef: b.lenderRef || "", actor: { email: `lender:${lender.code}` }, lenderId: lender.id,
  });
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.status || 400 });
  if (!r.duplicate && !r.same) await notifyLoanStatus(db, r.application, { lenderName: lender.name });
  return NextResponse.json({ ok: true, status: r.application.status });
}
