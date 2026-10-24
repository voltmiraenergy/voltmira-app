"use client";
// app/(app)/projects/[id]/SiteRecord.jsx — "On site", on a won quote: what the crew records at the job (lib/siteRecord.js):
// the checklist, the serial numbers of what was fitted, the photos by place, and the client's signature at handover,
// then the handover document in the client's language. Made for a phone on a roof: every change is kept on the
// device first (with the version it started from), saved when there is a signal, and merged with a teammate's
// changes meanwhile (lib/jobActions.js saveSite); photos wait on the device and go up on their own (lib/sitePhotos.js).
import { useCallback, useEffect, useRef, useState } from "react";
import { HardHat, Camera, FileText, X } from "lucide-react";
import { loadSite, saveSite, deletePhoto } from "../../../../lib/jobActions.js";
import { FIELD_ITEMS, SERIAL_KINDS, PHOTO_SLOTS, emptyRecord, cleanSerials } from "../../../../lib/siteRecord.js";
import { jt } from "../../../../lib/jobText.js";
import { queueAction } from "../../../../lib/offlineQueue.js";
import { isNetworkError } from "../../../../lib/offline.js";
import { resizeToBlob, keepPhoto, pendingPhotos, sendPending } from "../../../../lib/sitePhotos.js";
import SignaturePad from "../../studio/jobs/[id]/configure/SignaturePad.jsx";

const LOCS = { en: "en-GB", ro: "ro-RO", ru: "ru-RU", uk: "uk-UA" };
const LANG_NAME = { en: "English", ro: "română", ru: "русский", uk: "українська" };
const DRAFT = (id) => `vm-site:${id}`;

