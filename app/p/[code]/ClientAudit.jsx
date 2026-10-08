"use client";
// app/p/[code]/ClientAudit.jsx — the honesty engine, in the client's hands.
// The homeowner drags the electricity price and yearly price-rise sliders (or
// types the figures from their own bill) and watches their payback recompute
// LIVE, using the exact same engine the installer used. Nothing to hide,
// that's the whole brand. Styles: proposal.css (.ca-*).
import { useId, useMemo, useState } from "react";
import { SlidersHorizontal } from "lucide-react";
import { quote } from "@voltmira/engine";
import { t } from "../../../lib/i18n.js";
import { moneyFormatter, numFor } from "../../../lib/money.js";
import { ppt } from "./text.js";
import { CHART } from "./charts.jsx";

// A figure the client types (from their own bill). The text they are typing is
// kept as typed while the field has focus, and committed whenever it parses:
// re-formatting on every keystroke (the old toFixed value) turned "2.50" into
// "2.00." and then 0.01. Text with a decimal keypad, so a Romanian, Russian or
// Ukrainian reader's comma works as well as a dot.
function NumField({ value, decimals, lang, onCommit, label }) {
  const [draft, setDraft] = useState(null);
  const shown = (v) => v.toLocaleString({ en: "en-GB", ro: "ro-RO", ru: "ru-RU", uk: "uk-UA" }[lang] || "en-GB",
    { minimumFractionDigits: decimals, maximumFractionDigits: decimals, useGrouping: false });
  const parse = (s) => parseFloat(String(s).replace(/\s/g, "").replace(",", "."));
  return (
    <input type="text" inputMode="decimal" autoComplete="off" className="ca-num" aria-label={label}
      value={draft ?? shown(value)}
      onFocus={() => setDraft(shown(value))}
      onBlur={() => setDraft(null)}
      onChange={(e) => { setDraft(e.target.value); const v = parse(e.target.value); if (Number.isFinite(v)) onCommit(v); }} />
  );
}

