"use client";
// app/sign/mock/[id]/MockSign.jsx — the simulation's two answers: sign with a
// name, or cancel. Either way the client goes back through the same return
// URL a real MSign would use (/api/qsign/return).
import { useId, useState } from "react";

export default function MockSign({ requestId, pending, code, T }) {
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const id = useId();

  async function answer(decision) {
    if (busy) return;
    setBusy(true); setFailed(false);
    const res = await fetch("/api/qsign/mock", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ requestId, decision, signer: name.trim() }),
    }).catch(() => null);
    const out = res && res.ok ? await res.json().catch(() => null) : null;
    if (!out?.next) { setFailed(true); setBusy(false); return; }
    window.location.assign(out.next);
  }

  if (!pending) {
    return (
      <>
        <p className="pp-lead" style={{ margin: 0 }}>{T.qm_done}</p>
        <a className="pp-btn pp-btn-ghost" href={`/p/${encodeURIComponent(code)}`}>{T.qm_back}</a>
      </>
    );
  }
  return (
    <>
      <div>
        <label className="pp-field-l" htmlFor={`${id}-n`}>{T.qm_name}</label>
        <input id={`${id}-n`} className="pp-input" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" maxLength={120} />
      </div>
      <div className="qm-btns">
        <button type="button" className="pp-btn pp-btn-accept" disabled={busy || name.trim().length < 3} onClick={() => answer("sign")}>{T.qm_sign}</button>
        <button type="button" className="pp-btn pp-btn-ghost" disabled={busy} onClick={() => answer("decline")}>{T.qm_decline}</button>
      </div>
      {failed && <p className="pp-err" role="alert">{T.qs_error}</p>}
    </>
  );
}
