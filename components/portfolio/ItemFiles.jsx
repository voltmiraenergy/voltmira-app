"use client";
// components/portfolio/ItemFiles.jsx — one checklist item's documents and the
// bank's questions on it: file documents (straight to the private bucket),
// open or remove one, and answer a question in words, with a document, or
// both. The data and the writes are useDealRoom's.
import { useId, useState } from "react";
import { dt } from "../../lib/dealText.js";
import { plt } from "../../lib/plantText.js";
import { ACCEPT, sizeText, isAnswered, MAX_ANSWER } from "../../lib/dealRoom.js";
import { fmtDate } from "../../lib/tz.js";

const LOC = { en: "en-IE", ro: "ro-RO", ru: "ru-RU", uk: "uk-UA" };

function Answer({ q, docs, deal, lang }) {
  const id = useId();
  const [editing, setEditing] = useState(!isAnswered(q));
  const [text, setText] = useState(q.answer || "");
  const [docId, setDocId] = useState(q.answer_doc_id || "");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(false);
  const day = (iso) => fmtDate(iso, LOC[lang], { day: "numeric", month: "long", year: "numeric" });
  const docName = docs.find((d) => d.id === q.answer_doc_id)?.name;

  if (!editing) {
    return (
      <div className="if-a">
        <small>{dt("if_answered", lang, { date: day(q.answered_at || q.created_at) })}</small>
        {q.answer && <p>{q.answer}</p>}
        {docName && <p className="if-a-doc">{dt("b_answer_doc", lang, { x: docName })}</p>}
        <button type="button" className="if-link" onClick={() => setEditing(true)}>{dt("if_edit", lang)}</button>
      </div>
    );
  }
  async function send(e) {
    e.preventDefault();
    if (!text.trim() && !docId) return;
    setBusy(true); setErr(false);
    const ok = await deal.answer(q, { text, docId });
    setBusy(false);
    if (ok) setEditing(false); else setErr(true);
  }
  return (
    <form className="if-a-form" onSubmit={send}>
      <label className="sr-only" htmlFor={id + "t"}>{dt("if_answer_ph", lang)}</label>
      <textarea id={id + "t"} className="input" rows={2} placeholder={dt("if_answer_ph", lang)} value={text} maxLength={MAX_ANSWER} onChange={(e) => setText(e.target.value)} />
      <div className="if-a-row">
        {docs.length > 0 && (
          <label className="if-a-pick">{dt("if_attach", lang)}
            <select className="input" value={docId} onChange={(e) => setDocId(e.target.value)}>
              <option value="">{dt("if_attach_none", lang)}</option>
              {docs.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </label>
        )}
        <button type="submit" className="btn primary sm" disabled={busy || (!text.trim() && !docId)} aria-busy={busy}>{dt("if_answer", lang)}</button>
        {err && <span className="if-err" role="alert">{dt("dr_err", lang)}</span>}
      </div>
    </form>
  );
}

export default function ItemFiles({ itemId, deal, lang }) {
  const inputId = useId();
  const [busy, setBusy] = useState("");
  const [problems, setProblems] = useState([]);
  const docs = deal.docs.filter((d) => d.item_id === itemId);
  const qs = deal.questions.filter((q) => q.item_id === itemId);
  const bankOf = (q) => deal.links.find((l) => l.id === q.link_id)?.bank || "";
  const day = (iso) => fmtDate(iso, LOC[lang], { day: "numeric", month: "long", year: "numeric" });

  async function pick(e) {
    const files = Array.from(e.target.files || []);
    e.target.value = "";
    if (!files.length) return;
    setProblems([]);
    setBusy(files.map((f) => f.name).join(", "));
    const p = await deal.upload(itemId, files);
    setBusy("");
    setProblems(p);
  }
  async function drop(d) {
    if (!window.confirm(dt("if_remove_q", lang, { x: d.name }))) return;
    await deal.remove(d);
  }

  return (
    <div className="if">
      <div className="if-docs">
        {docs.length ? (
          <ul className="if-list">
            {docs.map((d) => (
              <li key={d.id}>
                <button type="button" className="if-link" onClick={() => deal.download(d)}>{d.name}</button>
                <small>{sizeText(d.size_bytes, lang)}, {day(d.created_at)}</small>
                <button type="button" className="if-x" onClick={() => drop(d)} aria-label={`${dt("if_remove", lang)}: ${d.name}`}>{dt("if_remove", lang)}</button>
              </li>
            ))}
          </ul>
        ) : <p className="if-none">{dt("if_none", lang)}</p>}
        <div className="if-up">
          <input id={inputId} className="sr-only" type="file" multiple accept={ACCEPT} onChange={pick} disabled={!!busy} />
          <label htmlFor={inputId} className={"btn ghost sm" + (busy ? " off" : "")} aria-disabled={!!busy || undefined}>{dt("if_add", lang)}</label>
          {busy && <span className="if-busy" role="status">{dt("if_uploading", lang, { x: busy })}</span>}
        </div>
        {problems.length > 0 && (
          <ul className="if-problems" role="alert">
            {problems.map((p, i) => (
              <li key={i}>{p.error === "type" ? dt("if_type", lang, { x: p.name }) : p.error === "size" ? dt("if_size", lang, { x: p.name }) : p.error === "empty" ? dt("if_empty", lang, { x: p.name }) : `${p.name}: ${dt("dr_err", lang)}`}</li>
            ))}
          </ul>
        )}
      </div>
      {qs.length > 0 && (
        <ul className="if-qs" aria-label={plt("pm_" + itemId, lang)}>
          {qs.map((q) => (
            <li key={q.id}>
              <p className="if-q"><small>{dt("if_asked", lang, { who: [bankOf(q), q.asked_by].filter(Boolean).join(", ") || dt("dr_bank", lang), date: day(q.created_at) })}</small>{q.body}</p>
              <Answer q={q} docs={docs} deal={deal} lang={lang} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
