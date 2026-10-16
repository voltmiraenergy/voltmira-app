"use client";
// app/(app)/projects/draft/page.jsx — a new quote started with no signal
// (lib/offlineDrafts.js): the client, the address and the system, kept on the
// device. The offline worker keeps this page, so it opens on a roof. With a
// signal, "Create the quote now" (or the app on its own, OfflineReady.jsx)
// turns it into a real quote and opens it. Everything here is client-side:
// the draft's id is in the address (?id=local-...).
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { readDraft, saveDraft, markSynced, syncedId, isDraftId } from "../../../../lib/offlineDrafts.js";
import { createQuoteFromDraft } from "../../../../lib/draftActions.js";
import { isNetworkError } from "../../../../lib/offline.js";
import { t, normLang } from "../../../../lib/i18n.js";

export default function DraftPage() {
  const router = useRouter();
  const [id, setId] = useState(null);
  const [d, setD] = useState(null);
  const [online, setOnline] = useState(true);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);

  // the draft named in the address; one already synced opens its quote
  useEffect(() => {
    const q = new URLSearchParams(location.search).get("id");
    const real = q && syncedId(q);
    if (real) { router.replace(`/projects/${real}`); return; }
    const sync = () => setOnline(navigator.onLine !== false);
    const go = () => { setId(q); setD(isDraftId(q) ? readDraft(q) : null); sync(); };
    const tm = setTimeout(go, 0);
    window.addEventListener("online", sync); window.addEventListener("offline", sync);
    return () => { clearTimeout(tm); window.removeEventListener("online", sync); window.removeEventListener("offline", sync); };
  }, [router]);

  // the app turned it into a quote in the background: follow it
  useEffect(() => {
    if (!id) return;
    const check = () => { const real = syncedId(id); if (real) router.replace(`/projects/${real}`); };
    const tm = setInterval(check, 2000);
    return () => clearInterval(tm);
  }, [id, router]);

  const lang = normLang(d?.lang || "ro");
  const set = (k) => (e) => { const next = { ...d, [k]: e.target.value }; setD(next); saveDraft(id, next); };

  async function create() {
    setBusy(true); setMsg(null);
    try {
      const real = await createQuoteFromDraft(d);
      markSynced(id, real);
      router.replace(`/projects/${real}`);
    } catch (e) {
      setMsg(isNetworkError(e) ? t("dr_still_offline", lang) : t("dr_failed", lang));
      setBusy(false);
    }
  }

  if (id && !d) {
    return (
      <div className="dx"><section className="card" style={{ maxWidth: 560 }}>
        <p>{t("dr_missing", lang)}</p>
        <Link className="btn ghost sm" href="/projects">{t("nav_projects", lang)}</Link>
      </section></div>
    );
  }
  if (!d) return null;
  const field = (k, label, props = {}) => (
    <label className="field" htmlFor={`dr-${k}`}>
      <span>{t(label, lang)}</span>
      <input id={`dr-${k}`} className="input" value={d[k] ?? ""} onChange={set(k)} {...props} />
    </label>
  );
  return (
    <div className="dx">
      <header className="dx-head"><div className="dx-hello">
        <h1>{d.title || d.client_name || t("dr_title", lang)}</h1>
        <p className="dx-summary">{t(online ? "dr_sub_online" : "dr_sub", lang)}</p>
      </div></header>
      <section className="card dr-form" style={{ maxWidth: 640 }}>
        {field("client_name", "dr_client", { autoComplete: "name" })}
        {field("phone", "dr_phone", { type: "tel", inputMode: "tel" })}
        {field("client_email", "dr_email", { type: "email" })}
        {field("address", "dr_address")}
        {field("kw", "dr_kw", { inputMode: "decimal" })}
        {field("cons", "dr_cons", { inputMode: "decimal" })}
        {field("batt_kwh", "dr_batt", { inputMode: "decimal" })}
        <label className="field" htmlFor="dr-notes"><span>{t("dr_notes", lang)}</span>
          <textarea id="dr-notes" className="input" rows={3} value={d.notes ?? ""} onChange={set("notes")} />
        </label>
        <p className="dr-saved" role="status">{t("dr_saved", lang)}</p>
        <button type="button" className="btn primary" disabled={busy || !online} onClick={create}>
          {busy ? t("dr_creating", lang) : t(online ? "dr_create" : "dr_wait", lang)}
        </button>
        {msg && <p className="dr-msg" role="alert">{msg}</p>}
      </section>
    </div>
  );
}
