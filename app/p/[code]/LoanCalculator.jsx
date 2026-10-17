"use client";
// app/p/[code]/LoanCalculator.jsx — financing from partner banks on the
// client's offer (docs/FINANCING.md): pick a bank and a term, see the monthly
// payment against what the system saves a month and the net cost after the
// estimated support, then apply with consent. The figures here are the same
// lib/loanMath.js the server uses; the server recomputes the amount itself
// (app/api/proposal/[code]/loan), so nothing typed here can change it.
import { useMemo, useState } from "react";
import { ppt } from "./text.js";
import { quoteLoan, netMonthlyMinor } from "../../../lib/loanMath.js";

const LOC = { en: "en-GB", ro: "ro-RO", ru: "ru-RU", uk: "uk-UA" };

export default function LoanCalculator({ code, lang, financing, clientName = "" }) {
  const { offers = [], priceMinor, supportMinor = 0, savingsMonthlyMinor = 0, applications = [], needsDb } = financing;
  const lei = (minor) => new Intl.NumberFormat(LOC[lang] || "ro-RO", { maximumFractionDigits: 0 }).format(Math.round(minor / 100)) + " lei";
  const [offerId, setOfferId] = useState(offers[0]?.id || "");
  const offer = offers.find((o) => o.id === offerId) || offers[0];
  const [term, setTerm] = useState(() => (offer?.terms.includes(60) ? 60 : offer?.terms.at(-1)));
  const [form, setForm] = useState(null);   // null, or the open application form
  const [state, setState] = useState(null);

  const pick = (o) => { setOfferId(o.id); setTerm(o.terms.includes(term) ? term : o.terms.includes(60) ? 60 : o.terms.at(-1)); setForm(null); setState(null); };
  const loan = useMemo(() => offer && quoteLoan({
    offer: { rate_bps: offer.rateBps, term_min_months: offer.termMin, term_max_months: offer.termMax, fee_bps: offer.feeBps, fee_flat_minor: offer.feeFlatMinor, min_amount_minor: offer.minMinor, max_amount_minor: offer.maxMinor },
    priceMinor, supportMinor, termMonths: term,
  }), [offer, priceMinor, supportMinor, term]);
  const net = loan?.ok ? netMonthlyMinor(loan.monthlyMinor, savingsMonthlyMinor) : null;
  const name = (o) => o.name?.[lang] || o.name?.en || "";

  async function send(e) {
    e.preventDefault();
    setState("sending");
    try {
      const res = await fetch(`/api/proposal/${code}/loan`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ offerId: offer.id, termMonths: term, ...form }),
      });
      const j = await res.json().catch(() => ({}));
      if (res.ok) setState(j.status === "failed" ? "not_delivered" : "sent");
      else setState(j.error === "needs_db" ? "needs_db" : "failed");
    } catch { setState("failed"); }
  }

  return (
    <section className="pp-sec pp-no-print" aria-labelledby="pp-lc-h">
      <h2 className="pp-h2" id="pp-lc-h">{ppt("lc_h", lang)}</h2>
      <p className="pp-lead">{ppt("lc_sub", lang)}</p>

      {applications.map((a, i) => (
        <p key={i} className="pp-lc-yours" role="status">{ppt("lc_yours", lang, { lender: a.lender, s: ppt("lc_st_" + a.status, lang) })}</p>
      ))}

      <div className="pp-lc-offers" role="radiogroup" aria-label={ppt("lc_h", lang)}>
        {offers.map((o) => (
          <label key={o.id} className={"pp-card pp-lc-o" + (o.id === offer?.id ? " on" : "")}>
            <input type="radio" name="pp-lc-offer" checked={o.id === offer?.id} onChange={() => pick(o)} />
            <b>{o.lender}</b>
            <span>{name(o)}</span>
            <span className="pp-lc-rate">{ppt("lc_rate", lang, { r: (o.rateBps / 100).toLocaleString(LOC[lang], { maximumFractionDigits: 2 }) })}</span>
          </label>
        ))}
      </div>
      {offers.some((o) => o.sample) && <p className="pp-lc-note">{ppt("lc_sample", lang)}</p>}

      {offer && (
        <div className="pp-card pp-lc-calc">
          <label className="pp-lc-term" htmlFor="pp-lc-term">{ppt("lc_term", lang)}
            <select id="pp-lc-term" value={term} onChange={(e) => setTerm(Number(e.target.value))}>
              {offer.terms.map((m) => <option key={m} value={m}>{ppt("lc_months", lang, { n: m })}</option>)}
            </select>
          </label>
          {loan?.ok ? (
            <>
              <dl className="pp-lc-figs">
                <div><dt>{ppt("lc_amount", lang)}</dt><dd>{lei(loan.amountMinor)}</dd></div>
                <div><dt>{ppt("lc_monthly", lang)}</dt><dd>{lei(loan.monthlyMinor)}</dd></div>
                <div><dt>{ppt("lc_savings", lang)}</dt><dd>{lei(savingsMonthlyMinor)}</dd></div>
                <div className={net <= 0 ? "good" : ""}><dt>{ppt("lc_net", lang)}</dt><dd>{net <= 0 ? lei(0) : lei(net)}</dd></div>
              </dl>
              {net < 0 && <p className="pp-lc-plus">{ppt("lc_net_plus", lang, { x: lei(-net) })}</p>}
              <p className="pp-lc-note">
                {supportMinor > 0 && <>{ppt("lc_amount_note", lang, { x: lei(supportMinor) })} </>}
                {ppt("lc_fee", lang, { x: lei(loan.feeMinor), t: lei(loan.totalMinor) })} {ppt("lc_estimate", lang)}
              </p>
              {state === "sent" || state === "not_delivered" ? (
                <p className="pp-lc-yours" role="status">{ppt(state === "sent" ? "lc_sent" : "lc_not_delivered", lang, { lender: offer.lender })}</p>
              ) : needsDb ? (
                <p className="pp-lc-note">{ppt("lc_needs_db", lang)}</p>
              ) : !form ? (
                <button type="button" className="pp-btn pp-btn-accept" onClick={() => { setForm({ name: clientName, phone: "", email: "", locality: "", consent: false, idempotencyKey: crypto.randomUUID() }); setState(null); }}>
                  {ppt("lc_apply", lang, { lender: offer.lender })}
                </button>
              ) : (
                <form className="pp-lc-form" onSubmit={send}>
                  <h3>{ppt("lc_form_h", lang)}</h3>
                  {[["name", "lc_name", "name", "text", true], ["phone", "lc_phone", "tel", "tel", true], ["email", "lc_email", "email", "email", false], ["locality", "lc_locality", "address-level2", "text", false]].map(([k, key, ac, type, req]) => (
                    <label key={k} htmlFor={`pp-lc-${k}`}>{ppt(key, lang)}
                      <input id={`pp-lc-${k}`} type={type} required={req} autoComplete={ac} maxLength={k === "phone" ? 30 : 120} value={form[k]} onChange={(e) => setForm((f) => ({ ...f, [k]: e.target.value }))} />
                    </label>
                  ))}
                  <label className="pp-lc-consent" htmlFor="pp-lc-consent">
                    <input id="pp-lc-consent" type="checkbox" required checked={form.consent} onChange={(e) => setForm((f) => ({ ...f, consent: e.target.checked }))} />
                    <span>{ppt("lc_consent", lang, { lender: offer.lender })}</span>
                  </label>
                  <div className="pp-lc-acts">
                    <button type="submit" className="pp-btn pp-btn-accept" disabled={state === "sending" || !form.consent}>{state === "sending" ? ppt("lc_sending", lang) : ppt("lc_send", lang)}</button>
                    <button type="button" className="pp-btn pp-btn-ghost" onClick={() => { setForm(null); setState(null); }}>{ppt("lc_cancel", lang)}</button>
                  </div>
                  {(state === "failed" || state === "needs_db") && <p className="pp-lc-err" role="alert">{ppt(state === "needs_db" ? "lc_needs_db" : "lc_failed", lang)}</p>}
                </form>
              )}
            </>
          ) : (
            <p className="pp-lc-note">{ppt("lc_out", lang, { a: lei(offer.minMinor), b: lei(offer.maxMinor) })}</p>
          )}
        </div>
      )}
    </section>
  );
}
