"use client";
// app/(app)/dashboard/TrendChart.jsx — the 6-month Sent-vs-Won card, with a
// Count / € toggle. Counts answer "how many deals moved", € answers "how much
// money moved" — often the more important of the two, and they can tell opposite
// stories (many small quotes sent, one big deal won). All data is precomputed
// server-side; this component only switches which series it draws.
import { useState } from "react";

const CW = 560, CH = 150, cBase = CH - 24, cPlot = cBase - 16, cGroup = CW / 6, cBar = 18;

// Compact money for bar captions: €12.4k / €980, so labels never overrun a bar.
function eurShort(n) {
  if (n >= 1000) return "€" + (n / 1000).toFixed(n >= 10000 ? 0 : 1).replace(".", ",") + "k";
  return "€" + Math.round(n);
}

export default function TrendChart({ months, title, sentLabel, wonLabel }) {
  const [mode, setMode] = useState("count"); // "count" | "eur"
  const eur = mode === "eur";
  const val = (m) => (eur ? { s: m.sentEur, w: m.wonEur } : { s: m.sent, w: m.won });
  const cap = (n) => (eur ? (n ? eurShort(n) : "") : (n || ""));
  const mMax = Math.max(1, ...months.map((m) => { const v = val(m); return Math.max(v.s, v.w); }));

  // .tr-tab carries a coarse-pointer min-height in AppTheme — inline styles alone
  // left these at 27px, too small to hit reliably on a phone.
  const tab = (m, label) => (
    <button type="button" className="tr-tab" onClick={() => setMode(m)} aria-pressed={mode === m}
      style={{ border: "1px solid var(--line)", background: mode === m ? "var(--ink)" : "var(--paper-2)",
        color: mode === m ? "#fff" : "var(--muted)", fontSize: 12, fontWeight: 600, padding: "5px 11px",
        borderRadius: 8, cursor: "pointer", fontFamily: "inherit" }}>{label}</button>
  );

  return (
    <section className="card">
      <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", marginBottom: 6 }}>
        <h3 style={{ margin: 0 }}>{title}</h3>
        <span className="spacer" style={{ flex: 1 }} />
        <span className="tr-leg"><i style={{ background: "var(--blue)" }} />{sentLabel}</span>
        <span className="tr-leg"><i style={{ background: "var(--green)" }} />{wonLabel}</span>
        <span style={{ display: "inline-flex", gap: 4, marginLeft: 4 }}>{tab("count", "Nr.")}{tab("eur", "€")}</span>
      </div>
      <svg viewBox={`0 0 ${CW} ${CH}`} role="img" aria-label={title} style={{ width: "100%", height: "auto", display: "block" }}>
        <line x1="0" y1={cBase} x2={CW} y2={cBase} stroke="var(--line)" strokeWidth="1" />
        {months.map((m, i) => {
          const v = val(m);
          const cx = i * cGroup + cGroup / 2;
          const hS = Math.round((v.s / mMax) * cPlot), hW = Math.round((v.w / mMax) * cPlot);
          return (
            <g key={i}>
              <rect x={cx - cBar - 3} y={cBase - hS} width={cBar} height={hS} rx="4" fill="var(--blue)" opacity=".85" />
              {v.s ? <text x={cx - cBar / 2 - 3} y={cBase - hS - 5} textAnchor="middle" fontSize="10.5" fill="var(--muted)">{cap(v.s)}</text> : null}
              <rect x={cx + 3} y={cBase - hW} width={cBar} height={hW} rx="4" fill="var(--green)" opacity=".9" />
              {v.w ? <text x={cx + 3 + cBar / 2} y={cBase - hW - 5} textAnchor="middle" fontSize="10.5" fill="var(--muted)">{cap(v.w)}</text> : null}
              <text x={cx} y={CH - 7} textAnchor="middle" fontSize="11.5" fill="var(--muted)">{m.lbl}</text>
            </g>
          );
        })}
      </svg>
    </section>
  );
}
