// app/api/projects/[id]/payments/route.js — payments a client made against the
// quote's invoice (docs/INTEGRATIONS.md). The installer's own project only.
// POST   { amount, currency, paidAt, method, reference, idempotencyKey }  record one (once per key)
// DELETE ?payment=<id>                                                    remove one recorded by mistake
import { NextResponse } from "next/server";
import { supabaseAdmin } from "../../../../../lib/supabase.js";
import { isRateLimited, clientIp } from "../../../../../lib/ratelimit.js";
import { validatePayment } from "../../../../../lib/billing.js";
import { recordPayment, removePayment } from "../../../../../lib/billingFlow.js";
import { billingGuard } from "../../../../../lib/invoiceServer.js";

export const dynamic = "force-dynamic";

export async function POST(req, props) {
  const { id } = await props.params;
  if (await isRateLimited(`payments:${clientIp(req)}`, 40, 60_000)) return NextResponse.json({ error: "rate" }, { status: 429 });
  const g = await billingGuard(id);
  if (g instanceof Response) return g;
  let body;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "bad_json" }, { status: 400 }); }
  const v = validatePayment(body);
  if (!v.ok) return NextResponse.json({ error: "invalid", fields: v.errors }, { status: 400 });
  const r = await recordPayment(supabaseAdmin(), { companyId: g.co.id, projectId: g.project.id, payment: v.payment, actor: { id: g.user.id, email: g.user.email } });
  return NextResponse.json(r, { status: r.ok ? 200 : r.error === "needs_db" ? 503 : 500 });
}

export async function DELETE(req, props) {
  const { id } = await props.params;
  const g = await billingGuard(id);
  if (g instanceof Response) return g;
  const paymentId = new URL(req.url).searchParams.get("payment") || "";
  if (!/^[0-9a-f-]{36}$/i.test(paymentId)) return NextResponse.json({ error: "bad_id" }, { status: 400 });
  const r = await removePayment(supabaseAdmin(), { companyId: g.co.id, projectId: g.project.id, paymentId, actor: { id: g.user.id, email: g.user.email } });
  return NextResponse.json(r, { status: r.ok ? 200 : 404 });
}
