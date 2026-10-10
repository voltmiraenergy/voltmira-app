"use client";
// app/widget/chat/ChatBox.jsx — the homeowner's side of the lead assistant.
// Keeps the conversation (the server is stateless, app/api/agent/chat) and
// renders every reply as PLAIN TEXT: a model's output is never trusted as
// markup on a page embedded in someone else's site.
//
// A homeowner can also send a photo of their electricity bill (the camera
// button): it is shrunk on the phone, read by /api/agent/bill, and what the
// reader found goes to the assistant as the next message. The photo itself is
// only ever shown here, in this browser tab.
import { useEffect, useRef, useState } from "react";
import { Camera } from "lucide-react";
import { t } from "../../../lib/i18n.js";

const MAX_TURNS = 12;
const MAX_LEN = 800;
const storeKey = (c) => "voltmira_chat_" + c;

// Phone photos run to several megabytes; the reader needs far less. Shrink to
// 2000 px on the long side as a JPEG before sending. PDFs go as they are.
async function shrink(file) {
  if (!file.type.startsWith("image/") || typeof createImageBitmap !== "function") return file;
  try {
    const img = await createImageBitmap(file);
    const scale = Math.min(1, 2000 / Math.max(img.width, img.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(img.width * scale); canvas.height = Math.round(img.height * scale);
    canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise((ok) => canvas.toBlob(ok, "image/jpeg", 0.85));
    return blob ? new File([blob], "bill.jpg", { type: "image/jpeg" }) : file;
  } catch { return file; }
}

export default function ChatBox({ companyId, lang, companyName }) {
  const hello = t("agent_hello", lang, { who: companyName || t("agent_installer", lang) });
  const [turns, setTurns] = useState([]);          // [{ role, text, bill?, img? }]
  const [leadRef, setLeadRef] = useState(null);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const listRef = useRef(null);
  const fileRef = useRef(null);

  // Survive a reload within the same tab; a convenience, never required.
  useEffect(() => {
    try {
      const saved = JSON.parse(sessionStorage.getItem(storeKey(companyId)) || "null");
      if (saved?.turns) { setTurns(saved.turns.slice(-MAX_TURNS)); setLeadRef(saved.leadRef || null); }
    } catch { /* storage unavailable */ }
  }, [companyId]);
  useEffect(() => {
    try {
      // Photo previews are blob URLs that die with the tab; keep only the flag.
      const keep = turns.slice(-MAX_TURNS).map(({ img, ...m }) => m);
      sessionStorage.setItem(storeKey(companyId), JSON.stringify({ turns: keep, leadRef }));
    } catch { /* ignore */ }
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [turns, leadRef, companyId, status]);

  // What the server sees: role and text only.
  const wire = (list) => list.slice(-MAX_TURNS).map(({ role, text }) => ({ role, text }));

  async function ask(text, history) {
    const res = await fetch("/api/agent/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ companyId, turns: wire(history), text, leadRef, lang }),
    });
    const data = await res.json().catch(() => null);
    if (data && "leadRef" in data && data.leadRef) setLeadRef(data.leadRef);
    return typeof data?.answer === "string" && data.answer ? data.answer
      : res.status === 429 ? t("agent_slow_down", lang) : t("agent_trouble", lang);
  }

  async function send(e) {
    e?.preventDefault();
    const text = draft.trim().slice(0, MAX_LEN);
    if (!text || busy) return;
    const history = turns;
    setTurns((cur) => [...cur, { role: "user", text }]);
    setDraft("");
    setBusy(true);
    try {
      const answer = await ask(text, history);
      setTurns((cur) => [...cur, { role: "assistant", text: answer }]);
    } catch {
      setTurns((cur) => [...cur, { role: "assistant", text: t("agent_trouble", lang) }]);
    } finally {
      setBusy(false);
    }
  }

  async function sendBill(raw) {
    if (!raw || busy) return;
    const history = turns;
    const img = raw.type.startsWith("image/") ? URL.createObjectURL(raw) : null;
    setTurns((cur) => [...cur, { role: "user", text: t("agent_bill_label", lang), bill: true, img }]);
    setBusy(true);
    setStatus(t("agent_bill_reading", lang));
    try {
      const fd = new FormData();
      fd.append("companyId", companyId);
      fd.append("lang", lang);
      fd.append("file", await shrink(raw));
      const res = await fetch("/api/agent/bill", { method: "POST", body: fd });
      const data = await res.json().catch(() => null);
      if (!data?.facts) {
        setTurns((cur) => [...cur, { role: "assistant", text: data?.message || (res.status === 429 ? t("agent_slow_down", lang) : t("agent_bill_failed", lang)) }]);
        return;
      }
      setStatus("");
      // The bill's turn carries what was read, so later messages keep it in context.
      setTurns((cur) => cur.map((m, i) => (i === cur.length - 1 && m.bill ? { ...m, text: data.facts } : m)));
      const answer = await ask(data.facts, history);
      setTurns((cur) => [...cur, { role: "assistant", text: answer }]);
    } catch {
      setTurns((cur) => [...cur, { role: "assistant", text: t("agent_trouble", lang) }]);
    } finally {
      setBusy(false);
      setStatus("");
    }
  }

  return (
    <>
      <header style={S.head}>
        <span style={S.tile} aria-hidden="true">{(companyName || "V").trim().charAt(0).toUpperCase()}</span>
        <div style={{ minWidth: 0 }}>
          <b style={{ display: "block", fontSize: 15 }}>{companyName || t("agent_installer", lang)}</b>
          <span style={{ fontSize: 12, color: "#66756C" }}>{t("agent_sub", lang)}</span>
        </div>
      </header>
      <div ref={listRef} style={S.list} aria-live="polite">
        <p style={{ ...S.bubble, ...S.them }}>{hello}</p>
        {turns.map((m, i) => (
          m.bill ? (
            <div key={i} style={{ ...S.bubble, ...S.me, ...S.billBubble }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {m.img ? <img src={m.img} alt="" style={S.thumb} /> : <Camera size={16} aria-hidden="true" />}
              <span style={{ padding: "0 6px 2px" }}>{t("agent_bill_label", lang)}</span>
            </div>
          ) : (
            <p key={i} style={{ ...S.bubble, ...(m.role === "user" ? S.me : S.them) }}>{m.text}</p>
          )
        ))}
        {busy && <p style={{ ...S.bubble, ...S.them, color: "#66756C" }}>{status || t("agent_typing", lang)}</p>}
      </div>
      <form onSubmit={send} style={S.form}>
        <input ref={fileRef} type="file" accept="image/*,application/pdf" style={{ display: "none" }}
          onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; sendBill(f); }} />
        <button type="button" onClick={() => fileRef.current?.click()} disabled={busy} style={{ ...S.cam, opacity: busy ? 0.55 : 1 }}
          aria-label={t("agent_bill_btn", lang)} title={t("agent_bill_btn", lang)}>
          <Camera size={20} aria-hidden="true" />
        </button>
        <label htmlFor="agent-input" style={S.sr}>{t("agent_placeholder", lang)}</label>
        <input id="agent-input" value={draft} maxLength={MAX_LEN} onChange={(e) => setDraft(e.target.value)}
          placeholder={t("agent_placeholder", lang)} style={S.input} autoComplete="off" />
        <button type="submit" disabled={busy || !draft.trim()} style={{ ...S.send, opacity: busy || !draft.trim() ? 0.55 : 1 }}>
          {t("agent_send", lang)}
        </button>
      </form>
      <p style={S.privacy}>{t("agent_privacy", lang, { who: companyName || t("agent_installer", lang) })}</p>
    </>
  );
}

const S = {
  head: { display: "flex", alignItems: "center", gap: 10, padding: "14px 16px", borderBottom: "1px solid #E3E1D6" },
  tile: { width: 36, height: 36, borderRadius: 10, background: "#E4EFE9", color: "#1E6B4E", display: "grid", placeItems: "center", fontWeight: 700, fontSize: 15, flex: "none" },
  list: { flex: 1, overflowY: "auto", padding: "14px 16px", display: "flex", flexDirection: "column", gap: 8 },
  bubble: { margin: 0, maxWidth: "86%", padding: "9px 12px", borderRadius: 14, fontSize: 14, lineHeight: 1.5, whiteSpace: "pre-wrap", overflowWrap: "anywhere" },
  them: { alignSelf: "flex-start", background: "#F3F2EC", color: "#142A21", borderBottomLeftRadius: 4 },
  me: { alignSelf: "flex-end", background: "#1E6B4E", color: "#fff", borderBottomRightRadius: 4 },
  billBubble: { display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 6, padding: 6 },
  thumb: { display: "block", width: 150, maxWidth: "100%", maxHeight: 190, objectFit: "cover", borderRadius: 10 },
  form: { display: "flex", gap: 8, padding: "10px 12px", borderTop: "1px solid #E3E1D6" },
  cam: { flex: "none", width: 44, border: "1px solid #D8D6CA", borderRadius: 10, background: "#fff", color: "#1E6B4E", display: "grid", placeItems: "center", cursor: "pointer" },
  input: { flex: 1, minWidth: 0, border: "1px solid #D8D6CA", borderRadius: 10, padding: "10px 12px", fontSize: 14, fontFamily: "inherit", color: "#142A21", background: "#fff" },
  send: { border: 0, borderRadius: 10, padding: "0 16px", background: "#1E6B4E", color: "#fff", fontWeight: 700, fontSize: 14, cursor: "pointer" },
  privacy: { margin: 0, padding: "0 14px 12px", fontSize: 11, color: "#66756C", lineHeight: 1.4 },
  sr: { position: "absolute", width: 1, height: 1, overflow: "hidden", clip: "rect(0 0 0 0)" },
};
