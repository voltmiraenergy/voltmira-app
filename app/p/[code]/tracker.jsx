"use client";
// app/p/[code]/tracker.jsx — sends REAL tracking events to the API.
// open (once) → heartbeat every 15s while visible → accept / request buttons.
import { useEffect, useRef, useState } from "react";
import { t } from "../../../lib/i18n.js";
import SignaturePad from "./SignaturePad.jsx";

export default function Tracker({ code, accepted: initialAccepted, lang = "en", signedName = null, signedDate = null }) {
  const [accepted, setAccepted] = useState(initialAccepted);
  const [requested, setRequested] = useState(false);
  const [refDone, setRefDone] = useState(false);
  // signing flow: Accept opens the signature panel; the deal only closes once
  // the client has typed their name AND drawn a signature.
  const [signing, setSigning] = useState(false);
  const [sig, setSig] = useState("");
  const [signer, setSigner] = useState("");
  const [sending, setSending] = useState(false);
  const secondsRef = useRef(0);

  const send = (kind, extra = {}) =>
    fetch(`/api/proposal/${code}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind, ...extra }),
      keepalive: true,
    }).catch(() => {});

  useEffect(() => {
    send("open");
    const tick = setInterval(() => {
      if (document.visibilityState === "visible") secondsRef.current += 5;
      if (secondsRef.current >= 15) {
        send("heartbeat", { seconds: secondsRef.current });
        secondsRef.current = 0;
      }
    }, 5000);
    const flush = () => {
      if (secondsRef.current > 0)
        navigator.sendBeacon?.(
          `/api/proposal/${code}`,
          new Blob([JSON.stringify({ kind: "heartbeat", seconds: secondsRef.current })],
            { type: "application/json" })
        );
    };
    window.addEventListener("beforeunload", flush);
    return () => { clearInterval(tick); window.removeEventListener("beforeunload", flush); flush(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code]);

  const btn = {
    width: "100%", padding: "16px", fontSize: 16, fontWeight: 700, borderRadius: 12,
    border: "none", cursor: "pointer", fontFamily: "Inter, system-ui, sans-serif",
  };

  const REF = ["recommend", "google", "social", "installer", "other"];

  return (
    <div style={{ display: "grid", gap: 10, marginTop: 4 }}>
      <button
        style={{ ...btn, background: "#E89B2D", color: "#142A21", opacity: requested ? 0.6 : 1 }}
        disabled={requested}
        onClick={() => { send("request"); setRequested(true); }}>
        {requested ? t("pp_requested", lang) : t("pp_request", lang)}
      </button>
      {!signing && (
        <button
          style={{ ...btn, background: "#1E6B4E", color: "#fff", opacity: accepted ? 0.6 : 1 }}
          disabled={accepted}
          onClick={() => setSigning(true)}>
          {accepted ? t("pp_accepted", lang) : t("pp_accept", lang)}
        </button>
      )}

      {/* Sign-to-accept: draw a signature + type the name, then close the deal. */}
      {signing && !accepted && (
        <div style={{ border: "1px solid #E3E1D6", borderRadius: 14, padding: 16, background: "#F6F5F0" }}>
          <div style={{ fontWeight: 700, fontSize: 15, color: "#142A21", marginBottom: 3 }}>{t("sig_title", lang)}</div>
          <div style={{ fontSize: 12.5, color: "#66756C", marginBottom: 14 }}>{t("sig_sub", lang)}</div>

          <label style={{ display: "block", fontSize: 12.5, color: "#66756C", marginBottom: 6 }}>{t("sig_name", lang)}</label>
          <input
            value={signer} onChange={e => setSigner(e.target.value)}
            placeholder={t("sig_name_ph", lang)} autoComplete="name" maxLength={120}
            style={{ width: "100%", padding: "13px 14px", borderRadius: 11, border: "1.5px solid #E3E1D6",
              background: "#fff", fontSize: 15, color: "#142A21", fontFamily: "inherit", marginBottom: 14,
              boxSizing: "border-box" }} />

          <SignaturePad onChange={setSig} label={t("sig_draw", lang)} clearLabel={t("sig_clear", lang)} />

          <button
            style={{ ...btn, marginTop: 14, background: "#1E6B4E", color: "#fff",
              opacity: (!sig || !signer.trim() || sending) ? 0.5 : 1,
              cursor: (!sig || !signer.trim() || sending) ? "default" : "pointer" }}
            disabled={!sig || !signer.trim() || sending}
            onClick={async () => {
              setSending(true);
              await send("accept", { signature: sig, signerName: signer.trim() });
              setAccepted(true); setSigning(false); setSending(false);
            }}>
            {sending ? t("sig_sending", lang) : t("sig_confirm", lang)}
          </button>
          <button
            style={{ width: "100%", marginTop: 8, padding: 12, background: "transparent", border: "none",
              color: "#66756C", fontSize: 13.5, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}
            onClick={() => { setSigning(false); setSig(""); }}>
            {t("sig_cancel", lang)}
          </button>
          <div style={{ fontSize: 11, color: "#8A968D", marginTop: 10, lineHeight: 1.5, textAlign: "center" }}>
            {t("sig_legal", lang)}
          </div>
        </div>
      )}

      {accepted && (
        <div style={{ fontSize: 12.5, color: "#1E6B4E", fontWeight: 600, textAlign: "center" }}>
          ✓ {signedName ? `${t("sig_signed_by", lang)} ${signedName}${signedDate ? " · " + signedDate : ""}` : t("sig_done", lang)}
        </div>
      )}

      {/* Referral source — word-of-mouth intelligence for the installer. */}
      <div style={{ marginTop: 6, padding: "12px 4px 2px", borderTop: "1px solid #E3E1D6", textAlign: "center" }}>
        <div style={{ fontSize: 13, color: "#66756C", marginBottom: 9 }}>{t("ref_q", lang)}</div>
        {refDone ? (
          <div style={{ fontSize: 13.5, fontWeight: 600, color: "#1E6B4E" }}>{t("ref_thanks", lang)}</div>
        ) : (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 7, justifyContent: "center" }}>
            {REF.map(s => (
              <button key={s} onClick={() => { send("referral", { source: s }); setRefDone(true); }}
                style={{ border: "1px solid #E3E1D6", background: "#fff", color: "#142A21", borderRadius: 99,
                  padding: "7px 13px", fontSize: 12.5, fontWeight: 600, cursor: "pointer", fontFamily: "Inter, system-ui, sans-serif" }}>
                {t("ref_opt_" + s, lang)}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
