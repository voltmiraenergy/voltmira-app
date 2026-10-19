"use client";
// components/fees/JobFeeCard.jsx — a job's VoltMira fee on its quote page,
// under the pay-per-signed-job model (lib/successFees.js). Before signing it
// says what signing will cost (or that it is one of the free jobs); once
// signed, the fee, how it was worked out, when it was signed and which month's
// statement it goes on, with "Client cancelled" to take it off; after a
// cancellation, that there is no fee. JobFee draws what it is given;
// JobFeeCard fetches /api/fees again whenever the job's status changes.
import "./fees.css";
import Link from "next/link";
import { useEffect, useState } from "react";
import { ft } from "../../lib/feeText.js";
import { feeForKw, LEI_PER_KW, MAX_LEI_PER_JOB, FREE_JOBS } from "../../lib/successFees.js";
import { lei, k1, n0, monthLabel, dayLabel } from "./feeFormat.js";
import { ReceiptText, Gift, Undo2, CalendarDays, FileSignature, ArrowRight } from "lucide-react";

const HOW = { online: "how_online", marked: "how_marked", status: "how_status" };

export function JobFee({ lang = "en", row = null, next = null, status = "draft", kw = 0, onCancel = null }) {
  const [ask, setAsk] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const how = <Link className="fe-how" href="/settings?tab=plan">{ft("jf_how", lang)}<ArrowRight size={13} strokeWidth={2.2} aria-hidden="true" /></Link>;

  // not signed: what signing will cost
  if (!row) {
    if (status === "won" || status === "lost") return null;   // a sample, or lost without ever being signed
    const line = next?.free ? ft("jf_next_free", lang, { n: next.freeN, t: FREE_JOBS })
      : Number(kw) > 0 ? ft("jf_next", lang, { lei: n0(feeForKw(kw), lang) }) : ft("jf_no_size", lang);
    return (
      <section className="dx-card fe-jobcard pre" aria-label={ft("jf_h", lang)}>
        <p className="fe-pre"><ReceiptText size={15} strokeWidth={2} aria-hidden="true" /><span>{line}</span></p>
        {how}
      </section>
    );
  }

  const cancel = async () => {
    setBusy(true); setErr("");
    const ok = await onCancel?.().catch(() => false);
    setBusy(false);
    if (ok) setAsk(false); else setErr(ft("jf_failed", lang));
  };

  if (row.status === "cancelled" || row.status === "before") {
    return (
      <section className="dx-card fe-jobcard off" aria-label={ft("jf_h", lang)}>
        <p className="fe-pre"><Undo2 size={15} strokeWidth={2} aria-hidden="true" /><span>{ft(row.status === "cancelled" ? "jf_cancelled" : "jf_before", lang)}</span></p>
      </section>
    );
  }

  const capped = row.kw * LEI_PER_KW > MAX_LEI_PER_JOB;
  return (
    <section className="dx-card fe-jobcard" aria-labelledby="fe-job-h">
      <h3 id="fe-job-h" className="fe-job-h"><ReceiptText size={16} strokeWidth={2} aria-hidden="true" />{ft("jf_h", lang)}</h3>
      {row.status === "free" ? (
        <>
          <p className="fe-job-v free"><Gift size={20} strokeWidth={2} aria-hidden="true" />{ft("free_word", lang)}</p>
          <p className="fe-job-s">{ft("jf_free", lang, { n: row.freeN, t: FREE_JOBS })}</p>
        </>
      ) : row.status === "no_size" ? (
        <p className="fe-job-s">{ft("jf_no_size", lang)}</p>
      ) : (
        <>
          <p className="fe-job-v">{lei(row.fee, lang)}</p>
          <p className="fe-job-s">{capped ? ft("jf_cap", lang, { kw: k1(row.kw, lang) }) : ft("jf_formula", lang, { kw: k1(row.kw, lang), rate: n0(LEI_PER_KW, lang) })}</p>
        </>
      )}
      <ul className="fe-job-meta">
        <li><FileSignature size={14} strokeWidth={2} aria-hidden="true" />{ft("jf_signed", lang, { d: dayLabel(row.signedAt, lang), how: ft(HOW[row.how], lang) })}</li>
        <li><CalendarDays size={14} strokeWidth={2} aria-hidden="true" />{ft("jf_month", lang, { m: monthLabel(row.period, lang) })}</li>
      </ul>
      {status === "won" && onCancel && (
        ask ? (
          <div className="fe-ask" role="group">
            <p>{ft("jf_cancel_q", lang)}</p>
            <div className="fe-ask-b">
              <button type="button" className="btn sm danger" disabled={busy} onClick={cancel}>{ft("jf_cancel_yes", lang)}</button>
              <button type="button" className="btn ghost sm" disabled={busy} onClick={() => setAsk(false)}>{ft("jf_keep", lang)}</button>
            </div>
            {err && <p className="fe-err" role="alert">{err}</p>}
          </div>
        ) : (
          <div className="fe-job-acts">
            <button type="button" className="btn ghost sm" onClick={() => setAsk(true)}><Undo2 size={14} strokeWidth={2} aria-hidden="true" />{ft("jf_cancel", lang)}</button>
            {how}
          </div>
        )
      )}
      {status !== "won" && how}
    </section>
  );
}

export default function JobFeeCard({ projectId, status, kw, lang = "en", onCancel }) {
  const [data, setData] = useState(null);
  useEffect(() => {
    let alive = true;
    fetch("/api/fees", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => { if (alive) setData(j); })
      .catch(() => {});
    return () => { alive = false; };
  }, [projectId, status]);
  if (!data) return null;
  const row = (data.rows || []).find((r) => r.id === projectId) || null;
  return <JobFee lang={lang} row={row} next={data.next} status={status} kw={kw} onCancel={onCancel} />;
}
