// app/(app)/fees/invoice/[id]/page.jsx — VoltMira's monthly statement (lib/jobFeePay.js monthlyStatements): the
// invoice for the jobs signed in one month, printable. In Romanian, as Moldovan fiscal paperwork is; the numbers are
// the stored ones, never worked out again. A job whose client gave up after the statement was issued is listed as
// taken off, and what is left to pay is said. Read on the installer's own session: row security shows a workspace
// only its own statements (a platform admin reads any).
import { notFound } from "next/navigation";
import { supabaseServer, supabaseAdmin } from "../../../../../lib/supabase.js";
import { currentUser } from "../../../../../lib/session.js";
import { isPlatformAdmin } from "../../../../../lib/platformAdmin.js";
import { fmtDate } from "../../../../../lib/tz.js";
import { monthName } from "../../../../../lib/feeText.js";
import { feeLei, FEE_PER_KW_MINOR, FEE_CAP_MINOR } from "../../../../../lib/jobFees.js";
import PrintNow from "../../../projects/[id]/invoice/PrintNow.jsx";

export const dynamic = "force-dynamic";

const lei = (minor) => `${(Math.round(Number(minor) || 0) / 100).toLocaleString("ro-RO", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} lei`;
const day = (iso) => (iso ? fmtDate(iso, "ro-RO", { day: "2-digit", month: "2-digit", year: "numeric" }) : "");

