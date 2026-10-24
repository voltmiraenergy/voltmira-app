"use client";
// app/(app)/traction/FeeAdmin.jsx — the fees still owed (due, or void and so still locked), for the platform admin:
// mark one paid when its bank transfer arrives (the reference it carried), or waive it, each with a reason
// (POST /api/admin/job-fees, audited). English, like the rest of /traction.
import { useState } from "react";
import { useRouter } from "next/navigation";

const LEI = (minor) => `${Math.round((Number(minor) || 0) / 100).toLocaleString("en-GB")} lei`;

export default function FeeAdmin({ rows }) {
  const router = useRouter();
  const [note, setNote] = useState({});
  const [busy, setBusy] = useState("");
  const [msg, setMsg] = useState("");
  if (!rows.length) return <p className="dx-muted-note">Nothing owed right now.</p>;

  async function act(feeId, action) {
    setBusy(feeId + action); setMsg("");
    const res = await fetch("/api/admin/job-fees", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ feeId, action, reason: note[feeId] || "", ref: note[feeId] || "" }) });
    const j = await res.json().catch(() => ({}));
    setBusy("");
    if (j.ok) router.refresh();
    else setMsg(j.error === "reason" ? "Write the transfer reference or the reason first." : `Not saved (${j.error || res.status}).`);
  }

  return (
    <div className="tr-tbl-wrap">
      {msg && <p className="dx-muted-note" role="status">{msg}</p>}
      <table className="tr-tbl">
        <thead><tr><th>Workspace</th><th>Job</th><th className="n">Fee</th><th>Pay by</th><th>State</th><th>Reference or reason</th><th /></tr></thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id}>
              <td className="tr-name">{r.workspace}</td>
              <td>{r.job}</td>
              <td className="n">{LEI(r.amount_minor)}</td>
              <td>{r.payBy}</td>
              <td>{r.status === "void" ? "lost, locked" : r.locked ? "locked" : "in grace"}</td>
              <td><input className="input" style={{ minWidth: 160 }} aria-label="Reference or reason" value={note[r.id] || ""} onChange={(e) => setNote({ ...note, [r.id]: e.target.value })} placeholder={r.ref} /></td>
              <td style={{ whiteSpace: "nowrap" }}>
                {r.status === "due" && <button type="button" className="dx-btn primary" disabled={!!busy} onClick={() => act(r.id, "paid")}>Mark paid</button>}{" "}
                <button type="button" className="dx-btn" disabled={!!busy} onClick={() => act(r.id, "waive")}>Waive</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
