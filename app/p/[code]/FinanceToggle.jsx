"use client";
// app/p/[code]/FinanceToggle.jsx — cash price vs. monthly payment, client-
// side (the PDF is static, so it shows both numbers side by side instead —
// see PrintSheet.jsx). Not a loan offer: the rate/term come from the
// installer's own configured estimate (engine.financeRatePct/financeTermYears
// in Settings), same status as costPerKw — an editable starting assumption,
// never a verified bank quote. Absent entirely on any proposal frozen before
// this feature existed (financeRatePct/financeTermYears weren't in the
// snapshot yet) — the caller only renders this when both are real numbers.
import { useState } from "react";
import { t } from "../../../lib/i18n.js";

export default function FinanceToggle({ cash, monthly, lang }) {
  const [mode, setMode] = useState("cash");
  const seg = (active) => ({
    flex: 1, padding: "5px 10px", borderRadius: 7, fontSize: 11.5, fontWeight: 700,
    background: active ? "#142A21" : "transparent", color: active ? "#fff" : "#66756C",
    border: "none", cursor: "pointer", fontFamily: "inherit",
  });
  return (
    <div>
      <div style={{ display: "flex", gap: 2, background: "#EDEBE2", borderRadius: 9, padding: 2, marginBottom: 6, maxWidth: 168 }}>
        <button type="button" style={seg(mode === "cash")} onClick={() => setMode("cash")}>{t("pp_pay_cash", lang)}</button>
        <button type="button" style={seg(mode === "monthly")} onClick={() => setMode("monthly")}>{t("pp_pay_monthly", lang)}</button>
      </div>
      <b style={{ display: "block", fontSize: 24, fontFamily: "'Inter Tight',Inter,system-ui,sans-serif", fontWeight: 700, letterSpacing: "-0.02em" }}>
        {mode === "cash" ? cash : monthly}
      </b>
      <span style={{ fontSize: 12, color: "#66756C" }}>
        {mode === "cash" ? t("pp_total_inv", lang) : t("pp_pay_monthly_note", lang)}
      </span>
    </div>
  );
}
