"use client";
// app/p/[code]/FinanceToggle.jsx — cash price vs. monthly payment, client-
// side (the PDF is static, so it shows both numbers side by side instead,
// see PrintSheet.jsx). Not a loan offer: the rate/term come from the
// installer's own configured estimate (engine.financeRatePct/financeTermYears
// in Settings), same status as costPerKw, an editable starting assumption,
// never a verified bank quote. Absent entirely on any proposal frozen before
// this feature existed (financeRatePct/financeTermYears weren't in the
// snapshot yet): the caller only renders this when both are real numbers.
// Renders the whole price block of the cover; styles in proposal.css.
import { useState } from "react";
import { ppt } from "./text.js";

export default function FinanceToggle({ cash, monthly, lang }) {
  const [mode, setMode] = useState("cash");
  const isCash = mode === "cash";
  return (
    <div className="pp-price">
      <span className="pp-k">{isCash ? ppt("k_price", lang) : ppt("k_monthly", lang)}</span>
      <b className="pp-price-v" aria-live="polite">{isCash ? cash : monthly}</b>
      <div className="pp-seg" role="group" aria-label={ppt("pay_mode", lang)}>
        <button type="button" aria-pressed={isCash} onClick={() => setMode("cash")}>{ppt("pay_full", lang)}</button>
        <button type="button" aria-pressed={!isCash} onClick={() => setMode("monthly")}>{ppt("pay_monthly", lang)}</button>
      </div>
      {/* Space kept for the note in both modes, so switching never moves the rows below. */}
      <span className="pp-price-note">{isCash ? "" : ppt("k_monthly_note", lang)}</span>
    </div>
  );
}
