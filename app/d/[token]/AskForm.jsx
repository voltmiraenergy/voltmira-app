"use client";
// app/d/[token]/AskForm.jsx — the bank asks a question on one checklist item.
// Closed until asked for; sends to /api/deal/[token]/question and shows the
// question under its item, waiting for the answer, without reloading the page
// (a reload would count as another visit in the installer's log).
import { useId, useState } from "react";
import { dt } from "../../../lib/dealText.js";
import { MAX_QUESTION } from "../../../lib/dealRoom.js";
import { fmtDate } from "../../../lib/tz.js";

const LOC = { en: "en-IE", ro: "ro-RO" };

export default function AskForm({ token, item, lang }) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [body, setBody] = useState("");
  const [state, setState] = useState("idle"); // idle | sending | sent | error
  const [asked, setAsked] = useState([]);

  async function send(e) {
    e.preventDefault();
    if (!body.trim() || state === "sending") return;
    setState("sending");
    try {
      const res = await fetch(`/api/deal/${token}/question`, {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ item, name, body }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.question) throw new Error(String(res.status));
      setAsked((a) => [data.question, ...a]);
      setBody("");
      setOpen(false);
      setState("sent");
    } catch {
      setState("error");
    }
  }

  const list = asked.length > 0 && (
    <ul className="dl-qs">
      {asked.map((q) => (
        <li key={q.id}>
          <p className="dl-q"><small>{dt("b_asked", lang, { date: fmtDate(q.created_at, LOC[lang], { day: "numeric", month: "long", year: "numeric" }) })}{q.asked_by ? `, ${q.asked_by}` : ""}</small>{q.body}</p>
          <p className="dl-wait">{dt("b_waiting", lang)}</p>
        </li>
      ))}
    </ul>
  );

  if (!open) {
    return (
      <>
        {list}
        <div className="dl-ask">
          <button type="button" className="btn ghost sm" onClick={() => { setOpen(true); setState("idle"); }}>{dt("b_ask", lang)}</button>
          {state === "sent" && <span className="dl-ok" role="status">{dt("b_ask_sent", lang)}</span>}
        </div>
      </>
    );
  }
  return (
    <>
      {list}
      <form className="dl-ask-form" onSubmit={send}>
        <div className="field">
          <label htmlFor={id + "n"}>{dt("b_ask_name", lang)}</label>
          <input id={id + "n"} className="input" value={name} maxLength={120} autoComplete="name" onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor={id + "b"}>{dt("b_ask_body", lang)}</label>
          <textarea id={id + "b"} className="input" rows={3} value={body} maxLength={MAX_QUESTION} required onChange={(e) => setBody(e.target.value)} />
        </div>
        <div className="dl-ask-row">
          <button type="submit" className="btn primary sm" disabled={!body.trim() || state === "sending"} aria-busy={state === "sending"}>{dt("b_ask_send", lang)}</button>
          <button type="button" className="btn ghost sm" onClick={() => setOpen(false)}>{dt("b_ask_cancel", lang)}</button>
          {state === "error" && <span className="dl-err" role="alert">{dt("b_ask_err", lang)}</span>}
        </div>
      </form>
    </>
  );
}
