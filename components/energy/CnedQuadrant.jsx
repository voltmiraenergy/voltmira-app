"use client";
// components/energy/CnedQuadrant.jsx — "Where the market is growing", in
// CnedExplorer: every area as a circle, by how many prosumers it already has
// per 10,000 residents (across) and how much its prosumer capacity grew in 12
// months (up), the circle as large as its population. The medians of the
// areas split the chart in four; the top left corner (growing faster than
// most, fewer prosumers than most so far) is listed beside it as the areas to
// watch. A reading of CNED's counts, never a forecast, and the chart says so.
//
// Data: lib/cnedStats.js marketQuadrants() of the raionStats() rows, as props.
import { useMemo, useState } from "react";
import { raionName } from "../../lib/mdRaions.js";
import { marketQuadrants } from "../../lib/cnedStats.js";
import { ct } from "../../lib/cnedText.js";
import { num } from "../../lib/portfolioFormat.js";
import { power } from "./CnedMap.jsx";
import { Star } from "lucide-react";

const W = 720, H = 420, M = { l: 54, r: 18, t: 18, b: 48 };
const Q_KEY = { early: "q_early", hot: "q_hot", quiet: "q_quiet", mature: "q_mature" };
const step = (max) => (max > 120 ? 40 : max > 60 ? 20 : 10);
const ticks = (max) => { const s = step(max), out = []; for (let v = 0; v <= max; v += s) out.push(v); return out; };

