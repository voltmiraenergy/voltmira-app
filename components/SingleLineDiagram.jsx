"use client";
// components/SingleLineDiagram.jsx — a real single-line electrical diagram
// (schiță monofilară): individual PV strings → string fuses → per-input DC
// disconnect+breaker → DC bus → DC disconnect → inverter → (battery branch,
// if any) → AC disconnect → AC breaker → RCD → AC SPD → bidirectional meter
// → main panel/earth → grid. Every number comes from the SAME real
// computation the editor's own "Verificări de proiectare" card and
// BosEstimate.jsx already show (lib/designCheck.js's designCheck()/
// stringInputs(), lib/bosEstimate.js's breaker/cable sizing) — never a
// second, separately-guessed set of numbers for this one view. With no real
// inverter in the BOM yet, designCheck() itself falls back to a
// representative one and says so (see fromBom below) — same honesty status
// as every other engineering view in this app.
//
// Real, standard PV wiring conventions this reproduces (not invented per
// project): a string fuse is only needed once 3+ strings parallel onto one
// input (below that, a fault current can't exceed a string's own rating —
// the same reasoning IEC 60364-7-712 / PUE-based practice uses); a DC and an
// AC disconnect switch are both required local means of isolation next to
// the inverter; an RCD is standard on the AC output of a PV inverter.
import { useMemo, useState } from "react";
import { designCheck, stringInputs } from "../lib/designCheck.js";
import { dcBreakerA, acBreakerA, spdCount, dcCableSize } from "../lib/bosEstimate.js";

const t3 = (lang, ro, en, ru) => (lang === "en" ? en : lang === "ru" ? ru : ro);
// Fixed document colors, NOT the app's live --ink/--muted theme variables:
// .sld-wrap is always a white "printed page" background regardless of the
// app's own light/dark mode, and in dark mode --ink resolves to a near-white
// value meant for a dark background — used here, it printed invisible
// white-on-white text (the actual bug a "why are some labels missing"
// report traced back to). Same reasoning as .ld-print-doc's hardcoded
// color:#000 below.
const INK = "#142A21", MUTED = "#66756C", LINE = "#E3E1D6", BOXFILL = "#F1EFE6";

function Box({ x, y, w, h, children, sub, dashed, small }) {
  return (
    <g>
      <rect x={x} y={y} width={w} height={h} rx="6" fill={BOXFILL} stroke={LINE}
        strokeWidth="1.5" strokeDasharray={dashed ? "4 3" : undefined} />
      <text x={x + w / 2} y={y + h / 2 - (sub ? 6 : 0)} textAnchor="middle" dominantBaseline="middle"
        fontSize={small ? "9.5" : "11.5"} fontWeight="700" fill={INK}>{children}</text>
      {sub && <text x={x + w / 2} y={y + h / 2 + 12} textAnchor="middle" dominantBaseline="middle"
        fontSize="9.5" fill={MUTED}>{sub}</text>}
    </g>
  );
}
function Wire({ x1, y1, x2, y2, dash }) {
  return <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={INK} strokeWidth="1.5" strokeDasharray={dash ? "3 2" : undefined} />;
}
/** Overcurrent breaker: circle with a diagonal stroke. */
function Breaker({ x, y, label }) {
  return (
    <g>
      <circle cx={x} cy={y} r="7" fill="#fff" stroke={INK} strokeWidth="1.5" />
      <line x1={x - 5} y1={y + 5} x2={x + 5} y2={y - 5} stroke={INK} strokeWidth="1.5" />
      {label && <text x={x} y={y - 13} textAnchor="middle" fontSize="9" fontWeight="700" fill={INK}>{label}</text>}
    </g>
  );
}
/** Fuse: a small rectangle with a line through it, on the wire. */
function Fuse({ x, y, vertical }) {
  const w = 12, h = 6;
  return vertical
    ? <g><rect x={x - h / 2} y={y - w / 2} width={h} height={w} fill="#fff" stroke={INK} strokeWidth="1.3" /><line x1={x} y1={y - w / 2} x2={x} y2={y + w / 2} stroke={INK} strokeWidth="1.3" /></g>
    : <g><rect x={x - w / 2} y={y - h / 2} width={w} height={h} fill="#fff" stroke={INK} strokeWidth="1.3" /><line x1={x - w / 2} y1={y} x2={x + w / 2} y2={y} stroke={INK} strokeWidth="1.3" /></g>;
}
/** Local disconnect switch: a hinged line, open at an angle — the standard
 *  isolator symbol, distinct from a breaker (no fault-clearing capability). */
