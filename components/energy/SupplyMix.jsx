"use client";
// components/energy/SupplyMix.jsx — where the right bank's electricity came
// from, as stacked columns of % of consumption: whole years 2019 to 2024, a
// gap, then month by month from January 2025 (lib/greenData.js COVERAGE, as
// printed in the Ministry of Energy's presentation). A dashed line marks January
// 2025, from when the left bank (MGRES) is at 0% in these figures.
//
// Four series, each its own hue, in a legend above the chart; a share the
// presentation does not print is left out of its column and says so in the tooltip
// and the table. Hover, or focus the chart and use the arrow keys, for one
// period's four shares; the table view lists every period.
import { useEffect, useRef, useState } from "react";
import { COVERAGE } from "../../lib/greenData.js";
import { et } from "../../lib/energyText.js";
import { num } from "../../lib/portfolioFormat.js";
import { LOCALE } from "../../lib/relTime.js";

const SERIES = [
  { key: "right", label: "mk_c_right", color: "var(--en-own)" },
  { key: "left", label: "mk_c_left", color: "var(--en-left)" },
  { key: "ua", label: "mk_c_ua", color: "var(--en-ua)" },
  { key: "ro", label: "mk_c_ro", color: "var(--en-ro)" },
];
const H = 270, PL = 38, PR = 8, PT = 30, PB = 44;

export default function SupplyMix({ lang = "en" }) {
  const loc = LOCALE[lang] || "en-GB";
  const rows = [
    ...COVERAGE.yearly.map((r) => ({ ...r, yearly: true })),
    ...COVERAGE.monthly.map((r) => ({ ...r, yearly: false })),
  ];
  const [view, setView] = useState("chart");
  const [hover, setHover] = useState(null);
  // the drawing is as wide as its box
  const [W, setW] = useState(720);
  const box = useRef(null);
  useEffect(() => {
    const el = box.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(([e]) => setW(Math.max(300, Math.round(e.contentRect.width))));
    ro.observe(el);
    return () => ro.disconnect();
  }, [view]);

  const monthName = (p, style = "short") => {
    const s = new Date(p + "-15T12:00:00Z").toLocaleDateString(loc, { month: style, year: style === "long" ? "numeric" : undefined, timeZone: "UTC" });
    return s.charAt(0).toUpperCase() + s.slice(1);
  };
  const label = (r) => (r.yearly ? r.period : monthName(r.period, "long"));
  const pc = (v) => (v == null ? et("not_printed", lang) : `${num(v, lang, 1)}%`);

  // columns: six years, a one-column gap, eighteen months
  const slots = rows.length + 1;
  const plotW = W - PL - PR, plotH = H - PT - PB;
  const step = plotW / slots;
  const bw = Math.max(6, Math.min(30, step * 0.7));
  const xOf = (i) => PL + step * (i + (rows[i].yearly ? 0 : 1)) + (step - bw) / 2;
  const yOf = (v) => PT + plotH - (v / 100) * plotH;
  const shiftX = PL + step * (COVERAGE.yearly.length + 1) - (step - bw) / 4;

  const tip = hover != null ? rows[hover] : null;
  const tipLeft = hover != null ? Math.min(Math.max(xOf(hover) + bw / 2, 90), W - 90) : 0;

  return (
    <div className="en-chart">
      <div className="en-chart-top">
        <ul className="en-legend" aria-label={et("sec_supply", lang)}>
          {SERIES.map((s) => <li key={s.key}><i style={{ background: s.color }} aria-hidden="true" />{et(s.label, lang)}</li>)}
        </ul>
        <div className="seg2 en-view" role="group">
          <button type="button" className={view === "chart" ? "on" : ""} aria-pressed={view === "chart"} onClick={() => setView("chart")}>{et("view_chart", lang)}</button>
          <button type="button" className={view === "table" ? "on" : ""} aria-pressed={view === "table"} onClick={() => setView("table")}>{et("view_table", lang)}</button>
        </div>
      </div>

      {view === "chart" ? (
        <div className="en-plot" ref={box} onMouseLeave={() => setHover(null)}>
          <svg width={W} height={H} role="img" aria-label={et("sec_supply", lang)} tabIndex={0}
            onFocus={() => setHover((h) => (h == null ? rows.length - 1 : h))}
            onBlur={() => setHover(null)}
            onKeyDown={(e) => {
              if (e.key === "ArrowRight") { e.preventDefault(); setHover((h) => Math.min(rows.length - 1, (h ?? -1) + 1)); }
              if (e.key === "ArrowLeft") { e.preventDefault(); setHover((h) => Math.max(0, (h ?? rows.length) - 1)); }
            }}>
            {[0, 25, 50, 75, 100].map((v) => (
              <g key={v}>
                <line x1={PL} x2={W - PR} y1={yOf(v)} y2={yOf(v)} className="en-grid" />
                <text x={PL - 6} y={yOf(v) + 4} className="en-ax" textAnchor="end">{v}%</text>
              </g>
            ))}
            {rows.map((r, i) => {
              let acc = 0;
              const x = xOf(i);
              return (
                <g key={r.period} className={hover === i ? "on" : ""}>
                  {SERIES.map((s) => {
                    const v = r[s.key];
                    if (!v) return null;
                    const y0 = yOf(acc), y1 = yOf(Math.min(100, acc + v));
                    acc += v;
                    return <rect key={s.key} x={x} y={y1} width={bw} height={Math.max(0.5, y0 - y1)} fill={s.color} />;
                  })}
                  {/* the whole column height answers the pointer */}
                  <rect x={x - (step - bw) / 2} y={PT} width={step} height={plotH} fill="transparent" onMouseEnter={() => setHover(i)} />
                  {r.yearly
                    ? <text x={x + bw / 2} y={H - PB + 16} className="en-ax" textAnchor="middle">{r.period}</text>
                    : (r.period.endsWith("-01") || r.period.endsWith("-04") || r.period.endsWith("-07") || r.period.endsWith("-10")) && (
                      <text x={x + bw / 2} y={H - PB + 16} className="en-ax" textAnchor="middle">{monthName(r.period)}</text>
                    )}
                  {!r.yearly && r.period.endsWith("-01") && (
                    <text x={x} y={H - PB + 32} className="en-ax en-ax-y">{r.period.slice(0, 4)}</text>
                  )}
                </g>
              );
            })}
            <line x1={shiftX} x2={shiftX} y1={PT - 22} y2={H - PB} className="en-shift" />
            <text x={shiftX + 6} y={PT - 12} className="en-shift-t">{et("shift_mark", lang)}</text>
          </svg>
          {tip && (
            <div className="en-tip" style={{ left: tipLeft, top: 8 }} role="status">
              <b>{label(tip)}</b>
              {SERIES.slice().reverse().map((s) => (
                <span key={s.key}><i style={{ background: s.color }} aria-hidden="true" />{et(s.label, lang)}<em>{pc(tip[s.key])}</em></span>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="en-table-wrap">
          <table className="en-table">
            <thead><tr><th>{et("mk_c_period", lang)}</th>{SERIES.map((s) => <th key={s.key} className="r">{et(s.label, lang)}</th>)}</tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.period}><td>{label(r)}</td>{SERIES.map((s) => <td key={s.key} className={"r" + (r[s.key] == null ? " dim" : "")}>{pc(r[s.key])}</td>)}</tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