// currency/rate: the proposal's own (lib/money.js). Every currency other than
// EUR is local (lei, hryvnia): the client reads and types the electricity
// price in it, at the rate frozen with the proposal; the engine keeps EUR.
// The unit comes from moneyFormatter, so a UAH offer reads "грн/кВт·год" in
// Ukrainian and "UAH/kWh" in English, never a hard-coded "lei".
export default function ClientAudit({ inputs, assumptions: E, lang, currency = "EUR", rate = 1 }) {
  const fmt = moneyFormatter({ currency, lang, fx: currency && currency !== "EUR" ? { [currency]: rate } : null });
  const local = fmt.local;
  const k = fmt.rate;
  const nf = numFor(lang);
  const id = useId();
  const basePrice = Number(inputs.price) || 0.21;
  const [priceMul, setPriceMul] = useState(1);
  const [inflDelta, setInflDelta] = useState(0);

  const params = useMemo(() => ({
    kw: Number(inputs.kw), cons: Number(inputs.cons) || 5000,
    batt: inputs.batt, market: inputs.market, useMonthly: inputs.useMonthly,
    consMonthly: inputs.consMonthly, afmSubsidy: inputs.afmSubsidy,
    yieldOverride: inputs.yieldOverride, monthlyYieldShape: inputs.monthlyYieldShape,
    // Carry the real battery capacity and the frozen BOM total, otherwise this
    // panel priced a 20 kWh battery as 10 kWh (engine fallback) and ignored the
    // bill of materials, so the audit contradicted the headline proposal.
    battKwh: inputs.battKwh,
    costOverride: Number(inputs.costOverride) || 0,
    bomHasBattery: !!inputs.bomHasBattery,
  }), [inputs]);

  // The proposal's own figures (q0), to show what the client's changes moved.
  const [q0, q] = useMemo(() => {
    const run = (mul, delta) => {
      const bend = (b) => ({ ...b, infl: Math.max(0, b.infl + delta) });
      const E2 = { ...E, bands: { pess: bend(E.bands.pess), expc: bend(E.bands.expc), opti: bend(E.bands.opti) } };
      return quote({ ...params, price: basePrice * mul }, E2);
    };
    return [run(1, 0), run(priceMul, inflDelta)];
  }, [priceMul, inflDelta, params, E, basePrice]);

  const yrs = (n) => n === null ? "25+" : n === 0 ? t("pp_immediate", lang) : nf(n, 1);
  const unit = (n) => (n === 0 ? "" : t("pp_years", lang));
  const touched = priceMul !== 1 || inflDelta !== 0;

  const bands = [
    ["sc_pess", q.p, q0.p, CHART.pess, true],
    ["sc_expc", q.e, q0.e, CHART.expc, false],
    ["sc_opti", q.o, q0.o, CHART.opti, true],
  ];
  const fillPct = (v, min, max) => `${Math.min(100, Math.max(0, ((v - min) / (max - min)) * 100))}%`;
  const localPrice = basePrice * priceMul * k;

  return (
    <section className="ca pp-card" aria-labelledby={`${id}-h`}>
      <div className="ca-head">
        <span className="pp-tile" aria-hidden="true"><SlidersHorizontal className="pp-ic" /></span>
        <div>
          <h3 className="pp-h3" id={`${id}-h`}>{ppt("audit_h", lang)}</h3>
          <p>{ppt("audit_p", lang)}</p>
        </div>
      </div>

      <div className="ca-fields">
        <div>
          <div className="ca-lbl">
            <label htmlFor={`${id}-p`}>{ppt("audit_price", lang)}</label>
            <output htmlFor={`${id}-p`}>{fmt.perKwh(basePrice * priceMul)}</output>
          </div>
          <div className="ca-row">
            <input id={`${id}-p`} type="range" className="ca-slider" min="0.6" max="1.8" step="0.05" value={priceMul}
              style={{ "--fill": fillPct(priceMul, 0.6, 1.8) }}
              onChange={(e) => setPriceMul(+e.target.value)} />
            <NumField value={localPrice} decimals={local ? 2 : 3} lang={lang} label={`${ppt("audit_price", lang)}, ${fmt.unit}`}
              onCommit={(v) => { if (v >= 0 && basePrice > 0) setPriceMul(v / k / basePrice); }} />
          </div>
        </div>
        <div>
          <div className="ca-lbl">
            <label htmlFor={`${id}-i`}>{ppt("audit_infl", lang)}</label>
            <output htmlFor={`${id}-i`}>{t("pp_pct_yr", lang, { v: nf(E.bands.expc.infl + inflDelta, 1) })}</output>
          </div>
          <div className="ca-row">
            <input id={`${id}-i`} type="range" className="ca-slider" min="-3" max="6" step="0.5" value={inflDelta}
              style={{ "--fill": fillPct(inflDelta, -3, 6) }}
              onChange={(e) => setInflDelta(+e.target.value)} />
            <NumField value={E.bands.expc.infl + inflDelta} decimals={1} lang={lang} label={`${ppt("audit_infl", lang)}, %`}
              onCommit={(v) => setInflDelta(v - E.bands.expc.infl)} />
          </div>
        </div>
      </div>

      <div className="ca-res" aria-live="polite">
        <div className="ca-res-h">{ppt("audit_result", lang)}</div>
        <div className="ca-bands">
          {bands.map(([key, b, b0, color, dashed]) => (
            <div key={key} className="ca-band">
              <span className="ca-band-k">
                <i className={"pp-ln" + (dashed ? " is-dash" : "")} style={{ color }} aria-hidden="true" />
                {ppt(key, lang)}
              </span>
              <span>
                <span className="ca-band-v">{yrs(b.payback)}<small>{unit(b.payback)}</small></span>
                {touched && b.payback !== b0.payback && (
                  <span className="ca-was">{ppt("audit_was", lang, { v: `${yrs(b0.payback)} ${unit(b0.payback)}`.trim() })}</span>
                )}
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="ca-foot">
        <p>{ppt("audit_note", lang)}</p>
        {touched && (
          <button type="button" className="pp-btn pp-btn-ghost" style={{ minHeight: 42, fontSize: 14 }}
            onClick={() => { setPriceMul(1); setInflDelta(0); }}>
            {ppt("audit_reset", lang)}
          </button>
        )}
      </div>
    </section>
  );
}
