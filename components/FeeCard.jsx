"use client";
// components/FeeCard.jsx — VoltMira's fee for a job (lib/jobFees.js), on the job's page. Signed: what it costs (or
// that it is one of the free ones), when and how it was signed, the statement it goes on, and "the client gave up".
// Not signed yet: a compact card with what it will cost. The client gave up: a compact card saying nothing is owed.
// The locked dialog opens from here too: when a locked document sent the installer back (?fee=locked or ?fee=idno),
// or when another part of the page meets one (the "vm-fee-locked" event).
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Receipt, Lock, X, Undo2, FileText } from "lucide-react";
import { ft, monthName, feeDay } from "../lib/feeText.js";
import { feeLei, feeMonth, FEE_PER_KW_MINOR, FREE_JOBS } from "../lib/jobFees.js";
import { clientGaveUp } from "../lib/feeActions.js";

/**
 * @param {object} p
 * @param {string} p.projectId
 * @param {string} p.lang
 * @param {string} p.status   the job's status
 * @param {{ fee: object|null, statement: object|null, preview: object|null, locked: boolean, error?: string, on: boolean, sample: boolean }} p.state
 * @param {string|null} [p.open]  "locked" | "idno": the dialog to show on arrival
 * @param {() => void} [p.onGaveUp]  after the job was marked lost here
 */
