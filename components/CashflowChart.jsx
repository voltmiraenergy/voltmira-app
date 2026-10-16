"use client";
// components/CashflowChart.jsx — yearly cash flow available for debt service
// (columns) against the debt service itself (a mark across each year's
// column), on ONE axis in EUR: a year whose column ends below its mark is a
// year the debt is not covered. Under the years, each repayment year's DSCR.
// Above the plot, a numbered marker on each year something moves the cash
// flow or the service (lib/cashflowEvents.js), explained in a line below, so
// a step down is never left for a lender to ask about.
// Built to the data-viz skill's specs: columns at most 24px with a 4px rounded
// top, hairline grid, a legend for the two series, a hover tooltip that also
// gives that year's DSCR, and a table view for anyone who prefers one.
//
// Colours are the validated chart pair (light #0F8A5F / #B46A00, dark #2BA170 /
// #C4851A, see portfolio.css), distinct in shape as well as hue.
//
// The margins match components/portfolio/DscrChart.jsx (CHART_PL, CHART_PR),
// so with the same span of years the two charts' years line up.
//
// `rate` (display currency per EUR) shows the amounts in the display currency:
// the series are converted first, so the axis ticks stay round.
import { useEffect, useRef, useState } from "react";
import { eur, eurCompact, dscr, num } from "../lib/portfolioFormat.js";
import { pt } from "../lib/portfolioText.js";
import { eventText } from "../lib/cashflowEvents.js";

export const CHART_PL = 52, CHART_PR = 58;
const PL = CHART_PL, PR = CHART_PR;

function niceMax(v) {
  if (!(v > 0)) return 1;
  const p = Math.pow(10, Math.floor(Math.log10(v)));
  const m = v / p;
  return (m <= 1 ? 1 : m <= 2 ? 2 : m <= 2.5 ? 2.5 : m <= 5 ? 5 : 10) * p;
}

