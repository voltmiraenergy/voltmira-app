"use client";
// app/(app)/admin/lenders/LenderActions.jsx — a new portal link for a lender
// (shown once, to copy), or sending an undelivered application again.
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function LenderActions({ mode, id, label, once = "" }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [out, setOut] = useState(null);

  async function run() {
    setBusy(true); setOut(null);
    try {
      const res = await fetch("/api/admin/lenders", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(mode === "portal" ? { action: "portal", lenderId: id } : { action: "resend", applicationId: id }),
      });
      const j = await res.json().catch(() => ({}));
      if (res.ok && mode === "portal") setOut({ ok: true, url: j.url });
      else if (res.ok) { setOut({ ok: true }); router.refresh(); }
      else setOut({ ok: false, text: j.error || String(res.status) });
    } catch { setOut({ ok: false, text: "network" }); }
    finally { setBusy(false); }
  }

  return (
    <div style={{ display: "grid", gap: 6 }}>
      <button type="button" className="btn ghost sm" disabled={busy} onClick={run}>{label}</button>
      {out?.url && (
        <>
          <input className="input" readOnly value={out.url} onFocus={(e) => e.target.select()} aria-label={label} style={{ fontSize: 12, minWidth: 260 }} />
          <small>{once}</small>
        </>
      )}
      {out && !out.ok && <small className="adm-msg bad">{out.text}</small>}
    </div>
  );
}
