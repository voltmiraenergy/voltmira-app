// app/api/export-1c/route.js — customers, invoices and payments for one date
// range, in the form 1C imports (lib/export1c.js, docs/INTEGRATIONS.md).
// GET  ?from=YYYY-MM-DD&to=YYYY-MM-DD&format=csv|xml  -> a ZIP of three CSVs, or one XML
// POST { mapping }                                    -> save the workspace's column mapping
// The caller's own workspace only (RLS reads); the amounts are the proforma's,
// recomputed the same way (lib/invoiceServer.js).
import { NextResponse } from "next/server";
import { supabaseServer } from "../../../lib/supabase.js";
import { currentUser, currentCompany } from "../../../lib/session.js";
import { projectVisibility } from "../../../lib/projectAccess.js";
import { isRateLimited, clientIp } from "../../../lib/ratelimit.js";
import { projectInvoice } from "../../../lib/invoiceServer.js";
import { cleanMapping, toCsv, toXml, buildExportRows, rangeOk } from "../../../lib/export1c.js";
import { zip } from "../../../lib/zip.js";
import { dayKeyOf } from "../../../lib/tz.js";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const missing = (e) => e && (e.code === "42P01" || e.code === "PGRST205" || /does not exist|schema cache/i.test(e.message || ""));

export async function GET(req) {
  if (await isRateLimited(`export1c:${clientIp(req)}`, 20, 60 * 60 * 1000)) return NextResponse.json({ error: "rate" }, { status: 429 });
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const co = await currentCompany();
  if (!co) return NextResponse.json({ error: "no_company" }, { status: 403 });
  const url = new URL(req.url);
  const from = url.searchParams.get("from"), to = url.searchParams.get("to");
  const format = url.searchParams.get("format") === "xml" ? "xml" : "csv";
  if (!rangeOk(from, to)) return NextResponse.json({ error: "bad_range" }, { status: 400 });

  const sb = await supabaseServer();
  const [{ data: projects }, pm, ef, mp] = await Promise.all([
    sb.from("projects").select("*").not("invoice_no", "is", null).limit(5000),
    sb.from("payments").select("project_id, amount_minor, currency, paid_at, method, reference").gte("paid_at", from).lte("paid_at", to).limit(10000),
    sb.from("efactura_submissions").select("project_id, fiscal_number").eq("status", "accepted").eq("provider", "sfs").limit(10000),
    sb.from("export_mappings").select("mapping").maybeSingle(),
  ]);
  const mapping = cleanMapping(mp.data?.mapping || {});
  const sees = await projectVisibility(user, co);
  const list = (projects || []).filter(sees);
  // amounts only for the invoices inside the range, or behind a payment in it
  const payIds = new Set((pm.data || []).map((m) => m.project_id));
  const amounts = new Map();
  for (const p of list) {
    const day = dayKeyOf(p.invoiced_at);
    if ((day && day >= from && day <= to) || payIds.has(p.id)) {
      const inv = await projectInvoice(p, co);
      amounts.set(p.id, { ...inv.amounts, cur: inv.cur });
    }
  }
  const rows = buildExportRows({
    projects: list, amounts, payments: missing(pm.error) ? [] : pm.data || [],
    fiscal: new Map((missing(ef.error) ? [] : ef.data || []).map((r) => [r.project_id, r.fiscal_number])), from, to,
  });
  const base = `voltmira-1c-${from}_${to}`;
  if (format === "xml") {
    return new NextResponse(toXml(rows, { from, to, company: co.legal_name || co.name || "" }), {
      headers: { "Content-Type": "application/xml; charset=utf-8", "Content-Disposition": `attachment; filename="${base}.xml"`, "Cache-Control": "no-store" },
    });
  }
  const archive = zip([
    { name: "clienti.csv", data: toCsv("customers", rows.customers, mapping) },
    { name: "facturi.csv", data: toCsv("invoices", rows.invoices, mapping) },
    { name: "plati.csv", data: toCsv("payments", rows.payments, mapping) },
  ]);
  return new NextResponse(archive, {
    headers: { "Content-Type": "application/zip", "Content-Disposition": `attachment; filename="${base}.zip"`, "Cache-Control": "no-store" },
  });
}

export async function POST(req) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const co = await currentCompany();
  if (!co) return NextResponse.json({ error: "no_company" }, { status: 403 });
  let body;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "bad_json" }, { status: 400 }); }
  const mapping = cleanMapping(body.mapping || {});
  const { error } = await (await supabaseServer()).from("export_mappings").upsert({ company_id: co.id, mapping, updated_at: new Date().toISOString() });
  if (error) return NextResponse.json({ error: missing(error) ? "needs_db" : "save_failed" }, { status: missing(error) ? 503 : 500 });
  return NextResponse.json({ ok: true, mapping });
}
