// components/fees/RevenueView.jsx — VoltMira's revenue for one month under
// the pay-per-signed-job model (lib/successFees.js): who pays what, the four
// figures (job fees, monitoring, the banks' commission, the total), every
// installer's statement with a CSV for invoicing, the banks, and the
// simulator. Draws what lib/feeData.js revenueMonth() gives it, so the admin
// page and a local preview share it. No hooks: a server component can render
// it, the simulator inside is the client part.
import "./fees.css";
import Link from "next/link";
import { ft } from "../../lib/feeText.js";
import { LEI_PER_KW, MAX_LEI_PER_JOB, FREE_JOBS } from "../../lib/successFees.js";
import { FREE_SYSTEMS, EUR_PER_SYSTEM } from "../../lib/monitoringPricing.js";
import { lei, kw, k1, n0, eur2, monthLabel } from "./feeFormat.js";
import RevenueSim from "./RevenueSim.jsx";
import { ReceiptText, Activity, Landmark, Wallet, Download, Users, Eye } from "lucide-react";

const I = { size: 17, strokeWidth: 1.9, "aria-hidden": true };

export default function RevenueView({ lang = "en", data, monthHref = (m) => `?month=${m}`, csvHref = null }) {
  const { period, current, rows, banks, totals, fx } = data;
  const m = monthLabel(period, lang);
  const bankN = (banks || []).reduce((s, b) => s + b.loans, 0);
  return (
    <>
      <p className="fe-note fe-preview"><Eye size={14} strokeWidth={2} aria-hidden="true" />{ft("preview", lang)}</p>

      <section className="adm-card" aria-labelledby="rv-how-h">
        <h2 id="rv-how-h">{ft("rv_how_h", lang)}</h2>
        <ul className="fe-who">
          <li><i><Users {...I} /></i><b>{ft("rv_how_inst", lang)}</b><span>{ft("rv_how_inst_v", lang, { lei: n0(LEI_PER_KW, lang), cap: n0(MAX_LEI_PER_JOB, lang), n: FREE_JOBS })}</span></li>
          <li><i><Activity {...I} /></i><b>{ft("k_mon", lang)}</b><span>{ft("rv_how_mon_v", lang, { eur: eur2(EUR_PER_SYSTEM, lang), n: FREE_SYSTEMS })}</span></li>
          <li><i><Landmark {...I} /></i><b>{ft("rv_how_bank", lang)}</b><span>{ft("rv_how_bank_v", lang)}</span></li>
        </ul>
      </section>

      <div className="fe-rv-bar">
        <nav className="adm-seg fe-months" aria-label={ft("rv_month", lang)}>
          {data.months.map((x) => (
            <Link key={x} href={monthHref(x)} className={"adm-tab fe-cap" + (x === period ? " on" : "")} aria-current={x === period ? "page" : undefined}>{monthLabel(x, lang)}</Link>
          ))}
        </nav>
        {csvHref && <a className="btn ghost sm fe-csv" href={csvHref}><Download size={14} strokeWidth={2} aria-hidden="true" />{ft("rv_csv", lang)}</a>}
      </div>

      <div className="fe-kpis fe-rv-kpis">
        <div className="fe-kpi">
          <span className="fe-kpi-l"><ReceiptText {...I} />{ft("k_fees", lang)}</span>
          <b>{lei(totals.feeLei, lang)}</b>
          <small>{ft("rv_k_fees_s", lang, { n: totals.signed, kw: kw(totals.kw, lang) })}</small>
        </div>
        <div className="fe-kpi">
          <span className="fe-kpi-l"><Activity {...I} />{ft("k_mon", lang)}</span>
          <b>{lei(period === current ? totals.monitoringLei : 0, lang)}</b>
          <small>{period === current ? ft("rv_k_mon_s", lang, { n: rows.reduce((s, r) => s + (r.monitoring?.billable || 0), 0) }) : ft("rv_k_mon_past", lang)}</small>
        </div>
        <div className="fe-kpi">
          <span className="fe-kpi-l"><Landmark {...I} />{ft("rv_k_bank", lang)}</span>
          <b>{lei(totals.bankLei + (fx?.rate ? Math.round(totals.bankEur * fx.rate) : 0), lang)}</b>
          <small>{banks && banks.length ? ft("rv_k_bank_s", lang, { n: bankN }) : ft("rv_k_bank_none", lang)}</small>
        </div>
        <div className="fe-kpi accent">
          <span className="fe-kpi-l"><Wallet {...I} />{ft("rv_k_total", lang, { m })}</span>
          <b>{lei(totals.totalLei, lang)}</b>
          <small>{ft("rv_k_total_s", lang, { n: totals.installers })}</small>
        </div>
      </div>

      <section className="adm-card" aria-labelledby="rv-t-h">
        <h2 id="rv-t-h">{ft("rv_t_h", lang)}</h2>
        <p>{ft("rv_t_note", lang)}</p>
        {rows.length ? (
          <div className="fe-table-wrap">
            <table className="fe-table fe-rv-table">
              <thead><tr>
                <th>{ft("rv_c_inst", lang)}</th><th className="r">{ft("rv_c_jobs", lang)}</th><th className="r">{ft("rv_c_free", lang)}</th>
                <th className="r">{ft("rv_c_canc", lang)}</th><th className="r u">kW</th><th className="r">{ft("rv_c_fees", lang)}</th>
                <th className="r">{ft("rv_c_mon", lang)}</th><th className="r">{ft("rv_c_total", lang)}</th>
              </tr></thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.companyId}>
                    <td><b>{r.name || r.companyId.slice(0, 8)}</b>{r.internal ? <span className="fe-chip off fe-int">{ft("rv_internal", lang)}</span> : null}</td>
                    <td className="r">{n0(r.signed, lang)}</td>
                    <td className="r">{r.free ? n0(r.free, lang) : ""}</td>
                    <td className="r">{r.cancelled ? n0(r.cancelled, lang) : ""}</td>
                    <td className="r">{k1(r.kw, lang)}</td>
                    <td className="r">{n0(r.feeLei, lang)}</td>
                    <td className="r">{r.monitoring?.monthlyLei ? n0(r.monitoring.monthlyLei, lang) : ""}</td>
                    <td className="r"><b className="fe-amt">{n0(r.totalLei, lang)}</b></td>
                  </tr>
                ))}
              </tbody>
              <tfoot><tr>
                <td>{ft("total_word", lang)}</td><td className="r">{n0(totals.signed, lang)}</td><td className="r">{n0(totals.free, lang)}</td>
                <td className="r">{n0(totals.cancelled, lang)}</td><td className="r">{k1(totals.kw, lang)}</td><td className="r">{n0(totals.feeLei, lang)}</td>
                <td className="r">{n0(totals.monitoringLei, lang)}</td><td className="r"><b>{n0(totals.feeLei + totals.monitoringLei, lang)}</b></td>
              </tr></tfoot>
            </table>
          </div>
        ) : <p className="fe-empty">{ft("rv_none", lang, { m })}</p>}
      </section>

      <section className="adm-card" aria-labelledby="rv-b-h">
        <h2 id="rv-b-h">{ft("rv_banks_h", lang)}</h2>
        {banks === null ? <p>{ft("rv_banks_db", lang)}</p> : banks.length ? (
          <div className="fe-table-wrap">
            <table className="fe-table">
              <thead><tr><th>{ft("rv_c_bank", lang)}</th><th className="r">{ft("rv_c_loans", lang)}</th><th className="r">{ft("rv_c_amount", lang)}</th></tr></thead>
              <tbody>
                {banks.map((b) => (
                  <tr key={b.lenderId + b.currency}>
                    <td><b>{b.lender}</b></td><td className="r">{n0(b.loans, lang)}</td>
                    <td className="r"><b className="fe-amt">{b.currency === "MDL" ? lei(b.amountMinor / 100, lang) : `${eur2(b.amountMinor / 100, lang)} ${b.currency}`}</b></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <p>{ft("rv_banks_none", lang, { m })} <Link href="/admin/lenders">{ft("rv_lenders", lang)}</Link></p>}
      </section>

      <RevenueSim lang={lang} eurMdl={fx?.rate || null} />
    </>
  );
}
