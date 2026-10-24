// app/api/job-fees/[projectId]/pay/route.js — pay a won job's fee by card (lib/jobFeePay.js). The installer's own
// quote only; the amount is the fee row's. With the test gateway (off production) the fee is paid at once; with the
// bank, the answer carries where to send the installer, and the bank's callback (../../callback) settles it.
//   POST -> { ok, paid, test? } | { ok, redirect | form } | { error }
import { NextResponse } from "next/server";
import { supabaseAdmin } from "../../../../../lib/supabase.js";
import { billingGuard } from "../../../../../lib/invoiceServer.js";
import { isRateLimited, clientIp } from "../../../../../lib/ratelimit.js";
import { loadJobFee } from "../../../../../lib/jobFeeServer.js";
import { startCardPayment } from "../../../../../lib/jobFeePay.js";
import { gatewayFor } from "../../../../../lib/paymentGateway.js";
import { logActivity } from "../../../../../lib/activity.js";

export const dynamic = "force-dynamic";

const CODE = { not_due: 409, not_configured: 503, needs_db: 503 };

export async function POST(req, props) {
  const { projectId } = await props.params;
  if (await isRateLimited(`fee-pay:${clientIp(req)}`, 10, 60_000)) return NextResponse.json({ error: "rate" }, { status: 429 });
  const g = await billingGuard(projectId);
  if (g instanceof Response) return g;
  const db = supabaseAdmin();
  const { fee, needsDb } = await loadJobFee(db, g.project.id);
  if (needsDb) return NextResponse.json({ error: "needs_db" }, { status: 503 });
  if (!fee || fee.company_id !== g.co.id) return NextResponse.json({ error: "not_due" }, { status: 409 });
  const r = await startCardPayment(db, {
    fee, gateway: gatewayFor(), actor: { id: g.user.id, email: g.user.email },
    returnUrl: `${new URL(req.url).origin}/projects/${g.project.id}?fee=paid`, io: { logActivity },
  });
  return NextResponse.json(r, { status: r.ok ? 200 : CODE[r.error] || 502 });
}
