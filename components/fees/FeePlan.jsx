"use client";
// components/fees/FeePlan.jsx — the Plan tab under the pay-per-signed-job
// model (lib/successFees.js): how the fee works with a calculator, this
// month's statement (job fees and monitoring, what is to pay) and the months
// before. FeePlan draws what it is given; FeePlanLoader fetches /api/fees for
// it (the Settings page, only while the model is on).
import "./fees.css";
import Link from "next/link";
import { useEffect, useState } from "react";
import { ft } from "../../lib/feeText.js";
import { feeForKw, LEI_PER_KW, MAX_LEI_PER_JOB, FREE_JOBS } from "../../lib/successFees.js";
import { FREE_SYSTEMS, EUR_PER_SYSTEM } from "../../lib/monitoringPricing.js";
import { lei, kw, k1, n0, eur2, rate4, monthLabel, dayLabel, kwU } from "./feeFormat.js";
import { Zap, ShieldCheck, Gift, Undo2, Activity, Calculator, Eye, FileSignature, Wallet, ReceiptText, History } from "lucide-react";

const I = { size: 17, strokeWidth: 1.9, "aria-hidden": true };
const HOW = { online: "how_online", marked: "how_marked", status: "how_status" };

/** The fee cell of a job: the amount, or why there is none. */
export function FeeCell({ row, lang }) {
  if (row.status === "due") return <b className="fe-amt">{lei(row.fee, lang)}</b>;
  if (row.status === "free") return <span className="fe-chip free">{ft("st_free", lang, { n: row.freeN, t: FREE_JOBS })}</span>;
  if (row.status === "cancelled") return <span className="fe-chip off"><s>{lei(row.full, lang)}</s>{ft("st_cancelled", lang)}</span>;
  if (row.status === "no_size") return <span className="fe-chip warn">{ft("st_no_size", lang)}</span>;
  return null;
}

/** How the fee works, with a calculator. */
export function FeeRules({ lang = "en", next = null }) {
  const [k, setK] = useState(10);
  const v = Number(k) || 0;
  const fee = feeForKw(v);
  const capped = v * LEI_PER_KW > MAX_LEI_PER_JOB;
  return (
    <section className="dx-card st-card fe-hero" aria-labelledby="fe-h">
      <div className="fe-pills">
        <span className="fe-pill"><FileSignature size={13} strokeWidth={2.2} aria-hidden="true" />{ft("badge", lang)}</span>
        <span className="fe-pill local"><Eye size={13} strokeWidth={2.2} aria-hidden="true" />{ft("preview", lang)}</span>
      </div>
      <h3 id="fe-h" className="fe-h">{ft("h", lang)}</h3>
      <p className="fe-lead">{ft("lead", lang)}</p>
      <ul className="fe-rules">
        <li><i><Zap {...I} /></i><span>{ft("r_kw", lang, { lei: n0(LEI_PER_KW, lang) })}</span></li>
        <li><i><ShieldCheck {...I} /></i><span>{ft("r_cap", lang, { lei: n0(MAX_LEI_PER_JOB, lang) })}</span></li>
        <li><i><Gift {...I} /></i><span>{ft("r_free", lang, { n: FREE_JOBS })}</span></li>
        <li><i><Undo2 {...I} /></i><span>{ft("r_cancel", lang)}</span></li>
      </ul>
      <div className="fe-calc">
        <span className="fe-calc-i"><Calculator {...I} /></span>
        <label htmlFor="fe-kw">{ft("calc_l", lang)}</label>
        <span className="fe-calc-in">
          <input id="fe-kw" type="number" inputMode="decimal" min="0" max="500" step="0.1" value={k}
            onChange={(e) => setK(e.target.value)} />
          <span>{kwU(lang)}</span>
        </span>
        <input className="fe-calc-r" type="range" min="1" max="60" step="0.5" value={Math.min(60, Math.max(1, v || 1))}
          aria-label={ft("calc_l", lang)} onChange={(e) => setK(e.target.value)} style={{ "--fill": `${((Math.min(60, Math.max(1, v || 1)) - 1) / 59) * 100}%` }} />
        <output htmlFor="fe-kw" className="fe-calc-out">
          <b>{ft("calc_v", lang, { lei: n0(fee, lang) })}</b>
          {capped && <small>{ft("calc_cap", lang)}</small>}
        </output>
      </div>
      {next?.free && <p className="fe-note good"><Gift size={14} strokeWidth={2} aria-hidden="true" />{ft("calc_free", lang, { n: next.freeN, t: FREE_JOBS })}</p>}
      <p className="fe-note"><Activity size={14} strokeWidth={2} aria-hidden="true" />{ft("r_monitor", lang, { eur: eur2(EUR_PER_SYSTEM, lang), n: FREE_SYSTEMS })}</p>
    </section>
  );
}

