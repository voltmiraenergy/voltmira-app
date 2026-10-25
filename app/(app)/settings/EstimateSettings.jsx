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
import { rangeFill } from "../../../lib/rangeFill.js";

const LOCS = { en: "en-GB", ro: "ro-RO", ru: "ru-RU", uk: "uk-UA" };

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
  // each sign's share of the score: the score is the weighted share of the signs a lead shows (lib/leadScore.js)
  const total = SCORE_SIGNALS.reduce((n, k) => n + (Number(s.weights[k]) || 0), 0);
  const share = (k) => (total > 0 ? Math.round(((Number(s.weights[k]) || 0) / total) * 100) : 0);
  // the follow-up days as the client lives them
  const days = [...new Set(s.nudgeDays.filter((d) => d > 0))].sort((a, b) => a - b);
  const dayList = days.length ? new Intl.ListFormat(LOCS[lang] || "en-GB", { type: "conjunction" }).format(days.map(String)) : "";

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
            <div key={k} className="es-w">
              <div className="es-w-top">
                <label htmlFor={"esW-" + k}>{qft("sig_" + k, lang)}</label>
                <output htmlFor={"esW-" + k} className="es-w-v">{s.weights[k]}</output>
              </div>
              <input id={"esW-" + k} type="range" min="0" max="100" step="5" value={s.weights[k]} disabled={locked} style={rangeFill(s.weights[k], 0, 100)}
                onChange={(e) => edit({ weights: { ...s.weights, [k]: Number(e.target.value) } })} />
              <span className="es-w-share">{qft("share", lang, { p: share(k) })}</span>
            </div>
          ))}
        </div>
        <details className="es-districts">
          <summary>
            <span className="es-sum-t">{qft("districts_h", lang)}</span>
            <span className="es-sum-n">{s.districts.length ? qft("districts_n", lang, { n: s.districts.length }) : qft("districts_all", lang)}</span>
          </summary>
          <p className="set-note st-note-tight">{qft("districts_p", lang)}</p>
          <div className="es-district-grid">
            {districts.map((r) => (
              <label key={r.id} className="es-chip">
                <input type="checkbox" disabled={locked} checked={s.districts.includes(r.id)}
                  onChange={(e) => edit({ districts: e.target.checked ? [...s.districts, r.id] : s.districts.filter((d) => d !== r.id) })} />
                <span>{r.name[lang] || r.name.ro}</span>
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
        {days.length > 0 && (
          <>
            <ol className="es-tl" aria-hidden="true">
              <li className="is-start">{qft("nudge_sent", lang)}</li>
              {days.map((d) => <li key={d}>{qft("nudge_day", lang, { n: d })}</li>)}
            </ol>
            <p className="set-note st-note-tight">{qft("nudge_preview", lang, { d: dayList })}</p>
          </>
        )}
      </section>

      {!locked && (
        <div className="es-save">
          <button type="button" className="btn primary" disabled={busy} onClick={save}>{busy ? qft("saving", lang) : qft("save", lang)}</button>
          {msg && <span className="set-note" role="status">{msg}</span>}
        </div>
      )}
      <style>{`
        .app .es-weights{display:grid;grid-template-columns:repeat(auto-fit,minmax(230px,1fr));gap:22px 28px;margin-top:4px}
        .app .es-w{display:grid;gap:8px;min-width:0}
        .app .es-w-top{display:flex;align-items:center;justify-content:space-between;gap:10px}
        .app .es-w-top label{font-size:13.5px;font-weight:600;color:var(--app-text);margin:0}
        .app .es-w-v{min-width:38px;padding:2px 8px;border-radius:999px;border:1px solid var(--app-line);background:var(--app-bg);text-align:center;font-weight:700;font-size:13px;font-variant-numeric:tabular-nums}
        .app .es-w input[type=range]{width:100%;margin:0}
        .app .es-w-share{font-size:12px;color:var(--app-muted);font-variant-numeric:tabular-nums}
        .app .es-districts{margin-top:20px;border-top:1px solid var(--app-line);padding-top:6px}
        .app .es-districts summary{cursor:pointer;display:flex;align-items:center;gap:12px;padding:10px 0;list-style:none}
        .app .es-districts summary::-webkit-details-marker{display:none}
        .app .es-districts summary::before{content:"";width:7px;height:7px;border-right:2px solid currentColor;border-bottom:2px solid currentColor;transform:rotate(-45deg);transition:transform .15s;flex:none;margin-left:2px}
        .app .es-districts[open] summary::before{transform:rotate(45deg)}
        .app .es-sum-t{font-weight:600}
        .app .es-sum-n{margin-left:auto;font-size:12.5px;color:var(--app-muted)}
        .app .es-district-grid{display:flex;flex-wrap:wrap;gap:8px;margin:8px 0 6px}
        .app .es-chip{position:relative;display:inline-flex}
        .app .es-chip input{position:absolute;inset:0;opacity:0;margin:0;cursor:pointer}
        .app .es-chip span{display:inline-flex;align-items:center;min-height:34px;padding:0 13px;border-radius:999px;border:1px solid var(--app-line);background:var(--app-surface);font-size:13.5px;color:var(--app-text);transition:background .15s,border-color .15s}
        .app .es-chip input:checked+span{border-color:var(--app-ok);background:var(--app-ok-tint);font-weight:600}
        .app .es-chip input:focus-visible+span{outline:2px solid var(--app-ok);outline-offset:2px}
        .app .es-chip input:disabled+span{opacity:.6}
        .app .es-tl{list-style:none;padding:0;margin:16px 0 4px;display:flex;flex-wrap:wrap;align-items:center;gap:8px 0}
        .app .es-tl li{display:inline-flex;align-items:center;font-size:12.5px;font-weight:600;padding:5px 12px;border-radius:999px;background:var(--app-warn-tint);color:var(--app-warn-ink);font-variant-numeric:tabular-nums}
        .app .es-tl li.is-start{background:var(--app-ok-tint);color:var(--app-ok)}
        .app .es-tl li+li{margin-left:28px;position:relative}
        .app .es-tl li+li::before{content:"";position:absolute;right:100%;top:50%;width:28px;border-top:2px dashed var(--app-line)}
        .app .es-save{display:flex;align-items:center;gap:12px;flex-wrap:wrap;margin:4px 0 20px}
      `}</style>
    </>
  );
}
