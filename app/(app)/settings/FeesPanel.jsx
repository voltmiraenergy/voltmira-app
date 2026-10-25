"use client";
// app/(app)/settings/FeesPanel.jsx — Settings, "Pay per job": VoltMira's one charge (lib/jobFees.js) in four rules
// and a calculator, this month's signed jobs with what they will cost, the earlier months with their statements, how
// to pay, and the company tax id. Loaded and saved through lib/feeActions.js.
import { useEffect, useState } from "react";
import Link from "next/link";
import { Zap, ShieldCheck, Gift, Undo2, Calculator, FileText, Landmark } from "lucide-react";
import { loadFeeOverview, setCompanyIdno } from "../../../lib/feeActions.js";
import { feeFor, feeLei, FEE_PER_KW_MINOR, FEE_CAP_MINOR, FREE_JOBS } from "../../../lib/jobFees.js";
import { ft, monthName, feeDay } from "../../../lib/feeText.js";
import { rangeFill } from "../../../lib/rangeFill.js";

const LOCS = { en: "en-GB", ro: "ro-RO", ru: "ru-RU", uk: "uk-UA" };

export default function FeesPanel({ lang }) {
  const F = (k, v) => ft(k, lang, v);
  const [d, setD] = useState(null);
  const [kw, setKw] = useState(10);
  const [idno, setIdno] = useState("");
  const [msg, setMsg] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    loadFeeOverview().then((r) => { setD(r); setIdno(r?.idno || ""); }).catch(() => setD({ error: "load" }));
  }, []);
  if (!d) return <section className="dx-card st-card" aria-busy="true" />;
  const kwTxt = (k) => Number(k || 0).toLocaleString(LOCS[lang] || "ro-RO", { maximumFractionDigits: 1 });
  const mName = (m) => monthName(m, lang);
  const err = (e) => setMsg({ ok: false, text: F("fp_e_" + e) !== "fp_e_" + e ? F("fp_e_" + e) : e === "needs_db" ? F("e_needs_db") : F("e_save") });
  const calc = feeFor(kw);
  const s = d.summary || { signed: 0, free: 0, cancelled: 0, kw: 0, feesMinor: 0, dueMinor: 0 };

  async function saveIdno() {
    setBusy(true); setMsg(null);
    const r = await setCompanyIdno(idno).catch(() => ({ ok: false, error: "save" }));
    setBusy(false);
    if (r.ok) { setMsg({ ok: true, text: F("fp_saved") }); setD({ ...d, idno: idno.replace(/\s+/g, "") }); } else err(r.error);
  }

  const rules = [
    { i: Zap, v: feeLei(FEE_PER_KW_MINOR, lang), c: F("r_kw_c") },
    { i: ShieldCheck, v: feeLei(FEE_CAP_MINOR, lang), c: F("r_cap_c") },
    { i: Gift, v: F("r_free_v", { n: FREE_JOBS }), c: F("r_free_c") },
    { i: Undo2, v: feeLei(0, lang), c: F("r_cancel_c") },
  ];
  const stateChip = (m) => {
    if (m.state === "paid") return <span className="fp-chip s-paid">{F("s_paid", { d: feeDay(m.statement.paid_at, lang) })}</span>;
    if (m.state === "late") return <span className="fp-chip s-late">{F("s_late")}</span>;
    if (m.state === "open") return <span className="fp-chip s-due">{F("s_open", { d: feeDay(Date.parse(m.statement.due_at) - 1, lang) })}</span>;
    if (m.state === "settled") return <span className="fp-chip s-paid">{F("s_settled")}</span>;
    if (m.state === "coming") return <span className="fp-chip s-due">{F("s_coming", { d: feeDay(m.comesOn + "T12:00:00Z", lang) })}</span>;
    return <span className="fp-chip">{F("s_none")}</span>;
  };

  return (
    <>
      {d.needsDb && <p className="set-note st-warn" role="status">{F("e_needs_db")}</p>}

      <section className="dx-card st-card fp-hero" aria-labelledby="fp-h">
        <span className="fp-kicker">{F("fp_kicker")}</span>
        <h3 id="fp-h">{F("fp_h")}</h3>
        <p className="fp-lead">{F("fp_p")}</p>
        <ul className="fp-rules">
          {rules.map(({ i: I, v, c }) => (
            <li key={c}><span className="fp-rule-i" aria-hidden="true"><I size={16} /></span><b>{v}</b><span>{c}</span></li>
          ))}
        </ul>
        <div className="fp-calc">
          <span className="fp-calc-i" aria-hidden="true"><Calculator size={16} /></span>
          <label htmlFor="fpKw">{F("calc_kw")}</label>
          <input id="fpKw" className="input" type="number" min="0" max="5000" step="0.5" inputMode="decimal" value={kw} onChange={(e) => setKw(e.target.value)} />
          <input aria-hidden="true" tabIndex={-1} type="range" min="1" max="60" step="0.5" value={Math.min(60, Number(kw) || 1)} style={rangeFill(Math.min(60, Number(kw) || 1), 1, 60)} onChange={(e) => setKw(e.target.value)} className="fp-range" />
          <span className="fp-calc-out" aria-live="polite">
            <small>{F("calc_out", { kw: kwTxt(kw) })}</small>
            <b>{feeLei(calc.minorMdl, lang)}</b>
            {calc.capped && <small>{F("calc_capped")}</small>}
          </span>
        </div>
        {!d.on && <p className="set-note st-note-tight">{F("off_p")}</p>}
      </section>

      <section className="fp-month" aria-labelledby="fp-month-h">
        <h3 id="fp-month-h">{F("month_h", { m: mName(d.month) })}</h3>
        <dl className="fp-tiles">
          <div><dt>{F("t_signed")}</dt><dd className="fp-big">{s.signed}</dd>
            <dd>{F("t_signed_sub", { kw: kwTxt(s.kw), f: s.free, c: s.cancelled })}</dd></div>
          <div><dt>{F("t_fees")}</dt><dd className="fp-big">{feeLei(s.feesMinor, lang)}</dd>
            <dd>{F("t_fees_sub", { r: feeLei(FEE_PER_KW_MINOR, lang), c: feeLei(FEE_CAP_MINOR, lang) })}</dd></div>
          <div className="fp-pay"><dt>{F("t_due", { m: mName(d.month) })}</dt><dd className="fp-big">{feeLei(s.dueMinor, lang)}</dd>
            <dd>{F("t_due_sub")}</dd></div>
        </dl>
        <p className="fp-meta">
          <span>{F("free_used", { u: d.freeUsed || 0, n: d.freeJobs || FREE_JOBS })}</span>
          {d.creditMinor > 0 && <span>{F("t_credit_sub", { v: feeLei(d.creditMinor, lang) })}</span>}
        </p>

        <div className="dx-card st-card fp-tcard">
          {(d.current || []).length === 0 ? <p className="st-p">{F("jobs_empty")}</p> : (
            <div className="fp-scroll">
              <table className="fp-table">
                <thead><tr><th scope="col">{F("col_signed")}</th><th scope="col">{F("col_job")}</th><th scope="col" className="r">kW</th><th scope="col" className="r">{F("col_fee")}</th></tr></thead>
                <tbody>
                  {d.current.map((f) => (
                    <tr key={f.id}>
                      <td className="fp-nowrap">{feeDay(f.won_at, lang)}<small>{F(f.trigger === "signed" ? "how_signed" : "how_manual")}</small></td>
                      <td><Link href={`/projects/${f.projectId}`} className="fp-job">{f.title || f.client || "?"}</Link>{f.client && f.title && <small>{f.client}</small>}</td>
                      <td className="r">{kwTxt(f.kw)}</td>
                      <td className="r fp-fee">
                        {f.status === "free" ? <><b className="fp-free">{F("st_free")}</b><small>{F("sub_free", { n: f.free_slot, t: FREE_JOBS })}</small></>
                          : f.status === "void" ? <><s>{feeLei(feeFor(f.kw).minorMdl, lang)}</s><span className="fp-chip s-void">{F("st_void")}</span></>
                          : f.status === "waived" ? <><s>{feeLei(f.amount_minor, lang)}</s><span className="fp-chip s-paid">{F("st_waived")}</span></>
                          : <><b>{feeLei(f.amount_minor, lang)}</b>{f.capped ? <small>{F("calc_capped")}</small> : f.payment_method === "credit" ? <small>{F("paid_credit")}</small> : null}</>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>

      <section className="dx-card st-card" aria-labelledby="fp-prev-h">
        <div className="st-card-h"><div><h3 id="fp-prev-h">{F("prev_h")}</h3></div></div>
        {(d.months || []).length === 0 ? <p className="st-p">{F("prev_empty")}</p> : (
          <div className="fp-scroll">
            <table className="fp-table">
              <thead><tr><th scope="col">{F("col_month")}</th><th scope="col" className="r">{F("col_jobs")}</th><th scope="col" className="r">kW</th><th scope="col" className="r">{F("col_fee")}</th><th scope="col">{F("col_status")}</th><th scope="col"><span className="sr">{F("statement_open")}</span></th></tr></thead>
              <tbody>
                {d.months.map((m) => (
                  <tr key={m.month}>
                    <td className="fp-nowrap fp-cap">{mName(m.month)}</td>
                    <td className="r">{m.summary.signed}{m.summary.free > 0 && <small>{F("st_free").toLowerCase()} {m.summary.free}</small>}</td>
                    <td className="r">{kwTxt(m.summary.kw)}</td>
                    <td className="r fp-nowrap"><b>{feeLei(m.statement ? (m.state === "paid" ? m.statement.total_minor : m.statement.leftMinor) : m.summary.feesMinor, lang)}</b></td>
                    <td>{stateChip(m)}</td>
                    <td className="fp-nowrap">{m.statement && <a className="fp-doc" href={`/fees/invoice/${m.statement.id}`} target="_blank" rel="noopener noreferrer"><FileText size={14} aria-hidden="true" />{m.statement.number}</a>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="dx-card st-card fp-howpay">
        <span className="fp-calc-i" aria-hidden="true"><Landmark size={16} /></span>
        <div><h3>{F("pay_h")}</h3><p>{F("pay_p")}</p></div>
      </section>

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

      <style>{`
        .app .fp-hero{display:grid;gap:10px}
        .app .fp-kicker{justify-self:start;padding:4px 11px;border-radius:999px;background:var(--green-tint);color:var(--green);font-size:12px;font-weight:700}
        .app .fp-hero h3{margin:0;font-family:"Inter Tight",Inter,system-ui,sans-serif;font-size:clamp(21px,2.4vw,27px);font-weight:800;letter-spacing:-.02em;text-wrap:balance}
        .app .fp-lead{margin:0;max-width:64ch;color:var(--muted);line-height:1.55}
        .app .fp-rules{list-style:none;margin:6px 0 4px;padding:0;display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px}
        .app .fp-rules li{display:grid;gap:3px;align-content:start;padding:14px;border-radius:14px;background:var(--paper);border:1px solid var(--line);min-width:0}
        .app .fp-rule-i{display:grid;place-items:center;width:30px;height:30px;border-radius:9px;background:var(--green-tint);color:var(--green);margin-bottom:4px}
        .app .fp-rules b{font-family:"Inter Tight",Inter,system-ui,sans-serif;font-size:22px;font-weight:800;letter-spacing:-.01em;color:var(--ink);font-variant-numeric:tabular-nums}
        .app .fp-rules li>span:last-child{font-size:12.5px;line-height:1.4;color:var(--muted)}
        .app .fp-calc{display:grid;grid-template-columns:auto auto 96px minmax(100px,1fr) auto;align-items:center;gap:10px 12px;padding:12px 14px;border-radius:14px;border:1.5px dashed color-mix(in srgb,var(--green) 40%,var(--line));background:color-mix(in srgb,var(--green-tint) 45%,transparent)}
        .app .fp-calc-i{display:grid;place-items:center;width:30px;height:30px;border-radius:9px;background:var(--paper-2);color:var(--green);border:1px solid var(--line);flex:none}
        .app .fp-calc label{font-size:13.5px;font-weight:650;color:var(--ink)}
        .app .fp-range{width:100%;margin:0}
        .app .fp-calc-out{display:flex;flex-direction:column;align-items:flex-end;text-align:right}
        .app .fp-calc-out small{font-size:11.5px;color:var(--muted)}
        .app .fp-calc-out b{font-family:"Inter Tight",Inter,system-ui,sans-serif;font-size:20px;font-weight:800;color:var(--green);font-variant-numeric:tabular-nums;white-space:nowrap}
        .app .fp-month{display:grid;gap:10px}
        .app .fp-month>h3{margin:6px 0 0;font-size:16px;font-weight:750}
        .app .fp-month>h3::first-letter,.app .fp-cap::first-letter{text-transform:uppercase}
        .app .fp-tiles{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px;margin:0}
        .app .fp-tiles>div{padding:14px 15px;border-radius:14px;background:var(--paper-2);border:1px solid var(--line);min-width:0}
        .app .fp-tiles dt{font-size:12.5px;font-weight:650;color:var(--muted)}
        .app .fp-tiles dd{margin:2px 0 0;font-size:12.5px;line-height:1.45;color:var(--muted)}
        .app .fp-tiles dd.fp-big{margin:4px 0 2px;font-family:"Inter Tight",Inter,system-ui,sans-serif;font-size:26px;font-weight:800;letter-spacing:-.02em;color:var(--ink);font-variant-numeric:tabular-nums}
        .app .fp-tiles .fp-pay{background:var(--green);border-color:transparent}
        .app .fp-tiles .fp-pay dt,.app .fp-tiles .fp-pay dd{color:color-mix(in srgb,#fff 82%,var(--green))}
        .app .fp-tiles .fp-pay dd.fp-big{color:#fff}
        .app .fp-meta{display:flex;flex-wrap:wrap;gap:6px 18px;margin:0;font-size:12.5px;color:var(--muted)}
        .app .fp-tcard{padding:6px 10px}
        .app .fp-idno{display:flex;gap:10px;flex-wrap:wrap;max-width:460px}
        .app .fp-idno .input{flex:1 1 200px;font-variant-numeric:tabular-nums;letter-spacing:.04em}
        .app .fp-ok{color:var(--green);font-weight:600}
        .app .fp-bad{color:var(--red);font-weight:600}
        .app .fp-scroll{overflow-x:auto}
        .app .fp-table{width:100%;border-collapse:collapse;font-size:13.5px;font-variant-numeric:tabular-nums}
        .app .fp-table th{text-align:left;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:var(--muted);padding:8px 10px;border-bottom:1.5px solid var(--line);white-space:nowrap}
        .app .fp-table td{padding:11px 10px;border-bottom:1px solid var(--line);vertical-align:top;color:var(--ink)}
        .app .fp-table tr:last-child td{border-bottom:0}
        .app .fp-table td small{display:block;font-size:11.5px;color:var(--muted);margin-top:2px}
        .app .fp-table .r{text-align:right}
        .app .fp-table s{color:var(--muted);margin-right:6px}
        .app .fp-fee{white-space:nowrap}
        .app .fp-free{color:var(--green)}
        .app .fp-nowrap{white-space:nowrap}
        .app .fp-job{font-weight:650;color:var(--ink);text-decoration:none}
        .app .fp-job:hover{text-decoration:underline}
        .app .fp-doc{display:inline-flex;align-items:center;gap:5px;font-weight:600;color:var(--ink);text-decoration:none;font-size:12.5px}
        .app .fp-doc:hover{text-decoration:underline}
        .app .fp-chip{display:inline-flex;padding:3px 9px;border-radius:999px;font-size:11.5px;font-weight:700;white-space:nowrap;background:var(--paper);border:1px solid var(--line);color:var(--muted)}
        .app .fp-chip.s-paid{background:var(--green-tint);border-color:transparent;color:var(--green)}
        .app .fp-chip.s-due{background:var(--amber-tint);border-color:transparent;color:var(--amber-ink)}
        .app .fp-chip.s-void,.app .fp-chip.s-late{background:var(--red-tint);border-color:transparent;color:var(--red)}
        .app .fp-howpay{display:flex;gap:12px;align-items:flex-start}
        .app .fp-howpay h3{margin:0 0 3px;font-size:15px}
        .app .fp-howpay p{margin:0;font-size:13.5px;line-height:1.55;color:var(--muted);max-width:70ch}
        @media (max-width:900px){.app .fp-rules{grid-template-columns:repeat(2,minmax(0,1fr))}.app .fp-calc{grid-template-columns:auto 1fr 96px}.app .fp-range{grid-column:1 / -1}.app .fp-calc-out{grid-column:1 / -1;align-items:flex-start;text-align:left}}
        @media (max-width:640px){.app .fp-tiles{grid-template-columns:1fr}}
      `}</style>
    </>
  );
}
