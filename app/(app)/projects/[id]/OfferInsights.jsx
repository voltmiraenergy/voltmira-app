"use client";
// app/(app)/projects/[id]/OfferInsights.jsx — in the "link to the client" window: this offer's automatic reminders
// (on or off, whatever the workspace setting) and what the client read, section by section (lib/offerInsights.js).
import { useEffect, useState } from "react";
import { offerInsights, setOfferNudges } from "../../../../lib/offerInsights.js";
import { qft, QFT } from "../../../../lib/quoteFastText.js";

const fmtSecs = (s, lang) => {
  const m = Math.floor(s / 60), r = s % 60;
  const loc = { en: "en-GB", ro: "ro-RO", ru: "ru-RU", uk: "uk-UA" }[lang] || "ro-RO";
  const unit = (n, u) => new Intl.NumberFormat(loc, { style: "unit", unit: u, unitDisplay: "short" }).format(n);
  return m ? `${unit(m, "minute")} ${unit(r, "second")}` : unit(r, "second");
};

export default function OfferInsights({ projectId, lang }) {
  const [d, setD] = useState(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  useEffect(() => { offerInsights(projectId).then(setD).catch(() => setD({ error: "load" })); }, [projectId]);
  if (!d || d.error) return null;

  async function toggle(on) {
    setBusy(true); setErr("");
    const r = await setOfferNudges(projectId, on).catch(() => ({ ok: false, error: "save_failed" }));
    setBusy(false);
    if (r.ok) setD({ ...d, nudgesOff: !on });
    else setErr(qft(r.error === "needs_db" ? "needs_db" : "err_save_failed", lang));
  }

  const max = Math.max(1, ...d.sections.map((x) => x.seconds));
  return (
    <div className="oi">
      <label className="check st-toggle">
        <input type="checkbox" checked={!d.nudgesOff} disabled={busy || d.needsDb} onChange={(e) => toggle(e.target.checked)} />
        <span className="toggle-pill" />
        <span className="txt">{qft("nudges_this", lang)}<small>{d.needsDb ? qft("needs_db", lang) : qft("nudges_this_note", lang)}</small></span>
      </label>
      {err && <p className="email-msg bad" role="alert">{err}</p>}
      <h5 className="oi-h">{qft("read_h", lang)}</h5>
      {d.sections.length === 0 ? <p className="sub">{qft("read_none", lang)}</p> : (
        <ul className="oi-list">
          {d.sections.map(({ s, seconds }) => (
            <li key={s}>
              <span>{QFT["sec_" + s] ? qft("sec_" + s, lang) : s}</span>
              <span className="oi-bar" aria-hidden="true"><i style={{ width: `${Math.round((seconds / max) * 100)}%` }} /></span>
              <b>{fmtSecs(seconds, lang)}</b>
            </li>
          ))}
        </ul>
      )}
      {d.options.length > 0 && <p className="sub">{qft("read_option", lang, { o: d.options.map((x) => x.o).join(", ") })}</p>}
      <style>{`
        .app .oi{margin-top:14px;padding-top:12px;border-top:1px solid var(--line)}
        .app .oi-h{margin:14px 0 6px;font-size:14px}
        .app .oi-list{list-style:none;margin:0;padding:0;display:grid;gap:6px}
        .app .oi-list li{display:grid;grid-template-columns:minmax(0,1.2fr) minmax(60px,1fr) auto;gap:10px;align-items:center;font-size:13px}
        .app .oi-bar{height:8px;border-radius:6px;background:var(--paper);overflow:hidden}
        .app .oi-bar i{display:block;height:100%;background:var(--green)}
      `}</style>
    </div>
  );
}