export default function CnedQuadrant({ lang = "en", stats = [], byId = {}, current, mine = [], onSelect, onToggleMarket }) {
  const q = useMemo(() => marketQuadrants(stats), [stats]);
  const [hover, setHover] = useState(null);
  const s = step(Math.max(...q.rows.map((r) => r.x), 10));
  const xMax = Math.ceil(Math.max(...q.rows.map((r) => r.x), 10) / s) * s;
  const yMax = Math.ceil(Math.max(...q.rows.map((r) => r.y), 10) / step(Math.max(...q.rows.map((r) => r.y), 10))) * step(Math.max(...q.rows.map((r) => r.y), 10));
  const px = (v) => M.l + (v / xMax) * (W - M.l - M.r);
  const py = (v) => H - M.b - (v / yMax) * (H - M.t - M.b);
  const popMax = Math.max(...q.rows.map((r) => r.population), 1);
  const rad = (p) => 5 + Math.sqrt(p / popMax) * 15;
  const mineSet = new Set(mine);
  const early = q.rows.filter((r) => r.q === "early").sort((a, b) => b.y - a.y);
  const missing = stats.filter((r) => !q.rows.some((x) => x.id === r.id)).map((r) => raionName(r.id, lang));
  // labels: the corner worth a look, the picked area, the installer's own; small circles last so they stay clickable
  const labelled = (r) => r.q === "early" || r.id === current || mineSet.has(r.id) || r.population === popMax;
  const drawn = [...q.rows].sort((a, b) => b.population - a.population);
  const hv = hover ? q.rows.find((r) => r.id === hover) : null;

  // names beside the circles, the most wanted first, each where it overlaps no name already placed
  const placed = [];
  const prio = (r) => (r.id === current ? 0 : mineSet.has(r.id) ? 1 : r.q === "early" ? 2 : 3);
  for (const r of q.rows.filter(labelled).sort((a, b) => prio(a) - prio(b) || b.y - a.y)) {
    const text = raionName(r.id, lang), w = text.length * 6.4 + 4, h = 16, cx = px(r.x), cy = py(r.y), rr = rad(r.population);
    const spots = [
      { x: cx + rr + 4, y: cy + 4, anchor: "start", box: [cx + rr + 2, cy - 8, w, h] },
      { x: cx - rr - 4, y: cy + 4, anchor: "end", box: [cx - rr - 2 - w, cy - 8, w, h] },
      { x: cx, y: cy - rr - 5, anchor: "middle", box: [cx - w / 2, cy - rr - 18, w, h] },
      { x: cx, y: cy + rr + 13, anchor: "middle", box: [cx - w / 2, cy + rr + 2, w, h] },
    ];
    const free = (b) => b[0] >= M.l && b[0] + b[2] <= W - M.r && b[1] >= M.t && b[1] + b[3] <= H - M.b
      && placed.every((p) => b[0] + b[2] < p.box[0] || p.box[0] + p.box[2] < b[0] || b[1] + b[3] < p.box[1] || p.box[1] + p.box[3] < b[1])
      // nor any other circle
      && q.rows.every((o) => {
        if (o.id === r.id) return true;
        const ox = px(o.x), oy = py(o.y), or = rad(o.population);
        const nx = Math.max(b[0], Math.min(ox, b[0] + b[2])), ny = Math.max(b[1], Math.min(oy, b[1] + b[3]));
        return (nx - ox) ** 2 + (ny - oy) ** 2 > or * or;
      });
    const spot = spots.find((sp) => free(sp.box)) || (r.id === current ? spots[0] : null);
    if (spot) placed.push({ id: r.id, text, ...spot });
  }
  const pick = (id) => { onSelect?.(id); document.getElementById("cned-map")?.scrollIntoView({ behavior: "smooth", block: "start" }); };

  return (
    <div className="cn-quad">
      <div className="cn-quad-plot">
        <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={ct("q4_aria", lang)}>
          {/* the four corners */}
          <rect className="qz early" x={M.l} y={M.t} width={px(q.xMed) - M.l} height={py(q.yMed) - M.t} />
          <rect className="qz hot" x={px(q.xMed)} y={M.t} width={W - M.r - px(q.xMed)} height={py(q.yMed) - M.t} />
          <rect className="qz quiet" x={M.l} y={py(q.yMed)} width={px(q.xMed) - M.l} height={H - M.b - py(q.yMed)} />
          <rect className="qz mature" x={px(q.xMed)} y={py(q.yMed)} width={W - M.r - px(q.xMed)} height={H - M.b - py(q.yMed)} />
          {/* the grid and axes */}
          {ticks(xMax).map((v) => <g key={"x" + v}><line className="qg" x1={px(v)} x2={px(v)} y1={M.t} y2={H - M.b} /><text className="qa" x={px(v)} y={H - M.b + 18} textAnchor="middle">{num(v, lang, 0)}</text></g>)}
          {ticks(yMax).map((v) => <g key={"y" + v}><line className="qg" x1={M.l} x2={W - M.r} y1={py(v)} y2={py(v)} /><text className="qa" x={M.l - 8} y={py(v) + 4} textAnchor="end">{num(v, lang, 0)}%</text></g>)}
          <line className="qm" x1={px(q.xMed)} x2={px(q.xMed)} y1={M.t} y2={H - M.b} />
          <line className="qm" x1={M.l} x2={W - M.r} y1={py(q.yMed)} y2={py(q.yMed)} />
          <text className="qt" x={W - M.r} y={H - 8} textAnchor="end">{ct("q4_x", lang)}</text>
          <text className="qt" x={14} y={M.t} transform={`rotate(-90 14 ${M.t})`} textAnchor="end">{ct("q4_y", lang)}</text>
          {/* corner names */}
          <text className="qc early" x={M.l + 10} y={M.t + 20}>{ct("q_early", lang)}</text>
          <text className="qc" x={W - M.r - 10} y={M.t + 20} textAnchor="end">{ct("q_hot", lang)}</text>
          <text className="qc" x={M.l + 10} y={H - M.b - 12}>{ct("q_quiet", lang)}</text>
          <text className="qc" x={W - M.r - 10} y={H - M.b - 12} textAnchor="end">{ct("q_mature", lang)}</text>
          {/* the areas */}
          {drawn.map((r) => (
            <g key={r.id} className={"qb q-" + r.q + (r.id === current ? " sel" : "") + (mineSet.has(r.id) ? " mine" : "") + (hover === r.id ? " hov" : "")}
              onMouseEnter={() => setHover(r.id)} onMouseLeave={() => setHover(null)} onClick={() => pick(r.id)}>
              <circle cx={px(r.x)} cy={py(r.y)} r={rad(r.population)} />
            </g>
          ))}
          {placed.map((l) => (
            <text key={"l" + l.id} className={"ql" + (l.id === current ? " sel" : "")} x={l.x} y={l.y} textAnchor={l.anchor}>{l.text}</text>
          ))}
        </svg>
        {hv && (
          <div className="cn-quad-tip" style={{ left: `${(px(hv.x) / W) * 100}%`, top: `${(py(hv.y) / H) * 100}%` }}>
            <b>{raionName(hv.id, lang)}</b>
            <span>{ct("q4_tip", lang, { x: num(hv.x, lang, 1), y: num(hv.y, lang, 0) })}</span>
            <small>{ct(Q_KEY[hv.q], lang)}</small>
          </div>
        )}
        <p className="cn-quad-key">
          <span><i className="q-early" />{ct("q_early", lang)}</span>
          <span><i className="q-hot" />{ct("q_hot", lang)}</span>
          <span><i className="q-mature" />{ct("q_mature", lang)}</span>
          <span><i className="q-quiet" />{ct("q_quiet", lang)}</span>
          <span className="sz">{ct("q4_size", lang)}</span>
        </p>
      </div>

      <aside className="cn-quad-list">
        <h3>{ct("q4_list_h", lang)}</h3>
        <p className="cn-quad-sub">{ct("q_early", lang)}</p>
        <ol>
          {early.map((r) => {
            const row = byId[r.id];
            const on = mineSet.has(r.id);
            return (
              <li key={r.id} className={r.id === current ? "on" : ""}>
                <button type="button" className="cn-quad-n" onClick={() => pick(r.id)}>{raionName(r.id, lang)}</button>
                <span className="cn-quad-v">
                  <b>+{num(r.y, lang, 0)}%</b>
                  <small>{ct("q4_row", lang, { x: num(r.x, lang, 1), kw: power(row?.growth12?.kw ?? 0, lang) })}</small>
                </span>
                <button type="button" className={"cn-star sm" + (on ? " on" : "")} aria-pressed={on} onClick={() => onToggleMarket?.(r.id)}
                  aria-label={ct(on ? "p_in_market" : "mk_near_add", lang, { x: raionName(r.id, lang) })} title={ct(on ? "p_in_market" : "p_add_market", lang)}>
                  <Star size={14} strokeWidth={2} fill={on ? "currentColor" : "none"} aria-hidden="true" />
                </button>
              </li>
            );
          })}
        </ol>
        <p className="en-note">{ct("q4_note", lang, { x: num(q.xMed, lang, 1), y: num(q.yMed, lang, 0) })}{missing.length ? ` ${ct("q4_missing", lang, { x: missing.join(", ") })}` : ""}</p>
      </aside>
    </div>
  );
}
