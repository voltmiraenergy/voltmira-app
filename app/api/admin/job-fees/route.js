// app/api/admin/job-fees/route.js — the platform admin's fees (lib/feeAdmin.js). Platform admins only
// (PLATFORM_ADMIN_EMAILS); anyone else gets a 404.
//   GET ?format=csv                                    every fee of the real workspaces, for the accountant
//   POST { action: "statement_paid", invoiceId, ref }  a statement's transfer arrived; audited
//   POST { action: "waive", feeId, reason }            no fee owed for one job after all; audited
import { NextResponse } from "next/server";
import { currentUser } from "../../../../lib/session.js";
import { isPlatformAdmin } from "../../../../lib/platformAdmin.js";
import { supabaseAdmin } from "../../../../lib/supabase.js";
import { loadTraction } from "../../../../lib/tractionData.js";
import { loadFeeAdmin, adminSetFee } from "../../../../lib/feeAdmin.js";
import { feesCsv } from "../../../../lib/feeRevenue.js";

export const dynamic = "force-dynamic";

export async function GET(req) {
  const user = await currentUser();
  if (!isPlatformAdmin(user?.email)) return NextResponse.json({ error: "not_found" }, { status: 404 });
  if (new URL(req.url).searchParams.get("format") !== "csv") return NextResponse.json({ error: "bad_request" }, { status: 400 });
  const r = await loadTraction({ weeks: 1 });
  const a = await loadFeeAdmin(r.workspaces.map((w) => w.id));
  return new NextResponse(feesCsv(a.fees, a), {
    headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": `attachment; filename="voltmira-fees-${new Date().toISOString().slice(0, 10)}.csv"`, "cache-control": "no-store" },
  });
}

export async function POST(req) {
  const user = await currentUser();
  if (!isPlatformAdmin(user?.email)) return NextResponse.json({ error: "not_found" }, { status: 404 });
  let b = {};
  try { b = await req.json(); } catch { /* refused below */ }
  const r = await adminSetFee(supabaseAdmin(), {
    action: b.action, invoiceId: String(b.invoiceId || ""), feeId: String(b.feeId || ""), reason: b.reason, ref: b.ref,
    actor: { id: user.id, email: user.email },
  });
  return NextResponse.json(r, { status: r.ok ? 200 : r.error === "not_found" ? 404 : 400 });
}