export default async function FeeInvoicePage(props) {
  const { id } = await props.params;
  const sp = await props.searchParams;
  if (!/^[0-9a-f-]{36}$/i.test(String(id))) notFound();
  const user = await currentUser();
  const sb = isPlatformAdmin(user?.email) ? supabaseAdmin() : await supabaseServer();
  const { data: inv } = await sb.from("job_fee_invoices").select("*").eq("id", id).maybeSingle();
  if (!inv) notFound();
  const { data: fees } = await sb.from("job_fees").select("*").in("id", inv.fee_ids || []);
  const ids = (fees || []).map((f) => f.project_id).filter(Boolean);
  const { data: projects } = ids.length ? await sb.from("projects").select("id, title, client_name").in("id", ids) : { data: [] };
  // a job deleted since reads by the name kept on its fee (add-fee-lockdown.sql)
  const name = new Map([...(fees || []).map((f) => [f.project_id, f.project_title || f.client_name || ""]), ...(projects || []).map((p) => [p.id, p.title || p.client_name || ""])]);
  const kwTxt = (k) => Number(k || 0).toLocaleString("ro-RO", { maximumFractionDigits: 1 });
  const s = inv.seller || {}, b = inv.buyer || {};
  const rows = (fees || []).sort((x, y) => Date.parse(x.won_at) - Date.parse(y.won_at));
  const gaveUp = rows.filter((f) => f.status === "void");
  const offMinor = gaveUp.reduce((t, f) => t + (Number(f.amount_minor) || 0), 0);
  const vatOff = Math.round((offMinor * (Number(inv.vat_rate) || 0)) / 100);
  const leftMinor = inv.paid_at ? 0 : Number(inv.total_minor) - offMinor - vatOff;

  return (
    <div className="fee-inv">
      <style>{`
        .app .fee-inv{max-width:780px;margin:0 auto;background:#fff;color:#142A21;border:1px solid #E3E1D6;border-radius:14px;padding:36px 40px;font-size:14px;line-height:1.5}
        .fee-inv h1{font-family:"Inter Tight",Inter,system-ui,sans-serif;font-size:24px;margin:0 0 4px;letter-spacing:-.02em}
        .fee-inv .meta{color:#5D6B62;margin:0 0 24px}
        .fee-inv .parties{display:grid;grid-template-columns:1fr 1fr;gap:24px;margin-bottom:24px}
        .fee-inv .parties h2{font-size:12px;text-transform:uppercase;letter-spacing:.06em;color:#5D6B62;margin:0 0 6px}
        .fee-inv .parties p{margin:0}
        .fee-inv .tw{overflow-x:auto}
        .fee-inv table{width:100%;border-collapse:collapse;margin-bottom:18px}
        .fee-inv th,.fee-inv td{text-align:left;padding:9px 8px;border-bottom:1px solid #E3E1D6;vertical-align:top}
        .fee-inv th{font-size:12px;color:#5D6B62;font-weight:600}
        .fee-inv td small{display:block;color:#5D6B62;font-size:12px}
        .fee-inv .num{text-align:right;white-space:nowrap;font-variant-numeric:tabular-nums}
        .fee-inv .off td{color:#5D6B62}
        .fee-inv .tot td{font-weight:700;border-bottom:0}
        .fee-inv .pay{padding:14px 16px;border-radius:10px;background:#F6F5F0;margin-top:8px}
        .fee-inv .pay p{margin:0}
        .fee-inv .pay b{font-variant-numeric:tabular-nums}
        .fee-inv .paid{display:inline-block;margin-top:6px;padding:3px 10px;border-radius:999px;background:#E3F1E8;color:#1E6B4E;font-weight:700;font-size:12.5px}
        @media (max-width:640px){.app .fee-inv{padding:22px 18px}.fee-inv .parties{grid-template-columns:1fr}}
        @media print{.app .fee-inv{border:0;border-radius:0;padding:0;max-width:none}}
      `}</style>
      <h1>Factură nr. {inv.number}</h1>
      <p className="meta">
        {inv.month ? <>Extrasul VoltMira pentru {monthName(inv.month, "ro")} | </> : null}
        Data emiterii: {day(inv.issued_at)} | Scadentă: {day(Date.parse(inv.due_at) - 1)}
      </p>
      <div className="parties">
        <div><h2>Furnizor</h2><p><b>{s.name}</b></p><p>IDNO {s.idno}</p><p>{s.address}</p><p>IBAN {s.iban}{s.bank ? `, ${s.bank}` : ""}</p></div>
        <div><h2>Cumpărător</h2><p><b>{b.name}</b></p>{b.idno && <p>IDNO {b.idno}</p>}{b.address && <p>{b.address}</p>}</div>
      </div>
      <div className="tw">
        <table>
          <thead><tr><th>Denumire</th><th className="num">kW</th><th className="num">Suma</th></tr></thead>
          <tbody>
            {rows.map((f) => (
              <tr key={f.id}>
                <td>Taxă VoltMira pentru o lucrare semnată: {name.get(f.project_id) || ""}<small>Semnată pe {day(f.won_at)}, {feeLei(FEE_PER_KW_MINOR, "ro")} pe kW{Number(f.tier) === 1 ? `, plafonat la ${feeLei(FEE_CAP_MINOR, "ro")}` : ""}</small></td>
                <td className="num">{kwTxt(f.kw)}</td>
                <td className="num">{lei(f.amount_minor)}</td>
              </tr>
            ))}
            <tr><td colSpan={2}>Total fără TVA</td><td className="num">{lei(inv.net_minor)}</td></tr>
            <tr><td colSpan={2}>TVA {Number(inv.vat_rate) || 0}%</td><td className="num">{lei(inv.vat_minor)}</td></tr>
            <tr className="tot"><td colSpan={2}>Total factură</td><td className="num">{lei(inv.total_minor)}</td></tr>
            {gaveUp.map((f) => (
              <tr key={"off" + f.id} className="off"><td colSpan={2}>Scăzut: clientul a renunțat la {name.get(f.project_id) || "lucrare"}</td><td className="num">{lei(-(Number(f.amount_minor) || 0) * (1 + (Number(inv.vat_rate) || 0) / 100))}</td></tr>
            ))}
            {gaveUp.length > 0 && <tr className="tot"><td colSpan={2}>Rămas de plată</td><td className="num">{lei(leftMinor)}</td></tr>}
          </tbody>
        </table>
      </div>
      <div className="pay">
        {inv.paid_at
          ? <p>Plătit pe {day(inv.paid_at)}. <span className="paid">Achitat</span></p>
          : <p>Plata prin transfer bancar în contul de mai sus, până pe {day(Date.parse(inv.due_at) - 1)}, cu destinația <b>{inv.payment_ref}</b>: <b>{lei(gaveUp.length ? leftMinor : inv.total_minor)}</b>.</p>}
      </div>
      {sp?.print === "1" && <PrintNow />}
    </div>
  );
}
