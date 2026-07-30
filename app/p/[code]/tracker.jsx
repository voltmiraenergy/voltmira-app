"use client";
// app/p/[code]/tracker.jsx — sends REAL tracking events to the API.
// open (once) → heartbeat every 15s while visible → accept / request buttons.
import { useEffect, useRef, useState } from "react";
import { t } from "../../../lib/i18n.js";

export default function Tracker({ code, accepted: initialAccepted, lang = "en" }) {
  const [accepted, setAccepted] = useState(initialAccepted);
  const [requested, setRequested] = useState(false);
  const [refDone, setRefDone] = useState(false);
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
      <button
        style={{ ...btn, background: "#1E6B4E", color: "#fff", opacity: accepted ? 0.6 : 1 }}
        disabled={accepted}
        onClick={() => { send("accept"); setAccepted(true); }}>
        {accepted ? t("pp_accepted", lang) : t("pp_accept", lang)}
      </button>

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
