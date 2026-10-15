"use client";
// app/p/[code]/QaWidget.jsx — "ask a question about your offer," grounded in
// this specific proposal's real numbers via app/api/proposal/[code]/qa
// (VoltMira's own assistant, or the installer's Make.com scenario, whichever
// is set up there). When the assistant records a discount or option,
// OfferBanner.jsx and LivePrice.jsx show it by the accept button. This
// component only ever renders whatever comes back as PLAIN TEXT, never HTML:
// a client's question is attacker-controlled input from this component's
// point of view, and rendering a model's output as markup would be a
// prompt-injection hole into the page it's embedded in.
// Styles: proposal.css (.pp-qa).
import { useEffect, useId, useRef, useState } from "react";
import { ChevronDown, MessageCircle } from "lucide-react";
import { ppt } from "./text.js";

const MAX_TURNS = 6;
const MAX_LEN = 500;

export default function QaWidget({ code, lang = "en", preparedBy = null }) {
  const [open, setOpen] = useState(false);
  const [turns, setTurns] = useState([]); // [{q, a}]
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(false);
  const inputRef = useRef(null);
  const opened = useRef(false);
  const id = useId();

  useEffect(() => {
    if (open && opened.current) inputRef.current?.focus();
  }, [open]);

  async function ask(e) {
    e?.preventDefault();
    const question = draft.trim();
    if (!question || busy) return;
    setBusy(true); setErr(false); setDraft("");
    try {
      const res = await fetch(`/api/proposal/${code}/qa`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question,
          // Frontend keeps the conversation; the backend re-caps this too,
          // client-side caps are a UX nicety here, never the real boundary.
          priorTurns: turns.slice(-MAX_TURNS),
        }),
      });
      const data = await res.json().catch(() => null);
      const answer = typeof data?.answer === "string" && data.answer ? data.answer : null;
      setTurns((cur) => [...cur.slice(-(MAX_TURNS - 1)), { q: question, a: answer || ppt("qa_error", lang) }]);
      if (!answer) setErr(true);
      // A discount or option the assistant just recorded: shown by the accept button.
      if (data && ("offer" in data || "option" in data)) {
        window.dispatchEvent(new CustomEvent("voltmira:offer", { detail: { offer: data.offer ?? null, option: data.option ?? null } }));
      }
    } catch {
      setTurns((cur) => [...cur.slice(-(MAX_TURNS - 1)), { q: question, a: ppt("qa_error", lang) }]);
      setErr(true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="pp-qa pp-card">
      <button type="button" className="pp-qa-head" aria-expanded={open} aria-controls={`${id}-body`}
        onClick={() => { opened.current = true; setOpen((v) => !v); }}>
        <span className="pp-tile" aria-hidden="true"><MessageCircle className="pp-ic" /></span>
        <span className="pp-qa-head-t">
          <b>{ppt("qa_h", lang)}</b>
          <span>{ppt("qa_sub", lang)}</span>
        </span>
        <ChevronDown className="pp-ic" aria-hidden="true" />
      </button>
      {open && (
        <div className="pp-qa-body" id={`${id}-body`}>
          <p className="pp-qa-disc">
            {ppt("qa_disclaimer", lang, { who: preparedBy?.name || ppt("qa_installer", lang) })}
          </p>

          <div className="pp-qa-log" aria-live="polite">
            {turns.map((turn, i) => (
              <div key={i} style={{ display: "contents" }}>
                <div className="pp-qa-q"><span className="pp-sr">{ppt("qa_you", lang)}: </span>{turn.q}</div>
                {/* Plain text node, never dangerouslySetInnerHTML. React
                    escapes this by construction, which is the point. */}
                <div className="pp-qa-a"><span className="pp-sr">{ppt("qa_bot", lang)}: </span>{turn.a}</div>
              </div>
            ))}
            {busy && <div className="pp-qa-a" style={{ color: "var(--muted)" }}>{ppt("qa_thinking", lang)}</div>}
          </div>

          <form className="pp-qa-form" onSubmit={ask}>
            <label htmlFor={`${id}-q`} className="pp-sr">{ppt("qa_label", lang)}</label>
            <input
              id={`${id}-q`}
              ref={inputRef}
              className="pp-input"
              value={draft}
              onChange={(e) => setDraft(e.target.value.slice(0, MAX_LEN))}
              placeholder={ppt("qa_ph", lang)}
              disabled={busy}
              maxLength={MAX_LEN}
              enterKeyHint="send"
            />
            <button type="submit" className="pp-btn pp-btn-dark" disabled={busy || !draft.trim()}>
              {ppt("qa_send", lang)}
            </button>
          </form>
          {err && <p className="pp-qa-err" role="alert">{ppt("qa_error", lang)}</p>}
        </div>
      )}
    </div>
  );
}
