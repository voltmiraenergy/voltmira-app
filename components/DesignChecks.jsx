"use client";
// components/DesignChecks.jsx — the engineering checks, as the installer's card.
//
// The maths and the wording both live in lib/designCheck.js, because the
// client's proposal PDF prints these same rows as an engineering annex. This
// file is only the on-screen presentation of them.
import { useMemo } from "react";
import { designCheck, designCheckRows, designCheckLead, stringInputs } from "../lib/designCheck.js";

const t3 = (lang, ro, en, ru) => (lang === "en" ? en : lang === "ru" ? ru : ro);

export default function DesignChecks({ lang, bom, kw, battKwh, consKwh, phases, market, className = "card" }) {
  const d = useMemo(() => designCheck({ bom, kw, battKwh, consKwh, phases, market }), [bom, kw, battKwh, consKwh, phases, market]);
  const rows = useMemo(() => designCheckRows(d, { lang, battKwh }), [d, lang, battKwh]);
  // Per-MPPT-input breakdown — "Input A / Input B" — only worth its own table
  // once there's an actual split to show; one string is just the row above.
  const inputs = useMemo(() => (d.strings > 1 ? stringInputs(d) : []), [d]);

  const allClear = rows.every((r) => r.ok);

  return (
    <section className={className}>
      <h3>{t3(lang, "Verificări de proiectare", "Design checks", "Проверки проекта")}</h3>
      <p className="dc-lead">{designCheckLead(d, lang)}</p>

      <ul className="dc-list">
        {rows.map((r, i) => (
          <li key={i} className={r.ok ? "ok" : "warn"}>
            <span className="dc-dot">{r.ok ? "✓" : "!"}</span>
            <div className="dc-body">
              <div className="dc-line"><span className="dc-label">{r.label}</span><b className={r.ok ? "" : "bad"}>{r.value}</b></div>
              <div className="dc-detail">
                {r.detail}
                {r.note ? <> · <i>{r.note}</i></> : null}
                {r.warn ? <> — <em>{r.warn}</em></> : null}
              </div>
            </div>
          </li>
        ))}
      </ul>

      {inputs.length > 1 && (
        <div className="dc-inputs">
          <div className="dc-in-cap">{t3(lang, "Repartizare pe intrări MPPT", "Split across MPPT inputs", "Разбивка по входам MPPT")}</div>
          <div className="dc-in-grid" style={{ gridTemplateColumns: `repeat(${inputs.length}, 1fr)` }}>
            {inputs.map((r) => (
              <div key={r.label} className={"dc-in" + (r.ok ? "" : " bad")}>
                <span className="dc-in-label">{t3(lang, "Intrare", "Input", "Вход")} {r.label}</span>
                <b>{r.strings} × {r.modulesPerString} {t3(lang, "module", "modules", "модулей")}</b>
                <span className="dc-in-v">{Math.round(r.vString)} V</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {allClear && (
        <div className="dc-clear">
          {t3(lang, "Toate verificările trec — sistemul e coerent.", "Every check passes — the design is sound.", "Все проверки пройдены.")}
        </div>
      )}

      <style dangerouslySetInnerHTML={{ __html: `
        .dc-lead{font-size:12.5px;color:var(--muted);margin:6px 0 14px;max-width:70ch;line-height:1.55}
        .dc-list{list-style:none;margin:0;padding:0;display:grid;gap:11px}
        .dc-list li{display:flex;gap:10px;align-items:flex-start}
        .dc-dot{flex:none;width:18px;height:18px;border-radius:50%;display:grid;place-items:center;
          font-size:10px;font-weight:700;margin-top:1px}
        .dc-list li.ok .dc-dot{background:var(--green-tint);color:var(--green)}
        .dc-list li.warn .dc-dot{background:var(--amber-tint);color:#B4472F}
        .dc-body{flex:1;min-width:0}
        .dc-line{display:flex;gap:10px;align-items:baseline;justify-content:space-between}
        .dc-label{font-size:13px;font-weight:600;color:var(--ink)}
        .dc-line b{font-size:13px;font-variant-numeric:tabular-nums;color:var(--ink);white-space:nowrap}
        .dc-line b.bad{color:#B4472F}
        .dc-detail{font-size:11.5px;color:var(--muted);line-height:1.5;margin-top:1px}
        .dc-detail em{font-style:normal;color:#B4472F}
        .dc-detail i{font-style:normal;color:var(--green)}
        .dc-clear{margin-top:13px;padding:9px 12px;background:var(--green-tint);color:var(--green);
          border-radius:9px;font-size:12.5px;font-weight:600}
        .dc-inputs{margin-top:12px}
        .dc-in-cap{font-size:10.5px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:var(--muted);margin-bottom:6px}
        .dc-in-grid{display:grid;gap:8px}
        .dc-in{background:var(--paper);border:1px solid var(--line);border-radius:9px;padding:9px 11px;
          display:flex;flex-direction:column;gap:2px}
        .dc-in.bad{border-color:#E3C0B3;background:var(--amber-tint)}
        .dc-in-label{font-size:10.5px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.04em}
        .dc-in b{font-size:13px;color:var(--ink);font-variant-numeric:tabular-nums}
        .dc-in-v{font-size:11px;color:var(--muted)}
        .dc-in.bad .dc-in-v{color:#B4472F;font-weight:600}
      ` }} />
    </section>
  );
}
