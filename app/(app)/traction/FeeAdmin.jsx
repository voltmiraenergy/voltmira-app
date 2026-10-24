"use client";
// app/(app)/traction/FeeAdmin.jsx — each installer's statement for the chosen month (lib/feeRevenue.js
// statementsFor), for the platform admin: mark a statement paid when its bank transfer arrives (the reference it
// carried), or waive one job's fee with a reason (POST /api/admin/job-fees, audited). English, like the rest of
// /traction.
import { useState } from "react";
import { useRouter } from "next/navigation";

const LEI = (minor) => `${Math.round((Number(minor) || 0) / 100).toLocaleString("en-GB")} lei`;
const KW = (n) => (Number(n) || 0).toLocaleString("en-GB", { maximumFractionDigits: 1 });
const STATE = { paid: "paid", open: "open", late: "late, locked", none: "nothing owed" };

export default function FeeAdmin({ rows, totals }) {
  const router = useRouter();
  const [note, setNote] = useState({});
  const [busy, setBusy] = useState("");
  const [msg, setMsg] = useState("");
  if (!rows.length) return <p className="dx-muted-note">No job signed in this month.</p>;

  async function post(key, body) {
    setBusy(key); setMsg("");
    const res = await fetch("/api/admin/job-fees", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const j = await res.json().catch(() => ({}));
    setBusy("");
    if (j.ok) router.refresh();
    else setMsg(j.error === "reason" ? "Write why the fee is waived first." : `Not saved (${j.error || res.status}).`);
  }

  return (
    <div className="tr-tbl-wrap">
      {msg && <p className="dx-muted-note" role="status">{msg}</p>}
      <table className="tr-tbl">
        <thead>
          <tr>
            <th>Installer</th><th className="n">Signed</th><th className="n">Free</th><th className="n">Cancelled</th><th className="n">kW</th>
            <th className="n">Fees</th><th>Statement</th><th className="n">Owed</th><th>Transfer reference</th><th />
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const st = r.statement;
            const open = st && (st.state === "open" || st.state === "late");
            return (
              <tr key={r.companyId}>
                <td className="tr-name">
                  {r.name || "Unnamed"}
                  {r.dueFees.length > 0 && (
                    <details className="tr-waive">
                      <summary>Waive a job&rsquo;s fee</summary>
                      {r.dueFees.map((f) => (
                        <div key={f.id} className="tr-waive-row">
                          <span>{f.job || "Job"}, {KW(f.kw)} kW, {LEI(f.amount_minor)}</span>
                          <input className="input" aria-label="Why it is waived" placeholder="Why" value={note[f.id] || ""} onChange={(e) => setNote({ ...note, [f.id]: e.target.value })} />
                          <button type="button" className="dx-btn" disabled={!!busy} onClick={() => post(f.id, { action: "waive", feeId: f.id, reason: note[f.id] || "" })}>Waive</button>
                        </div>
                      ))}
                    </details>
                  )}
                </td>
                <td className="n">{r.signed}</td><td className="n">{r.free}</td><td className="n">{r.cancelled}</td><td className="n">{KW(r.kw)}</td>
                <td className="n">{LEI(r.feesMinor)}</td>
                <td>{st ? <><a href={`/fees/invoice/${st.id}`} target="_blank" rel="noopener noreferrer">{st.number}</a><small className="tr-st"> {STATE[st.state]}</small></> : <small className="tr-st">{r.dueMinor > 0 ? "issued on the 1st" : "nothing to invoice"}</small>}</td>
                <td className="n">{LEI(st ? (st.state === "paid" ? 0 : st.leftMinor) : r.dueMinor)}</td>
                <td>{open && <input className="input" style={{ minWidth: 150 }} aria-label="Transfer reference" value={note[st.id] ?? ""} placeholder={st.ref} onChange={(e) => setNote({ ...note, [st.id]: e.target.value })} />}</td>
                <td style={{ whiteSpace: "nowrap" }}>
                  {open && <button type="button" className="dx-btn primary" disabled={!!busy} onClick={() => post(st.id, { action: "statement_paid", invoiceId: st.id, ref: note[st.id] || st.ref })}>Mark paid</button>}
                </td>
              </tr>
            );
          })}
        </tbody>
        <tfoot>
          <tr className="tr-total">
            <td>Total</td><td className="n">{totals.signed}</td><td className="n">{totals.free}</td><td className="n">{totals.cancelled}</td><td className="n">{KW(totals.kw)}</td>
            <td className="n">{LEI(totals.feesMinor)}</td><td /><td className="n">{LEI(totals.owedMinor)}</td><td /><td />
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
