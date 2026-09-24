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
      // Carry the real battery capacity and the frozen BOM total, otherwise this
      // panel priced a 20 kWh battery as 10 kWh (engine fallback) and ignored the
      // bill of materials — so the audit contradicted the headline proposal.
      battKwh: inputs.battKwh,
      costOverride: Number(inputs.costOverride) || 0,
      bomHasBattery: !!inputs.bomHasBattery,
    };
    const bend = (b) => ({ ...b, infl: Math.max(0, b.infl + inflDelta) });
    const E2 = { ...E, bands: { pess: bend(E.bands.pess), expc: bend(E.bands.expc), opti: bend(E.bands.opti) } };
    return quote(p, E2);
  }, [priceMul, inflDelta, inputs, E, basePrice]);

  const loc = { en: "en-IE", ro: "ro-RO", ru: "ru-RU" }[lang] || "en-IE";
  const yrs = (n) => n === null ? "25+" : n === 0 ? t("pp_immediate", lang) : n.toFixed(1);
  const touched = priceMul !== 1 || inflDelta !== 0;

  const bands = [["pp_pess", q.p, "#C4543B"], ["pp_expc", q.e, "#E89B2D"], ["pp_opti", q.o, "#1E6B4E"]];
  const DISPLAY = "'Inter Tight',Inter,system-ui,sans-serif";
  // className, not inline style: a custom thumb needs ::-webkit-slider-thumb /
  // ::-moz-range-thumb, which no inline style object can target. This is the
  // one interactive, live-recomputing moment in the whole proposal — it used
  // to fall back to the browser's plain default slider because this page
  // renders outside AppTheme (no access to the app's own premium slider CSS).
  const slider = { flex: 1, minWidth: 0, height: 6, cursor: "pointer" };
  const lbl = { display: "flex", justifyContent: "space-between", alignItems: "baseline", fontSize: 13, color: "#66756C", marginBottom: 8, fontWeight: 500 };
  const val = { fontFamily: DISPLAY, fontWeight: 800, color: "#1E6B4E", fontSize: 16 };
  const row = { display: "flex", alignItems: "center", gap: 10 };
  // A drag can't land on an exact figure — this lets the number itself (from
  // an actual bill, or an inflation figure the client has in mind) be typed.
  const numBox = { width: 68, flex: "none", textAlign: "right", fontVariantNumeric: "tabular-nums",
    padding: "5px 7px", borderRadius: 8, border: "1px solid #E3E1D6", fontSize: 13, fontFamily: "inherit" };
  const fillPct = (v, min, max) => `${((v - min) / (max - min)) * 100}%`;
  const priceFill = { ...slider, "--fill": fillPct(priceMul, 0.6, 1.8) };
  const inflFill = { ...slider, "--fill": fillPct(inflDelta, -3, 6) };

  return (
    <section style={{ background: "#fff", border: "1px solid #E89B2D", borderRadius: 14, padding: 20, margin: "16px 0",
      boxShadow: "0 2px 4px rgba(20,42,33,.03), 0 10px 26px -12px rgba(232,155,45,.28)" }}>
      <h2 style={{ fontSize: 15.5, margin: "0 0 4px", fontFamily: DISPLAY, fontWeight: 700, color: "#B4700F" }}>{t("audit_title", lang)}</h2>
      <p style={{ fontSize: 13, color: "#66756C", margin: "0 0 18px", lineHeight: 1.5 }}>{t("audit_sub", lang)}</p>

      <div style={{ display: "grid", gap: 18, marginBottom: 18 }}>
        <div>
          <div style={lbl}><span>{t("audit_price", lang)}</span><output style={val}>€{(basePrice * priceMul).toFixed(3)}/kWh</output></div>
          <div style={row}>
            <input type="range" className="ca-slider" min="0.6" max="1.8" step="0.05" value={priceMul} style={priceFill}
              onChange={e => setPriceMul(+e.target.value)} aria-label={t("audit_price", lang)} />
            <input type="number" step="0.001" min="0" style={numBox} value={(basePrice * priceMul).toFixed(3)}
              aria-label={t("audit_price", lang)}
              onChange={e => { const v = +e.target.value; if (!Number.isNaN(v) && basePrice > 0) setPriceMul(v / basePrice); }} />
          </div>
        </div>
        <div>
          <div style={lbl}><span>{t("audit_infl", lang)}</span><output style={val}>{(E.bands.expc.infl + inflDelta).toFixed(1)}%/yr</output></div>
          <div style={row}>
            <input type="range" className="ca-slider" min="-3" max="6" step="0.5" value={inflDelta} style={inflFill}
              onChange={e => setInflDelta(+e.target.value)} aria-label={t("audit_infl", lang)} />
            <input type="number" step="0.1" style={numBox} value={(E.bands.expc.infl + inflDelta).toFixed(1)}
              aria-label={t("audit_infl", lang)}
              onChange={e => { const v = +e.target.value; if (!Number.isNaN(v)) setInflDelta(v - E.bands.expc.infl); }} />
          </div>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 10 }}>
        {bands.map(([key, b, c]) => (
          <div key={key} style={{ background: "#F6F5F0", borderLeft: `4px solid ${c}`, borderRadius: 10, padding: "12px 12px" }}>
            <div style={{ fontSize: 10.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".07em", color: c }}>{t(key, lang)}</div>
            <div style={{ fontSize: 22, fontFamily: DISPLAY, fontWeight: 800, lineHeight: 1.1 }}>
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

      {/* A custom thumb needs a real stylesheet — no inline-style object can
          target ::-webkit-slider-thumb / ::-moz-range-thumb. This page
          renders outside AppTheme (public route), so it can't reach the
          app's own premium slider CSS either; this is a self-contained copy
          of the same visual language instead. */}
      <style dangerouslySetInnerHTML={{ __html: `
        .ca-slider{-webkit-appearance:none;appearance:none;border-radius:99px;
          background:linear-gradient(90deg,#E89B2D var(--fill,30%),#E3E1D6 var(--fill,30%))}
        .ca-slider::-webkit-slider-thumb{-webkit-appearance:none;appearance:none;width:20px;height:20px;
          border-radius:50%;background:#E89B2D;border:3px solid #fff;
          box-shadow:0 0 0 1px #E89B2D,0 2px 6px rgba(20,42,33,.25);cursor:grab}
        .ca-slider::-webkit-slider-thumb:active{cursor:grabbing;transform:scale(1.08)}
        .ca-slider::-moz-range-thumb{width:20px;height:20px;border-radius:50%;background:#E89B2D;
          border:3px solid #fff;box-shadow:0 0 0 1px #E89B2D,0 2px 6px rgba(20,42,33,.25);cursor:grab}
        .ca-slider::-moz-range-progress{height:6px;border-radius:99px;background:#E89B2D}
      ` }} />
    </section>
  );
}