export default function CashflowChart({ cfads: cfEur = [], debtService: dsEur = [], lang = "en", years = 25, bare = false, rate: rateIn, events = [] }) {
  const [hover, setHover] = useState(null);
  // the drawing is as wide as its box (720 when there is no script, as in the PDF)
  const [W, setW] = useState(720);
  const box = useRef(null);
  useEffect(() => {
    const el = box.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(([e]) => setW(Math.max(300, Math.round(e.contentRect.width))));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const rate = rateIn > 0 ? rateIn : 1;
  const cfads = cfEur.map((v) => v * rate);
  const debtService = dsEur.map((v) => v * rate);
  const n = Math.min(years, cfads.length);
  if (!n) return null;
  const hasDebt = debtService.some((d) => d > 1e-9);
  const slot = (W - PL - PR) / n;
  // the cover under each year, where a year is wide enough to hold it
  const coverRow = hasDebt && slot >= 22;
  const evs = events.filter((e) => e.from >= 1 && e.from <= n);
  const H = 240 + (coverRow ? 16 : 0) + (evs.length ? 14 : 0);
  const PT = evs.length ? 28 : 14, PB = coverRow ? 44 : 28;
  const max = niceMax(Math.max(...cfads.slice(0, n), ...debtService.slice(0, n), 1));
  const min = Math.min(0, ...cfads.slice(0, n));
  const lo = min < 0 ? -niceMax(-min) : 0;
  const bw = Math.min(24, slot * 0.62);
  const Y = (v) => PT + (1 - (v - lo) / (max - lo)) * (H - PT - PB);
  const X = (i) => PL + slot * i + slot / 2;
  const ticks = [lo, ...[1, 2, 3, 4].map((k) => lo + ((max - lo) * k) / 4)].filter((t, i, a) => a.indexOf(t) === i);
  const y0 = Y(0);
  const plotBottom = H - PB;

  // columns grow from the zero line, 4px rounded at the data end only
  const col = (i, v) => {
    const x = X(i) - bw / 2, top = Y(Math.max(v, 0)), bot = Y(Math.min(v, 0)), h = Math.max(0, bot - top);
    if (h < 0.5) return null;
    const r = Math.min(4, h, bw / 2);
    return v >= 0
      ? `M${x},${bot} V${top + r} Q${x},${top} ${x + r},${top} H${x + bw - r} Q${x + bw},${top} ${x + bw},${top + r} V${bot} Z`
      : `M${x},${top} V${bot - r} Q${x},${bot} ${x + r},${bot} H${x + bw - r} Q${x + bw},${bot} ${x + bw},${bot - r} V${top} Z`;
  };
  const h = hover != null ? hover : null;
  const tipLeft = h != null ? Math.min(Math.max(X(h) / W, 0.14), 0.86) * 100 : 0;
  const cover = (i) => (debtService[i] > 1e-9 ? cfads[i] / debtService[i] : null);
  const markWhy = (i) => evs.map((e, k) => (i + 1 === e.from ? k + 1 : null)).filter(Boolean);

  return (
    <figure className="pf-chart" aria-label={pt("r_cashflow", lang)}>
      <div className="pf-legend" aria-hidden="false">
        <span><i className="pf-k pf-k-a" />{pt("r_cfads", lang)}</span>
        {hasDebt && <span><i className="pf-k pf-k-b pf-k-mark" />{pt("r_ds", lang)}</span>}
      </div>
      <div className="pf-plot" ref={box}>
        <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={pt("r_cashflow", lang)} onMouseLeave={() => setHover(null)}>
          {ticks.map((t) => (
            <g key={t}>
              <line x1={PL} x2={W - PR} y1={Y(t)} y2={Y(t)} className="pf-gl" />
              <text x={PL - 8} y={Y(t) + 4} textAnchor="end" className="pf-axis">{eurCompact(t, lang)}</text>
            </g>
          ))}
          {lo < 0 && <line x1={PL} x2={W - PR} y1={y0} y2={y0} className="pf-zero" />}
          {/* the events: a numbered marker above the year, a hairline down to the axis */}
          {evs.map((e, k) => {
            const same = evs.slice(0, k).filter((x) => x.from === e.from).length;
            const x = X(e.from - 1) + same * 15;
            return (
              <g key={k} className="pf-ev">
                {same === 0 && <line x1={X(e.from - 1)} x2={X(e.from - 1)} y1={PT - 4} y2={plotBottom} className="pf-ev-l" />}
                <circle cx={x} cy={12} r={7.5} className="pf-ev-c" />
                <text x={x} y={15.5} textAnchor="middle" className="pf-ev-n">{k + 1}</text>
              </g>
            );
          })}
          {Array.from({ length: n }, (_, i) => (i + 1 === 1 || (i + 1) % 5 === 0 || (slot >= 22 && n <= 30)) && (
            <text key={i} x={X(i)} y={plotBottom + 16} textAnchor="middle" className="pf-axis">{i + 1}</text>
          ))}
          {coverRow && <text x={PL - 8} y={plotBottom + 34} textAnchor="end" className="pf-axis pf-cov-l">DSCR</text>}
          {coverRow && Array.from({ length: n }, (_, i) => cover(i) != null && (
            <text key={i} x={X(i)} y={plotBottom + 34} textAnchor="middle" className={"pf-axis pf-cov" + (cover(i) < 1 ? " bad" : "")}>{cover(i) >= 10 ? num(cover(i), lang, 0) : dscr(cover(i), lang).replace(/\s*x$/, "")}</text>
          ))}
          {cfads.slice(0, n).map((v, i) => { const d = col(i, v); return d ? <path key={i} d={d} className={"pf-col" + (h === i ? " on" : "")} /> : null; })}
          {/* the year's debt service, across its own column */}
          {hasDebt && debtService.slice(0, n).map((d, i) => (d > 1e-9 ? (
            <line key={i} x1={X(i) - bw / 2 - 4} x2={X(i) + bw / 2 + 4} y1={Y(d)} y2={Y(d)} className="pf-ds-mark" />
          ) : null))}
          {Array.from({ length: n }, (_, i) => (
            <rect key={i} x={PL + slot * i} y={PT} width={slot} height={H - PT - PB} className="pf-hit" onMouseEnter={() => setHover(i)} onFocus={() => setHover(i)} onBlur={() => setHover(null)} tabIndex={bare ? undefined : 0}
              aria-label={`${pt("r_year", lang)} ${i + 1}: ${eur(cfads[i], lang)}`} />
          ))}
        </svg>
        {h != null && (
          <div className="pf-tip" style={{ left: tipLeft + "%" }} role="status">
            <b>{pt("r_year", lang)} {h + 1}</b>
            <span><i className="pf-k pf-k-a" />{eur(cfads[h], lang)}</span>
            {hasDebt && <span><i className="pf-k pf-k-b" />{eur(debtService[h], lang)}</span>}
            {cover(h) != null && <span className="pf-tip-d">DSCR {dscr(cover(h), lang)}</span>}
            {markWhy(h).map((k) => <span key={k} className="pf-tip-d pf-tip-ev">{eventText(evs[k - 1], lang, (v) => eur(v * rate, lang))}</span>)}
          </div>
        )}
      </div>
      {evs.length > 0 && (
        <ol className="pf-evs">
          {evs.map((e, k) => <li key={k}>{eventText(e, lang, (v) => eur(v * rate, lang))}</li>)}
        </ol>
      )}
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
