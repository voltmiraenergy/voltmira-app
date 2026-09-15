"use client";
// app/p/[code]/QaWidget.jsx — "ask a question about your offer," grounded in
// this specific proposal's real numbers via app/api/proposal/[code]/qa. The
// LLM call itself lives outside this app (a Make.com scenario the installer
// configures — see docs/MAKE_AUTOMATIONS.md); this component only ever
// renders whatever comes back as PLAIN TEXT, never HTML — a client's
// question is attacker-controlled input from this component's point of
// view, and rendering a model's output as markup would be a prompt-injection
// hole into the page it's embedded in.
import { useState } from "react";
import { t } from "../../../lib/i18n.js";

const MAX_TURNS = 6;
const MAX_LEN = 500;

export default function QaWidget({ code, lang = "en", preparedBy = null }) {
  const [open, setOpen] = useState(false);
  const [turns, setTurns] = useState([]); // [{q, a}]
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(false);

  async function ask() {
    const question = draft.trim();
    if (!question || busy) return;
    setBusy(true); setErr(false); setDraft("");
    try {
      const res = await fetch(`/api/proposal/${code}/qa`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question,
          // Frontend keeps the conversation; the backend re-caps this too —
          // client-side caps are a UX nicety here, never the real boundary.
          priorTurns: turns.slice(-MAX_TURNS),
        }),
      });
      const data = await res.json().catch(() => null);
      const answer = typeof data?.answer === "string" && data.answer ? data.answer : null;
      setTurns((cur) => [...cur.slice(-(MAX_TURNS - 1)), { q: question, a: answer || t("qa_error", lang) }]);
      if (!answer) setErr(true);
    } catch {
      setTurns((cur) => [...cur.slice(-(MAX_TURNS - 1)), { q: question, a: t("qa_error", lang) }]);
      setErr(true);
    } finally {
      setBusy(false);
    }
  }

  const wrap = { marginTop: 22, border: "1px solid #E3E1D6", borderRadius: 14, background: "#fff", overflow: "hidden" };
  const head = { display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 16px", cursor: "pointer" };

  return (
    <div style={wrap}>
      <div style={head} onClick={() => setOpen((v) => !v)}>
        <div style={{ fontWeight: 700, fontSize: 14.5, color: "#142A21" }}>{t("qa_title", lang)}</div>
        <span style={{ fontSize: 18, color: "#66756C", transform: open ? "rotate(180deg)" : "none", transition: "transform .15s" }}>⌄</span>
      </div>
      {open && (
        <div style={{ padding: "0 16px 16px" }}>
          <div style={{ fontSize: 11.5, color: "#8A968D", marginBottom: 12, lineHeight: 1.5 }}>
            {t("qa_disclaimer", lang, { who: preparedBy?.name || t("qa_fallback_installer", lang) })}
          </div>

          {turns.length > 0 && (
            <div style={{ display: "grid", gap: 12, marginBottom: 14 }}>
              {turns.map((turn, i) => (
                <div key={i} style={{ display: "grid", gap: 5 }}>
                  <div style={{ alignSelf: "flex-end", background: "#F6F5F0", borderRadius: "10px 10px 2px 10px",
                    padding: "9px 12px", fontSize: 13.5, color: "#142A21", justifySelf: "end", maxWidth: "88%" }}>
                    {turn.q}
                  </div>
                  <div style={{ background: "#EFF5F1", borderRadius: "10px 10px 10px 2px",
                    padding: "10px 12px", fontSize: 13.5, color: "#142A21", lineHeight: 1.5, maxWidth: "92%",
                    whiteSpace: "pre-wrap" }}>
                    {/* Plain text node — never dangerouslySetInnerHTML. React
                        escapes this by construction, which is the point. */}
                    {turn.a}
                  </div>
                </div>
              ))}
            </div>
          )}

          <div style={{ display: "flex", gap: 8 }}>
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value.slice(0, MAX_LEN))}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); ask(); } }}
              placeholder={t("qa_placeholder", lang)}
              disabled={busy}
              maxLength={MAX_LEN}
              style={{ flex: 1, padding: "12px 14px", borderRadius: 11, border: "1.5px solid #E3E1D6",
                background: "#fff", fontSize: 14.5, color: "#142A21", fontFamily: "inherit", boxSizing: "border-box" }} />
            <button
              onClick={ask}
              disabled={busy || !draft.trim()}
              style={{ padding: "0 18px", borderRadius: 11, border: "none", background: "#1E6B4E", color: "#fff",
                fontWeight: 700, fontSize: 13.5, fontFamily: "Inter, system-ui, sans-serif",
                cursor: (busy || !draft.trim()) ? "default" : "pointer",
                opacity: (busy || !draft.trim()) ? 0.55 : 1 }}>
              {busy ? t("qa_thinking", lang) : t("qa_send", lang)}
            </button>
          </div>
          {err && (
            <div style={{ marginTop: 8, fontSize: 12, color: "#C4543B" }}>
              {t("qa_error", lang)}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
