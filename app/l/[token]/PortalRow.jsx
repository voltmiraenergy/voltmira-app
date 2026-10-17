"use client";
// app/l/[token]/PortalRow.jsx — one application's status control in a
// lender's portal: the statuses it may move to (lib/loanStatus.js), the
// lender's own reference and a note. Each save carries a fresh event id, so
// a double click is one change (app/api/lenders/portal).
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function PortalRow({ token, applicationId, next, labels, t }) {
  const router = useRouter();
  const [to, setTo] = useState(next[0] || "");
  const [ref, setRef] = useState("");
  const [note, setNote] = useState("");
  const [msg, setMsg] = useState(null);
  const [busy, setBusy] = useState(false);
  if (!next.length) return null;

  async function save() {
    setBusy(true); setMsg(null);
    try {
      const res = await fetch("/api/lenders/portal", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, applicationId, status: to, lenderRef: ref, note, eventId: crypto.randomUUID() }),
      });
      const j = await res.json().catch(() => ({}));
      if (res.ok) { setMsg({ ok: true, text: t.saved }); router.refresh(); }
      else setMsg({ ok: false, text: j.error === "bad_transition" ? t.bad : t.failed });
    } catch { setMsg({ ok: false, text: t.failed }); }
    finally { setBusy(false); }
  }

  const id = (k) => `lp-${k}-${applicationId}`;
  return (
    <div className="lp-row">
      <label htmlFor={id("st")}>{t.set}
        <select id={id("st")} value={to} onChange={(e) => setTo(e.target.value)}>{next.map((s) => <option key={s} value={s}>{labels[s]}</option>)}</select>
      </label>
      <label htmlFor={id("ref")}>{t.ref}<input id={id("ref")} value={ref} maxLength={120} onChange={(e) => setRef(e.target.value)} /></label>
      <label htmlFor={id("note")}>{t.note}<input id={id("note")} value={note} maxLength={500} onChange={(e) => setNote(e.target.value)} /></label>
      <button type="button" className="pp-btn pp-btn-dark" disabled={busy} onClick={save}>{t.save}</button>
      {msg && <span className={"lp-msg " + (msg.ok ? "ok" : "bad")} role="status">{msg.text}</span>}
    </div>
  );
}
