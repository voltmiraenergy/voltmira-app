"use client";
// app/p/[code]/HomeClaim.jsx — on a signed offer: the client opens their own
// account (app/home) with the email the installer has for them; a sign-in
// link is emailed (/api/home/claim). The answer is the same for any address.
import { useId, useState } from "react";

export default function HomeClaim({ code, T }) {
  const id = useId();
  const [email, setEmail] = useState("");
  const [state, setState] = useState("idle");

  async function send(e) {
    e.preventDefault();
    if (state === "sending") return;
    setState("sending");
    const res = await fetch("/api/home/claim", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ code, email }) }).catch(() => null);
    const j = res ? await res.json().catch(() => ({})) : {};
    setState(res?.ok ? "sent" : j.error === "installer_account" ? "installer" : "error");
  }

  return (
    <div className="pp-card pp-home">
      <h3>{T.hc_h}</h3>
      <p>{T.hc_p}</p>
      {state === "sent" ? <p className="pp-ok-msg" role="status">{T.hl_sent}</p> : (
        <form className="pp-home-form" onSubmit={send}>
          <label className="pp-field-l" htmlFor={`${id}-e`}>{T.hl_email}</label>
          <div className="pp-home-row">
            <input id={`${id}-e`} className="pp-input" type="email" inputMode="email" autoComplete="email" required maxLength={200} value={email} onChange={(e) => setEmail(e.target.value)} />
            <button type="submit" className="pp-btn pp-btn-ghost" disabled={state === "sending" || !email.trim()}>{state === "sending" ? T.hl_sending : T.hc_open}</button>
          </div>
          <p className="pp-rec-note">{T.hc_hint}</p>
          {state === "installer" && <p className="pp-err" role="alert">{T.hl_installer}</p>}
          {state === "error" && <p className="pp-err" role="alert">{T.hl_error}</p>}
        </form>
      )}
    </div>
  );
}
