"use client";
// app/solar/FunnelForm.jsx — the funnel's two steps: the home (address and
// consumption: a monthly bill, a yearly kWh figure, or a bill photo when AI is
// on) and its instant estimate, then the request for offers with consent.
// /api/solar/estimate, /api/solar/bill, /api/solar/request.
import { useId, useState } from "react";

const LOC = { en: "en-GB", ro: "ro-RO", ru: "ru-RU", uk: "uk-UA" };
const newKey = () => (globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`);
const fill = (s, v) => Object.entries(v).reduce((a, [k, x]) => a.split(`{${k}}`).join(String(x)), s);

export default function FunnelForm({ lang, T, photo = false, privacyHref }) {
  const id = useId();
  const nf = (n, d = 0) => Number(n).toLocaleString(LOC[lang] || "ro-RO", { maximumFractionDigits: d });
  const [address, setAddress] = useState("");
  const [mode, setMode] = useState("bill");
  const [bill, setBill] = useState("");
  const [kwh, setKwh] = useState("");
  const [readKwh, setReadKwh] = useState(null);
  const [est, setEst] = useState(null);
  const [state, setState] = useState("idle");      // idle | working | reading | error
  const [err, setErr] = useState("");
  const [form, setForm] = useState({ name: "", phone: "", email: "", consent: false });
  const [key] = useState(newKey);
  const [sent, setSent] = useState(null);
  const [sendState, setSendState] = useState("idle");

  const consumption = () => (mode === "bill" ? { monthlyBill: Number(String(bill).replace(",", ".")) || null } : { consKwhYear: Number(mode === "kwh" ? kwh : readKwh) || null });

  async function estimate(e) {
    e.preventDefault();
    if (state === "working") return;
    setState("working"); setErr(""); setEst(null);
    const res = await fetch("/api/solar/estimate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ address, ...consumption() }) }).catch(() => null);
    const j = res ? await res.json().catch(() => ({})) : {};
    if (res?.ok && j.estimate) { setEst(j.estimate); setState("idle"); return; }
    setState("error");
    setErr(j.error === "not_found" ? T.fn_e_not_found : j.error === "md_only" ? T.fn_e_md_only : T.fn_e_other);
  }

  async function readPhoto(file) {
    if (!file) return;
    setState("reading"); setErr(""); setReadKwh(null);
    const fd = new FormData(); fd.append("file", file);
    const res = await fetch("/api/solar/bill", { method: "POST", body: fd }).catch(() => null);
    const j = res ? await res.json().catch(() => ({})) : {};
    if (res?.ok && j.annualKwh > 0) { setReadKwh(j.annualKwh); setState("idle"); }
    else { setState("error"); setErr(T.fn_photo_failed); setMode("bill"); }
  }

  async function request(e) {
    e.preventDefault();
    if (sendState === "sending") return;
    setSendState("sending");
    const res = await fetch("/api/solar/request", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...form, address, lang, idempotencyKey: key, ...consumption() }) }).catch(() => null);
    const j = res ? await res.json().catch(() => ({})) : {};
    if (res?.ok) { setSent(j); setSendState("idle"); return; }
    setSendState(res?.status === 400 ? "invalid" : "error");
  }

  const pb = est?.payback;
  const years = pb?.expc != null ? (pb.pess != null && pb.opti != null ? fill(T.fn_res_years, { a: nf(pb.opti, 1), b: nf(pb.pess, 1) }) : nf(pb.expc, 1)) : "";
  const lei = (v) => `${nf(v)} lei`;

  return (
    <div className="sf-flow">
      <form className="pp-card sf-card" onSubmit={estimate} aria-labelledby={`${id}-s1`}>
        <h2 className="pp-h3" id={`${id}-s1`}>{T.fn_step1}</h2>
        <label className="pp-field-l" htmlFor={`${id}-a`}>{T.fn_address}</label>
        <input id={`${id}-a`} className="pp-input" required minLength={3} maxLength={200} autoComplete="street-address" placeholder={T.fn_address_ph} value={address} onChange={(e) => { setAddress(e.target.value); setEst(null); }} />
        <p className="pp-field-l" id={`${id}-u`}>{T.fn_use}</p>
        <div className="sf-seg" role="radiogroup" aria-labelledby={`${id}-u`}>
          {["bill", "kwh", ...(photo ? ["photo"] : [])].map((m) => (
            <button key={m} type="button" role="radio" aria-checked={mode === m} className={mode === m ? "on" : ""} onClick={() => { setMode(m); setEst(null); }}>
              {m === "bill" ? T.fn_by_bill : m === "kwh" ? T.fn_by_kwh : T.fn_by_photo}
            </button>
          ))}
        </div>
        {mode === "bill" && (
          <><label className="pp-field-l" htmlFor={`${id}-b`}>{T.fn_bill}</label>
            <input id={`${id}-b`} className="pp-input" inputMode="decimal" value={bill} onChange={(e) => { setBill(e.target.value); setEst(null); }} /></>
        )}
        {mode === "kwh" && (
          <><label className="pp-field-l" htmlFor={`${id}-k`}>{T.fn_kwh}</label>
            <input id={`${id}-k`} className="pp-input" inputMode="numeric" value={kwh} onChange={(e) => { setKwh(e.target.value.replace(/\D/g, "")); setEst(null); }} /></>
        )}
        {mode === "photo" && (
          <><label className="pp-field-l" htmlFor={`${id}-p`}>{T.fn_photo}</label>
            <input id={`${id}-p`} className="sf-file" type="file" accept="image/*,application/pdf" onChange={(e) => readPhoto(e.target.files?.[0])} />
            {readKwh && <p className="pp-ok-msg">{fill(T.fn_photo_read, { kwh: nf(readKwh) })}</p>}</>
        )}
        <button type="submit" className="pp-btn pp-btn-accept pp-btn-block" disabled={state === "working" || state === "reading" || address.trim().length < 3}>
          {state === "working" || state === "reading" ? T.fn_working : T.fn_estimate}
        </button>
        {state === "error" && <p className="pp-err" role="alert">{err}</p>}
      </form>

      {est && (
        <section className="pp-card sf-card sf-result" aria-labelledby={`${id}-r`}>
          <h2 className="pp-h3" id={`${id}-r`}>{T.fn_res_h}</h2>
          <p className="sf-p">{fill(T.fn_res_where, { place: est.location })}</p>
          <dl className="sf-tiles">
            <div><dt>{T.fn_res_kw}</dt><dd>{nf(est.recommendedKw, 1)} <small>kW</small></dd></div>
            <div><dt>{T.fn_res_prod}</dt><dd>{nf(est.prodKwh)} <small>kWh</small></dd></div>
            <div><dt>{T.fn_res_cost}</dt><dd>{lei(est.cost.local)}</dd></div>
            <div><dt>{T.fn_res_save}</dt><dd>{lei(est.annualSavings.local)}</dd></div>
            {years && <div className="wide"><dt>{T.fn_res_payback}</dt><dd>{years}</dd></div>}
          </dl>
          <p className="sf-note">{fill(T.fn_res_note, { source: est.tariff?.source || "ANRE" })}</p>
        </section>
      )}

      {est && !sent && (
        <form className="pp-card sf-card" onSubmit={request} aria-labelledby={`${id}-q`}>
          <h2 className="pp-h3" id={`${id}-q`}>{T.fn_req_h}</h2>
          <p className="sf-p">{T.fn_req_p}</p>
          <label className="pp-field-l" htmlFor={`${id}-n`}>{T.fn_name}</label>
          <input id={`${id}-n`} className="pp-input" required autoComplete="name" maxLength={120} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <div className="sf-two">
            <div><label className="pp-field-l" htmlFor={`${id}-ph`}>{T.fn_phone}</label>
              <input id={`${id}-ph`} className="pp-input" type="tel" inputMode="tel" autoComplete="tel" maxLength={40} value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
            <div><label className="pp-field-l" htmlFor={`${id}-em`}>{T.fn_email}</label>
              <input id={`${id}-em`} className="pp-input" type="email" inputMode="email" autoComplete="email" maxLength={200} value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
          </div>
          <label className="sf-consent">
            <input type="checkbox" checked={form.consent} onChange={(e) => setForm({ ...form, consent: e.target.checked })} />
            <span>{T.fn_consent} <a href={privacyHref} target="_blank" rel="noopener noreferrer">{T.fn_privacy}</a></span>
          </label>
          <button type="submit" className="pp-btn pp-btn-accept pp-btn-block" disabled={sendState === "sending" || !form.consent || form.name.trim().length < 2}>
            {sendState === "sending" ? T.fn_sending : T.fn_send}
          </button>
          {(sendState === "invalid" || sendState === "error") && <p className="pp-err" role="alert">{sendState === "invalid" ? T.fn_req_e : T.fn_req_failed}</p>}
        </form>
      )}

      {sent && (
        <section className="pp-card sf-card sf-done" role="status">
          <h2 className="pp-h3">{T.fn_sent_h}</h2>
          <p className="sf-p">{sent.offered ? fill(T.fn_sent_p, { n: sent.offered, h: sent.hours || 24 }) : T.fn_sent_none}</p>
          {sent.statusUrl && <a className="pp-btn pp-btn-ghost" href={sent.statusUrl}>{T.fn_status_link}</a>}
        </section>
      )}
    </div>
  );
}
