// app/(app)/projects/[id]/billing/page.jsx — a quote's billing
// (docs/INTEGRATIONS.md): its invoice sent to SFS e-Factura with every
// attempt and its status, and the payments the client made against it.
// Its own page because the proforma page opens the print dialog by itself.
// Read on the installer's session (RLS); written through
// /api/projects/[id]/efactura and /payments.
import { notFound } from "next/navigation";
import { supabaseServer } from "../../../../../lib/supabase.js";
import { currentCompany } from "../../../../../lib/session.js";
import { normLang } from "../../../../../lib/i18n.js";
import { xt } from "../../../../../lib/integrationText.js";
import { projectInvoice } from "../../../../../lib/invoiceServer.js";
import { buildEfacturaInvoice, validateEfactura, efacturaAdapterFor } from "../../../../../lib/efactura.js";
import { paymentSummary } from "../../../../../lib/billing.js";
import { dayKeyOf, mdDayKey } from "../../../../../lib/tz.js";
import BackLink from "../../../../../components/BackLink.jsx";
import BillingPanel from "./BillingPanel.jsx";
import "../../../dx.css";
import "./billing.css";

export const dynamic = "force-dynamic";
export const metadata = { title: "e-Factura | VoltMira" };

const missing = (e) => e && (e.code === "42P01" || e.code === "PGRST205" || /does not exist|schema cache/i.test(e.message || ""));

export default async function BillingPage(props) {
  const { id } = await props.params;
  const sb = await supabaseServer();
  const co = await currentCompany();
  const { data: p } = await sb.from("projects").select("*").eq("id", id).maybeSingle();
  if (!p || !co) notFound();
  const lang = normLang(co.lang);
  const loc = { en: "en-GB", ro: "ro-RO", ru: "ru-RU", uk: "uk-UA" }[lang] || "ro-RO";

  const inv = await projectInvoice(p, co);
  const [efq, pmq] = await Promise.all([
    sb.from("efactura_submissions").select("id, attempt, status, provider, sfs_ref, fiscal_number, error_code, error_message, gross_minor, currency, created_at").eq("project_id", id).order("attempt", { ascending: false }).limit(20),
    sb.from("payments").select("id, amount_minor, currency, paid_at, method, reference, created_at").eq("project_id", id).order("paid_at", { ascending: false }).limit(200),
  ]);
  const needsDb = missing(efq.error) || missing(pmq.error);
  const attempts = efq.data || [];
  const payments = pmq.data || [];

  // what SFS would refuse, checked before the installer presses anything
  const buyerIdno = p.client_profile?.buyerIdno || "";
  const draft = buildEfacturaInvoice({
    company: co, buyer: { name: p.client_name || p.title || "", kind: inv.kind, idno: buyerIdno },
    amounts: inv.amounts, currency: inv.cur, invoiceNo: p.invoice_no || "", date: dayKeyOf(p.invoiced_at) || mdDayKey(new Date()), description: inv.description,
  });
  const problems = validateEfactura(draft);

  return (
    <div className="dx bl">
      <BackLink href={`/projects/${id}`}>
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M15 5 8 12l7 7" /></svg>
        {xt("bl_back", lang)}
      </BackLink>
      <BillingPanel
        lang={lang} loc={loc} projectId={id} title={p.title || p.client_name || ""}
        invoiceNo={p.invoice_no || ""} currency={inv.cur} grossMinor={inv.grossMinor}
        clientIsCompany={inv.kind === "company"} buyerIdno={buyerIdno}
        problems={problems} attempts={attempts} payments={payments}
        summary={paymentSummary(payments, inv.grossMinor, inv.cur)}
        mock={efacturaAdapterFor().id === "sfs_mock"} needsDb={needsDb}
      />
    </div>
  );
}
