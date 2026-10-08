"use client";
// app/p/[code]/tracker.jsx — sends REAL tracking events to the API.
// open (once) → heartbeat every 15s while visible → accept / request buttons.
// Also the accept-and-sign panel itself: Accept opens it, and the deal only
// closes once the client has typed their name AND drawn a signature.
//   listens  "voltmira:sign"      (AcceptLink.jsx: any other "Accept and sign" on the page)
//   sends    "voltmira:accepted"  (AcceptLink.jsx, StickyCta.jsx: the client has signed)
// Styles: proposal.css (.pp-act, .pp-sign, .pp-ref).
import { useEffect, useId, useRef, useState } from "react";
import { PenLine } from "lucide-react";
import { t } from "../../../lib/i18n.js";
import { ppt } from "./text.js";
import SignaturePad from "./SignaturePad.jsx";

export default function Tracker({ code, accepted: initialAccepted, lang = "en", signedName = null, signedDate = null }) {
  const [accepted, setAccepted] = useState(initialAccepted);
  const [requested, setRequested] = useState(false);
  const [refDone, setRefDone] = useState(false);
  const [signing, setSigning] = useState(false);
  const [sig, setSig] = useState("");
  const [signer, setSigner] = useState("");
  const [sending, setSending] = useState(false);
  const [failed, setFailed] = useState(false);
  const secondsRef = useRef(0);
  const nameRef = useRef(null);
  const focusName = useRef(false);
  const id = useId();

  const send = (kind, extra = {}) =>
    fetch(`/api/proposal/${code}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind, ...extra }),
      keepalive: true,
    }).catch(() => null);

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

  // Another "Accept and sign" on the page was used: open the panel here.
  useEffect(() => {
    const open = () => setSigning(true);
    window.addEventListener("voltmira:sign", open);
    return () => window.removeEventListener("voltmira:sign", open);
  }, []);

  // Opened with this section's own button: the name is the next thing to do.
  useEffect(() => {
    if (signing && focusName.current) { focusName.current = false; nameRef.current?.focus(); }
  }, [signing]);

  const ready = Boolean(sig) && Boolean(signer.trim()) && !sending;

  async function confirm() {
    if (!ready) return;
    setSending(true); setFailed(false);
    const res = await send("accept", { signature: sig, signerName: signer.trim() });
    // Only a confirmed write closes the deal on screen; a dropped connection or a
    // rate limit used to read as "signed" while nothing reached the installer.
    if (!res || !res.ok) { setFailed(true); setSending(false); return; }
    setAccepted(true); setSigning(false); setSending(false);
    window.dispatchEvent(new CustomEvent("voltmira:accepted"));
  }

  const REF = ["recommend", "google", "social", "installer", "other"];
  const who = signedName || signer.trim();
  const signedLine = who
    ? (signedDate ? ppt("signed_by", lang, { name: who, date: signedDate }) : ppt("signed_by_nd", lang, { name: who }))
    : ppt("sig_done", lang);

  return (
    <div className="pp-act">
      {accepted ? (
        <div className="pp-done" role="status">
          <PenLine className="pp-ic" aria-hidden="true" />
          <span>{signedLine}{who ? <><br /><span style={{ fontWeight: 500 }}>{ppt("sig_done", lang)}</span></> : null}</span>
        </div>
      ) : !signing ? (
        <button type="button" className="pp-btn pp-btn-accept pp-btn-block"
          onClick={() => { focusName.current = true; setSigning(true); }}>
          {ppt("cta_accept", lang)}
        </button>
      ) : (
        <div className="pp-sign" role="group" aria-labelledby={`${id}-sh`}>
          <h3 className="pp-h3" id={`${id}-sh`}>{ppt("sig_h", lang)}</h3>
          <p>{ppt("sig_p", lang)}</p>

          <label className="pp-field-l" htmlFor={`${id}-name`}>{ppt("sig_name", lang)}</label>
          <input id={`${id}-name`} ref={nameRef} className="pp-input"
            value={signer} onChange={(e) => setSigner(e.target.value)}
            placeholder={t("sig_name_ph", lang)} autoComplete="name" maxLength={120} />

          <div style={{ marginTop: 16 }}>
            <SignaturePad onChange={setSig} label={ppt("sig_draw", lang)} clearLabel={ppt("sig_clear", lang)} hint={ppt("sig_here", lang)} />
          </div>

          <div className="pp-sign-btns">
            <button type="button" className="pp-btn pp-btn-accept pp-btn-block" disabled={!ready} onClick={confirm}>
              {sending ? ppt("sig_sending", lang) : ppt("sig_confirm", lang)}
            </button>
            <button type="button" className="pp-btn pp-btn-text" onClick={() => { setSigning(false); setSig(""); setFailed(false); }}>
              {ppt("sig_cancel", lang)}
            </button>
          </div>
          {failed && <p className="pp-err" role="alert">{ppt("sig_error", lang)}</p>}
          <p className="pp-legal">{ppt("sig_legal", lang)}</p>
        </div>
      )}

      {requested ? (
        <p className="pp-ok-msg" role="status">{ppt("requested", lang)}</p>
      ) : (
        <button type="button" className="pp-btn pp-btn-ghost pp-btn-block"
          onClick={() => { send("request"); setRequested(true); }}>
          {ppt("request", lang)}
        </button>
      )}

      {/* Referral source: word-of-mouth intelligence for the installer. */}
      <div className="pp-ref">
        <p id={`${id}-ref`}>{ppt("ref_q", lang)}</p>
        {refDone ? (
          <p className="pp-ok-msg" role="status">{ppt("ref_thanks", lang)}</p>
        ) : (
          <div className="pp-ref-opts" role="group" aria-labelledby={`${id}-ref`}>
            {REF.map((s) => (
              <button key={s} type="button" className="pp-pill" onClick={() => { send("referral", { source: s }); setRefDone(true); }}>
                {t("ref_opt_" + s, lang)}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