export default function SiteRecord({ projectId, companyId, lang, me = "", clientName = "", clientLang = null, quoteCounts = {} }) {
  const J = (k, v) => jt(k, lang, v);
  const loc = LOCS[lang] || "ro-RO";
  const [state, setState] = useState(null);       // { record, version, base, photos }
  const [msg, setMsg] = useState(null);
  const [busy, setBusy] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [waiting, setWaiting] = useState([]);     // photos still on the device
  const [texts, setTexts] = useState({});         // the serial text boxes as typed
  const fileRef = useRef(null);
  const slotRef = useRef("array");

  const refreshWaiting = useCallback(async () => {
    const list = await pendingPhotos(projectId);
    setWaiting(list.map((p) => ({ ...p, url: URL.createObjectURL(p.blob) })));
  }, [projectId]);

  const load = useCallback(async () => {
    const r = await loadSite(projectId).catch(() => null);
    let draft = null;
    try { draft = JSON.parse(localStorage.getItem(DRAFT(projectId)) || "null"); } catch { /* none */ }
    if (!r || r.error) {
      // no signal: the device's copy, if there is one
      if (draft) setState({ record: draft.mine, version: draft.baseVersion, base: draft.base, photos: [], offline: true });
      else setState({ record: emptyRecord(), version: 0, base: emptyRecord(), photos: [], offline: true });
      return;
    }
    if (r.needsDb) { setState({ needsDb: true }); return; }
    // changes kept on this device win the screen until they are saved
    setState(draft ? { record: draft.mine, version: draft.baseVersion, base: draft.base, photos: r.photos } : { record: r.record, version: r.version, base: r.record, photos: r.photos });
    if (draft) setDirty(true);
  }, [projectId]);

  useEffect(() => {
    let alive = true;
    (async () => {
      await load();
      if (!alive) return;
      await refreshWaiting();
      const s = await sendPending(projectId, companyId);
      if (alive && s.sent) { await refreshWaiting(); await load(); }
    })();
    const online = async () => {
      const s = await sendPending(projectId, companyId);
      if (s.sent) { await refreshWaiting(); await load(); }
    };
    window.addEventListener("online", online);
    return () => { alive = false; window.removeEventListener("online", online); };
  }, [projectId, companyId, load, refreshWaiting]);

  if (!state) return <section className="card site-card" aria-busy="true" />;
  if (state.needsDb) return <section className="card site-card"><h3><HardHat size={16} aria-hidden="true" />{J("site_h")}</h3><p className="site-note">{J("needs_db")}</p></section>;
  const rec = state.record || emptyRecord();

  function edit(next) {
    setState((s) => ({ ...s, record: next }));
    setDirty(true); setMsg(null);
    try { localStorage.setItem(DRAFT(projectId), JSON.stringify({ mine: next, baseVersion: state.version, base: state.base })); } catch { /* storage full */ }
  }
  const tick = (k) => {
    const cl = { ...rec.checklist };
    if (cl[k]) delete cl[k]; else cl[k] = { at: new Date().toISOString(), by: me };
    edit({ ...rec, checklist: cl });
  };

  async function save() {
    setBusy(true); setMsg(null);
    try {
      const r = await saveSite(projectId, rec, state.version, state.base);
      if (!r.ok) { setMsg({ ok: false, text: r.error === "needs_db" ? J("needs_db") : J("e_save") }); return; }
      try { localStorage.removeItem(DRAFT(projectId)); } catch { /* none */ }
      setState((s) => ({ ...s, record: r.record, version: r.version, base: r.record, offline: false }));
      setDirty(false); setTexts({});
      setMsg(r.conflicts?.length
        ? { ok: true, text: J("site_merged", { list: r.conflicts.map((c) => (c === "signature" ? J("sign_h") : J("f_" + c.split(".")[1]))).join(", ") }) }
        : { ok: true, text: J("saved") });
    } catch (e) {
      // no signal: kept here, and sent by the queue when the signal is back (merged then, lib/siteRecord.js)
      if (isNetworkError(e) && queueAction("siteRecord", [projectId, rec, state.version, state.base])) {
        try { localStorage.removeItem(DRAFT(projectId)); } catch { /* none */ }
        setDirty(false); setMsg({ ok: true, text: J("site_offline") });
      } else setMsg({ ok: false, text: J("e_save") });
    } finally { setBusy(false); }
  }

  async function addPhoto(file) {
    if (!file) return;
    try {
      const blob = await resizeToBlob(file);
      await keepPhoto(projectId, { blob, slot: slotRef.current, takenAt: new Date().toISOString() });
      await refreshWaiting();
      const s = await sendPending(projectId, companyId);
      if (s.failed && navigator.onLine) setMsg({ ok: false, text: J("p_failed") });
      if (s.sent) { await refreshWaiting(); await load(); }
    } catch { setMsg({ ok: false, text: J("p_failed") }); }
  }
  async function dropPhoto(id) {
    const r = await deletePhoto(id).catch(() => null);
    if (r?.ok) setState((s) => ({ ...s, photos: s.photos.filter((p) => p.id !== id) }));
  }

  const day = (iso) => new Date(iso).toLocaleString(loc, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Chisinau" });
  const sig = rec.signature;
  const hoLang = ["en", "ro", "ru", "uk"].includes(clientLang) ? clientLang : lang;

  return (
    <section className="card site-card" aria-labelledby="site-h">
      <div className="site-head">
        <h3 id="site-h"><HardHat size={16} aria-hidden="true" />{J("site_h")}</h3>
        <a className="btn ghost sm" href={`/api/projects/${projectId}/handover-pdf`} target="_blank" rel="noopener noreferrer"><FileText size={14} aria-hidden="true" />{J("handover_pdf")}</a>
      </div>
      <p className="site-note">{J("site_p")} {J("handover_lang", { l: LANG_NAME[hoLang] })}</p>

      <fieldset className="site-list">
        {FIELD_ITEMS.map((k) => (
          <label key={k} className="site-item">
            <input type="checkbox" checked={!!rec.checklist[k]} onChange={() => tick(k)} />
            <span>{J("f_" + k)}{rec.checklist[k] && <small>{day(rec.checklist[k].at)}{rec.checklist[k].by ? `, ${rec.checklist[k].by}` : ""}</small>}</span>
          </label>
        ))}
      </fieldset>

      <h4>{J("serials_h")}</h4>
      <p className="site-note">{J("serials_p")}</p>
      <div className="site-serials">
        {SERIAL_KINDS.map((k) => (
          <label key={k} className="field">
            <span>{J("s_" + k)}{quoteCounts[k] ? <small>{J("s_count", { n: rec.serials[k].length, q: quoteCounts[k] })}</small> : null}</span>
            <textarea className="input" rows={k === "panel" ? 4 : 2} spellCheck={false} autoCapitalize="characters"
              value={texts[k] ?? rec.serials[k].join("\n")}
              onChange={(e) => setTexts({ ...texts, [k]: e.target.value })}
              onBlur={(e) => { edit({ ...rec, serials: { ...rec.serials, [k]: cleanSerials(e.target.value) } }); setTexts((t) => { const n = { ...t }; delete n[k]; return n; }); }} />
          </label>
        ))}
      </div>

      <h4>{J("photos_h")}</h4>
      {waiting.length > 0 && <p className="site-note site-wait">{J("p_waiting", { n: waiting.length })}</p>}
      <div className="site-photos">
        {PHOTO_SLOTS.map((slot) => {
          const here = [...(state.photos || []).filter((p) => p.slot === slot), ...waiting.filter((p) => p.slot === slot).map((p) => ({ ...p, pending: true }))];
          return (
            <div key={slot} className="site-slot">
              <b>{J("p_" + slot)}</b>
              <div className="site-thumbs">
                {here.map((p) => (
                  <figure key={p.id || p.clientId} className={p.pending ? "is-pending" : ""}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={p.url} alt={J("p_" + slot)} loading="lazy" />
                    {!p.pending && <button type="button" aria-label={J("delete")} onClick={() => dropPhoto(p.id)}><X size={12} /></button>}
                  </figure>
                ))}
                <button type="button" className="site-add" aria-label={`${J("p_add")}: ${J("p_" + slot)}`} onClick={() => { slotRef.current = slot; fileRef.current?.click(); }}><Camera size={18} /></button>
              </div>
            </div>
          );
        })}
      </div>
      <input ref={fileRef} type="file" accept="image/*" capture="environment" hidden onChange={(e) => { addPhoto(e.target.files?.[0]); e.target.value = ""; }} />

      <h4>{J("sign_h")}</h4>
      {sig ? (
        <div className="site-signed">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={sig.png} alt={J("sign_h")} />
          <p>{J("signed_on", { n: sig.name || clientName, d: day(sig.at) })}</p>
          <button type="button" className="btn ghost sm" onClick={() => edit({ ...rec, signature: null })}>{J("sign_clear")}</button>
        </div>
      ) : (
        <SignBox lang={lang} clientName={clientName} onSign={(png, name) => edit({ ...rec, signature: { png, name, at: new Date().toISOString() } })} />
      )}

      <div className="site-foot">
        {msg && <p className={"site-msg" + (msg.ok ? " ok" : " bad")} role="status">{msg.text}</p>}
        <button type="button" className="btn primary" disabled={busy || !dirty} onClick={save}>{busy ? J("site_saving") : J("site_save")}</button>
      </div>
      <style>{SITE_CSS}</style>
    </section>
  );
}

function SignBox({ lang, clientName, onSign }) {
  const J = (k, v) => jt(k, lang, v);
  const [png, setPng] = useState(null);
  const [name, setName] = useState(clientName);
  return (
    <div className="site-sign">
      <label className="field"><span>{J("sign_name")}</span><input className="input" value={name} maxLength={120} onChange={(e) => setName(e.target.value)} /></label>
      <SignaturePad onChange={setPng} placeholder={J("sign_here")} clearLabel={J("sign_clear")} />
      <button type="button" className="btn ghost sm" disabled={!png || !name.trim()} onClick={() => onSign(png, name.trim())}>{J("signed_by_client")}</button>
    </div>
  );
}

const SITE_CSS = `
.app .site-card{display:grid;gap:10px}
.app .site-head{display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap}
.app .site-head h3{display:flex;align-items:center;gap:8px;margin:0;font-size:15px}
.app .site-head .btn{display:inline-flex;align-items:center;gap:6px}
.app .site-card h4{margin:8px 0 0;font-size:13.5px}
.app .site-note{margin:0;font-size:12.5px;color:var(--muted);line-height:1.5}
.app .site-wait{color:var(--amber-ink);font-weight:600}
.app .site-list{border:0;margin:0;padding:0;display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:6px 14px}
.app .site-item{display:flex;gap:9px;align-items:flex-start;font-size:13.5px;line-height:1.4;padding:6px 0;cursor:pointer}
.app .site-item input{width:20px;height:20px;margin-top:0;accent-color:var(--green);flex:none}
.app .site-item small{display:block;font-size:11.5px;color:var(--muted)}
.app .site-serials{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:10px}
.app .site-serials .field{display:grid;gap:4px;margin:0}
.app .site-serials .field>span{font-size:12.5px;font-weight:600;color:var(--muted);display:flex;justify-content:space-between;gap:8px}
.app .site-serials textarea{font-family:ui-monospace,Consolas,monospace;font-size:12.5px;resize:vertical}
.app .site-photos{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px}
.app .site-slot b{display:block;font-size:12.5px;margin-bottom:6px}
.app .site-thumbs{display:flex;flex-wrap:wrap;gap:6px}
.app .site-thumbs figure{position:relative;margin:0;width:64px;height:64px;border-radius:9px;overflow:hidden;border:1px solid var(--line)}
.app .site-thumbs figure.is-pending{outline:2px dashed var(--amber);outline-offset:-2px}
.app .site-thumbs img{width:100%;height:100%;object-fit:cover;display:block}
.app .site-thumbs figure button{position:absolute;top:3px;right:3px;width:20px;height:20px;border-radius:6px;border:0;background:rgba(0,0,0,.55);color:#fff;display:grid;place-items:center;cursor:pointer}
.app .site-add{width:64px;height:64px;border-radius:9px;border:1.5px dashed var(--line-2,var(--line));background:var(--paper);color:var(--muted);display:grid;place-items:center;cursor:pointer}
.app .site-sign{display:grid;gap:8px;max-width:520px}
.app .site-sign .field{display:grid;gap:4px;margin:0}
.app .site-sign .field>span{font-size:12.5px;font-weight:600;color:var(--muted)}
.app .site-signed{display:flex;align-items:center;gap:12px;flex-wrap:wrap}
.app .site-signed img{height:70px;background:#fff;border:1px solid var(--line);border-radius:8px;padding:4px}
.app .site-signed p{margin:0;font-size:13px}
.app .site-foot{display:flex;align-items:center;justify-content:flex-end;gap:12px;flex-wrap:wrap;position:sticky;bottom:0;padding-top:6px}
.app .site-msg{margin:0;font-size:12.5px;font-weight:600;flex:1}
.app .site-msg.ok{color:var(--green)}
.app .site-msg.bad{color:var(--red)}
`;
