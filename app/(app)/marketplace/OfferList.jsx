"use client";
// app/(app)/marketplace/OfferList.jsx — requests offered to this installer:
// the open ones with a live countdown and accept / decline, the accepted ones
// with the contact and a link to the lead, the rest folded away.
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

const LOC = { en: "en-GB", ro: "ro-RO", ru: "ru-RU", uk: "uk-UA" };
const fill = (s, v) => Object.entries(v).reduce((a, [k, x]) => a.split(`{${k}}`).join(String(x)), s);

function useNow(ms = 30000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), ms); return () => clearInterval(t); }, [ms]);
  return now;
}

export default function OfferList({ lang, T, rows }) {
  const router = useRouter();
  const now = useNow();
  const [busy, setBusy] = useState(null);
  const [declining, setDeclining] = useState(null);
  const [reason, setReason] = useState("");
  const [msg, setMsg] = useState(null);
  const nf = (n, d = 0) => Number(n).toLocaleString(LOC[lang] || "ro-RO", { maximumFractionDigits: d });
  const open = rows.filter((r) => r.status === "offered");
  const taken = rows.filter((r) => r.status === "accepted");
  const past = rows.filter((r) => !["offered", "accepted"].includes(r.status));

  async function answer(id, accept) {
    setBusy(id); setMsg(null);
    const res = await fetch("/api/marketplace/respond", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ offerId: id, accept, reason: accept ? "" : reason }) }).catch(() => null);
    const j = res ? await res.json().catch(() => ({})) : {};
    setBusy(null);
    if (!res?.ok) setMsg(j.error === "expired" ? T.mp_e_expired : T.mp_e_other);
    setDeclining(null); setReason("");
    router.refresh();
  }

  const left = (iso) => {
    const ms = Date.parse(iso) - now;
    if (ms <= 0) return T.mp_overdue;
    const m = Math.floor(ms / 60000);
    return fill(T.mp_left, { h: Math.floor(m / 60), m: m % 60 });
  };
  const facts = (r) => (
    <dl className="mp-facts">
      <div><dt>{T.mp_cons}</dt><dd>{nf(r.cons)} kWh</dd></div>
      {r.cost && <div><dt>{T.mp_est}</dt><dd>{nf(r.cost)} lei{r.payback ? `, ${fill(T.mp_years, { n: nf(r.payback, 1) })}` : ""}</dd></div>}
    </dl>
  );

  return (
    <section className="dx-card bl-card" aria-labelledby="mp-req-h">
      <header className="dx-card-head"><div><h2 id="mp-req-h">{T.mp_req_h}</h2></div></header>
      {open.length === 0 && taken.length === 0 && <p className="bl-muted">{T.mp_req_none}</p>}
      {open.length > 0 && (
        <ul className="mp-list">
          {open.map((r) => {
            const late = Date.parse(r.respondBy) <= now;
            return (
              <li key={r.id} className="mp-offer">
                <div className="mp-top">
                  <b>{fill(T.mp_where, { where: r.where, kw: nf(r.kw, 1) })}</b>
                  <span className={"mp-clock" + (late ? " late" : "")}>{left(r.respondBy)}</span>
                </div>
                {facts(r)}
                {declining === r.id ? (
                  <div className="mp-decline">
                    <label className="bl-field"><span>{T.mp_reason}</span><input className="input" maxLength={300} value={reason} onChange={(e) => setReason(e.target.value)} /></label>
                    <div className="bl-acts">
                      <button type="button" className="btn sm ghost" disabled={busy === r.id} onClick={() => answer(r.id, false)}>{T.mp_decline}</button>
                      <button type="button" className="btn sm ghost" onClick={() => setDeclining(null)}>{T.mp_cancel}</button>
                    </div>
                  </div>
                ) : (
                  <div className="bl-acts">
                    <button type="button" className="btn sm primary" disabled={busy === r.id || late} onClick={() => answer(r.id, true)}>{T.mp_accept}</button>
                    <button type="button" className="btn sm ghost" disabled={busy === r.id} onClick={() => setDeclining(r.id)}>{T.mp_decline}</button>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
      {msg && <p className="bl-note bad" role="alert">{msg}</p>}
      {taken.length > 0 && (
        <>
          <h3 className="mp-h3">{T.mp_accepted_h}</h3>
          <ul className="mp-list">
            {taken.map((r) => (
              <li key={r.id} className="mp-offer taken">
                <div className="mp-top"><b>{r.contact?.name}</b><span>{fill(T.mp_where, { where: r.where, kw: nf(r.kw, 1) })}</span></div>
                <p className="bl-muted">{[r.contact?.phone, r.contact?.email, r.contact?.address].filter(Boolean).join(", ")}</p>
                <a className="btn sm ghost" href="/leads">{T.mp_open_lead}</a>
              </li>
            ))}
          </ul>
        </>
      )}
      {past.length > 0 && (
        <details className="bl-hist">
          <summary>{T.mp_past_h} ({past.length})</summary>
          <ol>{past.map((r) => <li key={r.id}>{fill(T.mp_where, { where: r.where, kw: nf(r.kw, 1) })}: {T["mp_st_" + r.status]}</li>)}</ol>
        </details>
      )}
    </section>
  );
}
