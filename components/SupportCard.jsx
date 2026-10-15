"use client";
// components/SupportCard.jsx — "Support for this job" on a Moldovan quote:
// which programmes may pay for part of it and how much, from the rules in
// lib/greenData.js applied by lib/greenSupport.js. The installer picks who the
// client is (household, small business, company); the rest follows from the
// quote: its price, its battery and the VAT on the installer's invoices.
//
// Installer-only. Nothing here reaches the client's offer: an eligibility
// mistake on a client document would be a promise, so the amounts stay with
// the installer, each marked as an estimate with its source.
//
// The client type is stored on the quote (projects.client_kind) through a
// server action; until supabase/add-client-kind.sql runs it still works for
// this visit and says it is not saved. The insulation answer and a typed loan
// are what-ifs for the installer, kept in this browser only.
import "./support.css";
import { useEffect, useMemo, useState, useTransition } from "react";
import { supportFor, CLIENT_KINDS } from "../lib/greenSupport.js";
import { setClientKind } from "../lib/greenActions.js";
import { PROGRAMS } from "../lib/greenData.js";
import { et, sourceLine } from "../lib/energyText.js";
import { moneyFormatter, rateFor } from "../lib/money.js";
import { fmtDate } from "../lib/tz.js";
import { LOCALE } from "../lib/relTime.js";

const prog = (id) => PROGRAMS.find((p) => p.id === id);
const INS_KEY = (id) => `vm_ins_${id}`;

