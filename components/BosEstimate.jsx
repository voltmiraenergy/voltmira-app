"use client";
// components/BosEstimate.jsx — the balance-of-system materials list:
// DC cable cross-section/length, DC/AC breaker ratings, SPD count.
// lib/bosEstimate.js does the real math (voltage-drop, standard 1.25x
// overcurrent sizing) against the SAME real panel/inverter/string layout
// lib/designCheck.js's engineering annex already validated — this is a
// SPECIFICATION, not a priced BOM line: the catalog has no real
// optimizer/breaker/SPD/cable SKUs, so there's nothing to attach a price to
// (see lib/bosEstimate.js's own comment on why optimizers aren't here at all).
import { useMemo, useState } from "react";
import { designCheck, stringInputs } from "../lib/designCheck.js";
import { dcCableSize, dcCableLengthM, dcBreakerA, acBreakerA, spdCount } from "../lib/bosEstimate.js";
import { railLengthM, clampCount } from "../lib/mountingEstimate.js";

const t3 = (lang, ro, en, ru) => (lang === "en" ? en : lang === "ru" ? ru : ro);

function csvEscape(v) {
  const s = String(v ?? "");
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export default function BosEstimate({ lang, bom, kw, battKwh, consKwh, phases, market, rows: layoutRows }) {
  const [open, setOpen] = useState(false);
  const [runM, setRunM] = useState("15");

  const d = useMemo(() => designCheck({ bom, kw, battKwh, consKwh, phases, market }), [bom, kw, battKwh, consKwh, phases, market]);
  const inputs = useMemo(() => (d.strings > 1 ? stringInputs(d) : stringInputs({ ...d, strings: 1 })), [d]);

  const cable = useMemo(() => dcCableSize({
    oneWayRunM: Number(runM), currentA: d.panel.imp, stringVoltageV: d.perString * d.panel.vmp,
  }), [runM, d]);
  const cableLenM = useMemo(() => dcCableLengthM({ oneWayRunM: Number(runM), strings: d.strings, modules: d.modules }), [runM, d]);
  const dcBreakers = useMemo(() => inputs.map((row) => ({ label: row.label, a: dcBreakerA(row.iscTotalA) })), [inputs]);
  const ac = useMemo(() => acBreakerA(d.acKw, d.ph), [d]);
  const spd = useMemo(() => spdCount({ mpptInputs: d.mppt, inverters: d.nInv }), [d]);
  const railM = useMemo(() => railLengthM(layoutRows), [layoutRows]);
  const clamps = useMemo(() => clampCount(layoutRows), [layoutRows]);
  const hasLayout = Array.isArray(layoutRows) && layoutRows.length > 0;

  if (!open) {
    return (
      <button type="button" className="btn ghost sm" onClick={() => setOpen(true)}>
        {t3(lang, "Deviz materiale (BOS)", "Materials list (BOS)", "Смета материалов (BOS)")}
      </button>
    );
  }

  const rows = [
    { label: t3(lang, "Secțiune cablu DC", "DC cable cross-section", "Сечение кабеля DC"),
      value: cable ? `${cable.crossSectionMm2} mm²${cable.overThreshold ? ` (${t3(lang, "peste 1%!", "over 1%!", "выше 1%!")})` : ""}` : "—",
      note: cable ? `${t3(lang, "cădere de tensiune", "voltage drop", "падение напряжения")} ${cable.voltageDropPct.toFixed(2)}%` : "" },
    { label: t3(lang, "Metraj cablu DC estimat", "Estimated DC cable length", "Расчётная длина кабеля DC"),
      value: `${cableLenM.toLocaleString(lang === "ru" ? "ru-RU" : "ro-RO")} m`, note: "" },
    { label: t3(lang, "Întrerupătoare DC", "DC breakers", "Автоматы DC"),
      value: dcBreakers.map((b) => `${b.label}: ${b.a != null ? b.a + "A" : "—"}`).join(" · "), note: "" },
    { label: t3(lang, "Întrerupător AC", "AC breaker", "Автомат AC"),
      value: ac != null ? `${ac}A × ${d.nInv}` : "—", note: "" },
    { label: t3(lang, "Protecții supratensiune (SPD)", "Surge protection (SPD)", "Защита от перенапряжения (SPD)"),
      value: `${spd.dc}× DC (Tip 2) · ${spd.ac}× AC (Tip 2)`, note: "" },
    ...(hasLayout ? [
      { label: t3(lang, "Șine montaj (lungime totală)", "Mounting rail (total length)", "Монтажные рейки (общая длина)"),
        value: `${railM.toLocaleString(lang === "ru" ? "ru-RU" : "ro-RO", { maximumFractionDigits: 1 })} m`, note: "" },
      { label: t3(lang, "Cleme montaj", "Mounting clamps", "Крепёжные клеммы"),
        value: `${clamps.total}× (${clamps.end} ${t3(lang, "capăt", "end", "торцевых")} + ${clamps.mid} ${t3(lang, "mijloc", "mid", "промежуточных")})`, note: "" },
    ] : []),
  ];

  function exportCsv() {
    const lines = [[t3(lang, "Articol", "Item", "Позиция"), t3(lang, "Valoare", "Value", "Значение"), t3(lang, "Notă", "Note", "Примечание")]
      .map(csvEscape).join(",")];
    rows.forEach((r) => lines.push([r.label, r.value, r.note].map(csvEscape).join(",")));
    const blob = new Blob(["﻿" + lines.join("\r\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "deviz-materiale-bos.csv";
    document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url);
  }

  return (
    <section className="card bos-card">
      <div className="bos-head">
        <h4>{t3(lang, "Deviz materiale (BOS)", "Materials list (BOS)", "Смета материалов (BOS)")}</h4>
        <button type="button" className="btn ghost sm" onClick={() => setOpen(false)}>✕</button>
      </div>
      <p className="bos-note">
        {t3(lang,
          "Calculat din stringurile și invertorul reale din deviz (cădere de tensiune reală pe cablu, dimensionare întrerupătoare la 1,25× curentul de scurtcircuit, practică standard). Nu include optimizatoare de putere: catalogul nu are niciun invertor din acea clasă, deci nu există un produs real de recomandat. Rezultatul e o specificație (secțiune, calibru, cantitate) pentru echipa ta să cumpere, nu un articol de deviz cu preț.",
          "Computed from the real strings and inverter already in the BOM (real cable voltage-drop, breakers sized at 1.25× short-circuit current, standard practice). Doesn't include power optimizers: the catalog has no inverter in that class, so there's no real product to recommend. The result is a specification (cross-section, rating, quantity) for your team to buy, not a priced BOM line.",
          "Рассчитано по реальным стрингам и инвертору из сметы (реальное падение напряжения на кабеле, автоматы рассчитаны на 1,25× тока короткого замыкания). Не включает оптимизаторы мощности, в каталоге нет инвертора такого класса. Результат, спецификация (сечение, номинал, количество), не позиция сметы с ценой.")}
      </p>
      {!hasLayout && (
        <p className="bos-note">
          {t3(lang,
            "Șine/cleme apar aici după ce desenezi acoperișul real în Proiectare amplasament: lungimea și numărul depind de layout-ul real al panourilor, nu de un rând ipotetic.",
            "Rail/clamp figures appear here once you draw the real roof in Site Designer: the length and count depend on the actual panel layout, not a hypothetical row.",
            "Данные по рейкам/клеммам появятся после того, как вы нарисуете реальную крышу в Проектировании: длина и количество зависят от реальной раскладки панелей.")}
        </p>
      )}

      <div className="field" style={{ maxWidth: 220, marginBottom: 14 }}>
        <label>{t3(lang, "Traseu cablu (acoperiș → invertor, m)", "Cable run (roof → inverter, m)", "Трасса кабеля (крыша → инвертор, м)")}</label>
        <input className="input" type="number" min="1" step="1" value={runM} onChange={(e) => setRunM(e.target.value)} />
      </div>

      <table className="bos-table"><tbody>
        {rows.map((r) => (
          <tr key={r.label}>
            <td>{r.label}</td>
            <td><b>{r.value}</b>{r.note ? <span className="bos-sub"> · {r.note}</span> : null}</td>
          </tr>
        ))}
      </tbody></table>

      <div className="bos-foot">
        <button type="button" className="btn ghost" onClick={exportCsv}>{t3(lang, "Exportă Excel (CSV)", "Export Excel (CSV)", "Экспорт Excel (CSV)")}</button>
        <button type="button" className="btn primary" onClick={() => window.print()}>{t3(lang, "Exportă PDF", "Export PDF", "Экспорт PDF")}</button>
      </div>

      <style dangerouslySetInnerHTML={{ __html: `
        .bos-card{margin-top:16px}
        .bos-head{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:6px}
        .bos-head h4{margin:0;font-size:14px}
        .bos-note{font-size:12px;color:var(--muted);line-height:1.55;margin:0 0 14px}
        .bos-table{width:100%;border-collapse:collapse;font-size:13px;margin-bottom:16px}
        .bos-table td{padding:8px 0;border-bottom:1px solid var(--line)}
        .bos-table td:first-child{color:var(--muted);width:46%}
        .bos-table tr:last-child td{border-bottom:none}
        .bos-sub{color:var(--muted);font-size:11.5px;font-weight:400}
        .bos-foot{display:flex;justify-content:flex-end;gap:8px}
        @media print{
          body *{visibility:hidden}
          .bos-table,.bos-table *{visibility:visible}
          .bos-table{position:fixed;inset:24px;width:auto}
        }
      ` }} />
    </section>
  );
}