export default function FeeCard({ projectId, lang, status, state, open = null, onGaveUp }) {
  const router = useRouter();
  const F = (k, v) => ft(k, lang, v);
  const [gate, setGate] = useState(open === "locked" || open === "idno");
  const [ask, setAsk] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  // the dialog also opens when another part of the page meets a locked document
  useEffect(() => {
    const show = () => setGate(true);
    window.addEventListener("vm-fee-locked", show);
    return () => window.removeEventListener("vm-fee-locked", show);
  }, []);

  const fee = state?.fee || null;
  const kwTxt = (k) => Number(k || 0).toLocaleString({ en: "en-GB", ro: "ro-RO", ru: "ru-RU", uk: "uk-UA" }[lang] || "ro-RO", { maximumFractionDigits: 1 });
  const howLink = <a className="fee-how" href="/settings?tab=fees">{F("how_link")}</a>;

  // ---- not signed yet: what it will cost when the client signs
  if (status !== "won" && status !== "lost") {
    const pv = state?.preview;
    if (!pv || !(pv.kw > 0)) return null;
    return (
      <section className="card fee-card fee-mini" aria-labelledby="fee-h">
        <p className="fee-mini-h" id="fee-h"><Receipt size={15} aria-hidden="true" />{F("before_h")}: <b>{pv.free ? F("st_free") : feeLei(pv.minorMdl, lang)}</b></p>
        <p className="fee-line">{pv.free ? F("before_free", { t: FREE_JOBS }) : pv.capped ? F("sub_cap", { kw: kwTxt(pv.kw) }) : F("sub_kw", { kw: kwTxt(pv.kw), r: feeLei(FEE_PER_KW_MINOR, lang) })}. {F("before_p")}</p>
        {howLink}
        <Style />
      </section>
    );
  }

  // ---- the client gave up
  if (status === "lost") {
    if (!fee) return null;
    return (
      <section className="card fee-card fee-mini" aria-labelledby="fee-h">
        <p className="fee-mini-h" id="fee-h"><Undo2 size={15} aria-hidden="true" />{F("st_void")}</p>
        <p className="fee-line">{fee.status === "paid" ? F("cancel_paid_p") : F("void_p")}</p>
        <Style />
      </section>
    );
  }

  if (!fee && !state?.error) return null;
  const due = fee?.status === "due";
  const locked = !!state?.locked && due;
  const amount = fee ? feeLei(fee.amount_minor, lang) : "";
  const st = state?.statement || null;
  const month = fee?.won_at ? feeMonth(fee.won_at) : "";
  const sub = !fee ? ""
    : fee.status === "free" ? F("sub_free", { n: fee.free_slot || 1, t: FREE_JOBS })
    : Number(fee.tier) === 1 ? F("sub_cap", { kw: kwTxt(fee.kw) })
    : F("sub_kw", { kw: kwTxt(fee.kw), r: feeLei(FEE_PER_KW_MINOR, lang) });
  const where = !fee ? ""
    : fee.status === "paid" ? (fee.payment_method === "credit" ? F("paid_credit") : F("paid_on", { d: feeDay(fee.paid_at, lang) }))
    : fee.status === "waived" ? F("waived_p")
    : due && st ? F("on_statement", { no: st.number, d: feeDay(Date.parse(st.due_at) - 1, lang) })
    : due ? F("in_statement", { m: monthName(month, lang) }) : "";
  const note = state?.sample ? F("sample_p") : !state?.on ? F("off_p") : state?.error === "needs_idno" ? F("needs_idno") : locked ? F("locked_p", { m: monthName(st?.month || month, lang) }) : "";

  async function gaveUp() {
    setBusy(true); setErr("");
    const r = await clientGaveUp(projectId).catch(() => ({ ok: false }));
    setBusy(false);
    if (!r.ok) { setErr(F("e_save")); return; }
    setAsk(false);
    onGaveUp?.();
    router.refresh();
  }

  return (
    <section className="card fee-card" aria-labelledby="fee-h">
      <div className="fee-head">
        <h3 id="fee-h"><Receipt size={16} aria-hidden="true" />{F("fee_h")}</h3>
        {fee && <span className={"fee-chip s-" + (locked ? "locked" : fee.status)}>{locked ? <><Lock size={12} aria-hidden="true" />{F("st_locked")}</> : F("st_" + fee.status)}</span>}
      </div>
      {fee && (
        <>
          <p className="fee-amt"><b className={fee.status === "free" ? "is-free" : ""}>{fee.status === "free" ? F("st_free") : amount}</b></p>
          <p className="fee-sub">{sub}</p>
          <ul className="fee-facts">
            {fee.won_at && <li>{F("signed_on", { d: feeDay(fee.won_at, lang), how: F(fee.trigger === "signed" ? "how_signed" : "how_manual") })}</li>}
            {where && <li>{where}{st && <> <a className="fee-doc" href={`/fees/invoice/${st.id}`} target="_blank" rel="noopener noreferrer"><FileText size={13} aria-hidden="true" />{F("statement_open")}</a></>}</li>}
          </ul>
        </>
      )}
      {note && <p className={"fee-line" + (locked || state?.error ? " fee-warn" : "")}>{note}</p>}
      {state?.error === "needs_idno" && <a className="btn amber" href="/settings?tab=fees">{F("idno_go")}</a>}
      <div className="fee-foot">
        {fee && ["due", "free", "paid"].includes(fee.status) && (
          <button type="button" className="btn ghost sm" onClick={() => setAsk(true)}><Undo2 size={14} aria-hidden="true" />{F("btn_cancel")}</button>
        )}
        {howLink}
      </div>

      {ask && (
        <div className="overlay" onClick={() => setAsk(false)}>
          <div className="modal fee-gate" role="dialog" aria-modal="true" aria-labelledby="fee-ask-h" onClick={(e) => e.stopPropagation()}>
            <button type="button" className="fee-x" aria-label={F("close")} onClick={() => setAsk(false)}><X size={18} /></button>
            <h3 id="fee-ask-h">{F("cancel_h")}</h3>
            <p>{fee?.status === "paid" ? F("cancel_paid_p") : F("cancel_p")}</p>
            {err && <p className="fee-line fee-warn" role="status">{err}</p>}
            <div className="fee-acts">
              <button type="button" className="btn amber" disabled={busy} aria-busy={busy} onClick={gaveUp}>{F("cancel_yes")}</button>
              <button type="button" className="btn ghost" onClick={() => setAsk(false)}>{F("not_now")}</button>
            </div>
          </div>
        </div>
      )}

      {gate && (
        <div className="overlay" onClick={() => setGate(false)}>
          <div className="modal fee-gate" role="dialog" aria-modal="true" aria-labelledby="fee-gate-h" onClick={(e) => e.stopPropagation()}>
            <button type="button" className="fee-x" aria-label={F("close")} onClick={() => setGate(false)}><X size={18} /></button>
            <span className="fee-gate-i" aria-hidden="true"><Lock size={20} /></span>
            <h3 id="fee-gate-h">{F("gate_h")}</h3>
            <p>{state?.error === "needs_idno" ? F("needs_idno") : F("gate_p")}</p>
            {st && <p className="fee-gate-fee">{st.number}, {amount}</p>}
            <div className="fee-acts">
              {state?.error === "needs_idno"
                ? <a className="btn amber" href="/settings?tab=fees">{F("idno_go")}</a>
                : st && <a className="btn amber" href={`/fees/invoice/${st.id}`} target="_blank" rel="noopener noreferrer">{F("statement_open")}</a>}
              <button type="button" className="btn ghost" onClick={() => setGate(false)}>{F("close")}</button>
            </div>
          </div>
        </div>
      )}
      <Style />
    </section>
  );
}

