"use client";
// app/r/[code]/ReferralForm.jsx — name, phone, locality and (optionally) the
// monthly bill, for the installer to call (app/api/referral). A field placed
// off screen catches form-filling robots; it is hidden inline too, so it never
// shows even before the stylesheet loads. Says "sent" only when the server has
// saved it.
import { useState } from "react";
import { rt } from "./text.js";

const OFF_SCREEN = { position: "absolute", left: "-10000px", top: "auto", width: 1, height: 1, overflow: "hidden", opacity: 0 };

export default function ReferralForm({ code, lang, unit = "lei" }) {
  const [f, setF] = useState({ name: "", phone: "", locality: "", bill: "", hp: "" });
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
      <label htmlFor="rf-phone">{rt("phone", lang)}<input id="rf-phone" className="rf-in" required type="tel" inputMode="tel" maxLength={30} autoComplete="tel" placeholder="069 123 456" value={f.phone} onChange={set("phone")} /></label>
      <label htmlFor="rf-place">{rt("place", lang)}<input id="rf-place" className="rf-in" maxLength={80} autoComplete="address-level2" value={f.locality} onChange={set("locality")} /></label>
      <label htmlFor="rf-bill">{rt("bill", lang)}
        <span className="rf-unit"><input id="rf-bill" className="rf-in" inputMode="numeric" maxLength={7} value={f.bill} onChange={(e) => setF((x) => ({ ...x, bill: e.target.value.replace(/[^\d]/g, "") }))} /><em>{unit}</em></span>
      </label>
      {/* robots fill every field; people never see or reach this one */}
      <div style={OFF_SCREEN} aria-hidden="true">
        <input tabIndex={-1} autoComplete="off" value={f.hp} onChange={set("hp")} name="website" />
      </div>
      <button type="submit" className="pp-btn pp-btn-accept" disabled={state === "sending"}>{state === "sending" ? rt("sending", lang) : rt("send", lang)}</button>
      {state === "failed" && <p className="rf-err" role="alert">{rt("failed", lang)}</p>}
    </form>
  );
}
