// app/api/job-fees/[projectId]/invoice/route.js — VoltMira's invoice for a won job's fee, to pay by bank transfer
// (lib/jobFeePay.js invoiceForFee): issued once, numbered in the VMF series, with the reference the transfer must
// carry. A platform admin marks the fee paid from /traction when the money arrives.
//   POST -> { ok, invoice: { id, number, payment_ref, total_minor } } | { error }
import { NextResponse } from "next/server";
import { supabaseAdmin } from "../../../../../lib/supabase.js";
import { billingGuard } from "../../../../../lib/invoiceServer.js";
import { isRateLimited, clientIp } from "../../../../../lib/ratelimit.js";
import { loadJobFee } from "../../../../../lib/jobFeeServer.js";
import { invoiceForFee, sellerDetails, feeVatRate } from "../../../../../lib/jobFeePay.js";

export const dynamic = "force-dynamic";

const CODE = { not_due: 409, seller: 503, needs_db: 503 };

export async function POST(req, props) {
  const { projectId } = await props.params;
  if (await isRateLimited(`fee-inv:${clientIp(req)}`, 10, 60_000)) return NextResponse.json({ error: "rate" }, { status: 429 });
  const g = await billingGuard(projectId);
  if (g instanceof Response) return g;
  const db = supabaseAdmin();
  const { fee, needsDb } = await loadJobFee(db, g.project.id);
  if (needsDb) return NextResponse.json({ error: "needs_db" }, { status: 503 });
  if (!fee || fee.company_id !== g.co.id) return NextResponse.json({ error: "not_due" }, { status: 409 });
  // the buyer as the company reads now: its legal name, tax id and address
  const { data: company } = await db.from("companies").select("name, legal_name, idno, legal_address").eq("id", g.co.id).maybeSingle();
  const r = await invoiceForFee(db, { fee, company: company || g.co, seller: sellerDetails(), vatRate: feeVatRate() });
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: CODE[r.error] || 500 });
  const i = r.invoice;
  return NextResponse.json({ ok: true, invoice: { id: i.id, number: i.number, payment_ref: i.payment_ref, total_minor: i.total_minor } });
}
