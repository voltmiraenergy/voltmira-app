"use client";
// app/(app)/projects/[id]/ClientCare.jsx — after the offer is signed: the
// client's own account (invite them, see who is linked) and maintenance
// (tickets from the client, from monitoring, or opened here; book a visit,
// log what was done). Saved through /api/projects/[id]/homeowner-invite and
// /tickets; the client hears about each change. Styles: gridfile.css (.cc-*).
import { useId, useState } from "react";
import { useRouter } from "next/navigation";
import { xt } from "../../../../lib/integrationText.js";

const LOC = { en: "en-GB", ro: "ro-RO", ru: "ru-RU", uk: "uk-UA" };

export default function ClientCare({ projectId, lang, clientEmail = "", linked = [], tickets = [], needsDb = false }) {
  const router = useRouter();
  const id = useId();
  const T = (k, v) => xt(k, lang, v);
  const when = (iso) => new Intl.DateTimeFormat(LOC[lang] || "ro-RO", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(iso));
  const [email, setEmail] = useState(clientEmail);
  const [inv, setInv] = useState(null);
  const [busy, setBusy] = useState(false);
  const [title, setTitle] = useState("");
  const [detail, setDetail] = useState("");
  const [open, setOpen] = useState(null);         // the ticket being acted on
  const [visit, setVisit] = useState("");
  const [outcome, setOutcome] = useState("");
  const [msg, setMsg] = useState(null);

  async function invite(e) {
    e.preventDefault();
    if (busy) return;
    setBusy(true); setInv(null);
    const res = await fetch(`/api/projects/${projectId}/homeowner-invite`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email }) }).catch(() => null);
    const j = res ? await res.json().catch(() => ({})) : {};
    setBusy(false);
    if (j.ok) { setInv({ ok: true, text: T("hi_sent", { email }) }); router.refresh(); }
    else setInv({ ok: false, text: T("hi_e_" + j.error) !== "hi_e_" + j.error ? T("hi_e_" + j.error) : j.error === "needs_db" ? T("bl_needs_db") : T("hi_e_other") });
  }

  async function ticket(payload) {
    if (busy) return false;
    setBusy(true); setMsg(null);
    const res = await fetch(`/api/projects/${projectId}/tickets`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) }).catch(() => null);
    const j = res ? await res.json().catch(() => ({})) : {};
    setBusy(false);
    if (!j.ok) { setMsg(T("mt_e_" + j.error) !== "mt_e_" + j.error ? T("mt_e_" + j.error) : j.error === "needs_db" ? T("bl_needs_db") : T("mt_e_other")); return false; }
    router.refresh();
    return true;
  }

  const status = (t) => (t.status === "scheduled" && t.visit_at ? T("mt_st_scheduled", { d: when(t.visit_at) }) : T("mt_st_" + t.status));

  return (
    <section className="card cc" aria-labelledby={`${id}-h`}>
      <div className="cc-block">
        <h3 id={`${id}-h`}>{T("hi_h")}</h3>
        <p className="cc-p">{T("hi_p")}</p>
        {linked.length > 0 && <p className="cc-p"><b>{T("hi_linked", { list: linked.join(", ") })}</b></p>}
        <form className="cc-row" onSubmit={invite}>
          <label className="cc-field" htmlFor={`${id}-em`}><span>{T("hi_email")}</span>
            <input id={`${id}-em`} className="input" type="email" required maxLength={200} value={email} onChange={(e) => setEmail(e.target.value)} />
          </label>
          <button type="submit" className="btn sm ghost" disabled={busy || needsDb || !email.trim()}>{T("hi_send")}</button>
        </form>
        {inv && <p className={"cc-msg " + (inv.ok ? "ok" : "bad")} role="status">{inv.text}</p>}
      </div>

      <div className="cc-block">
        <h3>{T("mt_h")}</h3>
        <p className="cc-p">{T("mt_lead")}</p>
        {needsDb && <p className="cc-msg bad">{T("bl_needs_db")}</p>}
        {tickets.length === 0 ? <p className="cc-p">{T("mt_none")}</p> : (
          <ul className="cc-list">
            {tickets.map((t) => (
              <li key={t.id}>
                <div className="cc-t">
                  <b>{t.title}</b>
                  <small>{T("mt_from", { src: T("mt_src_" + t.source), d: when(t.created_at) })}</small>
                  {t.detail && <small>{t.detail}</small>}
                  {t.outcome && <small>{t.outcome}</small>}
                </div>
                <span className={"cc-st s-" + t.status}>{status(t)}</span>
                {t.status !== "closed" && open !== t.id && (
                  <button type="button" className="btn sm ghost cc-act" onClick={() => { setOpen(t.id); setVisit(""); setOutcome(""); setMsg(null); }}>{t.status === "resolved" ? T("mt_close") : t.status === "open" ? T("mt_schedule") : T("mt_resolve")}</button>
                )}
                {open === t.id && (
                  <div className="cc-do">
                    {t.status !== "resolved" && (
                      <div className="cc-row">
                        <label className="cc-field"><span>{T("mt_visit")}</span><input className="input" type="datetime-local" value={visit} onChange={(e) => setVisit(e.target.value)} /></label>
                        <button type="button" className="btn sm ghost" disabled={busy || !visit} onClick={() => ticket({ action: "status", ticketId: t.id, to: "scheduled", visitAt: new Date(visit).toISOString() }).then((ok) => ok && setOpen(null))}>{T("mt_schedule")}</button>
                      </div>
                    )}
                    {t.status !== "resolved" && (
                      <div className="cc-row">
                        <label className="cc-field cc-grow"><span>{T("mt_outcome")}</span><input className="input" maxLength={2000} value={outcome} onChange={(e) => setOutcome(e.target.value)} /></label>
                        <button type="button" className="btn sm primary" disabled={busy || outcome.trim().length < 2} onClick={() => ticket({ action: "status", ticketId: t.id, to: "resolved", outcome }).then((ok) => ok && setOpen(null))}>{T("mt_resolve")}</button>
                      </div>
                    )}
                    <div className="cc-row">
                      <button type="button" className="btn sm ghost" disabled={busy} onClick={() => ticket({ action: "status", ticketId: t.id, to: "closed" }).then((ok) => ok && setOpen(null))}>{T("mt_close")}</button>
                    </div>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
        <form className="cc-new" onSubmit={async (e) => { e.preventDefault(); if (await ticket({ action: "open", title, detail, kind: "other" })) { setTitle(""); setDetail(""); } }}>
          <label className="cc-field cc-grow"><span>{T("mt_title")}</span><input className="input" maxLength={160} value={title} onChange={(e) => setTitle(e.target.value)} /></label>
          <label className="cc-field cc-grow"><span>{T("mt_detail")}</span><input className="input" maxLength={2000} value={detail} onChange={(e) => setDetail(e.target.value)} /></label>
          <button type="submit" className="btn sm ghost" disabled={busy || needsDb || title.trim().length < 2}>{T("mt_open_btn")}</button>
        </form>
        {msg && <p className="cc-msg bad" role="alert">{msg}</p>}
      </div>
    </section>
  );
}
