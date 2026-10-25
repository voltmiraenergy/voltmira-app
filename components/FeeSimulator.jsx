"use client";
// components/FeeSimulator.jsx — Settings › Pay per job: one example job's fee walked through day by day, with the real
// rules (lib/feeSim.js): signed, added up in its month, on the statement on the 1st, paid by transfer by the 14th, or
// held step by step when it is not; the client giving up before or after the paperwork. Nothing is saved or sent.
import { useMemo, useState } from "react";
import { Lock, LockOpen, Mail, FileText, RotateCcw, Landmark, Undo2 } from "lucide-react";
import { simDates, simState } from "../lib/feeSim.js";
import { simt } from "../lib/feeSimText.js";
import { feeLei, FREE_JOBS } from "../lib/jobFees.js";
import { ft, monthName, feeDay } from "../lib/feeText.js";
import { rangeFill } from "../lib/rangeFill.js";

const DAY = 864e5;

export default function FeeSimulator({ lang, month }) {
  const S = (k, v) => simt(k, lang, v);
  // the month the workspace is in (the server's, from Settings): the example is signed in it
  const d = useMemo(() => simDates(month), [month]);
  const span = Math.round((d.end - d.signed) / DAY);
  const [day, setDay] = useState(0);
  const [kw, setKw] = useState(8);
  const [free, setFree] = useState(false);
  const [papers, setPapers] = useState(true);
  const [paidAt, setPaidAt] = useState(null);
  const [gaveUpAt, setGaveUpAt] = useState(null);
  const at = d.signed + day * DAY;
  const s = simState({ d, at, kw, free, papers, paidAt, gaveUpAt });
  const day1 = (t) => feeDay(new Date(t).toISOString(), lang, true);
  const lei = (m) => feeLei(m, lang);
  const ref = `VMF${d.month.slice(0, 4)}000042`;
  const goTo = (t) => setDay(Math.max(0, Math.min(span, Math.round((t - d.signed) / DAY))));
  const reset = () => { setDay(0); setPaidAt(null); setGaveUpAt(null); };

  const marks = [
    ["signed", d.signed, S("sim_m_signed")], ["issued", d.issued, S("sim_m_issued")], ["last", d.lastDay, S("sim_m_last")],
    ["locked", d.due, S("sim_m_locked")], ["hold30", d.hold30, S("sim_m_hold30")], ["hold60", d.hold60, S("sim_m_hold60")],
  ];
  const current = marks.filter(([, t]) => t <= at).at(-1)?.[0];

  const chip = {
    free: ["is-ok", S("sim_s_free")], month: ["", S("sim_s_month")], open: ["is-due", S("sim_s_open")],
    late: ["is-late", S("sim_s_late", { n: s.daysLate })], paid: ["is-ok", S("sim_s_paid")], void: ["", S("sim_s_void")], kept: ["is-due", S("sim_s_kept")],
  }[s.status];
  const why = s.status === "free" ? S("sim_x_free", { n: FREE_JOBS })
    : s.status === "month" ? S("sim_x_month", { d: day1(d.issued) })
    : s.status === "open" ? S("sim_x_open", { d: day1(d.lastDay) })
    : s.status === "late" ? S("sim_x_late" + Math.max(1, s.level))
    : s.status === "paid" ? S("sim_x_paid", { d: day1(paidAt) })
    : s.status === "void" ? S("sim_x_void")
    : S("sim_x_kept");
  const can = [
    [S("sim_c_docs"), s.level >= 1 ? S("sim_locked") : S("sim_open"), s.level >= 1],
    [S("sim_c_offers"), s.level >= 2 ? S("sim_stopped") : S("sim_open"), s.level >= 2],
    [S("sim_c_edit"), s.level >= 3 ? S("sim_readonly") : S("sim_open"), s.level >= 3],
  ];
  const mVars = { m: monthName(d.month, lang), v: lei(s.amountMinor) };

  return (
    <section className="dx-card st-card fs" id="fee-sim" aria-labelledby="fs-h">
      <div className="fs-head">
        <span className="fs-kicker">{S("sim_kicker")}</span>
        <h2 id="fs-h">{S("sim_h")}</h2>
        <p>{S("sim_p")}</p>
      </div>

      <div className="fs-controls">
        <label className="fs-kw" htmlFor="fs-kw">
          <span>{S("sim_kw")}</span>
          <input id="fs-kw" type="range" min="2" max="50" step="1" value={kw} style={rangeFill(kw, 2, 50)} onChange={(e) => setKw(+e.target.value)} />
          <b>{kw} kW</b>
        </label>
        <label className="fs-check"><input type="checkbox" checked={free} onChange={(e) => setFree(e.target.checked)} />{S("sim_free", { n: FREE_JOBS })}</label>
        <label className="fs-check"><input type="checkbox" checked={papers} onChange={(e) => setPapers(e.target.checked)} />{S("sim_papers")}</label>
      </div>

      <div className="fs-time">
        <div className="fs-now">
          <span>{S("sim_day")}</span>
          <b>{day1(at)}</b>
        </div>
        <input type="range" className="fs-slider" min="0" max={span} step="1" value={day} aria-label={S("sim_day")}
          aria-valuetext={day1(at)} style={rangeFill(day, 0, span)} onChange={(e) => setDay(+e.target.value)} />
        <div className="fs-marks">
          {marks.map(([id, t, label]) => (
            <button key={id} type="button" className={"fs-mark" + (current === id ? " on" : "") + (t <= at ? " past" : "")} onClick={() => goTo(t)}>
              <small>{feeDay(new Date(t).toISOString(), lang)}</small>{label}
            </button>
          ))}
        </div>
      </div>

      <div className="fs-grid">
        <div className="fs-box">
          <h3>{S("sim_fee_h")}</h3>
          <p className="fs-amt"><b>{lei(s.amountMinor)}</b><small>{kw} kW</small></p>
          <span className={"fs-chip " + chip[0]}>{chip[1]}</span>
          <p className="fs-why" aria-live="polite">{why}</p>
        </div>
        <div className="fs-box">
          <h3>{S("sim_can_h")}</h3>
          <ul className="fs-can">
            {can.map(([what, state, shut]) => (
              <li key={what} className={shut ? "shut" : ""}>
                {shut ? <Lock size={15} aria-hidden="true" /> : <LockOpen size={15} aria-hidden="true" />}
                <span>{what}</span><b>{state}</b>
              </li>
            ))}
          </ul>
        </div>
        <div className="fs-box">
          <h3>{S("sim_mail_h")}</h3>
          {s.emails.length ? (
            <ol className="fs-mails">
              {[...s.emails].reverse().map((e) => (
                <li key={e.step}><Mail size={14} aria-hidden="true" /><span><small>{feeDay(new Date(e.at).toISOString(), lang)}</small>{ft("rem_s_" + e.step, lang, mVars)}</span></li>
              ))}
            </ol>
          ) : <p className="fs-why">{S("sim_mail_none")}</p>}
        </div>
      </div>

      <div className="fs-st">
        <span className="fs-st-i" aria-hidden="true"><FileText size={16} /></span>
        <div className="fs-st-tx">
          <b>{S("sim_st_h")}</b>
          {free ? <span>{S("sim_st_free")}</span>
            : at < d.issued ? <span>{S("sim_st_none", { d: day1(d.issued) })}</span>
            : <span>{S("sim_st_sum")} <b>{s.status === "paid" || s.status === "void" ? lei(0) : lei(s.amountMinor)}</b>, {S("sim_st_until")} {day1(d.lastDay)}, {S("sim_st_ref")} <code>{ref}</code>, {S("sim_st_iban")}</span>}
        </div>
        <div className="fs-acts">
          <button type="button" className="btn amber" disabled={!s.canPay} onClick={() => setPaidAt(at)}>
            <Landmark size={15} aria-hidden="true" />{S("sim_pay")}
          </button>
          <button type="button" className="btn ghost" disabled={!s.canGiveUp} onClick={() => setGaveUpAt(at)}>
            <Undo2 size={15} aria-hidden="true" />{S("sim_gave_up")}
          </button>
          <button type="button" className="btn ghost" onClick={reset}><RotateCcw size={15} aria-hidden="true" />{S("sim_reset")}</button>
        </div>
      </div>
      <p className="fs-note">{S("sim_pay_hint")}</p>

      <style>{`
        .app .fs{display:grid;gap:16px}
        .app .fs-head{display:grid;gap:4px}
        .app .fs-kicker{font-size:11px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:var(--amber-ink,var(--amber))}
        .app .fs-head h2{margin:0;font-size:19px;font-weight:750;letter-spacing:-.01em;color:var(--ink);text-wrap:balance}
        .app .fs-head p{margin:0;font-size:13.5px;line-height:1.5;color:var(--muted);max-width:68ch}
        .app .fs-controls{display:flex;flex-wrap:wrap;align-items:center;gap:10px 22px}
        .app .fs-kw{display:flex;align-items:center;gap:10px;font-size:13.5px;font-weight:650;color:var(--ink)}
        .app .fs-kw input{width:170px}
        .app .fs-kw b{font-variant-numeric:tabular-nums;min-width:48px}
        .app .fs-check{display:inline-flex;align-items:center;gap:8px;font-size:13.5px;color:var(--ink);cursor:pointer}
        .app .fs-check input{width:17px;height:17px;accent-color:var(--green)}
        .app .fs-time{display:grid;gap:10px;padding:14px;border-radius:14px;background:var(--paper);border:1px solid var(--line)}
        .app .fs-now{display:flex;align-items:baseline;gap:10px}
        .app .fs-now span{font-size:12px;font-weight:650;color:var(--muted);text-transform:uppercase;letter-spacing:.06em}
        .app .fs-now b{font-size:18px;font-weight:750;color:var(--ink);font-variant-numeric:tabular-nums}
        .app .fs-slider{width:100%}
        .app .fs-marks{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:6px}
        .app .fs-mark{display:grid;gap:2px;text-align:left;padding:7px 9px;border-radius:10px;border:1px solid var(--line);background:var(--card);font-size:12.5px;font-weight:650;color:var(--muted);line-height:1.25;cursor:pointer}
        .app .fs-mark small{font-size:11px;font-weight:600;font-variant-numeric:tabular-nums}
        .app .fs-mark.past{color:var(--ink)}
        .app .fs-mark.on{border-color:var(--amber);background:var(--amber-tint);color:var(--ink)}
        .app .fs-mark:focus-visible{outline:2px solid var(--amber);outline-offset:2px}
        .app .fs-grid{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr) minmax(0,1.25fr);gap:12px}
        .app .fs-box{display:grid;align-content:start;gap:8px;padding:14px;border-radius:14px;border:1px solid var(--line);background:var(--card);min-width:0}
        .app .fs-box h3{margin:0;font-size:13px;font-weight:700;color:var(--muted);text-transform:none}
        .app .fs-amt{margin:0;display:flex;align-items:baseline;gap:8px}
        .app .fs-amt b{font-size:26px;font-weight:800;letter-spacing:-.02em;color:var(--ink);font-variant-numeric:tabular-nums}
        .app .fs-amt small{font-size:12.5px;color:var(--muted)}
        .app .fs-chip{justify-self:start;font-size:12px;font-weight:700;padding:3px 10px;border-radius:99px;background:var(--paper-2);color:var(--ink)}
        .app .fs-chip.is-ok{background:var(--green-tint);color:var(--green)}
        .app .fs-chip.is-due{background:var(--amber-tint);color:var(--amber-ink,var(--ink))}
        .app .fs-chip.is-late{background:color-mix(in srgb,var(--red) 12%,var(--card));color:var(--red)}
        .app .fs-why{margin:0;font-size:13px;line-height:1.5;color:var(--ink)}
        .app .fs-can{list-style:none;margin:0;padding:0;display:grid;gap:6px}
        .app .fs-can li{display:grid;grid-template-columns:auto 1fr auto;align-items:center;gap:8px;font-size:13px;color:var(--ink);padding:7px 9px;border-radius:9px;background:var(--paper)}
        .app .fs-can li svg{color:var(--green)}
        .app .fs-can li b{font-size:12px;color:var(--green)}
        .app .fs-can li.shut{background:color-mix(in srgb,var(--red) 8%,var(--card))}
        .app .fs-can li.shut svg,.app .fs-can li.shut b{color:var(--red)}
        .app .fs-mails{list-style:none;margin:0;padding:0;display:grid;gap:7px;max-height:250px;overflow:auto}
        .app .fs-mails li{display:grid;grid-template-columns:auto 1fr;gap:8px;font-size:12.5px;line-height:1.4;color:var(--ink)}
        .app .fs-mails li svg{margin-top:2px;color:var(--muted)}
        .app .fs-mails small{display:block;font-size:11px;font-weight:650;color:var(--muted);font-variant-numeric:tabular-nums}
        .app .fs-st{display:grid;grid-template-columns:auto minmax(0,1fr) auto;align-items:center;gap:12px;padding:12px 14px;border-radius:14px;border:1.5px dashed color-mix(in srgb,var(--green) 40%,var(--line));background:color-mix(in srgb,var(--green-tint) 45%,transparent)}
        .app .fs-st-i{display:grid;place-items:center;width:30px;height:30px;border-radius:9px;background:var(--paper-2);color:var(--green);border:1px solid var(--line)}
        .app .fs-st-tx{display:grid;gap:2px;font-size:13px;line-height:1.45;color:var(--ink)}
        .app .fs-st-tx code{font-size:12px;font-weight:700;padding:1px 6px;border-radius:6px;background:var(--paper-2)}
        .app .fs-acts{display:flex;flex-wrap:wrap;gap:8px;justify-content:flex-end}
        .app .fs-acts .btn{display:inline-flex;align-items:center;gap:6px}
        .app .fs-note{margin:-6px 0 0;font-size:12.5px;color:var(--muted)}
        @media (max-width:900px){
          .app .fs-grid{grid-template-columns:minmax(0,1fr)}
          .app .fs-marks{grid-template-columns:repeat(3,minmax(0,1fr))}
          .app .fs-st{grid-template-columns:auto minmax(0,1fr)}
          .app .fs-acts{grid-column:1/-1;justify-content:flex-start}
        }
      `}</style>
    </section>
  );
}
