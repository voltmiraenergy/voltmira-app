"use client";
// app/(app)/traction/PackRequests.jsx — the bank packs a developer asked to pay
// for by bank transfer (app/api/portfolios/[id]/pack). Once the transfer has
// arrived, "Unlock" opens the pack for 90 days (app/api/admin/packs).
import { useState } from "react";

const EUR = (n) => "€" + Math.round(Number(n) || 0).toLocaleString("en-IE");
const TIER = { ci: "C&I", utility: "Utility", portfolio: "Portfolio" };

export default function PackRequests({ initial = [] }) {
  const [rows, setRows] = useState(initial);
  const [busy, setBusy] = useState(null);
  const [error, setError] = useState("");

  async function act(id, cancel = false) {
    if (cancel && !window.confirm("Close this request without unlocking the pack?")) return;
    setBusy(id); setError("");
    try {
      const res = await fetch("/api/admin/packs", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ requestId: id, cancel }) });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || res.statusText);
      setRows((r) => r.filter((x) => x.id !== id));
    } catch (e) {
      setError(`Could not update the request: ${e.message}`);
    } finally {
      setBusy(null);
    }
  }

  if (!rows.length) return <p className="dx-muted-note">No invoice requests waiting.</p>;
  return (
    <>
      {error && <p className="dx-muted-note" role="alert">{error}</p>}
      <div className="tr-tbl-wrap">
        <table className="tr-tbl">
          <thead><tr><th>Workspace</th><th>Plant</th><th>Tier</th><th className="n">Amount</th><th>Billing details</th><th>Asked</th><th /></tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td className="tr-name" title={`Workspace id: ${r.company_id}`}>{r.company || "Unnamed"}<br /><small>{r.requested_by}</small></td>
                <td>{r.plant_name || (r.plant_id ? r.plant_id : "Data room")}</td>
                <td>{TIER[r.tier] || r.tier}</td>
                <td className="n">{EUR(r.amount_eur)}</td>
                <td style={{ whiteSpace: "pre-line", maxWidth: 280 }}>{r.billing || "None given"}</td>
                <td>{new Date(r.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}</td>
                <td style={{ whiteSpace: "nowrap" }}>
                  <button type="button" className="dx-btn" disabled={busy === r.id} onClick={() => act(r.id)}>Paid: unlock</button>{" "}
                  <button type="button" className="dx-btn" disabled={busy === r.id} onClick={() => act(r.id, true)}>Close</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