/** This month: the four figures and every job signed in it. */
export function FeeMonth({ lang = "en", data }) {
  const s = data.statement;
  const mon = s.monitoring;
  const m = monthLabel(s.period, lang);
  const jobs = [...s.jobs].sort((a, b) => String(b.signedAt).localeCompare(String(a.signedAt)));
  return (
    <section className="dx-card st-card" aria-labelledby="fe-month-h">
      <div className="st-card-h"><div><h3 id="fe-month-h">{ft("month_h", lang, { m })}</h3></div></div>
      <div className="fe-kpis">
        <div className="fe-kpi">
          <span className="fe-kpi-l"><FileSignature {...I} />{ft("k_signed", lang)}</span>
          <b>{n0(s.signed, lang)}</b>
          <small>{ft("k_signed_s", lang, { kw: kw(s.kw, lang), free: s.free, c: s.cancelled })}</small>
        </div>
        <div className="fe-kpi">
          <span className="fe-kpi-l"><ReceiptText {...I} />{ft("k_fees", lang)}</span>
          <b>{lei(s.feeLei, lang)}</b>
          <small>{ft("k_fees_s", lang, { n: s.due, lei: n0(LEI_PER_KW, lang) })}</small>
        </div>
        <div className="fe-kpi">
          <span className="fe-kpi-l"><Activity {...I} />{ft("k_mon", lang)}</span>
          <b>{mon?.monthlyLei != null ? lei(mon.monthlyLei, lang) : `${eur2(mon?.monthlyEur || 0, lang)} EUR`}</b>
          <small>{mon && mon.billable > 0 ? ft("k_mon_s", lang, { b: mon.billable, n: mon.systems }) : ft("k_mon_free", lang, { n: mon?.systems || 0, f: FREE_SYSTEMS })}</small>
        </div>
        <div className="fe-kpi accent">
          <span className="fe-kpi-l"><Wallet {...I} />{ft("k_total", lang, { m })}</span>
          <b>{lei(s.totalLei, lang)}</b>
          <small>{ft("k_total_s", lang)}</small>
        </div>
      </div>

      {jobs.length ? (
        <div className="fe-table-wrap">
          <table className="fe-table fe-jobs">
            <thead><tr><th>{ft("t_date", lang)}</th><th>{ft("t_job", lang)}</th><th className="r u">{kwU(lang)}</th><th className="r">{ft("t_fee", lang)}</th></tr></thead>
            <tbody>
              {jobs.map((j) => (
                <tr key={j.id} className={j.status === "cancelled" ? "off" : ""}>
                  <td className="fe-nowrap">{dayLabel(j.signedAt, lang)}<small>{ft(HOW[j.how], lang)}</small></td>
                  <td><Link href={`/projects/${j.id}`} className="fe-job">{j.title || j.client}</Link>{j.client && j.title ? <small>{j.client}</small> : null}</td>
                  <td className="r fe-kwc">{k1(j.kw, lang)}<span className="fe-m"> {kwU(lang)}</span></td>
                  <td className="r"><FeeCell row={j} lang={lang} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : <p className="fe-empty">{ft("t_none", lang)}</p>}
      {mon?.monthlyLei != null && mon.billable > 0 && data.fx?.rate ? <p className="fe-foot">{ft("fx_note", lang, { r: rate4(data.fx.rate, lang) })}</p> : null}
      {data.from ? <p className="fe-foot">{ft("from_note", lang, { d: dayLabel(`${data.from}T12:00:00Z`, lang) })}</p> : null}
    </section>
  );
}

/** The months before this one. */
export function FeeHistory({ lang = "en", data }) {
  const past = (data.months || []).filter((x) => x.period !== data.current);
  return (
    <section className="dx-card st-card" aria-labelledby="fe-hist-h">
      <div className="st-card-h"><div><h3 id="fe-hist-h"><History size={16} strokeWidth={2} aria-hidden="true" className="fe-h3i" />{ft("hist_h", lang)}</h3></div></div>
      {past.length ? (
        <div className="fe-table-wrap">
          <table className="fe-table">
            <thead><tr><th>{ft("hist_month", lang)}</th><th className="r">{ft("k_signed", lang)}</th><th className="r u">{kwU(lang)}</th><th className="r">{ft("k_fees", lang)}</th></tr></thead>
            <tbody>
              {past.map((x) => (
                <tr key={x.period}>
                  <td className="fe-cap">{monthLabel(x.period, lang)}</td>
                  <td className="r">{n0(x.signed, lang)}{x.free ? <small>{ft("free_n", lang, { n: x.free })}</small> : null}</td>
                  <td className="r">{k1(x.kw, lang)}</td>
                  <td className="r"><b className="fe-amt">{lei(x.feeLei, lang)}</b></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : <p className="fe-empty">{ft("hist_none", lang)}</p>}
    </section>
  );
}

export default function FeePlan({ lang = "en", data }) {
  return (
    <>
      <FeeRules lang={lang} next={data?.next} />
      {data && <FeeMonth lang={lang} data={data} />}
      {data && <FeeHistory lang={lang} data={data} />}
    </>
  );
}

/** The Plan tab's fee section, fetched. */
export function FeePlanLoader({ lang = "en" }) {
  const [data, setData] = useState(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let alive = true;
    fetch("/api/fees", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
      .then((j) => { if (alive) setData(j); })
      .catch(() => { if (alive) setFailed(true); });
    return () => { alive = false; };
  }, []);
  return (
    <>
      <FeePlan lang={lang} data={data} />
      {!data && <p className="fe-empty" role="status">{failed ? ft("load_failed", lang) : ft("loading", lang)}</p>}
    </>
  );
}
