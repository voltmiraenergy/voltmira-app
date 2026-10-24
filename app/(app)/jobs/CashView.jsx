"use client";
// app/(app)/jobs/CashView.jsx — "Încasări", the third tab of Lucrări: what the clients owe and have paid, stage by
// stage (lib/milestones.js). Four tiles (overdue, due within 7 days, the next 30 days, received this month), the
// invoices with their state and what to do with each (copy the pay link, mark it received, see the client's proof,
// pause the job's reminders), and the earlier months. Loaded by lib/cashActions.js loadCash.
import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Link2, Check, FileImage, BellOff, Bell, ExternalLink } from "lucide-react";
import { pt, money, dayName } from "../../../lib/payText.js";
import { markReceived, setReminders, proofLink } from "../../../lib/cashActions.js";

export default function CashView({ cash, lang }) {
  const router = useRouter();
  const P = (k, v) => pt(k, lang, v);
  const [filter, setFilter] = useState("open");
  const [note, setNote] = useState("");
  const [pay, setPay] = useState(null);   // the invoice in the "received" dialog
  const [busy, setBusy] = useState(false);
  const cur = cash?.currency || "MDL";
  const M = (minor, c = cur) => money(minor, c, lang);
  const rows = useMemo(() => {
    const all = (cash?.rows || []).filter((r) => r.state !== "void");
    const order = { overdue: 0, due_soon: 1, open: 2, planned: 3, paid: 4 };
    const list = filter === "open" ? all.filter((r) => ["overdue", "due_soon", "open"].includes(r.state)) : all;
    return list.sort((a, b) => (order[a.state] - order[b.state]) || String(a.due_on || "9").localeCompare(String(b.due_on || "9")) || a.seq - b.seq);
  }, [cash, filter]);

  if (cash?.needsDb) return <p className="jb-warn" role="status">{P("e_needs_db")}</p>;
  const t = cash?.tiles;
  const nInv = (n) => (n === 1 ? P("t_n1") : P("t_n", { n }));
  const flash = (s) => { setNote(s); setTimeout(() => setNote(""), 2200); };
  const lateDays = (r) => Math.max(1, Math.round((Date.parse(cash.today + "T12:00:00Z") - Date.parse(r.due_on + "T12:00:00Z")) / 864e5));
  const chip = (r) => {
    if (r.state === "overdue") return <span className="cs-chip s-late">{P("s_overdue", { n: lateDays(r) })}</span>;
    if (r.state === "due_soon") return <span className="cs-chip s-soon">{P("s_due_soon")}</span>;
    if (r.state === "open") return <span className="cs-chip s-open">{r.paid_minor > 0 ? P("s_part", { v: M(r.paid_minor, r.currency) }) : P("s_open")}</span>;
    if (r.state === "paid") return <span className="cs-chip s-paid">{P("s_paid")}</span>;
    return <span className="cs-chip">{P("s_planned")}</span>;
  };

  async function copy(r) {
    try { await navigator.clipboard.writeText(`${window.location.origin}/pay/${r.token}`); flash(P("a_copied")); } catch { window.open(`/pay/${r.token}`, "_blank", "noopener"); }
  }
  async function toggle(r) {
    setBusy(true);
    const x = await setReminders(r.projectId, !r.paused).catch(() => ({ ok: false }));
    setBusy(false);
    if (x.ok) router.refresh(); else flash(P("e_save"));
  }
  async function proof(r) {
    const x = await proofLink(r.id).catch(() => ({ ok: false }));
    if (x.ok) window.open(x.url, "_blank", "noopener"); else flash(P("e_save"));
  }

  return (
    <div className="cs">
      <p className="jb-hint">{P("cash_sub")}</p>
      <dl className="cs-tiles">
        <div className={t?.overdue.n ? "is-late" : ""}><dt>{P("t_overdue")}</dt><dd className="cs-big">{M(t?.overdue.minor || 0)}</dd><dd>{nInv(t?.overdue.n || 0)}</dd></div>
        <div><dt>{P("t_week")}</dt><dd className="cs-big">{M(t?.week.minor || 0)}</dd><dd>{nInv(t?.week.n || 0)}</dd></div>
        <div><dt>{P("t_month")}</dt><dd className="cs-big">{M(t?.month.minor || 0)}</dd><dd>{t?.planned.minor ? P("t_planned", { v: M(t.planned.minor) }) : nInv(t?.month.n || 0)}</dd></div>
        <div className="cs-in"><dt>{P("t_received")}</dt><dd className="cs-big">{M(t?.received.minor || 0)}</dd><dd>{(t?.received.n === 1 ? P("t_payments1") : P("t_payments", { n: t?.received.n || 0 }))}</dd></div>
      </dl>

      <div className="cs-bar">
        <nav className="cs-pills" aria-label={P("c_status")}>
          {["open", "all"].map((f) => <button key={f} type="button" className={filter === f ? "on" : ""} aria-pressed={filter === f} onClick={() => setFilter(f)}>{P("f_" + f)}</button>)}
        </nav>
        {note && <span className="cs-note" role="status">{note}</span>}
      </div>

      <section className="dx-card cs-card">
        {rows.length === 0 ? <p className="dx-muted-note">{P("cash_empty")}</p> : (
          <div className="cs-scroll">
            <table className="cs-table">
              <thead><tr><th scope="col">{P("c_invoice")}</th><th scope="col">{P("c_job")}</th><th scope="col">{P("c_stage")}</th><th scope="col" className="r">{P("c_amount")}</th><th scope="col">{P("c_due")}</th><th scope="col">{P("c_status")}</th><th scope="col"><span className="sr">{P("more")}</span></th></tr></thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className={"st-" + r.state}>
                    <td className="cs-nowrap">{r.invoice_no ? <a className="cs-no" href={`/pay/${r.token}`} target="_blank" rel="noopener noreferrer">{r.invoice_no}</a> : <span className="cs-muted">{P("s_planned")}</span>}</td>
                    <td><Link href={`/projects/${r.projectId}/billing`} className="cs-job">{r.job || r.client || "?"}</Link>{r.client && r.job ? <small>{r.client}</small> : null}</td>
                    <td>{P("tr_" + r.trigger)}<small>{r.seq} / {r.of}, {r.pct}%</small></td>
                    <td className="r cs-nowrap"><b>{M(r.amount_minor, r.currency)}</b></td>
                    <td className="cs-nowrap">{r.due_on ? dayName(r.due_on, lang) : ""}</td>
                    <td>{chip(r)}{r.proof && r.state !== "paid" ? <span className="cs-chip s-proof">{P("s_proof")}</span> : null}{r.paused && r.state !== "paid" ? <small>{P("paused")}</small> : null}</td>
                    <td className="cs-acts">
                      {r.invoice_no && r.state !== "paid" && (
                        <>
                          <button type="button" className="btn primary sm" onClick={() => setPay({ ...r, amount: "", paidAt: cash.today })}><Check size={14} aria-hidden="true" />{P("a_paid")}</button>
                          <button type="button" className="cs-icon" title={P("a_copy")} aria-label={P("a_copy")} onClick={() => copy(r)}><Link2 size={15} /></button>
                          {r.proof && <button type="button" className="cs-icon" title={P("a_proof")} aria-label={P("a_proof")} onClick={() => proof(r)}><FileImage size={15} /></button>}
                          <button type="button" className="cs-icon" disabled={busy} title={P(r.paused ? "a_resume" : "a_pause")} aria-label={P(r.paused ? "a_resume" : "a_pause")} onClick={() => toggle(r)}>{r.paused ? <Bell size={15} /> : <BellOff size={15} />}</button>
                        </>
                      )}
                      {r.state === "paid" && <a className="cs-icon" href={`/pay/${r.token}`} target="_blank" rel="noopener noreferrer" title={P("a_open")} aria-label={P("a_open")}><ExternalLink size={15} /></a>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="dx-card cs-card" aria-labelledby="cs-hist-h">
        <h2 id="cs-hist-h" className="cs-h">{P("hist_h")}</h2>
        <div className="cs-scroll">
          <table className="cs-table">
            <thead><tr><th scope="col">{P("c_month")}</th><th scope="col" className="r">{P("c_invoiced")}</th><th scope="col" className="r">{P("c_received")}</th></tr></thead>
            <tbody>
              {(cash?.history || []).map((h) => (
                <tr key={h.month}>
                  <td className="cs-cap">{new Date(h.month + "-15T00:00:00Z").toLocaleDateString({ en: "en-GB", ro: "ro-RO", ru: "ru-RU", uk: "uk-UA" }[lang] || "ro-RO", { month: "long", year: "numeric", timeZone: "UTC" })}</td>
                  <td className="r">{M(h.invoicedMinor)}</td>
                  <td className="r"><b>{M(h.receivedMinor)}</b></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {pay && (
        <div className="overlay" onClick={() => setPay(null)}>
          <form className="modal cs-modal" role="dialog" aria-modal="true" aria-labelledby="cs-pay-h" onClick={(e) => e.stopPropagation()}
            onSubmit={async (e) => {
              e.preventDefault(); setBusy(true);
              const x = await markReceived(pay.id, { amount: pay.amount, paidAt: pay.paidAt }).catch(() => ({ ok: false }));
              setBusy(false);
              if (x.ok || x.error === "already") { setPay(null); router.refresh(); }
              else flash(P(x.error === "amount" ? "e_amount" : "e_save"));
            }}>
            <h3 id="cs-pay-h">{P("mp_h", { no: pay.invoice_no })}</h3>
            <div className="field">
              <label htmlFor="csAmt">{P("mp_amount")}</label>
              <input id="csAmt" className="input" inputMode="decimal" placeholder={M(pay.amount_minor - pay.paid_minor, pay.currency)} value={pay.amount} onChange={(e) => setPay({ ...pay, amount: e.target.value })} />
            </div>
            <div className="field">
              <label htmlFor="csDay">{P("mp_date")}</label>
              <input id="csDay" className="input" type="date" max={cash.today} value={pay.paidAt} onChange={(e) => setPay({ ...pay, paidAt: e.target.value })} />
            </div>
            <div className="modal-acts">
              <button type="button" className="btn ghost" onClick={() => setPay(null)}>{P("cancel")}</button>
              <button type="submit" className="btn primary" disabled={busy} aria-busy={busy}>{P("mp_save")}</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
