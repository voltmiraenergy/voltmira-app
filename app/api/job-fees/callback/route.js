// app/api/job-fees/callback/route.js — the bank's word on a card payment for a fee (lib/paymentGateway.js verify,
// lib/jobFeePay.js settleCallback): the signature checked first, then once per order and only for the amount asked.
// Until Victoria Bank's documentation and keys are in, the gateway answers not_configured and nothing is settled.
import { NextResponse } from "next/server";
import { supabaseAdmin } from "../../../../lib/supabase.js";
import { gatewayFor } from "../../../../lib/paymentGateway.js";
import { settleCallback } from "../../../../lib/jobFeePay.js";
import { logActivity } from "../../../../lib/activity.js";

export const dynamic = "force-dynamic";

export async function POST(req) {
  const gateway = gatewayFor();
  const v = await gateway.verify(req);
  if (!v.ok) return NextResponse.json({ error: v.error || "unverified" }, { status: v.error === "not_configured" ? 503 : 400 });
  const r = await settleCallback(supabaseAdmin(), v, { io: { logActivity } });
  return NextResponse.json(r, { status: r.ok ? 200 : 400 });
}
