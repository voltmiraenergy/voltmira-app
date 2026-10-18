"use client";
// app/(app)/admin/installers/VerifyActions.jsx — verify or reject one
// installer, with a note the installer receives.
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function VerifyActions({ companyId, T }) {
  const router = useRouter();
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [out, setOut] = useState(null);

  async function decide(decision) {
    setBusy(true); setOut(null);
    const res = await fetch("/api/admin/installers", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ companyId, decision, note }) }).catch(() => null);
    const j = res ? await res.json().catch(() => ({})) : {};
    setBusy(false);
    setOut(j.ok ? T.done : j.error || "error");
    if (j.ok) router.refresh();
  }

  return (
    <div style={{ display: "grid", gap: 6, minWidth: 200 }}>
      <input className="input" placeholder={T.note} value={note} maxLength={500} onChange={(e) => setNote(e.target.value)} aria-label={T.note} />
      <div style={{ display: "flex", gap: 6 }}>
        <button type="button" className="btn sm primary" disabled={busy} onClick={() => decide("verified")}>{T.verify}</button>
        <button type="button" className="btn sm ghost" disabled={busy || note.trim().length < 3} onClick={() => decide("rejected")}>{T.reject}</button>
      </div>
      {out && <small>{out}</small>}
    </div>
  );
}
