"use client";
// app/home/login/HomeLoginForm.jsx — the email field and the answer, which is
// the same whether or not the address has a system.
import { useId, useState } from "react";

export default function HomeLoginForm({ T }) {
  const id = useId();
  const [email, setEmail] = useState("");
  const [state, setState] = useState("idle");   // idle | sending | sent | installer | error

  async function send(e) {
    e.preventDefault();
    if (state === "sending") return;
    setState("sending");
    const res = await fetch("/api/home/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email }) }).catch(() => null);
    const j = res ? await res.json().catch(() => ({})) : {};
    setState(res?.ok ? "sent" : j.error === "installer_account" ? "installer" : "error");
  }

  if (state === "sent") return <p className="pp-ok-msg" role="status">{T.hl_sent}</p>;
  return (
    <form className="hm-form" onSubmit={send}>
      <label className="pp-field-l" htmlFor={`${id}-e`}>{T.hl_email}</label>
      <input id={`${id}-e`} className="pp-input" type="email" inputMode="email" autoComplete="email" required maxLength={200} value={email} onChange={(e) => setEmail(e.target.value)} />
      <button type="submit" className="pp-btn pp-btn-accept pp-btn-block" disabled={state === "sending" || !email.trim()}>{state === "sending" ? T.hl_sending : T.hl_send}</button>
      {state === "installer" && <p className="pp-err" role="alert">{T.hl_installer}</p>}
      {state === "error" && <p className="pp-err" role="alert">{T.hl_error}</p>}
    </form>
  );
}
