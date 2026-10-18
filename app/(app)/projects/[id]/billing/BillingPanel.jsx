"use client";
// app/(app)/projects/[id]/billing/BillingPanel.jsx — the billing page's two
// cards: e-Factura (readiness, status, send, retry, the attempts) and
// payments (paid and due, record one, the list). Every action goes to the
// server and the page re-reads what was saved.
import { useId, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { xt, efReason } from "../../../../../lib/integrationText.js";

const today = () => new Date().toISOString().slice(0, 10);
const newKey = () => (globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`);

export default function BillingPanel({ lang, loc, projectId, title, invoiceNo, currency, grossMinor, clientIsCompany, buyerIdno: savedIdno, problems, attempts, payments, summary, mock, needsDb }) {
  const router = useRouter();
  const id = useId();
  const T = (k, v) => xt(k, lang, v);
  const money = (minor, cur = currency) => new Intl.NumberFormat(loc, { style: "currency", currency: cur, minimumFractionDigits: 2, maximumFractionDigits: 2 }).format((Number(minor) || 0) / 100);
  const day = (d) => new Intl.DateTimeFormat(loc, { day: "numeric", month: "short", year: "numeric" }).format(new Date(d));

  // ---- e-Factura
  const last = attempts[0] || null;
  const [idno, setIdno] = useState(savedIdno);
  const [efBusy, setEfBusy] = useState(false);
  const [efMsg, setEfMsg] = useState(null);
  // the buyer's IDNO is typed here, so its check follows the field, not the saved value
  const shown = problems.filter((c) => c !== "buyer_idno" || !/^\d{13}$/.test(idno.replace(/\D/g, "")));
  const canSend = !needsDb && invoiceNo && shown.length === 0 && last?.status !== "accepted" && last?.status !== "submitted";

  async function ef(action) {
    if (efBusy) return;
    setEfBusy(true); setEfMsg(null);
    try {
      const res = await fetch(`/api/projects/${projectId}/efactura`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, buyerIdno: idno }) });
      const j = await res.json().catch(() => ({}));
      if (!j.ok && !j.submission) setEfMsg(efReason(j.error, lang));
      router.refresh();
    } catch { setEfMsg(efReason("other", lang)); }
    finally { setEfBusy(false); }
  }

  const statusLine = (a) => a.status === "accepted" ? T("ef_st_accepted", { n: a.fiscal_number || "" })
    : a.status === "rejected" ? T("ef_st_rejected", { reason: efReason(a.error_code, lang) })
      : a.status === "error" ? T("ef_st_error", { reason: efReason(a.error_code, lang) })
        : T("ef_st_submitted");

  // ---- payments
  const [form, setForm] = useState({ amount: "", currency, paidAt: today(), method: "bank", reference: "" });
  const [key, setKey] = useState(newKey);
  const [pmBusy, setPmBusy] = useState(false);
  const [pmMsg, setPmMsg] = useState(null);
  const set = (k) => (e) => { setForm((f) => ({ ...f, [k]: e.target.value })); setPmMsg(null); };

  async function addPayment(e) {
    e.preventDefault();
    if (pmBusy) return;
    setPmBusy(true); setPmMsg(null);
    try {
      const res = await fetch(`/api/projects/${projectId}/payments`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...form, idempotencyKey: key }) });
      const j = await res.json().catch(() => ({}));
      if (res.status === 400) setPmMsg(T("pm_bad"));
      else if (!j.ok) setPmMsg(j.error === "needs_db" ? T("bl_needs_db") : T("pm_failed"));
      else { setForm((f) => ({ ...f, amount: "", reference: "" })); setKey(newKey()); router.refresh(); }
    } catch { setPmMsg(T("pm_failed")); }
    finally { setPmBusy(false); }
  }

  async function removePayment(pid) {
    if (!window.confirm(T("pm_remove_q"))) return;
    const res = await fetch(`/api/projects/${projectId}/payments?payment=${pid}`, { method: "DELETE" }).catch(() => null);
    if (!res?.ok) setPmMsg(T("pm_failed"));
    router.refresh();
  }

  return (
    <>
      <header className="dx-head">
        <div className="dx-hello">
          <h1>{T("bl_title", { title })}</h1>
          <p className="dx-summary">{invoiceNo ? T("bl_sub", { no: invoiceNo, total: money(grossMinor) }) : T("bl_no_number")}</p>
        </div>
        <Link className="btn ghost sm" href={`/projects/${projectId}/invoice`} target="_blank" rel="noopener noreferrer">{T("bl_open_invoice")}</Link>
      </header>

      {needsDb && <p className="bl-note bad" role="status">{T("bl_needs_db")}</p>}

      <section className="dx-card bl-card" aria-labelledby={`${id}-ef`}>
        <header className="dx-card-head">
          <div>
            <h2 id={`${id}-ef`}>{T("ef_h")}</h2>
            <p>{T("ef_lead")}</p>
          </div>
        </header>
        {mock && <p className="bl-note warn">{T("ef_mock")}</p>}

        <p className={"bl-status s-" + (last?.status || "none")} role="status">{last ? statusLine(last) : T("ef_none")}</p>

        {last?.status !== "accepted" && (
          <div className="bl-ready">
            <h3>{T("ef_ready_h")}</h3>
            {shown.length === 0 ? <p className="bl-ok">{T("ef_ready_ok")}</p> : (
              <ul>
                {shown.map((c) => <li key={c}>{efReason(c, lang)}{c.startsWith("seller_") && <> <Link href="/settings">{T("ef_settings")}</Link></>}</li>)}
              </ul>
            )}
            {clientIsCompany && (
              <label className="bl-field" htmlFor={`${id}-idno`}>
                <span>{T("ef_buyer_idno")}</span>
                <input id={`${id}-idno`} className="input" inputMode="numeric" maxLength={13} value={idno} onChange={(e) => setIdno(e.target.value.replace(/\D/g, ""))} />
              </label>
            )}
          </div>
        )}

        <div className="bl-acts">
          {last?.status === "submitted"
            ? <button type="button" className="btn ghost sm" disabled={efBusy} onClick={() => ef("refresh")}>{efBusy ? T("ef_sending") : T("ef_refresh")}</button>
            : last?.status !== "accepted" && (
              <button type="button" className="btn primary sm" disabled={efBusy || !canSend} onClick={() => ef("submit")}>
                {efBusy ? T("ef_sending") : last ? T("ef_retry") : T("ef_submit")}
              </button>
            )}
        </div>
        {efMsg && <p className="bl-note bad" role="alert">{efMsg}</p>}

        {attempts.length > 0 && (
          <details className="bl-hist">
            <summary>{T("ef_history")} ({attempts.length})</summary>
            <ol>
              {attempts.map((a) => (
                <li key={a.id}><b>{T("ef_attempt", { n: a.attempt, date: day(a.created_at) })}</b>: {statusLine(a)}{a.sfs_ref ? `, ${a.sfs_ref}` : ""}</li>
              ))}
            </ol>
          </details>
        )}
      </section>

      <section className="dx-card bl-card" aria-labelledby={`${id}-pm`}>
        <header className="dx-card-head"><div><h2 id={`${id}-pm`}>{T("pm_h")}</h2></div></header>
        <dl className="bl-sum">
          <div><dt>{T("pm_invoiced")}</dt><dd>{money(grossMinor)}</dd></div>
          <div><dt>{T("pm_paid")}</dt><dd>{money(summary.paidMinor)}</dd></div>
          <div><dt>{T("pm_due")}</dt><dd className={summary.settled ? "ok" : ""}>{summary.settled ? T("pm_settled") : money(summary.dueMinor)}</dd></div>
        </dl>
        {summary.otherCurrency > 0 && <p className="bl-muted">{T("pm_other_cur", { n: summary.otherCurrency })}</p>}

        <form className="bl-form" onSubmit={addPayment}>
          <label className="bl-field"><span>{T("pm_amount")}</span><input className="input" inputMode="decimal" required value={form.amount} onChange={set("amount")} /></label>
          <label className="bl-field"><span>{T("pm_currency")}</span>
            <select className="input" value={form.currency} onChange={set("currency")}>{["MDL", "EUR", "RON", "UAH"].map((c) => <option key={c} value={c}>{c}</option>)}</select>
          </label>
          <label className="bl-field"><span>{T("pm_date")}</span><input className="input" type="date" required max={today()} value={form.paidAt} onChange={set("paidAt")} /></label>
          <label className="bl-field"><span>{T("pm_method")}</span>
            <select className="input" value={form.method} onChange={set("method")}>{["bank", "cash", "card"].map((m) => <option key={m} value={m}>{T("pm_m_" + m)}</option>)}</select>
          </label>
          <label className="bl-field bl-wide"><span>{T("pm_reference")}</span><input className="input" maxLength={120} value={form.reference} onChange={set("reference")} /></label>
          <button type="submit" className="btn primary sm" disabled={pmBusy || needsDb || !form.amount.trim()}>{pmBusy ? T("pm_saving") : T("pm_add")}</button>
        </form>
        {pmMsg && <p className="bl-note bad" role="alert">{pmMsg}</p>}

        {payments.length === 0 ? <p className="bl-muted">{T("pm_none")}</p> : (
          <ul className="bl-list">
            {payments.map((pm) => (
              <li key={pm.id}>
                <span className="bl-amt">{money(pm.amount_minor, pm.currency)}</span>
                <span>{day(pm.paid_at)}, {T("pm_m_" + pm.method)}{pm.reference ? `, ${pm.reference}` : ""}</span>
                <button type="button" className="btn ghost sm" onClick={() => removePayment(pm.id)}>{T("pm_remove")}</button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
