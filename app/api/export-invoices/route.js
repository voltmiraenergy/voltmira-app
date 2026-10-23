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
// issued, lib/invoiceIssue.js) and market = MD. The figures are the ones fixed
// with the invoice number (lib/invoiceFreeze.js, read through projectInvoice),
// in that invoice's own currency, so this file shows the total and currency
// the client's document has, whatever the rate or the quote's size has since
// done. An invoice issued before the figures were kept is worked out as the
// invoice page worked it out.
import { NextResponse } from "next/server";
import { supabaseServer } from "../../../lib/supabase.js";
import { currentCompany } from "../../../lib/session.js";
import { projectInvoice } from "../../../lib/invoiceServer.js";
import { csvEsc } from "../../../lib/csv.js";
import { projectVisibility } from "../../../lib/projectAccess.js";
import { dayKeyOf } from "../../../lib/tz.js";

export const dynamic = "force-dynamic";

export async function GET() {
  const sb = await supabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: "auth" }, { status: 401 });
  const co = await currentCompany();
  if (!co) return NextResponse.json({ error: "no_company" }, { status: 403 });

  const { data: rows } = await sb.from("projects").select("*")
    .eq("market", "MD").not("invoice_no", "is", null).order("invoice_no", { ascending: true });

  const sees = await projectVisibility(user, co);
  const head = [
    "Numar factura", "Data", "Client", "Adresa client",
    "Suma neta", "Cota TVA (%)", "TVA", "Suma totala", "Moneda",
    "Denumire furnizor", "IDNO furnizor", "Cod TVA furnizor",
  ];
  const lines = [];
  for (const p of (rows || []).filter(sees)) {
    const inv = await projectInvoice(p, co);
    const { gross, net, vat, rate } = inv.amounts;
    const cur = inv.cur;
    const date = dayKeyOf(p.invoiced_at);
    lines.push([
      p.invoice_no || "", date, p.client_name || "", p.address || "",
      net, rate, vat, gross, cur,
      co.legal_name || co.name || "", co.reg_no || "", co.vat_no || "",
    ].map(csvEsc).join(","));
  }

  const csv = "﻿" + head.join(",") + "\n" + lines.join("\n");
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv;charset=utf-8",
      "Content-Disposition": `attachment; filename="voltmira-facturi-md-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
}
