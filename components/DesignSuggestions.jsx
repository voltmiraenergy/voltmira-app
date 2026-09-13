"use client";
// components/DesignSuggestions.jsx — every inverter that could serve this
// array, compared side by side, instead of the one already sitting in the BOM.
//
// The comparison itself (lib/inverterOptions.js) reports two real, computable
// numbers per candidate: the nominal power ratio (DC/AC) and "energy capture"
// — the honest analogue of a black-box "profitability" score, spelled out as
// what it actually is: the share of the array's output this combination
// doesn't clip away. Picking a row replaces the BOM's inverter line; nothing
// here writes to the BOM on its own.
import { useMemo, useState } from "react";
import { designCheck } from "../lib/designCheck.js";
import { inverterOptions } from "../lib/inverterOptions.js";

const t3 = (lang, ro, en, ru) => (lang === "en" ? en : lang === "ru" ? ru : ro);

/**
 * @param {Array}  bom        current bill of materials (reads the panel line
 *   for the array's real DC power; falls back to `kw` with no BOM)
 * @param {number} kw, battKwh, phases   same inputs DesignChecks takes
 * @param {(row:{inverter,count,acKw,dcac,capturePct,hybrid})=>void} onApply
 */
export default function DesignSuggestions({ lang, bom, kw, battKwh, phases, onApply, className = "card" }) {
  const [open, setOpen] = useState(false);
  const d = useMemo(() => designCheck({ bom, kw, battKwh, phases }), [bom, kw, battKwh, phases]);
  const rows = useMemo(
    () => inverterOptions({ dcKw: d.dcKw, phases: d.ph, wantHybrid: battKwh > 0 }),
    [d.dcKw, d.ph, battKwh],
  );

  if (!open) {
    // Same card frame as the open state (and everything else on this page) —
    // a bare button sitting directly on the page background, between two
    // cards, read as a stray control rather than part of the flow.
    return (
      <section className={className + " ds-closed"}>
        <button type="button" className="btn ghost sm ds-trigger" onClick={() => setOpen(true)}>
          {t3(lang, "Sugestii de proiectare — compară invertoare", "Design suggestions — compare inverters", "Варианты дизайна — сравнить инверторы")}
        </button>
      </section>
    );
  }

  return (
    <section className={className + " ds-panel"}>
      <div className="ds-head">
        <h3 style={{ margin: 0 }}>{t3(lang, "Sugestii de proiectare", "Design suggestions", "Варианты дизайна")}</h3>
        <button type="button" className="btn ghost sm" onClick={() => setOpen(false)}>
          {t3(lang, "închide", "close", "закрыть")}
        </button>
      </div>
      <p className="ds-lead">
        {t3(lang,
          `Fiecare combinație de invertoare care poate deservi acest array de ${d.dcKw.toFixed(1)} kWp — nu doar cea aleasă acum. „Captură energetică” arată cât din producție NU se pierde prin limitare — nu o estimare de profitabilitate.`,
          `Every inverter combination that can serve this ${d.dcKw.toFixed(1)} kWp array — not just the one currently picked. "Energy capture" is how much of the output ISN'T lost to clipping — not a profitability estimate.`,
          `Все комбинации инверторов для этого массива ${d.dcKw.toFixed(1)} кВт·п. «Захват энергии» — доля выработки, не потерянная на ограничении, а не оценка доходности.`)}
      </p>

      {rows.length === 0 ? (
        <div className="ds-empty">
          {t3(lang, "Niciun invertor din baza de date se potrivește acestei puteri/faze.", "No inverter in the database fits this size/phase.", "В базе нет подходящего инвертора для этой мощности/фазы.")}
        </div>
      ) : (
        <div className="ds-scroll">
          <table className="ds-table"><tbody>
            <tr>
              <th>{t3(lang, "Invertor", "Inverter", "Инвертор")}</th>
              <th>{t3(lang, "Buc.", "Units", "Шт.")}</th>
              <th>{t3(lang, "Raport putere", "Power ratio", "Коэфф. мощности")}</th>
              <th>{t3(lang, "Captură energetică", "Energy capture", "Захват энергии")}</th>
              <th>{t3(lang, "Putere AC", "AC power", "Мощность AC")}</th>
              <th aria-hidden="true"></th>
            </tr>
            {rows.map((r, i) => (
              <tr key={i} className={r.clipPct > 8 ? "warn" : ""}>
                <td>
                  <b>{r.inverter.brand} {r.inverter.model}</b>
                  {r.hybrid && <span className="ds-tag">hybrid</span>}
                </td>
                <td>× {r.count}</td>
                <td>{Math.round(r.dcac * 100)}%</td>
                <td>
                  <span className="ds-bar"><i style={{ width: r.capturePct + "%" }} /></span>
                  {r.capturePct}%
                </td>
                <td>{r.acKw.toFixed(2)} kW</td>
                <td>
                  <button type="button" className="btn primary sm" onClick={() => { onApply(r); setOpen(false); }}>
                    {t3(lang, "Aplică", "Apply", "Применить")}
                  </button>
                </td>
              </tr>
            ))}
          </tbody></table>
        </div>
      )}

      <style dangerouslySetInnerHTML={{ __html: `
        .ds-trigger{width:100%}
        .ds-panel{margin-top:10px}
        .ds-head{display:flex;align-items:center;justify-content:space-between;margin-bottom:6px}
        .ds-lead{font-size:12px;color:var(--muted);margin:0 0 12px;max-width:74ch;line-height:1.55}
        .ds-empty{font-size:12.5px;color:var(--muted);padding:12px;text-align:center;
          background:var(--paper);border:1px dashed var(--line);border-radius:10px}
        .ds-scroll{overflow-x:auto}
        .ds-table{width:100%;border-collapse:collapse;font-size:12.5px;white-space:nowrap}
        .ds-table th{text-align:left;font-size:10px;text-transform:uppercase;letter-spacing:.04em;
          color:var(--muted);padding:6px 9px;border-bottom:1px solid var(--line)}
        .ds-table td{padding:8px 9px;border-bottom:1px solid var(--line);vertical-align:middle;color:var(--ink)}
        .ds-table tr.warn td{background:var(--amber-tint)}
        .ds-tag{margin-left:6px;font-size:9.5px;font-weight:700;text-transform:uppercase;letter-spacing:.03em;
          color:var(--green);background:var(--green-tint);border-radius:99px;padding:2px 6px}
        .ds-bar{display:inline-block;width:46px;height:6px;background:var(--line);border-radius:99px;
          overflow:hidden;vertical-align:middle;margin-right:6px}
        .ds-bar i{display:block;height:100%;background:var(--green)}
      ` }} />
    </section>
  );
}
