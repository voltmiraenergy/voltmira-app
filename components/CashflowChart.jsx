"use client";
// components/CashflowChart.jsx — yearly cash flow available for debt service
// (columns) against the debt service itself (a step line), on ONE axis in EUR:
// the year the columns fall under the line is the year the debt is not covered.
// Built to the data-viz skill's specs: columns at most 24px with a 4px rounded
// top, a 2px line, a hairline grid, a legend for the two series, a hover tooltip
// that also gives that year's DSCR, and a table view for anyone who prefers one.
//
// Colours are the validated chart pair (light #0F8A5F / #B46A00, dark #2BA170 /
// #C4851A, see portfolio.css), distinct in shape as well as hue.
import { useState } from "react";
import { eur, eurCompact, dscr } from "../lib/portfolioFormat.js";
import { pt } from "../lib/portfolioText.js";

const W = 720, H = 240, PL = 52, PR = 12, PT = 14, PB = 28;

function niceMax(v) {
  if (!(v > 0)) return 1;
  const p = Math.pow(10, Math.floor(Math.log10(v)));
  const m = v / p;
  return (m <= 1 ? 1 : m <= 2 ? 2 : m <= 2.5 ? 2.5 : m <= 5 ? 5 : 10) * p;
}

export default function CashflowChart({ cfads = [], debtService = [], lang = "en", years = 25, bare = false }) {
  const [hover, setHover] = useState(null);
  const n = Math.min(years, cfads.length);
  if (!n) return null;
  const hasDebt = debtService.some((d) => d > 1e-9);
  const max = niceMax(Math.max(...cfads.slice(0, n), ...debtService.slice(0, n), 1));
  const min = Math.min(0, ...cfads.slice(0, n));
  const lo = min < 0 ? -niceMax(-min) : 0;
  const slot = (W - PL - PR) / n;
  const bw = Math.min(24, slot * 0.62);
  const Y = (v) => PT + (1 - (v - lo) / (max - lo)) * (H - PT - PB);
  const X = (i) => PL + slot * i + slot / 2;
  const ticks = [lo, ...[1, 2, 3, 4].map((k) => lo + ((max - lo) * k) / 4)].filter((t, i, a) => a.indexOf(t) === i);
  const y0 = Y(0);

  // columns grow from the zero line, 4px rounded at the data end only
  const col = (i, v) => {
    const x = X(i) - bw / 2, top = Y(Math.max(v, 0)), bot = Y(Math.min(v, 0)), h = Math.max(0, bot - top);
    if (h < 0.5) return null;
    const r = Math.min(4, h, bw / 2);
    return v >= 0
      ? `M${x},${bot} V${top + r} Q${x},${top} ${x + r},${top} H${x + bw - r} Q${x + bw},${top} ${x + bw},${top + r} V${bot} Z`
      : `M${x},${top} V${bot - r} Q${x},${bot} ${x + r},${bot} H${x + bw - r} Q${x + bw},${bot} ${x + bw},${bot - r} V${top} Z`;
  };
  // the step line holds each year's service across its slot, and stops after
  // the last payment rather than running along zero for the rest of the life
  let step = "";
  if (hasDebt) {
    let lastPaid = -1;
    for (let i = 0; i < n; i++) if ((debtService[i] || 0) > 1e-9) lastPaid = i;
    for (let i = 0; i <= lastPaid; i++) {
      const y = Y(debtService[i] || 0);
      step += `${i ? "L" : "M"}${PL + slot * i + 2},${y} L${PL + slot * (i + 1) - 2},${y} `;
    }
  }
  const h = hover != null ? hover : null;
  const tipLeft = h != null ? Math.min(Math.max(X(h) / W, 0.14), 0.86) * 100 : 0;

  return (
    <figure className="pf-chart" aria-label={pt("r_cashflow", lang)}>
      <div className="pf-legend" aria-hidden="false">
        <span><i className="pf-k pf-k-a" />{pt("r_cfads", lang)}</span>
        {hasDebt && <span><i className="pf-k pf-k-b" />{pt("r_ds", lang)}</span>}
      </div>
      <div className="pf-plot">
        <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={pt("r_cashflow", lang)} onMouseLeave={() => setHover(null)}>
          {ticks.map((t) => (
            <g key={t}>
              <line x1={PL} x2={W - PR} y1={Y(t)} y2={Y(t)} className="pf-gl" />
              <text x={PL - 8} y={Y(t) + 4} textAnchor="end" className="pf-axis">{eurCompact(t, lang)}</text>
            </g>
          ))}
          {lo < 0 && <line x1={PL} x2={W - PR} y1={y0} y2={y0} className="pf-zero" />}
          {Array.from({ length: n }, (_, i) => (i + 1 === 1 || (i + 1) % 5 === 0) && (
            <text key={i} x={X(i)} y={H - 8} textAnchor="middle" className="pf-axis">{i + 1}</text>
          ))}
          {cfads.slice(0, n).map((v, i) => { const d = col(i, v); return d ? <path key={i} d={d} className={"pf-col" + (h === i ? " on" : "")} /> : null; })}
          {hasDebt && <path d={step} className="pf-line" fill="none" />}
          {Array.from({ length: n }, (_, i) => (
            <rect key={i} x={PL + slot * i} y={PT} width={slot} height={H - PT - PB} className="pf-hit" onMouseEnter={() => setHover(i)} onFocus={() => setHover(i)} tabIndex={0}
              aria-label={`${pt("r_year", lang)} ${i + 1}: ${eur(cfads[i], lang)}`} />
          ))}
        </svg>
        {h != null && (
          <div className="pf-tip" style={{ left: tipLeft + "%" }} role="status">
            <b>{pt("r_year", lang)} {h + 1}</b>
            <span><i className="pf-k pf-k-a" />{eur(cfads[h], lang)}</span>
            {hasDebt && <span><i className="pf-k pf-k-b" />{eur(debtService[h], lang)}</span>}
            {hasDebt && debtService[h] > 1e-9 && <span className="pf-tip-d">DSCR {dscr(cfads[h] / debtService[h], lang)}</span>}
          </div>
        )}
      </div>
      {!bare && <details className="pf-table">
        <summary>{pt("r_cashflow", lang)}</summary>
        <div className="pf-scroll">
          <table>
            <thead><tr><th>{pt("r_year", lang)}</th><th>{pt("r_cfads", lang)}</th>{hasDebt && <th>{pt("r_ds", lang)}</th>}{hasDebt && <th>DSCR</th>}</tr></thead>
            <tbody>
              {cfads.slice(0, n).map((v, i) => (
                <tr key={i}><td>{i + 1}</td><td>{eur(v, lang)}</td>{hasDebt && <td>{eur(debtService[i], lang)}</td>}{hasDebt && <td>{debtService[i] > 1e-9 ? dscr(v / debtService[i], lang) : ""}</td>}</tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>}
    </figure>
  );
}