function Disconnect({ x, y, label }) {
  return (
    <g>
      <circle cx={x - 8} cy={y} r="2" fill={INK} />
      <circle cx={x + 8} cy={y} r="2" fill={INK} />
      <line x1={x - 8} y1={y} x2={x + 7} y2={y - 9} stroke={INK} strokeWidth="1.5" />
      {label && <text x={x} y={y - 16} textAnchor="middle" fontSize="9" fontWeight="700" fill={INK}>{label}</text>}
    </g>
  );
}
/** RCD (residual-current device): a breaker circle with an inner "d" mark. */
function Rcd({ x, y, label }) {
  return (
    <g>
      <circle cx={x} cy={y} r="8" fill="#fff" stroke={INK} strokeWidth="1.5" />
      <text x={x} y={y + 3.5} textAnchor="middle" fontSize="9" fontWeight="800" fill={INK}>Id</text>
      {label && <text x={x} y={y - 15} textAnchor="middle" fontSize="9" fontWeight="700" fill={INK}>{label}</text>}
    </g>
  );
}
/** Protective earth: the standard three-descending-bar ground symbol. */
function Earth({ x, y }) {
  const bars = [10, 6.5, 3.5];
  return (
    <g>
      <line x1={x} y1={y} x2={x} y2={y + 10} stroke={INK} strokeWidth="1.5" />
      {bars.map((wBar, i) => (
        <line key={i} x1={x - wBar / 2} y1={y + 10 + i * 4} x2={x + wBar / 2} y2={y + 10 + i * 4} stroke={INK} strokeWidth="1.5" />
      ))}
    </g>
  );
}

