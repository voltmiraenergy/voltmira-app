// app/(app)/fees/invoice/[id]/page.jsx — VoltMira's invoice for a fee per won project (lib/jobFeePay.js
// invoiceForFee), printable. In Romanian, as Moldovan fiscal paperwork is; the numbers are the stored ones, never
// worked out again. Read on the installer's own session: row security shows a workspace only its own invoices.
import { notFound } from "next/navigation";
import { supabaseServer } from "../../../../../lib/supabase.js";
import { fmtDate } from "../../../../../lib/tz.js";
import PrintNow from "../../../projects/[id]/invoice/PrintNow.jsx";

export const dynamic = "force-dynamic";

const lei = (minor) => `${(Math.round(Number(minor) || 0) / 100).toLocaleString("ro-RO", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} lei`;
const day = (iso) => (iso ? fmtDate(iso, "ro-RO", { day: "2-digit", month: "2-digit", year: "numeric" }) : "");

export default async function FeeInvoicePage(props) {
  const { id } = await props.params;
  const sp = await props.searchParams;
  if (!/^[0-9a-f-]{36}$/i.test(String(id))) notFound();
  const sb = await supabaseServer();
  const { data: inv } = await sb.from("job_fee_invoices").select("*").eq("id", id).maybeSingle();
  if (!inv) notFound();
  const { data: fees } = await sb.from("job_fees").select("id, kw, project_id").in("id", inv.fee_ids || []);
  const ids = (fees || []).map((f) => f.project_id);
  const { data: projects } = ids.length ? await sb.from("projects").select("id, title, client_name").in("id", ids) : { data: [] };
  const name = new Map((projects || []).map((p) => [p.id, p.title || p.client_name || ""]));
  const kwTxt = (k) => Number(k || 0).toLocaleString("ro-RO", { maximumFractionDigits: 1 });
  const s = inv.seller || {}, b = inv.buyer || {};
  const each = (fees || []).length ? Math.round(Number(inv.net_minor) / fees.length) : Number(inv.net_minor);

  return (
    <div className="fee-inv">
      <style>{`
        .app .fee-inv{max-width:780px;margin:0 auto;background:#fff;color:#142A21;border:1px solid #E3E1D6;border-radius:14px;padding:36px 40px;font-size:14px;line-height:1.5}
        .fee-inv h1{font-family:"Inter Tight",Inter,system-ui,sans-serif;font-size:24px;margin:0 0 4px;letter-spacing:-.02em}
        .fee-inv .meta{color:#5D6B62;margin:0 0 24px}
        .fee-inv .parties{display:grid;grid-template-columns:1fr 1fr;gap:24px;margin-bottom:24px}
        .fee-inv .parties h2{font-size:12px;text-transform:uppercase;letter-spacing:.06em;color:#5D6B62;margin:0 0 6px}
        .fee-inv .parties p{margin:0}
        .fee-inv table{width:100%;border-collapse:collapse;margin-bottom:18px}
        .fee-inv th,.fee-inv td{text-align:left;padding:9px 8px;border-bottom:1px solid #E3E1D6;vertical-align:top}
        .fee-inv th{font-size:12px;color:#5D6B62;font-weight:600}
        .fee-inv .num{text-align:right;white-space:nowrap;font-variant-numeric:tabular-nums}
        .fee-inv .tot td{font-weight:700;border-bottom:0}
        .fee-inv .pay{padding:14px 16px;border-radius:10px;background:#F6F5F0;margin-top:8px}
        .fee-inv .pay b{font-variant-numeric:tabular-nums}
        @media (max-width:640px){.app .fee-inv{padding:22px 18px}.fee-inv .parties{grid-template-columns:1fr}}
        @media print{.app .fee-inv{border:0;border-radius:0;padding:0;max-width:none}}
      `}</style>
      <h1>Factură nr. {inv.number}</h1>
      <p className="meta">Data emiterii: {day(inv.issued_at)} | Scadentă: {day(inv.due_at)}</p>
      <div className="parties">
        <div><h2>Furnizor</h2><p><b>{s.name}</b></p><p>IDNO {s.idno}</p><p>{s.address}</p><p>IBAN {s.iban}{s.bank ? `, ${s.bank}` : ""}</p></div>
        <div><h2>Cumpărător</h2><p><b>{b.name}</b></p>{b.idno && <p>IDNO {b.idno}</p>}{b.address && <p>{b.address}</p>}</div>
      </div>
      <table>
        <thead><tr><th>Denumire</th><th className="num">Suma</th></tr></thead>
        <tbody>
          {(fees || []).map((f) => (
            <tr key={f.id}><td>Taxă VoltMira pentru un proiect câștigat: {name.get(f.project_id) || ""}, sistem de {kwTxt(f.kw)} kW</td><td className="num">{lei(each)}</td></tr>
          ))}
          <tr><td>Total fără TVA</td><td className="num">{lei(inv.net_minor)}</td></tr>
          <tr><td>TVA {Number(inv.vat_rate) || 0}%</td><td className="num">{lei(inv.vat_minor)}</td></tr>
          <tr className="tot"><td>Total de plată</td><td className="num">{lei(inv.total_minor)}</td></tr>
        </tbody>
      </table>
      <div className="pay">
        <p style={{ margin: 0 }}>Plata prin transfer bancar în contul de mai sus, cu destinația <b>{inv.payment_ref}</b>.</p>
      </div>
      {sp?.print === "1" && <PrintNow />}
    </div>
  );
}
