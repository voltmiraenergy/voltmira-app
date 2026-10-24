"use client";
// app/(app)/settings/FeesPanel.jsx — Settings, "Pay per job": VoltMira's one charge explained (lib/jobFees.js), a
// calculator for a system's size, the free projects used, the company tax id, the won jobs with their fees, credit
// from cancelled jobs, VoltMira's invoices, and the one-invoice-a-month switch. Loaded and saved through
// lib/feeActions.js.
import { useEffect, useState } from "react";
import Link from "next/link";
import { Receipt, Calculator, Gift, FileText } from "lucide-react";
import { loadFeeOverview, setCompanyIdno, setMonthlyInvoice } from "../../../lib/feeActions.js";
import { FEE_TIERS_MDL, feeFor, feeLei } from "../../../lib/jobFees.js";
import { ft } from "../../../lib/feeText.js";

const LOCS = { en: "en-GB", ro: "ro-RO", ru: "ru-RU", uk: "uk-UA" };

export default function FeesPanel({ lang }) {
  const F = (k, v) => ft(k, lang, v);
  const [d, setD] = useState(null);
  const [kw, setKw] = useState(6);
  const [idno, setIdno] = useState("");
  const [msg, setMsg] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    loadFeeOverview().then((r) => { setD(r); setIdno(r?.idno || ""); }).catch(() => setD({ error: "load" }));
  }, []);
  if (!d) return <section className="dx-card st-card" aria-busy="true" />;
  const day = (iso) => (iso ? new Date(iso).toLocaleDateString(LOCS[lang] || "ro-RO", { day: "numeric", month: "short", year: "numeric", timeZone: "Europe/Chisinau" }) : "");
  const fees = d.fees || [];
  const dueNow = fees.filter((f) => f.status === "due").reduce((s, f) => s + f.amount_minor, 0);
  const paid = fees.filter((f) => f.status === "paid" && f.payment_method !== "credit").reduce((s, f) => s + f.amount_minor, 0);
  const paidCount = fees.filter((f) => f.status === "paid").length;
  const err = (e) => setMsg({ ok: false, text: F("fp_e_" + e) !== "fp_e_" + e ? F("fp_e_" + e) : e === "needs_db" ? F("e_needs_db") : F("fp_e_save") });

  async function saveIdno() {
    setBusy(true); setMsg(null);
    const r = await setCompanyIdno(idno).catch(() => ({ ok: false, error: "save" }));
    setBusy(false);
    if (r.ok) { setMsg({ ok: true, text: F("fp_saved") }); setD({ ...d, idno: idno.replace(/\s+/g, "") }); } else err(r.error);
  }
  async function toggleMonthly(on) {
    setBusy(true); setMsg(null);
    const r = await setMonthlyInvoice(on).catch(() => ({ ok: false, error: "save" }));
    setBusy(false);
    if (r.ok) setD({ ...d, monthly: on }); else err(r.error);
  }

  return (
    <>
      {d.needsDb && <p className="set-note st-warn" role="status">{F("e_needs_db")}</p>}

      <section className="dx-card st-card fp-hero">
        <div className="st-card-h"><div><h3>{F("fp_h")}</h3><p>{F("fp_p", { n: d.freeJobs || 3 })}</p></div></div>
        <h4 className="fp-sub">{F("fp_tiers")}</h4>
        <ul className="fp-tiers">
          {FEE_TIERS_MDL.map((tr, i) => (
            <li key={i}><span>{F("tier_" + i)}</span><b>{feeLei(tr.minor, lang)}</b></li>
          ))}
        </ul>
        <div className="fp-calc">
          <span className="fp-calc-i" aria-hidden="true"><Calculator size={16} /></span>
          <label htmlFor="fpKw">{F("fp_calc")}</label>
          <input id="fpKw" className="input" type="number" min="0" max="5000" step="0.5" inputMode="decimal" value={kw} onChange={(e) => setKw(e.target.value)} />
          <input aria-hidden="true" tabIndex={-1} type="range" min="1" max="150" step="0.5" value={Math.min(150, Number(kw) || 1)} onChange={(e) => setKw(e.target.value)} className="fp-range" />
          <span className="fp-calc-out"><small>{F("fp_calc_out")}</small><b>{feeLei(feeFor(kw).minorMdl, lang)}</b></span>
        </div>
        {!d.on && <p className="set-note st-note-tight">{F("off_p")}</p>}
        {d.on && d.test && <p className="set-note st-note-tight">{F("test_mode")}</p>}
      </section>

      <dl className="fp-kpis">
        <div><dt><Gift size={14} aria-hidden="true" />{F("st_free")}</dt><dd>{d.freeUsed || 0} / {d.freeJobs || 3}</dd><dd className="fp-sub2">{F("fp_free_used", { u: d.freeUsed || 0, n: d.freeJobs || 3 })}</dd></div>
        <div className={dueNow ? "is-due" : ""}><dt><Receipt size={14} aria-hidden="true" />{F("fp_due_total")}</dt><dd>{feeLei(dueNow, lang)}</dd></div>
        <div><dt>{F("fp_paid_total")}</dt><dd>{feeLei(paid, lang)}</dd></div>
        <div><dt>{F("fp_credit")}</dt><dd>{feeLei(d.creditMinor || 0, lang)}</dd></div>
      </dl>

      <section className="dx-card st-card">
        <div className="st-card-h"><div><h3>{F("fp_idno_h")}</h3><p>{F("fp_idno_p")}</p></div></div>
        <div className="fp-idno">
          <input className="input" id="fpIdno" aria-label={F("fp_idno_h")} inputMode="numeric" maxLength={16} placeholder="1003600123456"
            value={idno} disabled={!d.isOwner || d.needsDb || busy} onChange={(e) => setIdno(e.target.value)} />
          <button type="button" className="btn primary" disabled={!d.isOwner || d.needsDb || busy || idno.replace(/\s+/g, "") === (d.idno || "")} onClick={saveIdno}>{F("fp_idno_save")}</button>
        </div>
        {!d.isOwner && <p className="set-note st-note-tight">{F("fp_e_owner_only")}</p>}
        {msg && <p className={"set-note st-note-tight " + (msg.ok ? "fp-ok" : "fp-bad")} role="status">{msg.text}</p>}
      </section>

      <section className="dx-card st-card">
        <div className="st-card-h"><div><h3>{F("fp_jobs_h")}</h3></div></div>
        {fees.length === 0 ? <p className="st-p">{F("fp_jobs_empty")}</p> : (
          <div className="fp-scroll">
            <table className="fp-table">
              <thead><tr><th scope="col">{F("fp_col_job")}</th><th scope="col">{F("fp_col_won")}</th><th scope="col" className="r">{F("fp_col_fee")}</th><th scope="col">{F("fp_col_status")}</th></tr></thead>
              <tbody>
                {fees.map((f) => (
                  <tr key={f.id}>
                    <td><Link href={`/projects/${f.projectId}`} className="fp-job">{f.client || "?"}</Link><small>{F("tier_" + f.tier)}</small></td>
                    <td className="fp-nowrap">{day(f.won_at)}</td>
                    <td className="r fp-nowrap">{f.status === "free" ? <s>{feeLei(feeFor(f.kw).minorMdl, lang)}</s> : feeLei(f.amount_minor, lang)}</td>
                    <td><span className={"fp-chip s-" + f.status}>{F("st_" + f.status)}</span>
                      {f.status === "due" && f.grace_ends_at && <small>{day(f.grace_ends_at)}</small>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="dx-card st-card">
        <div className="st-card-h">
          <div><h3>{F("fp_inv_h")}</h3><p>{F("fp_monthly_p")}</p></div>
          <label className="fp-switch">
            <input type="checkbox" checked={!!d.monthly} disabled={!d.isOwner || busy || d.needsDb || (!d.monthly && paidCount < 3)} onChange={(e) => toggleMonthly(e.target.checked)} />
            <span>{F("fp_monthly")}</span>
          </label>
        </div>
        {(d.invoices || []).length === 0 ? <p className="st-p">{F("fp_inv_empty")}</p> : (
          <ul className="fp-inv">
            {d.invoices.map((i) => (
              <li key={i.id}>
                <FileText size={15} aria-hidden="true" />
                <a href={`/fees/invoice/${i.id}`} target="_blank" rel="noopener noreferrer">{i.number}</a>
                <span>{day(i.issued_at)}</span>
                <span>{F("fp_inv_n", { n: i.count })}</span>
                <b>{feeLei(i.total_minor, lang)}</b>
              </li>
            ))}
          </ul>
        )}
      </section>

      <style>{`
        .app .fp-sub{margin:4px 0 8px;font-size:13px;font-weight:700;color:var(--ink)}
        .app .fp-tiers{list-style:none;margin:0 0 14px;padding:0;display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:8px}
        .app .fp-tiers li{display:flex;flex-direction:column;gap:2px;padding:11px 13px;border-radius:12px;background:var(--paper);border:1px solid var(--line)}
        .app .fp-tiers span{font-size:12.5px;color:var(--muted)}
        .app .fp-tiers b{font-family:"Inter Tight",Inter,system-ui,sans-serif;font-size:19px;font-weight:750;color:var(--ink);font-variant-numeric:tabular-nums}
        .app .fp-calc{display:grid;grid-template-columns:auto auto 96px minmax(100px,1fr) auto;align-items:center;gap:10px 12px;padding:12px 14px;border-radius:14px;border:1.5px dashed color-mix(in srgb,var(--green) 40%,var(--line));background:color-mix(in srgb,var(--green-tint) 45%,transparent)}
        .app .fp-calc-i{display:grid;place-items:center;width:30px;height:30px;border-radius:9px;background:var(--paper-2);color:var(--green);border:1px solid var(--line)}
        .app .fp-calc label{font-size:13.5px;font-weight:650;color:var(--ink)}
        .app .fp-range{width:100%;margin:0}
        .app .fp-calc-out{display:flex;flex-direction:column;align-items:flex-end;text-align:right}
        .app .fp-calc-out small{font-size:11.5px;color:var(--muted)}
        .app .fp-calc-out b{font-family:"Inter Tight",Inter,system-ui,sans-serif;font-size:18px;font-weight:750;color:var(--green);font-variant-numeric:tabular-nums;white-space:nowrap}
        .app .fp-kpis{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px;margin:0}
        .app .fp-kpis>div{padding:13px 14px;border-radius:13px;background:var(--paper-2);border:1px solid var(--line);min-width:0}
        .app .fp-kpis dt{display:flex;align-items:center;gap:6px;font-size:12px;font-weight:650;color:var(--muted)}
        .app .fp-kpis dt svg{color:var(--green)}
        .app .fp-kpis dd{margin:3px 0 0;font-family:"Inter Tight",Inter,system-ui,sans-serif;font-size:21px;font-weight:750;color:var(--ink);font-variant-numeric:tabular-nums}
        .app .fp-kpis dd.fp-sub2{font-family:inherit;font-size:11.5px;font-weight:500;color:var(--muted)}
        .app .fp-kpis .is-due dd{color:var(--amber-ink)}
        .app .fp-idno{display:flex;gap:10px;flex-wrap:wrap;max-width:460px}
        .app .fp-idno .input{flex:1 1 200px;font-variant-numeric:tabular-nums;letter-spacing:.04em}
        .app .fp-ok{color:var(--green);font-weight:600}
        .app .fp-bad{color:var(--red);font-weight:600}
        .app .fp-scroll{overflow-x:auto}
        .app .fp-table{width:100%;border-collapse:collapse;font-size:13.5px;font-variant-numeric:tabular-nums}
        .app .fp-table th{text-align:left;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:var(--muted);padding:7px 10px;border-bottom:1.5px solid var(--line);white-space:nowrap}
        .app .fp-table td{padding:10px;border-bottom:1px solid var(--line);vertical-align:top;color:var(--ink)}
        .app .fp-table td small{display:block;font-size:11.5px;color:var(--muted);margin-top:2px}
        .app .fp-table .r{text-align:right}
        .app .fp-table s{color:var(--muted)}
        .app .fp-nowrap{white-space:nowrap}
        .app .fp-job{font-weight:650;color:var(--ink);text-decoration:none}
        .app .fp-job:hover{text-decoration:underline}
        .app .fp-chip{display:inline-flex;padding:3px 9px;border-radius:999px;font-size:11.5px;font-weight:700;white-space:nowrap;background:var(--paper);border:1px solid var(--line);color:var(--muted)}
        .app .fp-chip.s-free,.app .fp-chip.s-paid,.app .fp-chip.s-waived{background:var(--green-tint);border-color:transparent;color:var(--green)}
        .app .fp-chip.s-due{background:var(--amber-tint);border-color:transparent;color:var(--amber-ink)}
        .app .fp-chip.s-void{background:var(--red-tint);border-color:transparent;color:var(--red)}
        .app .fp-switch{display:flex;align-items:center;gap:8px;font-size:13px;font-weight:600;white-space:nowrap;flex:none}
        .app .fp-inv{list-style:none;margin:0;padding:0;display:grid}
        .app .fp-inv li{display:grid;grid-template-columns:auto minmax(0,1fr) auto auto auto;gap:12px;align-items:center;padding:9px 0;border-bottom:1px solid var(--line);font-size:13.5px}
        .app .fp-inv li:last-child{border-bottom:0}
        .app .fp-inv svg{color:var(--muted)}
        .app .fp-inv span{color:var(--muted);font-size:12.5px;white-space:nowrap}
        .app .fp-inv b{font-variant-numeric:tabular-nums;white-space:nowrap}
        @media (max-width:900px){.app .fp-kpis{grid-template-columns:repeat(2,minmax(0,1fr))}.app .fp-calc{grid-template-columns:auto 1fr 96px}.app .fp-range{grid-column:1 / -1}.app .fp-calc-out{grid-column:1 / -1;align-items:flex-start;text-align:left}}
        @media (max-width:560px){.app .fp-inv li{grid-template-columns:auto minmax(0,1fr) auto}.app .fp-inv li span{display:none}}
      `}</style>
    </>
  );
}
