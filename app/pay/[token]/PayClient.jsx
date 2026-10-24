"use client";
// app/pay/[token]/PayClient.jsx — the parts of the pay page the client uses: the bank details with a copy button
// each, the proof of transfer sent to the installer (POST /api/pay/[token]/proof), and printing the invoice.
import { useState } from "react";
import { pt } from "../../../lib/payText.js";

const TYPES = ["image/jpeg", "image/png", "image/webp", "application/pdf"];

function Copy({ value, lang }) {
  const [ok, setOk] = useState(false);
  return (
    <button type="button" className="pay-copy" onClick={async () => { try { await navigator.clipboard.writeText(value); setOk(true); setTimeout(() => setOk(false), 1600); } catch { /* the value is on screen to copy by hand */ } }}>
      {ok ? pt("pp_copied", lang) : pt("pp_copy", lang)}
    </button>
  );
}

export default function PayClient({ lang, token, company, details, proofSent }) {
  const P = (k, v) => pt(k, lang, v);
  const [state, setState] = useState(proofSent ? "sent" : "idle");
  const [err, setErr] = useState("");

  async function send(file) {
    setErr("");
    if (!file || !TYPES.includes(file.type) || file.size > 8 * 1024 * 1024) { setErr(P("pp_e_file")); return; }
    setState("sending");
    const body = new FormData();
    body.append("file", file);
    try {
      const r = await fetch(`/api/pay/${token}/proof`, { method: "POST", body });
      if (r.ok) setState("sent");
      else { setState("idle"); setErr(r.status === 413 || r.status === 415 ? P("pp_e_file") : P("pp_e_send")); }
    } catch { setState("idle"); setErr(P("pp_e_send")); }
  }

  return (
    <>
      <section className="pay-bank" aria-labelledby="pay-bank-h">
        <h2 id="pay-bank-h">{P("pp_how")}</h2>
        {details ? (
          <dl>
            <div><dt>{P("pp_to")}</dt><dd><span>{details.to}{details.idno ? <small>IDNO {details.idno}</small> : null}</span></dd></div>
            <div><dt>IBAN</dt><dd><span className="pay-mono">{details.iban}</span><Copy value={details.iban.replace(/\s+/g, "")} lang={lang} /></dd></div>
            <div className="pay-ref"><dt>{P("pp_ref")}</dt><dd><span className="pay-mono">{details.ref}</span><Copy value={details.ref} lang={lang} /></dd></div>
          </dl>
        ) : <p className="pay-note">{P("pp_no_iban", { company })}</p>}
        {details && <p className="pay-hint">{P("pp_ref_p")}</p>}
      </section>

      <section className="pay-proof" aria-labelledby="pay-proof-h">
        <h2 id="pay-proof-h">{P("pp_proof_h")}</h2>
        {state === "sent" ? <p className="pay-ok" role="status">{P("pp_uploaded")}</p> : (
          <>
            <p>{P("pp_proof_p", { company })}</p>
            <label className="pay-btn">
              <input type="file" accept={TYPES.join(",")} className="sr" disabled={state === "sending"} onChange={(e) => send(e.target.files?.[0])} />
              {state === "sending" ? P("pp_uploading") : P("pp_upload")}
            </label>
          </>
        )}
        {err && <p className="pay-err" role="alert">{err}</p>}
      </section>

      <button type="button" className="pay-print" onClick={() => window.print()}>{P("pp_print")}</button>
    </>
  );
}
