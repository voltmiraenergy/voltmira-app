"use client";
// components/fees/RevenueSim.jsx — on VoltMira's revenue page, what the
// pay-per-signed-job model earns in a month and a year for a number of
// installers and jobs: the job fees (lib/successFees.js), the banks'
// commission on the clients who take a loan, and monitoring past each
// installer's free systems. The average jobs are CNED's: homes 8.4 kW,
// companies 62 kW (lib/data/cnedEser.js), priced at about 650 and 500 EUR a
// kW. Free jobs are left out: an installer has them once, not every month.
import "./fees.css";
import { useState } from "react";
import { ft } from "../../lib/feeText.js";
import { feeForKw } from "../../lib/successFees.js";
import { FREE_SYSTEMS, EUR_PER_SYSTEM } from "../../lib/monitoringPricing.js";
import { lei, k1, n0, rate4 } from "./feeFormat.js";
import { SlidersHorizontal, ReceiptText, Landmark, Activity, Wallet } from "lucide-react";

export const SIM_JOBS = { home: { kw: 8.4, eurPerKw: 650 }, company: { kw: 62, eurPerKw: 500 } };
const I = { size: 15, strokeWidth: 2, "aria-hidden": true };

/** The month the inputs make, in lei. Pure, so the page and a test can share it. */
export function simulate({ installers, jobsPer, companyPct, loanPct, bankPct, systems }, eurMdl) {
  const r = eurMdl || 20;
  const jobs = Math.max(0, installers) * Math.max(0, jobsPer);
  const companies = jobs * (Math.min(100, Math.max(0, companyPct)) / 100);
  const homes = jobs - companies;
  const price = (j) => j.kw * j.eurPerKw * r;
  const fees = homes * feeForKw(SIM_JOBS.home.kw) + companies * feeForKw(SIM_JOBS.company.kw);
  const value = homes * price(SIM_JOBS.home) + companies * price(SIM_JOBS.company);
  const bank = value * (Math.min(100, Math.max(0, loanPct)) / 100) * (Math.max(0, bankPct) / 100);
  const billable = Math.max(0, Math.max(0, systems) - Math.max(0, installers) * FREE_SYSTEMS);
  const monitoring = billable * EUR_PER_SYSTEM * r;
  return { jobs, homes, companies, fees, bank, monitoring, total: fees + bank + monitoring, value };
}

function Field({ id, label, value, onChange, min, max, step }) {
  return (
    <label className="fe-sim-f" htmlFor={id}>
      <span>{label}</span>
      <span className="fe-sim-in">
        <input id={id} type="number" min={min} max={max} step={step} value={value} onChange={(e) => onChange(e.target.value)} />
        <input type="range" min={min} max={max} step={step} value={Math.min(max, Math.max(min, Number(value) || 0))} aria-label={label}
          onChange={(e) => onChange(e.target.value)} style={{ "--fill": `${((Math.min(max, Math.max(min, Number(value) || 0)) - min) / (max - min)) * 100}%` }} />
      </span>
    </label>
  );
}

export default function RevenueSim({ lang = "en", eurMdl = null }) {
  const [v, setV] = useState({ installers: 10, jobsPer: 2, companyPct: 25, loanPct: 30, bankPct: 1, systems: 150 });
  const set = (k) => (x) => setV((cur) => ({ ...cur, [k]: x }));
  const num = Object.fromEntries(Object.entries(v).map(([k, x]) => [k, Number(x) || 0]));
  const r = eurMdl || 20;
  const m = simulate(num, r);
  const eur = (x) => `≈ ${n0(x / r, lang)} EUR`;
  const rows = [
    { k: "k_fees", Icon: ReceiptText, v: m.fees },
    { k: "rv_k_bank", Icon: Landmark, v: m.bank },
    { k: "k_mon", Icon: Activity, v: m.monitoring },
  ];
  return (
    <section className="adm-card fe-simcard" aria-labelledby="fe-sim-h">
      <h2 id="fe-sim-h"><SlidersHorizontal size={17} strokeWidth={2} aria-hidden="true" className="fe-h3i" />{ft("sim_h", lang)}</h2>
      <p>{ft("sim_s", lang, {
        hk: k1(SIM_JOBS.home.kw, lang), hp: n0(SIM_JOBS.home.kw * SIM_JOBS.home.eurPerKw * r, lang),
        ck: k1(SIM_JOBS.company.kw, lang), cp: n0(SIM_JOBS.company.kw * SIM_JOBS.company.eurPerKw * r, lang),
      })}</p>
      <div className="fe-sim-grid">
        <div className="fe-sim-fields">
          <Field id="sim-inst" label={ft("sim_inst", lang)} value={v.installers} onChange={set("installers")} min={1} max={200} step={1} />
          <Field id="sim-jobs" label={ft("sim_jobs", lang)} value={v.jobsPer} onChange={set("jobsPer")} min={0} max={20} step={0.5} />
          <Field id="sim-comp" label={ft("sim_comp", lang)} value={v.companyPct} onChange={set("companyPct")} min={0} max={100} step={5} />
          <Field id="sim-loan" label={ft("sim_loan", lang)} value={v.loanPct} onChange={set("loanPct")} min={0} max={100} step={5} />
          <Field id="sim-bank" label={ft("sim_bank", lang)} value={v.bankPct} onChange={set("bankPct")} min={0} max={5} step={0.25} />
          <Field id="sim-sys" label={ft("sim_sys", lang)} value={v.systems} onChange={set("systems")} min={0} max={5000} step={10} />
        </div>
        <div className="fe-sim-out" aria-live="polite">
          <table className="fe-table">
            <thead><tr><th /><th className="r">{ft("sim_month", lang)}</th><th className="r">{ft("sim_year", lang)}</th></tr></thead>
            <tbody>
              {rows.map(({ k, Icon, v: x }) => (
                <tr key={k}><td><span className="fe-sim-l"><Icon {...I} />{ft(k, lang)}</span></td><td className="r">{lei(x, lang)}</td><td className="r">{lei(x * 12, lang)}</td></tr>
              ))}
              <tr className="fe-sim-total">
                <td><span className="fe-sim-l"><Wallet {...I} />{ft("total_word", lang)}</span></td>
                <td className="r"><b>{lei(m.total, lang)}</b><small>{eur(m.total)}</small></td>
                <td className="r"><b>{lei(m.total * 12, lang)}</b><small>{eur(m.total * 12)}</small></td>
              </tr>
            </tbody>
          </table>
          <p className="fe-foot">{ft("sim_note", lang, { r: rate4(r, lang) })}</p>
        </div>
      </div>
    </section>
  );
}