function Style() {
  return (
    <style>{`
      .app .fee-card{display:grid;gap:8px}
      .app .fee-head{display:flex;align-items:center;justify-content:space-between;gap:10px}
      .app .fee-head h3{display:flex;align-items:center;gap:8px;margin:0;font-size:15px}
      .app .fee-head h3 svg,.app .fee-mini-h svg{color:var(--green);flex:none}
      .app .fee-chip{display:inline-flex;align-items:center;gap:5px;padding:3px 10px;border-radius:999px;font-size:12px;font-weight:700;white-space:nowrap;background:var(--paper);border:1px solid var(--line);color:var(--muted)}
      .app .fee-chip.s-free,.app .fee-chip.s-paid,.app .fee-chip.s-waived{background:var(--green-tint);border-color:transparent;color:var(--green)}
      .app .fee-chip.s-due{background:var(--amber-tint);border-color:transparent;color:var(--amber-ink)}
      .app .fee-chip.s-locked,.app .fee-chip.s-void{background:var(--red-tint);border-color:transparent;color:var(--red)}
      .app .fee-amt{margin:2px 0 0}
      .app .fee-amt b{font-family:"Inter Tight",Inter,system-ui,sans-serif;font-size:30px;font-weight:800;letter-spacing:-.02em;color:var(--ink);font-variant-numeric:tabular-nums}
      .app .fee-amt b.is-free{color:var(--green)}
      .app .fee-sub{margin:-4px 0 0;font-size:13px;color:var(--muted)}
      .app .fee-facts{list-style:none;margin:2px 0 0;padding:10px 0 0;border-top:1px solid var(--line);display:grid;gap:5px;font-size:13px;color:var(--ink)}
      .app .fee-doc{display:inline-flex;align-items:center;gap:4px;font-weight:650;color:var(--green);text-decoration:none;white-space:nowrap}
      .app .fee-doc:hover{text-decoration:underline}
      .app .fee-line{margin:0;font-size:13.5px;line-height:1.5;color:var(--ink)}
      .app .fee-line.fee-warn{color:var(--red);font-weight:600}
      .app .fee-foot{display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;margin-top:2px}
      .app .fee-foot .btn{display:inline-flex;align-items:center;gap:6px}
      .app .fee-how{font-size:12.5px;font-weight:650;color:var(--muted);text-decoration:none}
      .app .fee-how:hover{color:var(--ink);text-decoration:underline}
      .app .fee-mini{gap:5px;padding-top:12px;padding-bottom:12px}
      .app .fee-mini-h{display:flex;align-items:center;gap:7px;margin:0;font-size:14px;font-weight:650;color:var(--ink)}
      .app .fee-mini-h b{font-variant-numeric:tabular-nums}
      .app .fee-mini .fee-line{font-size:12.5px;color:var(--muted)}
      .app .fee-acts{display:flex;gap:8px;flex-wrap:wrap;margin-top:4px}
      .app .fee-gate{position:relative;max-width:460px;display:grid;gap:10px}
      .app .fee-gate h3{margin:0;font-size:19px;padding-right:24px}
      .app .fee-gate p{margin:0;line-height:1.5}
      .app .fee-gate-i{display:grid;place-items:center;width:42px;height:42px;border-radius:12px;background:var(--red-tint);color:var(--red)}
      .app .fee-gate-fee{padding:10px 12px;border-radius:11px;background:var(--paper);border:1px solid var(--line);font-weight:650;font-variant-numeric:tabular-nums}
      .app .fee-x{position:absolute;top:12px;right:12px;background:none;border:0;color:var(--muted);cursor:pointer;padding:4px}
    `}</style>
  );
}
