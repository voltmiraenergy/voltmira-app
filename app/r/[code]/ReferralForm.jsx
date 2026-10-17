"use client";
// app/r/[code]/ReferralForm.jsx — name, phone and locality for the installer
// to call (app/api/referral). A hidden field catches form-filling robots. Says
// "sent" only when the server has saved it.
import { useState } from "react";
import { rt } from "./text.js";

export default function ReferralForm({ code, lang }) {
  const [f, setF] = useState({ name: "", phone: "", locality: "", hp: "" });
  const [state, setState] = useState(null);       // null | "sending" | { co } | "failed"
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.value }));

  async function send(e) {
    e.preventDefault();
    setState("sending");
    try {
      const res = await fetch("/api/referral", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ code, ...f }) });
      const j = await res.json().catch(() => ({}));
      setState(res.ok && j.ok ? { co: j.company || "" } : "failed");
    } catch {
      setState("failed");
    }
  }

  if (state && typeof state === "object") return <p className="rf-sent" role="status">{rt("sent", lang, { co: state.co })}</p>;
  return (
    <form className="rf-form" onSubmit={send}>
      <label htmlFor="rf-name">{rt("name", lang)}<input id="rf-name" className="rf-in" required maxLength={120} autoComplete="name" value={f.name} onChange={set("name")} /></label>
      <label htmlFor="rf-phone">{rt("phone", lang)}<input id="rf-phone" className="rf-in" required type="tel" inputMode="tel" maxLength={30} autoComplete="tel" value={f.phone} onChange={set("phone")} /></label>
      <label htmlFor="rf-place">{rt("place", lang)}<input id="rf-place" className="rf-in" maxLength={80} value={f.locality} onChange={set("locality")} /></label>
      {/* robots fill every field; people never see this one */}
      <input className="rf-hp" tabIndex={-1} autoComplete="off" aria-hidden="true" value={f.hp} onChange={set("hp")} name="website" />
      <button type="submit" className="pp-btn pp-btn-accept" disabled={state === "sending"}>{state === "sending" ? rt("sending", lang) : rt("send", lang)}</button>
      {state === "failed" && <p className="rf-err" role="alert">{rt("failed", lang)}</p>}
    </form>
  );
}
