"use client";
// components/FeeCard.jsx — the fee per won project on a job (lib/jobFees.js): what it costs, whether it is free,
// paid, due (with the days left to pay) or locking the paperwork, and the two ways to pay it: by card (the bank's
// gateway, or the test one off production) or against VoltMira's invoice by transfer. The paywall dialog opens from
// here too: when a locked document sent the installer back (?fee=locked or ?fee=idno), or when the editor asks.
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Receipt, CreditCard, Landmark, Lock, X } from "lucide-react";
import { ft } from "../lib/feeText.js";
import { feeLei } from "../lib/jobFees.js";

/**
 * @param {object} p
 * @param {string} p.projectId
 * @param {string} p.lang
 * @param {{ fee: object|null, locked: boolean, error?: string, access: object, on: boolean, sample: boolean, test: boolean }} p.state
 * @param {string|null} [p.open]  "locked" | "idno" | "paid": the dialog or the note to show on arrival
 */
export default function FeeCard({ projectId, lang, state, open = null }) {
  const router = useRouter();
  const F = (k, v) => ft(k, lang, v);
  const [busy, setBusy] = useState("");
  const [msg, setMsg] = useState(open === "paid" ? { ok: true, text: F("paid_ok") } : null);
  const [gate, setGate] = useState(open === "locked" || open === "idno");
  const [inv, setInv] = useState(null);
  // the dialog also opens when another part of the page meets a locked document
  useEffect(() => {
    const show = () => setGate(true);
    window.addEventListener("vm-fee-locked", show);
    return () => window.removeEventListener("vm-fee-locked", show);
  }, []);

  const fee = state?.fee || null;
  if (!fee && !state?.error) return null;
  const amount = fee ? feeLei(fee.amount_minor, lang) : "";
  const tier = fee ? F("tier_" + fee.tier) : "";
  const due = fee?.status === "due";
  const day = (iso) => new Date(iso).toLocaleDateString({ en: "en-GB", ro: "ro-RO", ru: "ru-RU", uk: "uk-UA" }[lang] || "ro-RO", { day: "numeric", month: "long", timeZone: "Europe/Chisinau" });

  async function payCard() {
    setBusy("card"); setMsg(null);
    try {
      const r = await fetch(`/api/job-fees/${projectId}/pay`, { method: "POST" });
      const j = await r.json().catch(() => ({}));
      if (j.ok && j.paid) { setMsg({ ok: true, text: F("paid_ok") }); setGate(false); router.refresh(); }
      else if (j.ok && j.redirect) window.location.assign(j.redirect);
      else setMsg({ ok: false, text: F(j.error === "not_configured" ? "e_not_configured" : j.error === "needs_db" ? "e_needs_db" : "e_pay") });
    } catch { setMsg({ ok: false, text: F("e_pay") }); }
    finally { setBusy(""); }
  }
  async function payTransfer() {
    setBusy("transfer"); setMsg(null);
    try {
      const r = await fetch(`/api/job-fees/${projectId}/invoice`, { method: "POST" });
      const j = await r.json().catch(() => ({}));
      if (j.ok) setInv(j.invoice);
      else setMsg({ ok: false, text: F(j.error === "seller" ? "e_seller" : j.error === "needs_db" ? "e_needs_db" : "e_pay") });
    } catch { setMsg({ ok: false, text: F("e_pay") }); }
    finally { setBusy(""); }
  }

  const status = state?.error === "needs_idno" ? "idno" : fee?.status;
  const line = state?.sample ? F("sample_p")
    : !state?.on ? F("off_p")
    : status === "idno" ? F("needs_idno")
    : status === "free" ? F("free_n")
    : status === "paid" ? (fee.payment_method === "credit" ? F("paid_credit") : F("paid_on", { d: fee.paid_at ? day(fee.paid_at) : "" }))
    : status === "waived" ? F("waived_p")
    : status === "void" ? F("void_p")
    : state?.locked ? F("locked_p")
    : F("grace_left", { n: Math.max(1, state?.access?.daysLeft ?? 14) });
  const pays = due && !state?.sample && state?.error !== "needs_idno";
  const actions = (
    <>
      {pays && (
        <div className="fee-acts">
          <button type="button" className="btn amber" disabled={!!busy} aria-busy={busy === "card"} onClick={payCard}>
            <CreditCard size={16} aria-hidden="true" />{busy === "card" ? F("paying") : F("pay_card", { v: amount })}
          </button>
          <button type="button" className="btn ghost" disabled={!!busy} aria-busy={busy === "transfer"} onClick={payTransfer}>
            <Landmark size={16} aria-hidden="true" />{F("pay_transfer")}
          </button>
        </div>
      )}
      {pays && state?.test && <p className="fee-note">{F("test_mode")}</p>}
      {status === "idno" && <a className="btn amber" href="/settings?tab=fees">{F("idno_go")}</a>}
      {inv && (
        <p className="fee-note fee-ok">{F("transfer_p", { ref: inv.payment_ref })} <a href={`/fees/invoice/${inv.id}?print=1`} target="_blank" rel="noopener noreferrer">{F("invoice_open")}</a></p>
      )}
      {msg && <p className={"fee-note" + (msg.ok ? " fee-ok" : " fee-bad")} role="status">{msg.text}</p>}
    </>
  );

  return (
    <section className="card fee-card" aria-labelledby="fee-h">
      <div className="fee-head">
        <h3 id="fee-h"><Receipt size={16} aria-hidden="true" />{F("fee_h")}</h3>
        {fee && <span className={"fee-chip s-" + (state?.locked && due ? "locked" : fee.status)}>{state?.locked && due ? <><Lock size={12} aria-hidden="true" />{F("st_due")}</> : F("st_" + fee.status)}</span>}
      </div>
      {fee && (
        <p className="fee-amt"><b className={fee.status === "free" ? "is-free" : ""}>{fee.status === "free" ? F("st_free") : amount}</b><span>{tier}</span></p>
      )}
      <p className="fee-line">{line}</p>
      {actions}
      <p className="fee-why">{F("why")}</p>

      {gate && (
        <div className="overlay" onClick={() => setGate(false)}>
          <div className="modal fee-gate" role="dialog" aria-modal="true" aria-labelledby="fee-gate-h" onClick={(e) => e.stopPropagation()}>
            <button type="button" className="fee-x" aria-label={F("close")} onClick={() => setGate(false)}><X size={18} /></button>
            <span className="fee-gate-i" aria-hidden="true"><Lock size={20} /></span>
            <h3 id="fee-gate-h">{F("gate_h")}</h3>
            <p>{status === "idno" ? F("needs_idno") : status === "void" ? F("void_p") : F("gate_p")}</p>
            {fee && status !== "idno" && <p className="fee-gate-fee">{F("gate_fee", { v: amount, t: tier })}</p>}
            {actions}
          </div>
        </div>
      )}

      <style>{`
        .app .fee-card{display:grid;gap:8px}
        .app .fee-head{display:flex;align-items:center;justify-content:space-between;gap:10px}
        .app .fee-head h3{display:flex;align-items:center;gap:8px;margin:0;font-size:15px}
        .app .fee-head h3 svg{color:var(--green)}
        .app .fee-chip{display:inline-flex;align-items:center;gap:5px;padding:3px 10px;border-radius:999px;font-size:12px;font-weight:700;white-space:nowrap;background:var(--paper);border:1px solid var(--line);color:var(--muted)}
        .app .fee-chip.s-free,.app .fee-chip.s-paid,.app .fee-chip.s-waived{background:var(--green-tint);border-color:transparent;color:var(--green)}
        .app .fee-chip.s-due{background:var(--amber-tint);border-color:transparent;color:var(--amber-ink)}
        .app .fee-chip.s-locked,.app .fee-chip.s-void{background:var(--red-tint);border-color:transparent;color:var(--red)}
        .app .fee-amt{display:flex;align-items:baseline;gap:10px;flex-wrap:wrap;margin:0}
        .app .fee-amt b{font-family:"Inter Tight",Inter,system-ui,sans-serif;font-size:26px;font-weight:800;letter-spacing:-.02em;color:var(--ink);font-variant-numeric:tabular-nums}
        .app .fee-amt b.is-free{color:var(--green)}
        .app .fee-amt span{font-size:13px;color:var(--muted)}
        .app .fee-line{margin:0;font-size:13.5px;line-height:1.5;color:var(--ink)}
        .app .fee-acts{display:flex;gap:8px;flex-wrap:wrap;margin-top:4px}
        .app .fee-acts .btn{display:inline-flex;align-items:center;gap:7px}
        .app .fee-note{margin:0;font-size:12.5px;color:var(--muted);line-height:1.5}
        .app .fee-note.fee-ok{color:var(--green);font-weight:600}
        .app .fee-note.fee-bad{color:var(--red);font-weight:600}
        .app .fee-why{margin:4px 0 0;font-size:12px;color:var(--muted)}
        .app .fee-gate{position:relative;max-width:460px;display:grid;gap:10px}
        .app .fee-gate h3{margin:0;font-size:19px}
        .app .fee-gate p{margin:0;line-height:1.5}
        .app .fee-gate-i{display:grid;place-items:center;width:42px;height:42px;border-radius:12px;background:var(--red-tint);color:var(--red)}
        .app .fee-gate-fee{padding:10px 12px;border-radius:11px;background:var(--paper);border:1px solid var(--line);font-weight:650}
        .app .fee-x{position:absolute;top:12px;right:12px;background:none;border:0;color:var(--muted);cursor:pointer;padding:4px}
      `}</style>
    </section>
  );
}
