"use client";
// app/p/[code]/ClientAudit.jsx — the honesty engine, in the client's hands.
// The homeowner drags the electricity price and yearly price-rise sliders and
// watches their own payback recompute LIVE, using the exact same engine the
// installer used. Nothing to hide — that's the whole brand.
import { useMemo, useState } from "react";
import { quote } from "@voltmira/engine";
import { t } from "../../../lib/i18n.js";

export default function ClientAudit({ inputs, assumptions: E, lang }) {
  const basePrice = Number(inputs.price) || 0.21;
  const [priceMul, setPriceMul] = useState(1);
  const [inflDelta, setInflDelta] = useState(0);

  const q = useMemo(() => {
    const p = {
      kw: Number(inputs.kw), price: basePrice * priceMul, cons: Number(inputs.cons) || 5000,
      batt: inputs.batt, market: inputs.market, useMonthly: inputs.useMonthly,
      consMonthly: inputs.consMonthly, afmSubsidy: inputs.afmSubsidy,
      yieldOverride: inputs.yieldOverride, monthlyYieldShape: inputs.monthlyYieldShape,
    };
    const bend = (b) => ({ ...b, infl: Math.max(0, b.infl + inflDelta) });
    const E2 = { ...E, bands: { pess: bend(E.bands.pess), expc: bend(E.bands.expc), opti: bend(E.bands.opti) } };
    return quote(p, E2);
  }, [priceMul, inflDelta, inputs, E, basePrice]);

  const loc = { en: "en-IE", ro: "ro-RO", ru: "ru-RU" }[lang] || "en-IE";
  const yrs = (n) => n === null ? "25+" : n === 0 ? t("pp_immediate", lang) : n.toFixed(1);
  const touched = priceMul !== 1 || inflDelta !== 0;

  const bands = [["pp_pess", q.p, "#C4543B"], ["pp_expc", q.e, "#E89B2D"], ["pp_opti", q.o, "#1E6B4E"]];
  const slider = { width: "100%", accentColor: "#E89B2D", height: 6, cursor: "pointer" };
  const lbl = { display: "flex", justifyContent: "space-between", alignItems: "baseline", fontSize: 13, color: "#66756C", marginBottom: 8, fontWeight: 500 };
  const val = { fontFamily: "Space Grotesk, sans-serif", fontWeight: 700, color: "#1E6B4E", fontSize: 15 };

  return (
    <section style={{ background: "#fff", border: "1px solid #E89B2D", borderRadius: 14, padding: 20, margin: "16px 0",
      boxShadow: "0 2px 14px rgba(232,155,45,.1)" }}>
      <h2 style={{ fontSize: 15, margin: "0 0 4px", fontFamily: "Space Grotesk, sans-serif", color: "#B4700F" }}>{t("audit_title", lang)}</h2>
      <p style={{ fontSize: 13, color: "#66756C", margin: "0 0 18px", lineHeight: 1.5 }}>{t("audit_sub", lang)}</p>

      <div style={{ display: "grid", gap: 18, marginBottom: 18 }}>
        <div>
          <div style={lbl}><span>{t("audit_price", lang)}</span><output style={val}>€{(basePrice * priceMul).toFixed(3)}/kWh</output></div>
          <input type="range" min="0.6" max="1.8" step="0.05" value={priceMul} style={slider}
            onChange={e => setPriceMul(+e.target.value)} aria-label={t("audit_price", lang)} />
        </div>
        <div>
          <div style={lbl}><span>{t("audit_infl", lang)}</span><output style={val}>{(E.bands.expc.infl + inflDelta).toFixed(1)}%/yr</output></div>
          <input type="range" min="-3" max="6" step="0.5" value={inflDelta} style={slider}
            onChange={e => setInflDelta(+e.target.value)} aria-label={t("audit_infl", lang)} />
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 10 }}>
        {bands.map(([key, b, c]) => (
          <div key={key} style={{ background: "#F6F5F0", borderLeft: `4px solid ${c}`, borderRadius: 10, padding: "12px 12px" }}>
            <div style={{ fontSize: 10.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".07em", color: c }}>{t(key, lang)}</div>
            <div style={{ fontSize: 22, fontFamily: "Space Grotesk, sans-serif", fontWeight: 700, lineHeight: 1.1 }}>
              {yrs(b.payback)} <small style={{ fontSize: 12, color: "#66756C", fontWeight: 500 }}>{t("pp_years", lang)}</small></div>
          </div>
        ))}
      </div>

      {touched && (
        <button onClick={() => { setPriceMul(1); setInflDelta(0); }}
          style={{ marginTop: 14, background: "none", border: "1px solid #E3E1D6", borderRadius: 9, padding: "7px 13px",
            fontSize: 12.5, fontWeight: 600, color: "#66756C", cursor: "pointer", fontFamily: "Inter, system-ui, sans-serif" }}>
          {t("audit_reset", lang)}
        </button>
      )}
      <p style={{ fontSize: 11.5, color: "#8A8F88", margin: "14px 0 0", lineHeight: 1.5 }}>{t("audit_note", lang)}</p>
    </section>
  );
}
