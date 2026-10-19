// app/api/projects/[id]/efactura/route.js — send the quote's invoice to SFS
// e-Factura, or ask SFS again about one it is still processing
// (docs/INTEGRATIONS.md). The installer's own project only; the amounts are
// recomputed here (lib/invoiceServer.js), the buyer's IDNO is the one thing
// the installer types (a company client), and it is kept on the project.
// POST { action: "submit" | "refresh", buyerIdno? }
import { NextResponse } from "next/server";
import { supabaseAdmin, supabaseServer } from "../../../../../lib/supabase.js";
import { isRateLimited, clientIp } from "../../../../../lib/ratelimit.js";
import { buildEfacturaInvoice, efacturaAdapterFor } from "../../../../../lib/efactura.js";
import { submitEfactura, refreshEfactura } from "../../../../../lib/billingFlow.js";
import { projectInvoice, billingGuard } from "../../../../../lib/invoiceServer.js";
import { invoiceBlocked } from "../../../../../lib/successFees.js";

export const dynamic = "force-dynamic";

export async function POST(req, props) {
  const { id } = await props.params;
  if (await isRateLimited(`efactura:${clientIp(req)}`, 20, 60_000)) return NextResponse.json({ error: "rate" }, { status: 429 });
  const g = await billingGuard(id);
  if (g instanceof Response) return g;
  if (invoiceBlocked(g.project.status)) return NextResponse.json({ error: "not_signed" }, { status: 403 });
  const { user, co, project: p } = g;
  let body;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "bad_json" }, { status: 400 }); }
  const actor = { id: user.id, email: user.email };
  const db = supabaseAdmin();
  const adapter = efacturaAdapterFor();

  if (body.action === "refresh") {
    const r = await refreshEfactura(db, { companyId: co.id, projectId: p.id, adapter, actor });
    return NextResponse.json(r, { status: r.ok ? 200 : r.error === "needs_db" ? 503 : 502 });
  }
  if (body.action !== "submit") return NextResponse.json({ error: "bad_action" }, { status: 400 });

  const inv = await projectInvoice(p, co);
  const buyerIdno = String(body.buyerIdno ?? p.client_profile?.buyerIdno ?? "").replace(/\D/g, "").slice(0, 13);
  if (inv.kind === "company" && buyerIdno && buyerIdno !== p.client_profile?.buyerIdno) {
    await (await supabaseServer()).from("projects").update({ client_profile: { ...(p.client_profile || {}), buyerIdno } }).eq("id", p.id);
  }
  const invoice = buildEfacturaInvoice({
    company: co,
    buyer: { name: p.client_name || p.title || "", kind: inv.kind, idno: inv.kind === "company" ? buyerIdno : "", address: p.address || "" },
    amounts: inv.amounts, currency: inv.cur, invoiceNo: p.invoice_no || "",
    date: String(p.invoiced_at || new Date().toISOString()).slice(0, 10), description: inv.description,
  });
  const r = await submitEfactura(db, { companyId: co.id, projectId: p.id, invoice, adapter, actor });
  const status = r.ok || r.submission ? 200 : r.error === "needs_db" || r.error === "not_configured" ? 503 : 409;
  return NextResponse.json(r, { status });
}
