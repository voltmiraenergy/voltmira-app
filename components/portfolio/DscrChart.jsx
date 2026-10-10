"use client";
// components/portfolio/DscrChart.jsx — the pooled debt cover (DSCR) in each
// repayment year, on P50 and on P90 energy, against each test's target.
// Built to the data-viz skill's specs: one axis (a ratio), 2px lines, markers
// of 8px with a 2px surface ring (a circle for P50, a square for P90, so the
// two differ in shape as well as hue), hairline grid, the targets as dashed
// lines in their series' colour with their values beside them, a legend that
// also names each series' lowest year, a crosshair tooltip on hover and focus,
// and a table view.
//
// Colours: P50 --pf-a (#0F8A5F light / #2BA170 dark), P90 --pf-c (#2A6FC0 /
// #4C8FE0); validated as a pair, CVD delta E 18.1 light / 17.6 dark.
import { useEffect, useRef, useState } from "react";
import { dscr as fx } from "../../lib/portfolioFormat.js";
import { pt } from "../../lib/portfolioText.js";

const PL = 44, PR = 58, PT = 12, PB = 28;

function niceStep(max) {
  return max <= 3 ? 0.5 : max <= 6 ? 1 : max <= 15 ? 2.5 : 5;
}

export default function DscrChart({ p50 = [], p90 = [], targets = { p50: 1.3, p90: 1.2 }, lang = "en", bare = false, height = 230 }) {
  const H = height;
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
  // the repayment years: those with a cover figure
  let last = -1;
  for (let i = 0; i < p50.length; i++) if (p50[i] != null || p90[i] != null) last = i;
  const n = last + 1;
  if (!n) return <p className="pf-hint" ref={box}>{pt("ch_nodebt", lang)}</p>;
  const vals = [...p50.slice(0, n), ...p90.slice(0, n)].filter((v) => v != null && Number.isFinite(v));
  const top = Math.max(...vals, targets.p50, targets.p90) * 1.08;
  const step = niceStep(top);
  const max = Math.ceil(top / step) * step;
  const ticks = Array.from({ length: Math.round(max / step) + 1 }, (_, k) => k * step);
  const slot = (W - PL - PR) / n;
  const X = (i) => PL + slot * (i + 0.5);
  const Y = (v) => PT + (1 - v / max) * (H - PT - PB);
  const path = (arr) => arr.slice(0, n).map((v, i) => (v == null ? null : `${X(i)},${Y(v)}`)).filter(Boolean).map((p, k) => (k ? "L" : "M") + p).join(" ");
  const lowest = (arr) => { const v = arr.slice(0, n).filter((x) => x != null); return v.length ? Math.min(...v) : null; };
  const lo50 = lowest(p50), lo90 = lowest(p90);
  // target values at the right edge, nudged apart only as far as they must be to stay legible
  let y50 = Y(targets.p50), y90 = Y(targets.p90);
  if (Math.abs(y50 - y90) < 12) { const mid = (y50 + y90) / 2, s = y50 <= y90 ? -1 : 1; y50 = mid + s * 6; y90 = mid - s * 6; }
  const xLabel = (i) => n <= 12 || i === 0 || (i + 1) % 5 === 0;
  const h = hover;
  const tipLeft = h != null ? Math.min(Math.max(X(h) / W, 0.14), 0.86) * 100 : 0;
  const label = pt("ch_dscr", lang);

  return (
    <figure className="pf-chart pf-dscr" aria-label={label}>
      <div className="pf-legend">
        <span><i className="pf-k pf-k-line pf-k-a" /><i className="pf-k pf-k-dot pf-k-a" />P50{lo50 != null ? `, ${pt("ch_lowest", lang, { x: fx(lo50, lang) })}` : ""}</span>
        <span><i className="pf-k pf-k-line pf-k-c" /><i className="pf-k pf-k-sq pf-k-c" />P90{lo90 != null ? `, ${pt("ch_lowest", lang, { x: fx(lo90, lang) })}` : ""}</span>
        <span><i className="pf-k pf-k-dash pf-k-a" />{pt("ch_target", lang, { x: fx(targets.p50, lang), lvl: "P50" })}</span>
        <span><i className="pf-k pf-k-dash pf-k-c" />{pt("ch_target", lang, { x: fx(targets.p90, lang), lvl: "P90" })}</span>
      </div>
      <div className="pf-plot" ref={box}>
        <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={label} onMouseLeave={() => setHover(null)}>
          {ticks.map((t) => (
            <g key={t}>
              <line x1={PL} x2={W - PR} y1={Y(t)} y2={Y(t)} className={t === 1 ? "pf-zero" : "pf-gl"} />
              <text x={PL - 8} y={Y(t) + 4} textAnchor="end" className="pf-axis">{fx(t, lang)}</text>
            </g>
          ))}
          {Array.from({ length: n }, (_, i) => xLabel(i) && (
            <text key={i} x={X(i)} y={H - 8} textAnchor="middle" className="pf-axis">{i + 1}</text>
          ))}
          <line x1={PL} x2={W - PR} y1={Y(targets.p50)} y2={Y(targets.p50)} className="pf-target pf-sa" />
          <line x1={PL} x2={W - PR} y1={Y(targets.p90)} y2={Y(targets.p90)} className="pf-target pf-sc" />
          <text x={W - PR + 6} y={y50 + 4} className="pf-axis">{fx(targets.p50, lang)}</text>
          <text x={W - PR + 6} y={y90 + 4} className="pf-axis">{fx(targets.p90, lang)}</text>
          {h != null && <line x1={X(h)} x2={X(h)} y1={PT} y2={H - PB} className="pf-cross" />}
          <path d={path(p50)} className="pf-ln pf-sa" fill="none" />
          <path d={path(p90)} className="pf-ln pf-sc" fill="none" />
          {p50.slice(0, n).map((v, i) => v != null && <circle key={"a" + i} cx={X(i)} cy={Y(v)} r={4} className="pf-mk pf-fa" />)}
          {p90.slice(0, n).map((v, i) => v != null && <rect key={"c" + i} x={X(i) - 4} y={Y(v) - 4} width={8} height={8} rx={1} className="pf-mk pf-fc" />)}
          {!bare && Array.from({ length: n }, (_, i) => (
            <rect key={"h" + i} x={PL + slot * i} y={PT} width={slot} height={H - PT - PB} className="pf-hit" tabIndex={0}
              onMouseEnter={() => setHover(i)} onFocus={() => setHover(i)} onBlur={() => setHover(null)}
              aria-label={`${pt("r_year", lang)} ${i + 1}: P50 ${p50[i] == null ? "" : fx(p50[i], lang)}, P90 ${p90[i] == null ? "" : fx(p90[i], lang)}`} />
          ))}
        </svg>
        {h != null && (
          <div className="pf-tip" style={{ left: tipLeft + "%" }} role="status">
            <b>{pt("r_year", lang)} {h + 1}</b>
            <span><i className="pf-k pf-k-line pf-k-a" /><strong>{p50[h] == null ? "" : fx(p50[h], lang)}</strong> P50</span>
            <span><i className="pf-k pf-k-line pf-k-c" /><strong>{p90[h] == null ? "" : fx(p90[h], lang)}</strong> P90</span>
          </div>
        )}
      </div>
      {!bare && (
        <details className="pf-table">
          <summary>{pt("ch_table", lang)}</summary>
          <div className="pf-scroll">
            <table>
              <thead><tr><th>{pt("r_year", lang)}</th><th>DSCR P50</th><th>DSCR P90</th></tr></thead>
              <tbody>
                {Array.from({ length: n }, (_, i) => (
                  <tr key={i}><td>{i + 1}</td><td>{p50[i] == null ? "" : fx(p50[i], lang)}</td><td>{p90[i] == null ? "" : fx(p90[i], lang)}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      )}
    </figure>
  );
}
