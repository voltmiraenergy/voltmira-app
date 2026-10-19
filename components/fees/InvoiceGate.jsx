"use client";
// components/fees/InvoiceGate.jsx — under the pay-per-signed-job model
// (lib/successFees.js) an invoice is for a signed job: opening one on a job
// that is not signed asks to mark it signed first, and says what that job's
// VoltMira fee will be (or that it is one of the free ones). The server says
// the same (app/api/projects/[id]/invoice and the e-Factura route answer
// "not_signed"), so no invoice leaves for a job that never counted.
import "./fees.css";
import { useEffect, useState } from "react";
import { ft } from "../../lib/feeText.js";
import { feeForKw, FREE_JOBS } from "../../lib/successFees.js";
import { n0 } from "./feeFormat.js";
import { FileSignature } from "lucide-react";

export function GateBox({ lang = "en", next = null, kw = 0, busy = false, onConfirm, onClose }) {
  const fee = next?.free ? ft("ig_free", lang, { n: next.freeN, t: FREE_JOBS }) : next ? ft("ig_fee", lang, { lei: n0(feeForKw(kw), lang) }) : "";
  return (
    <div className="modal fe-gate" role="dialog" aria-modal="true" aria-labelledby="fe-gate-h" onClick={(e) => e.stopPropagation()}>
      <span className="fe-gate-i"><FileSignature size={20} strokeWidth={2} aria-hidden="true" /></span>
      <h3 id="fe-gate-h">{ft("ig_h", lang)}</h3>
      <p>{ft("ig_p", lang)}</p>
      {fee && <p className="fe-gate-fee">{fee}</p>}
      <div className="fe-gate-b">
        <button type="button" className="btn primary" disabled={busy} onClick={onConfirm}>{ft("ig_yes", lang)}</button>
        <button type="button" className="btn ghost" disabled={busy} onClick={onClose}>{ft("ig_no", lang)}</button>
      </div>
    </div>
  );
}

export default function InvoiceGate({ lang = "en", kw = 0, onConfirm, onClose }) {
  const [next, setNext] = useState(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    let alive = true;
    fetch("/api/fees", { cache: "no-store" }).then((r) => (r.ok ? r.json() : null)).then((j) => { if (alive && j) setNext(j.next); }).catch(() => {});
    return () => { alive = false; };
  }, []);
  const confirm = async () => { setBusy(true); try { await onConfirm?.(); } finally { setBusy(false); } };
  return (
    <div className="overlay" onClick={onClose}>
      <GateBox lang={lang} next={next} kw={kw} busy={busy} onConfirm={confirm} onClose={onClose} />
    </div>
  );
}
