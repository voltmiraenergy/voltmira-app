// app/api/export-invoices/route.js — a structured CSV of every real proforma
// invoice this company has issued to a Moldovan client, for an accountant to
// import into 1C or whatever they actually use.
//
// WHY CSV, not a live SFS e-Factura submission or a 1C CommerceML file:
// e-Factura (SFS's real system, efactura.sfs.md) needs EVOSign digital-
// signature handling and vendor onboarding to submit to directly — real
// integration guides exist, but this app hasn't verified their exact
// schema, and getting a signed fiscal submission wrong has real legal
// consequences for an installer. CommerceML is a real 1C protocol, but it's
// built for e-commerce catalog/order exchange, not general invoice export —
// using it here would be a mismatched fit dressed up as a "real 1C format."
// A plain, clearly-labeled CSV of the real numbers already on each invoice
// is the honest, low-risk option: any accounting software can import a CSV,
// and nothing here claims to be an official interchange format it isn't.
//
// Scope: only projects with a real invoice_no (a proforma was actually
// issued — see the invoice page's next_invoice_no()) and market = MD. Same
// net/VAT/gross math as the invoice PDF itself (lib/invoiceMath.js), so this
// export can never show a different total than the document the client has.
import { NextResponse } from "next/server";
import { supabaseServer } from "../../../lib/supabase.js";
import { currentCompany } from "../../../lib/session.js";
import { quote } from "@voltmira/engine";
import { companyEngine } from "../../../lib/engineSettings.js";
import { rowToQuoteInput } from "../../../lib/quoteInput.js";
import { vatBreakdown } from "../../../lib/invoiceMath.js";
import { getRate } from "../../../lib/fx.js";

export const dynamic = "force-dynamic";

const PLAIN_NUMBER = /^-?\d+(\.\d+)?$/;

// Same formula-injection guard as export-projects/route.js — client_name and
// title can carry text a stranger supplied (the widget-lead endpoint has no
// account gate), so a leading =+-@ must never reach an accountant's
// spreadsheet as a live formula.
function csvEsc(v) {
  v = String(v == null ? "" : v);
  if (!PLAIN_NUMBER.test(v) && /^[=+\-@\t\r]/.test(v)) v = "'" + v;
  return /[",\n;]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v;
}

export async function GET() {
  const sb = supabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: "auth" }, { status: 401 });
  const co = await currentCompany();
  if (!co) return NextResponse.json({ error: "no_company" }, { status: 403 });

  const { data: rows } = await sb.from("projects").select("*")
    .eq("market", "MD").not("invoice_no", "is", null).order("invoice_no", { ascending: true });

  const E = await companyEngine(co);
  const cur = co.currency || "MDL";
  const fxInfo = await getRate(cur);
  const fx = Number(fxInfo.rate) > 0 ? Number(fxInfo.rate) : 1;

  const head = [
    "Numar factura", "Data", "Client", "Adresa client",
    "Suma neta", "Cota TVA (%)", "TVA", "Suma totala", "Moneda",
    "Denumire furnizor", "IDNO furnizor", "Cod TVA furnizor",
  ];
  const lines = (rows || []).map((p) => {
    const q = quote(rowToQuoteInput(p), E).e;
    const grossEur = Math.max(0, Math.round(q.cost || 0));
    const grossLocal = Math.round(grossEur * fx);
    const { net, vat, rate } = vatBreakdown(grossLocal, co.vat_rate);
    const date = p.invoiced_at ? new Date(p.invoiced_at).toISOString().slice(0, 10) : "";
    return [
      p.invoice_no || "", date, p.client_name || "", p.address || "",
      Math.round(net), rate, Math.round(vat), grossLocal, cur,
      co.legal_name || co.name || "", co.reg_no || "", co.vat_no || "",
    ].map(csvEsc).join(",");
  });

  const csv = "﻿" + head.join(",") + "\n" + lines.join("\n");
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv;charset=utf-8",
      "Content-Disposition": `attachment; filename="voltmira-facturi-md-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
}
