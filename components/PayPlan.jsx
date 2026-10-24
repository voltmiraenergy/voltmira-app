"use client";
// components/PayPlan.jsx — a payment plan: the stages of a job's price (lib/milestones.js), each a share tied to a
// step, and the days the client has to pay. Two places: Settings, the workspace's default plan (the owner's); a job's
// billing page, that job's own plan, where the stages already invoiced are listed and only the rest can change.
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, X, Link2 } from "lucide-react";
import { pt, money, dayName } from "../lib/payText.js";
import { MILESTONE_TRIGGERS } from "../lib/milestones.js";
import { saveDefaultPlan, saveJobPlan, loadDefaultPlan } from "../lib/cashActions.js";

/**
 * @param {object} p
 * @param {"default"|"job"} p.mode
 * @param {{ steps: {trigger,pct}[], termDays: number }} p.plan
 * @param {object[]} [p.rows]     the job's stages (job mode)
 * @param {string} [p.projectId]
 * @param {boolean} [p.canEdit]
 */
export default function PayPlan({ lang, mode, plan, rows = [], projectId = "", canEdit = true, needsDb = false }) {
  const router = useRouter();
  const P = (k, v) => pt(k, lang, v);
  const fixed = rows.filter((r) => r.state !== "planned" && r.state !== "void");
  const usedPct = fixed.reduce((t, r) => t + r.pct, 0);
  const target = 100 - usedPct;
  const taken = new Set(fixed.map((r) => r.trigger));
  const start = rows.length ? rows.filter((r) => r.state === "planned").map((r) => ({ trigger: r.trigger, pct: r.pct })) : plan.steps;
  const [steps, setSteps] = useState(start.length ? start : []);
  const [term, setTerm] = useState(rows.find((r) => r.state === "planned")?.term_days || plan.termDays);
  const [msg, setMsg] = useState(null);
  const [busy, setBusy] = useState(false);
  const sum = steps.reduce((t, s) => t + (Number(s.pct) || 0), 0);
  const free = MILESTONE_TRIGGERS.filter((t) => !taken.has(t) && !steps.some((s) => s.trigger === t));
  const set = (i, k, v) => setSteps(steps.map((s, j) => (j === i ? { ...s, [k]: v } : s)));
  const cur = rows[0]?.currency;

  async function save() {
    setBusy(true); setMsg(null);
    const body = { steps: steps.map((s) => ({ trigger: s.trigger, pct: Number(s.pct) })), termDays: Number(term) };
    const r = await (mode === "job" ? saveJobPlan(projectId, body) : saveDefaultPlan(body)).catch(() => ({ ok: false }));
    setBusy(false);
    if (r.ok) { setMsg({ ok: true, text: P("sch_saved") }); router.refresh(); }
    else setMsg({ ok: false, text: r.error === "sum" ? P("e_sum", { t: target }) : r.error === "twice" ? P("e_twice") : r.error === "term" ? P("e_term") : r.error === "issued" ? P("e_issued") : r.error === "owner" ? P("e_owner") : r.error === "needs_db" ? P("e_needs_db") : P("e_save") });
  }

  return (
    <div className="pp">
      {needsDb && <p className="pp-warn" role="status">{P("e_needs_db")}</p>}
      {fixed.length > 0 && (
        <ul className="pp-fixed">
          {fixed.map((r) => (
            <li key={r.id}>
              <span><b>{P("tr_" + r.trigger)}</b><small>{r.pct}%, {r.invoice_no}{r.due_on ? `, ${dayName(r.due_on, lang)}` : ""}</small></span>
              <span className="pp-amt">{money(r.amount_minor, r.currency, lang)}</span>
              <span className={"pp-chip s-" + r.state}>{P({ paid: "s_paid", overdue: "s_late", due_soon: "s_due_soon" }[r.state] || "s_open")}</span>
              <a className="pp-link" href={`/pay/${r.token}`} target="_blank" rel="noopener noreferrer" aria-label={P("a_open")} title={P("a_open")}><Link2 size={14} /></a>
            </li>
          ))}
        </ul>
      )}
      {mode === "job" && fixed.length > 0 && <p className="pp-note">{P("sch_job_p")}</p>}
      {target > 0 && (
        <>
          <div className="pp-rows" role="list">
            {steps.map((s, i) => {
              const row = rows.find((r) => r.state === "planned" && r.trigger === s.trigger);
              return (
                <div className="pp-row" role="listitem" key={i}>
                  <label className="sr" htmlFor={`pp-t-${i}`}>{P("sch_when")}</label>
                  <select id={`pp-t-${i}`} className="input" value={s.trigger} disabled={!canEdit} onChange={(e) => set(i, "trigger", e.target.value)}>
                    {[s.trigger, ...free].map((t) => <option key={t} value={t}>{P("tr_" + t)}</option>)}
                  </select>
                  <span className="pp-pct">
                    <input className="input" aria-label="%" inputMode="numeric" value={s.pct} disabled={!canEdit} onChange={(e) => set(i, "pct", e.target.value.replace(/[^0-9]/g, "").slice(0, 3))} />%
                  </span>
                  <span className="pp-amt">{row && cur ? money(row.amount_minor, cur, lang) : ""}</span>
                  {canEdit && steps.length > 1 && <button type="button" className="pp-x" aria-label={P("sch_remove")} title={P("sch_remove")} onClick={() => setSteps(steps.filter((_, j) => j !== i))}><X size={15} /></button>}
                </div>
              );
            })}
          </div>
          <div className="pp-foot">
            {canEdit && free.length > 0 && steps.length < 5 && <button type="button" className="btn ghost sm" onClick={() => setSteps([...steps, { trigger: free[0], pct: Math.max(0, target - sum) || 10 }])}><Plus size={14} aria-hidden="true" />{P("sch_add")}</button>}
            <span className={"pp-sum" + (sum === target ? " ok" : " bad")}>{P("sch_sum", { n: sum, t: target })}</span>
            <label className="pp-term" htmlFor={`pp-term-${mode}`}>{P("sch_term")}
              <input id={`pp-term-${mode}`} className="input" inputMode="numeric" value={term} disabled={!canEdit} onChange={(e) => setTerm(e.target.value.replace(/[^0-9]/g, "").slice(0, 2))} />
            </label>
            {canEdit && <button type="button" className="btn primary" disabled={busy || sum !== target || !steps.length} onClick={save}>{P("sch_save")}</button>}
          </div>
        </>
      )}
      {!canEdit && mode === "default" && <p className="pp-note">{P("e_owner")}</p>}
      {msg && <p className={"pp-msg " + (msg.ok ? "ok" : "bad")} role="status">{msg.text}</p>}
      <style>{`
        .app .pp{display:grid;gap:10px}
        .app .pp-warn{margin:0;padding:9px 12px;border-radius:10px;background:var(--app-warn-tint);color:var(--app-warn-ink);font-size:13px;font-weight:600}
        .app .pp-fixed{list-style:none;margin:0;padding:0;display:grid}
        .app .pp-fixed li{display:grid;grid-template-columns:minmax(0,1fr) auto auto auto;gap:10px;align-items:center;padding:9px 0;border-bottom:1px solid var(--app-line)}
        .app .pp-fixed b{font-size:13.5px}
        .app .pp-fixed small{display:block;font-size:12px;color:var(--app-muted)}
        .app .pp-amt{font-weight:650;font-variant-numeric:tabular-nums;white-space:nowrap;text-align:right}
        .app .pp-chip{padding:3px 9px;border-radius:99px;font-size:11.5px;font-weight:700;white-space:nowrap;background:var(--app-warn-tint);color:var(--app-warn-ink)}
        .app .pp-chip.s-paid{background:var(--app-ok-tint);color:var(--app-ok)}
        .app .pp-chip.s-overdue{background:var(--app-bad-tint);color:var(--app-bad)}
        .app .pp-link{display:grid;place-items:center;width:28px;height:28px;border-radius:8px;border:1px solid var(--app-line);color:var(--app-text)}
        .app .pp-note{margin:0;font-size:12.5px;color:var(--app-muted)}
        .app .pp-rows{display:grid;gap:8px}
        .app .pp-row{display:grid;grid-template-columns:minmax(0,1fr) 92px minmax(90px,auto) 32px;gap:8px;align-items:center}
        .app .pp-pct{display:flex;align-items:center;gap:5px;font-weight:650}
        .app .pp-pct .input{width:64px;text-align:right}
        .app .pp-x{display:grid;place-items:center;width:30px;height:30px;border:0;background:none;color:var(--app-muted);cursor:pointer;border-radius:8px}
        .app .pp-x:hover{color:var(--app-bad)}
        .app .pp-foot{display:flex;align-items:center;gap:12px;flex-wrap:wrap}
        .app .pp-foot .btn{display:inline-flex;align-items:center;gap:6px}
        .app .pp-sum{font-size:12.5px;font-weight:700}
        .app .pp-sum.ok{color:var(--app-ok)}
        .app .pp-sum.bad{color:var(--app-bad)}
        .app .pp-term{display:flex;align-items:center;gap:7px;font-size:13px;color:var(--app-muted);margin-left:auto}
        .app .pp-term .input{width:56px;text-align:right}
        .app .pp-msg{margin:0;font-size:13px;font-weight:650}
        .app .pp-msg.ok{color:var(--app-ok)}
        .app .pp-msg.bad{color:var(--app-bad)}
        @media (max-width:560px){.app .pp-row{grid-template-columns:minmax(0,1fr) 84px 32px}.app .pp-row .pp-amt{display:none}.app .pp-term{margin-left:0}}
      `}</style>
    </div>
  );
}

/** Settings: the workspace's default plan, loaded on arrival. */
export function DefaultPayPlan({ lang }) {
  const [d, setD] = useState(null);
  useEffect(() => { loadDefaultPlan().then(setD).catch(() => setD({ error: "load" })); }, []);
  if (!d?.plan) return null;
  return <PayPlan lang={lang} mode="default" plan={d.plan} canEdit={!!d.isOwner} />;
}