export default function SupportCard({ projectId, lang = "en", market, costEur = 0, batteryEur = 0, vatRatePct = 0, fx = null, initialKind = null }) {
  const [kind, setKind] = useState(CLIENT_KINDS.includes(initialKind) ? initialKind : null);
  const [insulated, setInsulated] = useState(null);
  const [loan, setLoan] = useState("");
  const [note, setNote] = useState(null);
  const [pending, start] = useTransition();

  // the insulation answer is remembered per quote in this browser
  useEffect(() => {
    try {
      const v = localStorage.getItem(INS_KEY(projectId));
      if (v === "1" || v === "0") setInsulated(v === "1");
    } catch { /* private window: ask again */ }
  }, [projectId]);
  const answer = (v) => {
    setInsulated(v);
    try { localStorage.setItem(INS_KEY(projectId), v ? "1" : "0"); } catch { /* not remembered */ }
  };

  // lei, the currency the programmes are set in: the quote's EUR converts at
  // the workspace's live rate once, and amounts already in lei are printed as
  // they are (rate 1), so a grant and the client's share always add up
  const rate = rateFor("MDL", fx);
  const L = useMemo(() => moneyFormatter({ currency: "MDL", lang, fx: { MDL: 1 } }), [lang]);
  const loanMdl = Number(String(loan).replace(/[^\d]/g, "")) || 0;

  const r = supportFor({
    market, clientKind: kind, costMdl: costEur * rate, batteryMdl: batteryEur * rate,
    vatRatePct, insulated, loanMdl,
  });
  if (!r.market) return null;

  function pick(k) {
    if (k === kind) return;
    setKind(k);
    setNote(null);
    start(async () => {
      try {
        const res = await setClientKind(projectId, k);
        if (!res?.ok) setNote(res?.needsDb ? "needs_db" : "failed");
      } catch { setNote("failed"); }
    });
  }

  const loc = LOCALE[lang] || "en-GB";
  const battery = batteryEur > 0;

  function body(it) {
    const p = prog(it.id);
    switch (it.id) {
      case "casa_verde":
        return (
          <>
            <p>{et("cv_line", lang, { pct: it.sharePct, cap: L(it.capMdl) })}</p>
            {it.capped && it.state !== "blocked" && <p className="spc-dim">{et("cv_capped", lang, { half: L(it.halfMdl) })}</p>}
            <div className="spc-q">
              <span>{et("ins_q", lang)}</span>
              <div className="seg2 spc-seg" role="group" aria-label={et("ins_q", lang)}>
                <button type="button" className={insulated === true ? "on" : ""} aria-pressed={insulated === true} onClick={() => answer(true)}>{et("ins_yes", lang)}</button>
                <button type="button" className={insulated === false ? "on" : ""} aria-pressed={insulated === false} onClick={() => answer(false)}>{et("ins_no", lang)}</button>
              </div>
            </div>
            {it.state === "conditional" && <p className="spc-dim">{et("cv_ins_unknown", lang)}</p>}
            {it.state === "blocked" && <p className="spc-warn">{et("cv_ins_no", lang)}</p>}
            {it.state !== "blocked" && <p className="spc-dim">{et("cv_pays", lang, { x: L(it.clientPaysMdl) })}</p>}
          </>
        );
      case "law112_vat":
        return it.state === "none_on_invoice"
          ? <p className="spc-dim">{et("vat_zero", lang)}</p>
          : <><p>{et("vat_line", lang, { rate: it.ratePct, base: L(it.baseMdl) })}</p><p className="spc-dim">{et("vat_cond", lang)}</p></>;
      case "law112_customs":
        return <p>{et("customs_line", lang, { from: it.fromPct, to: it.toPct })}</p>;
      case "facem_373":
        return <><p>{et("facem_line", lang, { pct: it.upToPct })}</p><p className="spc-dim">{et("facem_base", lang, { pct: it.upToPct, base: L(it.baseMdl) })}</p></>;
      case "bess_guarantee":
        return (
          <>
            <p>{et("g_line", lang, { pct: it.sharePct, cap: L(it.capMdl), months: it.maxMonths, fee: it.feePctYear })}</p>
            <div className="spc-q">
              <label htmlFor={"spc-loan-" + projectId}>{et("g_loan", lang)}</label>
              <input id={"spc-loan-" + projectId} className="input spc-loan" inputMode="numeric" value={loan}
                onChange={(e) => setLoan(e.target.value.replace(/[^\d\s.]/g, ""))} />
            </div>
            {it.state === "needs_loan" && <p className="spc-dim">{et("g_type_loan", lang)}</p>}
            {it.capped && <p className="spc-dim">{et("g_capped", lang, { cap: L(it.capMdl) })}</p>}
            {/* "31 грудня 2028 р." already ends in a dot; the sentence adds its own */}
            <p className="spc-dim">{et("g_until", lang, { date: fmtDate(p.validUntil + "T12:00:00Z", loc, { day: "numeric", month: "long", year: "numeric" }).replace(/\.$/, "") })}</p>
          </>
        );
      default:
        return null;
    }
  }

  function amount(it) {
    if (it.id === "casa_verde") return it.state === "blocked" ? null : L(it.amountMdl);
    if (it.id === "law112_vat") return it.state === "none_on_invoice" ? null : L(it.amountMdl);
    if (it.id === "facem_373") return et("upto", lang, { x: L(it.upToMdl) });
    if (it.id === "bess_guarantee") return it.amountMdl > 0 ? <>{L(it.amountMdl)} <small>{et("guaranteed", lang)}</small></> : null;
    return null;
  }

  return (
    <section className="card spc" id="support" aria-labelledby="spc-h" aria-busy={pending}>
      <h3 id="spc-h">{et("sp_title", lang)}</h3>
      <p className="spc-sub">{et("sp_sub", lang)}</p>

      <div className="spc-kind">
        <span className="spc-lbl">{et("sp_kind", lang)}</span>
        <div className="seg2 spc-seg" role="group" aria-label={et("sp_kind", lang)}>
          {CLIENT_KINDS.map((k) => (
            <button key={k} type="button" className={kind === k ? "on" : ""} aria-pressed={kind === k} onClick={() => pick(k)}>
              {et("kind_" + k, lang)}
            </button>
          ))}
        </div>
        {note && <p className={"spc-note" + (note === "failed" ? " bad" : "")} role="status">{et(note === "needs_db" ? "sp_needs_db" : "sp_save_failed", lang)}</p>}
      </div>

      {r.needsKind ? (
        <p className="spc-dim">{et("sp_pick", lang)}</p>
      ) : (
        <>
          {r.hint && (
            <p className="spc-hint">
              {r.hint.id === "add_battery"
                ? et("hint_add_battery", lang, { pct: r.hint.sharePct, cap: L(r.hint.capMdl) })
                : et("hint_battery_programmes", lang)}
            </p>
          )}
          {r.items.length > 0 && (
            <ul className="spc-list">
              {r.items.map((it) => {
                const p = prog(it.id);
                const amt = amount(it);
                return (
                  <li key={it.id} className={"spc-item s-" + it.state}>
                    <div className="spc-top">
                      <b>{et("pg_" + it.id, lang)}</b>
                      {amt && <span className="spc-amt">{amt}</span>}
                    </div>
                    {body(it)}
                    <small className="spc-src">{et("src", lang, { src: sourceLine(p.sources, lang) })}</small>
                  </li>
                );
              })}
            </ul>
          )}
          {battery && r.items.length > 0 && <p className="spc-dim">{et("sp_batt_est", lang, { x: L(batteryEur * rate) })}</p>}
          <p className="spc-foot">{et("sp_foot", lang)}</p>
        </>
      )}
    </section>
  );
}
