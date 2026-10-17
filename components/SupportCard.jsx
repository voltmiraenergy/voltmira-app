"use client";
// components/SupportCard.jsx — "Support for this job" on a Moldovan quote:
// which programmes may pay for part of it and how much, from the rules in
// lib/greenData.js applied by lib/greenSupport.js. The installer picks who the
// client is (household, small business, company); the rest follows from the
// quote: its price, its battery and the VAT on the installer's invoices.
//
// The client's offer shows the same programmes, frozen on the day it is sent,
// each worded as an estimate (app/p/[code]/SupportOffer.jsx,
// lib/supportSnapshot.js).
//
// The client type is stored on the quote (projects.client_kind), and the
// client's answers (VAT payer, net-metering contract, the loan, documents
// already held) in projects.client_profile, through server actions; until the
// SQL has run they work for this visit and say they are not saved.
import "./support.css";
import { useMemo, useState, useTransition } from "react";
import { supportFor, CLIENT_KINDS } from "../lib/greenSupport.js";
import { setClientKind, setClientProfile } from "../lib/greenActions.js";
import { SUBSIDY_SEED } from "../lib/subsidySeed.js";
import { cleanClientProfile } from "../lib/clientProfile.js";
import { PROGRAMS } from "../lib/greenData.js";
import { et, sourceLine } from "../lib/energyText.js";
import { moneyFormatter, rateFor } from "../lib/money.js";
import { fmtDate } from "../lib/tz.js";
import { LOCALE } from "../lib/relTime.js";

const prog = (id) => PROGRAMS.find((p) => p.id === id);
// every document a programme may ask for, once each
const DOCS = [...new Map(SUBSIDY_SEED.flatMap((p) => p.required_documents).map((d) => [d.id, d])).values()];

export default function SupportCard({ projectId, lang = "en", market, costEur = 0, batteryEur = 0, vatRatePct = 0, fx = null, initialKind = null, initialProfile = null }) {
  const [kind, setKind] = useState(CLIENT_KINDS.includes(initialKind) ? initialKind : null);
  const [profile, setProfile] = useState(() => cleanClientProfile(initialProfile || {}));
  const [loan, setLoan] = useState(profile.loanMdl ? String(profile.loanMdl) : "");
  const [pfNote, setPfNote] = useState(null);
  const [note, setNote] = useState(null);
  const [pending, start] = useTransition();


  // lei, the currency the programmes are set in: the quote's EUR converts at
  // the workspace's live rate once, and amounts already in lei are printed as
  // they are (rate 1), so a grant and the client's share always add up
  const rate = rateFor("MDL", fx);
  const L = useMemo(() => moneyFormatter({ currency: "MDL", lang, fx: { MDL: 1 } }), [lang]);
  const loanMdl = Number(String(loan).replace(/[^\d]/g, "")) || 0;

  const r = supportFor({
    market, clientKind: kind, costMdl: costEur * rate, batteryMdl: batteryEur * rate,
    vatRatePct, loanMdl,
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

  // the client's answers, saved on the quote for the next offer
  function saveProfile(next) {
    const clean = cleanClientProfile(next);
    setProfile(clean);
    setPfNote(null);
    start(async () => {
      try {
        const res = await setClientProfile(projectId, clean);
        setPfNote(res?.ok ? "saved" : res?.needsDb ? "needs_db" : "failed");
      } catch { setPfNote("failed"); }
    });
  }
  const tri = (key) => (
    <div className="seg2 spc-seg" role="group" aria-label={et(key === "vatPayer" ? "pf_vat" : "pf_net", lang)}>
      {[["yes", true], ["no", false], ["unknown", undefined]].map(([w, v]) => (
        <button key={w} type="button" className={profile[key] === v ? "on" : ""} aria-pressed={profile[key] === v}
          onClick={() => saveProfile({ ...profile, [key]: v === undefined ? null : v })}>{et("pf_" + w, lang)}</button>
      ))}
    </div>
  );

  const loc = LOCALE[lang] || "en-GB";
  const battery = batteryEur > 0;

  function body(it) {
    const p = prog(it.id);
    switch (it.id) {
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
                onChange={(e) => setLoan(e.target.value.replace(/[^\d\s.]/g, ""))}
                onBlur={() => { if ((profile.loanMdl || 0) !== loanMdl) saveProfile({ ...profile, loanMdl }); }} />
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
              {et("hint_battery_programmes", lang)}
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
          {battery && r.items.length > 0 && (
            <div className="spc-pf">
              <span className="spc-lbl">{et("pf_h", lang)}</span>
              <div className="spc-pf-row"><span>{et("pf_vat", lang)}</span>{tri("vatPayer")}</div>
              <div className="spc-pf-row"><span>{et("pf_net", lang)}</span>{tri("netMetering")}</div>
              <span className="spc-lbl">{et("pf_docs", lang)}</span>
              <div className="spc-pf-docs">
                {DOCS.map((d) => {
                  const on = (profile.documentsHave || []).includes(d.id);
                  return (
                    <label key={d.id}>
                      <input type="checkbox" checked={on} onChange={() => saveProfile({ ...profile, documentsHave: on ? profile.documentsHave.filter((x) => x !== d.id) : [...(profile.documentsHave || []), d.id] })} />
                      {d.name[lang] || d.name.en}
                    </label>
                  );
                })}
              </div>
              {pfNote && <p className={"spc-note" + (pfNote === "saved" ? "" : " bad")} role="status">{et(pfNote === "saved" ? "pf_saved" : pfNote === "needs_db" ? "pf_needs_db" : "sp_save_failed", lang)}</p>}
            </div>
          )}
          <p className="spc-foot">{et("sp_foot", lang)}</p>
        </>
      )}
    </section>
  );
}
