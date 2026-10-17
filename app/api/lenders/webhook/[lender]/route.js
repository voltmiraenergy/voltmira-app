// app/api/lenders/webhook/[lender]/route.js — a lender tells VoltMira that an
// application moved (docs/FINANCING.md). Signed: the header
// x-voltmira-signature carries an HMAC-SHA256 of the raw body with the
// lender's secret (env LENDER_WEBHOOK_SECRET_<CODE>), at most five minutes
// old (lib/lenderSignature.js). Idempotent: the same event_id twice changes
// nothing. A lender can only move its own applications, only forwards.
//   POST { event_id, application_id, status, lender_ref?, note? }
//     200 { ok, status, duplicate? }   401 bad signature   404 unknown   409 not allowed
import { NextResponse } from "next/server";
import { supabaseAdmin } from "../../../../../lib/supabase.js";
import { verifyBody, secretEnvName, SIGNATURE_HEADER } from "../../../../../lib/lenderSignature.js";
import { applyStatus } from "../../../../../lib/loanFlow.js";
import { notifyLoanStatus } from "../../../../../lib/loanNotify.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req, props) {
  const { lender: code } = await props.params;
  if (!/^[a-z0-9_]{2,30}$/.test(String(code || ""))) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const raw = await req.text();
  if (raw.length > 20000) return NextResponse.json({ error: "too_large" }, { status: 413 });
  const sig = verifyBody(raw, req.headers.get(SIGNATURE_HEADER), process.env[secretEnvName(code)]);
  if (!sig.ok) return NextResponse.json({ error: sig.error }, { status: 401 });

  let body;
  try { body = JSON.parse(raw); } catch { return NextResponse.json({ error: "bad_json" }, { status: 400 }); }
  const db = supabaseAdmin();
  const { data: lender } = await db.from("lenders").select("id, name, active").eq("code", code).maybeSingle();
  if (!lender || lender.active === false) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const r = await applyStatus(db, {
    applicationId: body.application_id, to: String(body.status || ""), source: "webhook",
    eventId: String(body.event_id || ""), note: body.note || "", lenderRef: body.lender_ref || "",
    actor: { email: `lender:${code}` }, lenderId: lender.id,
  });
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.status || 400 });
  if (!r.duplicate && !r.same) await notifyLoanStatus(db, r.application, { lenderName: lender.name });
  return NextResponse.json({ ok: true, status: r.application.status, ...(r.duplicate ? { duplicate: true } : {}) });
}
