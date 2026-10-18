// app/api/qsign/mock/route.js — the simulated MSign's answer (sign or
// cancel), from /sign/mock/[id]. Exists only where the simulation is on
// (lib/qsignFlow.js qsignMode); a real MSign never comes through here.
import { NextResponse } from "next/server";
import { supabaseAdmin } from "../../../../lib/supabase.js";
import { isRateLimited, clientIp } from "../../../../lib/ratelimit.js";
import { qsignMode, decideMock } from "../../../../lib/qsignFlow.js";

export async function POST(req) {
  if (qsignMode() !== "mock") return NextResponse.json({ error: "not_found" }, { status: 404 });
  if (await isRateLimited(`qsign:mock:${clientIp(req)}`, 20, 60_000))
    return NextResponse.json({ error: "rate" }, { status: 429 });
  let body;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "bad_json" }, { status: 400 }); }
  const requestId = String(body.requestId || "");
  if (!/^QS-[0-9a-f]{24}$/.test(requestId)) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const decision = body.decision === "sign" ? "sign" : "decline";
  const r = await decideMock(supabaseAdmin(), { requestId, decision, signer: body.signer });
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.error === "name" ? 400 : 404 });
  return NextResponse.json({ ok: true, next: `/api/qsign/return?r=${requestId}` });
}