export default function SingleLineDiagram({ lang, bom, kw, battKwh, hasBattery, consKwh, phases, market, projectTitle, projectAddress }) {
  const [runM, setRunM] = useState("15");
  const d = useMemo(() => designCheck({ bom, kw, battKwh, consKwh, phases, market }), [bom, kw, battKwh, consKwh, phases, market]);
  const inputs = useMemo(() => (d.strings > 1 ? stringInputs(d) : stringInputs({ ...d, strings: 1 })), [d]);
  const dcRatings = useMemo(() => inputs.map((row) => dcBreakerA(row.iscTotalA)), [inputs]);
  const acA = useMemo(() => acBreakerA(d.acKw, d.ph), [d]);
  const spd = useMemo(() => spdCount({ mpptInputs: d.mppt, inverters: d.nInv }), [d]);
  const cable = useMemo(() => dcCableSize({
    oneWayRunM: Number(runM), currentA: d.panel.imp, stringVoltageV: d.perString * d.panel.vmp,
  }), [runM, d]);
  const hasBatt = hasBattery ?? (Number(battKwh) > 0);

  // --- layout, computed from real content so nothing overlaps ---
  const rowH = 30, stringGap = 6, inputGap = 22;
  let y = 46;
  const inputRows = inputs.map((row) => {
    const nStrings = row.strings;
    const needsFuse = nStrings >= 3; // fault current can't exceed one string's rating below 3 in parallel
    const stringYs = Array.from({ length: nStrings }, (_, i) => y + i * (rowH + stringGap) + rowH / 2);
    const top = y, bottom = stringYs[stringYs.length - 1];
    const inputMidY = (top + bottom) / 2 + rowH / 2 - rowH / 2;
    const r = { ...row, needsFuse, stringYs, top, mid: (stringYs[0] + stringYs[stringYs.length - 1]) / 2 };
    y = bottom + rowH / 2 + inputGap;
    return r;
  });
  const svgH = Math.max(260, y + (hasBatt ? 90 : 20));
  const busYtop = inputRows[0].stringYs[0];
  const busYbot = inputRows[inputRows.length - 1].mid;
  const invMidY = (busYtop + busYbot) / 2;

  const stringX = 10, stringW = 108;
  const fuseX = stringX + stringW + 20;
  const inBrkX = fuseX + 24;
  const busX = inBrkX + 34;
  const dcDiscX = busX + 44;
  const invX = dcDiscX + 40, invW = 168, invH = 60, invY = invMidY - invH / 2;
  const battX = invX + invW / 2 - 34, battY = invY + invH + 40, battW = 68, battH = 34;
  const acDiscX = invX + invW + 40;
  const acBrkX = acDiscX + 42;
  const rcdX = acBrkX + 44;
  const spdX = rcdX + 44, spdW = 40;
  const meterX = spdX + spdW + 16, meterW = 88;
  const panelX = meterX + meterW + 50, panelW = 14, panelH = 70;
  const gridX = panelX + 60;

  return (
    <div className="sld-wrap">
      <div className="sld-title">
        <div>
          <b>{projectTitle || t3(lang, "Proiect", "Project", "Проект")}</b>
          {projectAddress && <div className="sld-addr">{projectAddress}</div>}
        </div>
        <span>{t3(lang, "Schiță monofilară", "Single-line diagram", "Однолинейная схема")} · {new Date().toLocaleDateString(lang === "ru" ? "ru-RU" : "ro-RO")}</span>
      </div>

      <svg viewBox={`0 0 ${gridX + 90} ${svgH}`} width="100%" height="auto" role="img">
        {inputRows.map((row) => (
          <g key={row.label}>
            {row.stringYs.map((sy, si) => (
              <g key={si}>
                <Box x={stringX} y={sy - rowH / 2} w={stringW} h={rowH} small
                  sub={`${row.modulesPerString}× · Voc ${d.panel.voc}V`}>
                  {t3(lang, "Șir", "String", "Строка")} {row.label}{row.strings > 1 ? si + 1 : ""}
                </Box>
                {row.needsFuse
                  ? <><Wire x1={stringX + stringW} y1={sy} x2={fuseX - 6} y2={sy} /><Fuse x={fuseX} y={sy} /><Wire x1={fuseX + 6} y1={sy} x2={inBrkX - 8} y2={sy} /></>
                  : <Wire x1={stringX + stringW} y1={sy} x2={inBrkX - 8} y2={sy} />}
                {row.strings > 1 && <Wire x1={inBrkX - 8} y1={sy} x2={inBrkX - 8} y2={row.mid} />}
              </g>
            ))}
            <Breaker x={inBrkX} y={row.mid} label={dcRatings[inputRows.indexOf(row)] != null ? `${dcRatings[inputRows.indexOf(row)]}A` : "—"} />
            <Wire x1={inBrkX + 7} y1={row.mid} x2={busX} y2={row.mid} />
            <Wire x1={busX} y1={row.mid} x2={busX} y2={invMidY} />
          </g>
        ))}
        <Wire x1={busX} y1={busYtop} x2={busX} y2={busYbot} />
        <Wire x1={busX} y1={invMidY} x2={dcDiscX - 9} y2={invMidY} />
        <Disconnect x={dcDiscX} y={invMidY} label={t3(lang, "sep. CC", "DC disc.", "разъед. DC")} />
        <Wire x1={dcDiscX + 8} y1={invMidY} x2={invX} y2={invMidY} />

        <Box x={invX} y={invY} w={invW} h={invH} small={!!d.inverter}
          sub={d.inverter ? `${d.acKw.toFixed(1)} kW · ${d.ph === 3 ? "3~" : "1~"} · MPPT×${d.mppt}` : t3(lang, "reprezentativ", "representative", "условный")}>
          {d.inverter ? `${d.inverter.brand} ${d.inverter.model}` : t3(lang, "Invertor", "Inverter", "Инвертор")}
        </Box>

        {hasBatt && (
          <g>
            <Wire x1={invX + invW / 2} y1={invY + invH} x2={invX + invW / 2} y2={battY - 9} />
            <Breaker x={invX + invW / 2} y={battY - 17} label="" />
            <Box x={battX} y={battY} w={battW} h={battH} small sub={`${Number(battKwh || 0).toFixed(1)} kWh`}>
              {t3(lang, "Baterie", "Battery", "Батарея")}
            </Box>
          </g>
        )}

        <Wire x1={invX + invW} y1={invMidY} x2={acDiscX - 9} y2={invMidY} />
        <Disconnect x={acDiscX} y={invMidY} label={t3(lang, "sep. CA", "AC disc.", "разъед. AC")} />
        <Wire x1={acDiscX + 8} y1={invMidY} x2={acBrkX - 8} y2={invMidY} />
        <Breaker x={acBrkX} y={invMidY} label={acA != null ? `${acA}A×${d.nInv}` : "—"} />
        <Wire x1={acBrkX + 7} y1={invMidY} x2={rcdX - 9} y2={invMidY} />
        <Rcd x={rcdX} y={invMidY} label="RCD" />
        <Wire x1={rcdX + 9} y1={invMidY} x2={spdX - 14} y2={invMidY} />

        <Box x={spdX} y={invMidY - 16} w={spdW} h={32} dashed sub="">SPD</Box>
        <text x={spdX + spdW / 2} y={invMidY + 28} textAnchor="middle" fontSize="9" fill={MUTED}>{spd.dc}DC+{spd.ac}AC</text>
        <Wire x1={spdX + spdW} y1={invMidY} x2={meterX} y2={invMidY} />

        <Box x={meterX} y={invMidY - 20} w={meterW} h={40} sub={t3(lang, "bidirecțional", "bidirectional", "двунаправленный")}>
          {t3(lang, "Contor", "Meter", "Счётчик")}
        </Box>
        <Wire x1={meterX + meterW} y1={invMidY} x2={panelX} y2={invMidY} />

        {/* main distribution board, with a protective-earth branch to the frame */}
        <rect x={panelX} y={invMidY - panelH / 2} width={panelW} height={panelH} fill={BOXFILL} stroke={LINE} strokeWidth="1.5" />
        <Wire x1={panelX + panelW / 2} y1={invMidY + panelH / 2} x2={panelX + panelW / 2} y2={invMidY + panelH / 2 + 14} />
        <Earth x={panelX + panelW / 2} y={invMidY + panelH / 2 + 14} />
        <text x={panelX + panelW / 2} y={invMidY - panelH / 2 - 8} textAnchor="middle" fontSize="9.5" fontWeight="700" fill={INK}>
          {t3(lang, "Tablou", "Panel", "Щит")}
        </text>
        <Wire x1={panelX + panelW} y1={invMidY} x2={gridX} y2={invMidY} />

        <line x1={gridX} y1={invMidY - 16} x2={gridX} y2={invMidY + 16} stroke={INK} strokeWidth="2" />
        {[-10, -3, 4].map((dy) => (
          <line key={dy} x1={gridX} y1={invMidY + dy} x2={gridX + 14} y2={invMidY + dy + 7} stroke={INK} strokeWidth="1.5" />
        ))}
        <text x={gridX + 4} y={invMidY + 38} textAnchor="middle" fontSize="10.5" fontWeight="700" fill={INK}>
          {t3(lang, "Rețea", "Grid", "Сеть")}
        </text>
      </svg>

      <div className="sld-legend">
        <div><span>{t3(lang, "Panou", "Panel", "Панель")}</span><b>{d.panel.brand} {d.panel.model} ({d.panel.watt} W, Voc {d.panel.voc}V, Isc {d.panel.isc}A)</b></div>
        <div><span>{t3(lang, "Total module", "Total modules", "Всего модулей")}</span><b>{d.modules} ({d.dcKw.toFixed(1)} kWp)</b></div>
        <div><span>{t3(lang, "Raport DC/AC", "DC/AC ratio", "Соотношение DC/AC")}</span><b>{d.dcac.toFixed(2)}</b></div>
      </div>

      <div className="sld-cable-row">
        <label>{t3(lang, "Traseu cablu CC (m)", "DC cable run (m)", "Трасса кабеля DC (м)")}</label>
        <input className="input" type="number" min="1" step="1" value={runM} onChange={(e) => setRunM(e.target.value)} />
        {cable && (
          <span className="sld-cable-out">
            {t3(lang, "Secțiune recomandată", "Recommended section", "Рекомендуемое сечение")}: <b>{cable.crossSectionMm2} mm²</b>
            {" "}({t3(lang, "cădere", "drop", "падение")} {cable.voltageDropPct.toFixed(2)}%{cable.overThreshold ? `, ${t3(lang, "peste 1%!", "over 1%!", "выше 1%!")}` : ""})
          </span>
        )}
      </div>

      <div className="sld-key">
        <b>{t3(lang, "Legendă", "Legend", "Легенда")}:</b>{" "}
        {t3(lang,
          "cerc tăiat = întrerupător · dreptunghi mic = siguranță fuzibilă · balama = separator local · Id = protecție diferențială (RCD) · casetă punctată = descărcător supratensiune (SPD) · bare descrescătoare = împământare de protecție.",
          "slashed circle = breaker · small rectangle = fuse · hinge = local disconnect switch · Id = residual-current device (RCD) · dashed box = surge protection (SPD) · descending bars = protective earth.",
          "перечёркнутый круг = автомат · маленький прямоугольник = предохранитель · шарнир = местный разъединитель · Id = УЗО · пунктирная рамка = защита от перенапряжения (SPD) · убывающие полосы = защитное заземление.")}
      </div>

      {!d.fromBom.inverter && (
        <p className="sld-note">
          {t3(lang,
            "Niciun invertor real în deviz încă, schița folosește un model reprezentativ. Adaugă invertorul real în Echipament & Deviz pentru o schiță exactă.",
            "No real inverter in the BOM yet, this diagram uses a representative model. Add the real inverter in Equipment & BOM for an accurate diagram.",
            "В смете пока нет реального инвертора, схема использует условную модель. Добавьте реальный инвертор в разделе Оборудование и смета для точной схемы.")}
        </p>
      )}

      <style dangerouslySetInnerHTML={{ __html: `
        .sld-wrap{background:#fff;color:${INK};border:1px solid ${LINE};border-radius:10px;padding:18px;
          font-family:'Inter',system-ui,sans-serif}
        .sld-title{display:flex;justify-content:space-between;align-items:flex-start;gap:10px;margin-bottom:10px;font-size:13px}
        .sld-title span{color:${MUTED};font-size:11.5px;white-space:nowrap}
        .sld-addr{color:${MUTED};font-size:11px;margin-top:2px}
        .sld-legend{display:flex;gap:20px;flex-wrap:wrap;margin-top:14px;padding-top:12px;border-top:1px solid ${LINE};font-size:11.5px}
        .sld-legend div{display:flex;flex-direction:column;gap:2px}
        .sld-legend span{color:${MUTED};font-size:10.5px}
        .sld-cable-row{display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-top:12px;font-size:12px}
        .sld-cable-row label{color:${MUTED};font-size:11px}
        .sld-cable-row input{width:70px;padding:5px 8px;border:1px solid ${LINE};border-radius:6px;font-size:12px;color:${INK};background:#fff}
        .sld-cable-out{color:${INK}}
        .sld-key{font-size:10.5px;color:${MUTED};line-height:1.5;margin-top:12px}
        .sld-note{font-size:11.5px;color:#B4472F;margin:12px 0 0}
        @media print{
          .sld-wrap{border:none}
          .sld-cable-row input{border:none;background:none}
        }
      ` }} />
    </div>
  );
}
