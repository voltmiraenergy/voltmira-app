"use client";
// app/home/[id]/HomeTickets.jsx — the homeowner's maintenance requests: the
// form, and each request with where it stands. A resolved one can be reopened
// when it is not right. Saved through /api/home/ticket.
import { useId, useState } from "react";
import { useRouter } from "next/navigation";

const KINDS = ["fault", "underproduction", "cleaning", "damage", "other"];
const LOC = { en: "en-GB", ro: "ro-RO", ru: "ru-RU", uk: "uk-UA" };

export default function HomeTickets({ projectId, lang, T, company, tickets, needsDb }) {
  const router = useRouter();
  const id = useId();
  const [kind, setKind] = useState("fault");
  const [title, setTitle] = useState("");
  const [detail, setDetail] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);
  const when = (iso) => new Intl.DateTimeFormat(LOC[lang] || "ro-RO", { day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" }).format(new Date(iso));
  const fill = (s, v) => Object.entries(v).reduce((a, [k, x]) => a.split(`{${k}}`).join(x), s);

  async function post(payload) {
    setBusy(true); setMsg(null);
    const res = await fetch("/api/home/ticket", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ projectId, ...payload }) }).catch(() => null);
    setBusy(false);
    if (!res?.ok) { setMsg({ ok: false, text: T.hm_failed }); return false; }
    router.refresh();
    return true;
  }

  async function send(e) {
    e.preventDefault();
    if (busy || title.trim().length < 2) return;
    if (await post({ kind, title, detail })) { setTitle(""); setDetail(""); setMsg({ ok: true, text: fill(T.hm_mt_sent, { co: company }) }); }
  }

  const status = (t) => (t.status === "scheduled" && t.visit_at ? fill(T.hm_mt_st_scheduled, { d: when(t.visit_at) }) : T["hm_mt_st_" + t.status]);

  return (
    <section className="pp-card hm-card hm-wide" aria-labelledby={`${id}-h`}>
      <h2 className="pp-h3" id={`${id}-h`}>{T.hm_mt_h}</h2>
      <p className="hm-muted">{T.hm_mt_p}</p>
      {tickets.length === 0 ? <p className="hm-muted">{T.hm_mt_none}</p> : (
        <ul className="hm-tickets">
          {tickets.map((t) => (
            <li key={t.id}>
              <div>
                <b>{t.title}</b>
                <small className="hm-muted">{when(t.created_at)}{t.source === "monitoring" ? `, ${T.hm_mt_by_mon}` : ""}</small>
                {t.outcome && <small>{t.outcome}</small>}
              </div>
              <span className={"hm-st s-" + t.status}>{status(t)}</span>
              {t.status === "resolved" && <button type="button" className="pp-btn pp-btn-text" disabled={busy} onClick={() => post({ ticketId: t.id, to: "open" })}>{T.hm_mt_reopen}</button>}
            </li>
          ))}
        </ul>
      )}
      {!needsDb && (
        <form className="hm-form" onSubmit={send}>
          <label className="pp-field-l" htmlFor={`${id}-k`}>{T.hm_mt_kind}</label>
          <select id={`${id}-k`} className="pp-input" value={kind} onChange={(e) => setKind(e.target.value)}>
            {KINDS.map((k) => <option key={k} value={k}>{T["hm_mt_k_" + k]}</option>)}
          </select>
          <label className="pp-field-l" htmlFor={`${id}-t`}>{T.hm_mt_title}</label>
          <input id={`${id}-t`} className="pp-input" maxLength={160} required value={title} onChange={(e) => setTitle(e.target.value)} />
          <label className="pp-field-l" htmlFor={`${id}-d`}>{T.hm_mt_detail}</label>
          <textarea id={`${id}-d`} className="pp-input" rows={3} maxLength={2000} value={detail} onChange={(e) => setDetail(e.target.value)} />
          <button type="submit" className="pp-btn pp-btn-accept" disabled={busy || title.trim().length < 2}>{T.hm_mt_send}</button>
        </form>
      )}
      {msg && <p className={msg.ok ? "pp-ok-msg" : "pp-err"} role="status">{msg.text}</p>}
    </section>
  );
}
