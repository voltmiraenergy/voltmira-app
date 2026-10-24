"use client";
// app/(app)/settings/EstimateSettings.jsx — Settings, "Estimate page": the installer's public estimate page (its
// address and colour, the link and the embed code), the lead score's weights, the districts they serve, and the
// follow-up days. Loaded and saved through lib/leadSettings.js with its own Save, owner only.
import { useEffect, useMemo, useState } from "react";
import { loadLeadSettings, saveLeadSettings } from "../../../lib/leadSettings.js";
import { qft } from "../../../lib/quoteFastText.js";
import { SCORE_SIGNALS, DEFAULT_WEIGHTS } from "../../../lib/leadScore.js";
import { cleanSlug } from "../../../lib/publicPage.js";
import { RAIONS } from "../../../lib/mdRaions.js";

export default function EstimateSettings({ lang }) {
  const [s, setS] = useState(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    loadLeadSettings().then((r) => setS(r?.error ? { error: r.error } : r)).catch(() => setS({ error: "load" }));
  }, []);

  const districts = useMemo(() => RAIONS.filter((r) => r.covered)
    .sort((a, b) => (a.name[lang] || a.name.ro).localeCompare(b.name[lang] || b.name.ro, lang)), [lang]);

  if (!s) return <section className="dx-card st-card" aria-busy="true" />;
  if (s.error) return <section className="dx-card st-card"><p className="set-note">{qft("err_save_failed", lang)}</p></section>;

  const edit = (patch) => { setS({ ...s, ...patch }); setMsg(""); };
  const locked = !s.isOwner || s.needsDb;
  const key = s.slug || s.companyId;
  // shown only once loaded, in the browser
  const url = `${location.origin}/estimate/${key}`;
  const snippet = `<iframe src="${url}?embed=1" width="100%" height="760" style="border:none;max-width:560px" title="${qft("page_h", lang)}"></iframe>`;

  async function save() {
    setBusy(true); setMsg(qft("saving", lang));
    const r = await saveLeadSettings({ slug: s.slug, color: s.color, weights: s.weights, districts: s.districts, nudgeDays: s.nudgeDays })
      .catch(() => ({ ok: false, error: "save_failed" }));
    setBusy(false);
    setMsg(r.ok ? qft("saved", lang) : qft(r.error === "needs_db" ? "needs_db" : r.error === "owner_only" ? "owner_only" : "err_" + r.error, lang));
  }

  return (
    <>
      {s.needsDb && <p className="set-note st-warn" role="status">{qft("needs_db", lang)}</p>}
      {!s.isOwner && <p className="set-note" role="status">{qft("owner_only", lang)}</p>}

      <section className="dx-card st-card">
        <div className="st-card-h"><div><h3>{qft("page_h", lang)}</h3><p>{qft("page_p", lang)}</p></div></div>
        {!s.pageOn && <p className="set-note">{qft("not_live", lang)}</p>}
        <div className="set-grid">
          <div className="field">
            <label htmlFor="esSlug">{qft("slug", lang)}</label>
            <input className="input" id="esSlug" value={s.slug} disabled={locked} placeholder={s.suggested}
              onChange={(e) => edit({ slug: e.target.value.toLowerCase() })}
              onBlur={() => s.slug && edit({ slug: cleanSlug(s.slug) || s.slug })} />
            <p className="set-note st-note-tight">{qft("slug_hint", lang)}
              {!s.slug && s.suggested && !locked && <> <button type="button" className="btn ghost sm" onClick={() => edit({ slug: s.suggested })}>{qft("slug_use", lang, { s: s.suggested })}</button></>}
            </p>
          </div>
          <div className="field">
            <label htmlFor="esColor">{qft("color", lang)}</label>
            <span style={{ display: "flex", gap: 10, alignItems: "center" }}>
              <input id="esColor" type="color" value={s.color || "#1e6b4e"} disabled={locked} onChange={(e) => edit({ color: e.target.value })}
                style={{ width: 48, height: 40, border: "1px solid var(--line)", borderRadius: 10, background: "var(--paper-2)", padding: 2 }} />
              <code>{s.color || "#1e6b4e"}</code>
            </span>
          </div>
        </div>
        {s.pageOn && (
          <>
            <p><a className="btn ghost sm" href={url} target="_blank" rel="noopener noreferrer">{qft("open", lang)}</a></p>
            <p className="set-note st-note-tight">{qft("embed", lang)}</p>
            <div className="st-embed">
              <code className="embed-code">{snippet}</code>
              <button type="button" className="btn ghost sm" onClick={() => { navigator.clipboard?.writeText(snippet); setCopied(true); setTimeout(() => setCopied(false), 1800); }}>
                {copied ? qft("copied", lang) : qft("copy", lang)}
              </button>
            </div>
          </>
        )}
      </section>

      <section className="dx-card st-card">
        <div className="st-card-h">
          <div><h3>{qft("score_h", lang)}</h3><p>{qft("score_p", lang)}</p></div>
          {!locked && <button type="button" className="btn ghost sm" onClick={() => edit({ weights: { ...DEFAULT_WEIGHTS } })}>{qft("defaults", lang)}</button>}
        </div>
        <div className="es-weights">
          {SCORE_SIGNALS.map((k) => (
            <div key={k} className="field">
              <label htmlFor={"esW-" + k} style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                <span>{qft("sig_" + k, lang)}</span><b>{s.weights[k]}</b>
              </label>
              <input id={"esW-" + k} type="range" min="0" max="100" step="5" value={s.weights[k]} disabled={locked}
                onChange={(e) => edit({ weights: { ...s.weights, [k]: Number(e.target.value) } })} style={{ width: "100%" }} />
            </div>
          ))}
        </div>
        <details className="es-districts">
          <summary>{qft("districts_h", lang)} ({s.districts.length})</summary>
          <p className="set-note st-note-tight">{qft("districts_p", lang)}</p>
          <div className="es-district-grid">
            {districts.map((r) => (
              <label key={r.id} className="check">
                <input type="checkbox" disabled={locked} checked={s.districts.includes(r.id)}
                  onChange={(e) => edit({ districts: e.target.checked ? [...s.districts, r.id] : s.districts.filter((d) => d !== r.id) })} />
                <span className="txt">{r.name[lang] || r.name.ro}</span>
              </label>
            ))}
          </div>
        </details>
      </section>

      <section className="dx-card st-card">
        <div className="st-card-h"><div><h3>{qft("nudge_h", lang)}</h3><p>{qft("nudge_p", lang)}</p></div></div>
        <div className="set-grid">
          {[0, 1, 2].map((i) => (
            <div key={i} className="field">
              <label htmlFor={"esN-" + i}>{qft("nudge_n", lang, { n: i + 1 })}</label>
              <input className="input" id={"esN-" + i} type="number" min="1" max="60" disabled={locked} value={s.nudgeDays[i] ?? ""}
                onChange={(e) => { const d = [...s.nudgeDays]; d[i] = e.target.value === "" ? undefined : Number(e.target.value); edit({ nudgeDays: d.filter((x) => x != null) }); }} />
            </div>
          ))}
        </div>
      </section>

      {!locked && (
        <div className="es-save">
          <button type="button" className="btn primary" disabled={busy} onClick={save}>{busy ? qft("saving", lang) : qft("save", lang)}</button>
          {msg && <span className="set-note" role="status">{msg}</span>}
        </div>
      )}
      <style>{`
        .app .es-weights{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:6px 18px}
        .app .es-districts{margin-top:10px}
        .app .es-districts summary{cursor:pointer;font-weight:600;padding:6px 0}
        .app .es-district-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:4px 12px;margin-top:6px}
        .app .es-save{display:flex;align-items:center;gap:12px;flex-wrap:wrap;margin:4px 0 20px}
      `}</style>
    </>
  );
}
