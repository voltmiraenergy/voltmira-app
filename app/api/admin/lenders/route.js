// app/api/admin/lenders/route.js — the platform admin's financing actions
// (docs/FINANCING.md). Platform admins only (PLATFORM_ADMIN_EMAILS); anyone
// else gets a 404.
//   GET  ?format=csv                          the commission payout report
//   POST { action: "portal", lenderId }       a new portal link, shown once
//                                             (only its SHA-256 is stored; the
//                                             old link stops working)
//   POST { action: "resend", applicationId }  send an undelivered application again
import { NextResponse } from "next/server";
import { currentUser } from "../../../../lib/session.js";
import { isPlatformAdmin } from "../../../../lib/platformAdmin.js";
import { supabaseAdmin } from "../../../../lib/supabase.js";
import { newPortalToken } from "../../../../lib/lenderSignature.js";
import { resendApplication, missingTable } from "../../../../lib/loanFlow.js";
import { payoutReport } from "../../../../lib/commission.js";
import { writeAudit } from "../../../../lib/audit.js";
import { sendEmail, emailConfigured } from "../../../../lib/email.js";
import { renderHtmlPdf } from "../../../../lib/renderProposalPdf.js";
import { notifyLoanStatus } from "../../../../lib/loanNotify.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function admin() {
  const user = await currentUser();
  return isPlatformAdmin(user?.email) ? user : null;
}

export async function GET(req) {
  if (!(await admin())) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const db = supabaseAdmin();
  const [{ data: rows, error }, { data: lenders }] = await Promise.all([
    db.from("commission_ledger").select("lender_id, period, currency, loan_minor, amount_minor"),
    db.from("lenders").select("id, name"),
  ]);
  if (error) return NextResponse.json({ error: missingTable(error) ? "needs_db" : "load_failed" }, { status: missingTable(error) ? 503 : 500 });
  const rep = payoutReport(rows || [], lenders || []);
  if (new URL(req.url).searchParams.get("format") === "csv") {
    const q = (s) => `"${String(s).replace(/"/g, '""')}"`;
    const csv = ["month,lender,currency,loans_funded,volume,commission_owed",
      ...rep.map((r) => [r.period, q(r.lender), r.currency, r.loans, (r.loanMinor / 100).toFixed(2), (r.amountMinor / 100).toFixed(2)].join(","))].join("\n");
    return new Response(csv, { headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": `attachment; filename="voltmira-commissions.csv"`, "cache-control": "no-store" } });
  }
  return NextResponse.json({ report: rep }, { headers: { "cache-control": "no-store" } });
}

export async function POST(req) {
  const user = await admin();
  if (!user) return NextResponse.json({ error: "not_found" }, { status: 404 });
  let b = {};
  try { b = await req.json(); } catch { /* refused below */ }
  const db = supabaseAdmin();
  const actor = { id: user.id, email: user.email };

  if (b.action === "portal") {
    const { data: lender } = await db.from("lenders").select("id, code, portal_token_hash").eq("id", String(b.lenderId || "")).maybeSingle();
    if (!lender) return NextResponse.json({ error: "not_found" }, { status: 404 });
    const { token, hash } = newPortalToken();
    const { error } = await db.from("lenders").update({ portal_token_hash: hash }).eq("id", lender.id);
    if (error) return NextResponse.json({ error: "save_failed" }, { status: 500 });
    await writeAudit(db, { companyId: null, actor, action: "lender.portal_link", entity: "lender", entityId: lender.id, before: { had_link: !!lender.portal_token_hash }, after: { had_link: true } });
    const base = (process.env.NEXT_PUBLIC_APP_URL || new URL(req.url).origin).replace(/\/+$/, "");
    return NextResponse.json({ ok: true, url: `${base}/l/${token}` });
  }

  if (b.action === "resend") {
    const r = await resendApplication(db, { applicationId: b.applicationId, io: { sendEmail, emailConfigured, buildPdf: renderHtmlPdf }, actor });
    if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.status || 400 });
    const { data: lender } = await db.from("lenders").select("name").eq("id", r.application.lender_id).maybeSingle();
    await notifyLoanStatus(db, r.application, { lenderName: lender?.name || "" });
    return NextResponse.json({ ok: true, status: r.application.status });
  }
  return NextResponse.json({ error: "bad_action" }, { status: 400 });
}
