"use client";
// components/portfolio/TornadoChart.jsx — the sensitivity "tornado": each
// driver moved down and up on its own, the bar running from the base value to
// the result, widest swing at the top. HTML rather than SVG so the driver
// names stay readable at phone width.
//
// Built to the data-viz skill's specs: polarity is the colour job, so the two
// sides take two hues that read as opposite (worse: --pf-b amber, better:
// --pf-c blue; CVD delta E 24.2 light / 25.7 dark) around a neutral base line;
// bars 14px with a 4px rounded data end and a square end on the base line; the
// value at each bar's end in text tokens; a tooltip on hover and keyboard focus
// that also gives the change; a table view.
import { useState } from "react";
import { pt } from "../../lib/portfolioText.js";
import { driverLabel } from "../../lib/portfolioDisplay.js";
import { dscr, pct, eur } from "../../lib/portfolioFormat.js";

/**
 * Plain values only (a server component renders this in the report): the
 * metric decides the format, `rate` turns an NPV in EUR into the display currency.
 */
export default function TornadoChart({ rows = [], base, metric = "dscrMin", rate = 1, lang = "en", bare = false, caption }) {
  const [tip, setTip] = useState(null);
  const fmt = metric === "dscrMin" ? (v) => dscr(v, lang) : metric === "npv" ? (v) => eur(v * rate, lang) : (v) => pct(v, lang);
  const fmtDelta = (v) => (v < 0 ? "−" : "+") + fmt(Math.abs(v));
  if (base == null || !rows.length) return <p className="pf-hint">{pt("tor_none", lang)}</p>;
  const vals = [base, ...rows.flatMap((r) => [r.lo, r.hi])].filter((v) => v != null);
  let lo = Math.min(...vals), hi = Math.max(...vals);
  if (hi - lo < 1e-12) { lo -= 1; hi += 1; }
  const pad = (hi - lo) * 0.3;                       // room for the value labels at the bar ends
  lo -= pad; hi += pad;
  const pos = (v) => ((v - lo) / (hi - lo)) * 100;
  const b = pos(base);
  const sideText = (side) => pt(side === "lo" ? "tor_low" : "tor_high", lang);

  const bar = (r, side) => {
    const v = r[side];
    if (v == null) return null;
    const worse = v < base;
    const left = Math.min(pos(v), b), width = Math.abs(pos(v) - b);
    const d = v - base;
    const aria = `${driverLabel(r.id, r.size, lang)}, ${sideText(side)}: ${fmt(v)} (${fmtDelta(d)})`;
    return (
      <span key={side}>
        <span className={"pf-tbar " + (worse ? "is-worse" : "is-better")} style={{ left: left + "%", width: Math.max(width, 0.4) + "%" }}
          tabIndex={bare ? undefined : 0} role={bare ? undefined : "img"} aria-label={bare ? undefined : aria}
          onMouseEnter={() => setTip({ id: r.id, side, text: aria, x: pos(v) })} onMouseLeave={() => setTip(null)}
          onFocus={() => setTip({ id: r.id, side, text: aria, x: pos(v) })} onBlur={() => setTip(null)} />
        <span className={"pf-tval " + (worse ? "is-left" : "is-right")} style={worse ? { right: 100 - pos(v) + 0.8 + "%" } : { left: pos(v) + 0.8 + "%" }}>{fmt(v)}</span>
      </span>
    );
  };

  return (
    <figure className="pf-chart pf-tornado" aria-label={caption || pt("tor_title", lang)}>
      <div className="pf-legend">
        <span><i className="pf-k pf-k-sw pf-k-b" />{pt("tor_worse", lang)}</span>
        <span><i className="pf-k pf-k-sw pf-k-c" />{pt("tor_better", lang)}</span>
        <span><i className="pf-k pf-k-base" />{pt("tor_base", lang, { x: fmt(base) })}</span>
      </div>
      <div className="pf-trows">
        {rows.map((r) => (
          <div className="pf-trow" key={r.id}>
            <span className="pf-tlbl">{driverLabel(r.id, r.size, lang)}</span>
            <span className="pf-ttrack">
              <span className="pf-tbase" style={{ left: b + "%" }} aria-hidden="true" />
              {bar(r, "lo")}{bar(r, "hi")}
              {tip && tip.id === r.id && (
                <span className="pf-tip pf-ttip" style={{ left: Math.min(Math.max(tip.x, 18), 82) + "%" }} role="status">{tip.text}</span>
              )}
            </span>
          </div>
        ))}
      </div>
      {!bare && (
        <details className="pf-table">
          <summary>{pt("ch_table", lang)}</summary>
          <div className="pf-scroll">
            <table>
              <thead><tr><th>{pt("st_case", lang)}</th><th>{pt("tor_low", lang)}</th><th>{pt("tor_high", lang)}</th></tr></thead>
              <tbody>
                <tr><td>{pt("tor_base", lang, { x: "" }).trim()}</td><td>{fmt(base)}</td><td>{fmt(base)}</td></tr>
                {rows.map((r) => (
                  <tr key={r.id}><td>{driverLabel(r.id, r.size, lang)}</td><td>{r.lo == null ? "" : fmt(r.lo)}</td><td>{r.hi == null ? "" : fmt(r.hi)}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      )}
    </figure>
  );
}
