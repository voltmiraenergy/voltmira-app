"use client";
// app/(app)/leads/AddLead.jsx — "Add lead" for everything the widget can't
// catch: the phone call, the walk-in, the neighbour's referral. Opens a small
// dialog, saves through createLead() (source "manual", with the channel picked
// here) and the new lead lands at the top of the list.
import { useEffect, useRef, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { createLead } from "../../../lib/actions.js";
import { t } from "../../../lib/i18n.js";
import { CHANNEL_ORDER } from "../../../lib/leadChannels.js";

const EMPTY = { name: "", phone: "", email: "", channel: "coldcall", address: "", note: "", hot: false };

export default function AddLead({ lang }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [f, setF] = useState(EMPTY);
  const [err, setErr] = useState("");
  const [pending, start] = useTransition();
  const nameRef = useRef(null);
  const set = (k) => (e) => {
    if (k === "name" && err) setErr("");
    setF((p) => ({ ...p, [k]: e.target.type === "checkbox" ? e.target.checked : e.target.value }));
  };

  useEffect(() => {
    if (!open) return;
    const id = setTimeout(() => nameRef.current?.focus(), 30);
    const onKey = (e) => { if (e.key === "Escape") setOpen(false); };
    window.addEventListener("keydown", onKey);
    return () => { clearTimeout(id); window.removeEventListener("keydown", onKey); };
  }, [open]);

  function submit(e) {
    e.preventDefault();
    if (!f.name.trim()) { setErr(t("lead_add_need_name", lang)); nameRef.current?.focus(); return; }
    setErr("");
    start(async () => {
      try {
        await createLead(f);
        setF(EMPTY);
        setOpen(false);
        router.refresh();
      } catch {
        setErr(t("lead_add_failed", lang));
      }
    });
  }

  return (
    <>
      <button type="button" className="dx-new" onClick={() => setOpen(true)} aria-haspopup="dialog">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12h14" /><path d="M12 5v14" /></svg>
        {t("lead_add", lang)}
      </button>

      {/* Portalled to the app root so the page's entrance animation can't pin it. */}
      {open && createPortal(
        <div className="dx-pal-wrap ld-dlg-wrap" role="presentation" onMouseDown={(e) => { if (e.target === e.currentTarget) setOpen(false); }}>
          <form className="dx-pal ld-dlg" role="dialog" aria-modal="true" aria-labelledby="ld-dlg-h" onSubmit={submit}>
            <header className="ld-dlg-head">
              <h2 id="ld-dlg-h">{t("lead_add_title", lang)}</h2>
              <p>{t("lead_add_hint", lang)}</p>
            </header>
            <div className="ld-dlg-grid">
              <label className="wide">{t("lead_field_name", lang)}
                <input id="ld-add-name" ref={nameRef} value={f.name} onChange={set("name")} maxLength={120} autoComplete="off" aria-invalid={!!err && !f.name.trim()} />
              </label>
              <label>{t("lead_field_phone", lang)}
                <input id="ld-add-phone" value={f.phone} onChange={set("phone")} maxLength={40} inputMode="tel" autoComplete="off" placeholder="+373" />
              </label>
              <label>{t("lead_field_email", lang)}
                <input id="ld-add-email" value={f.email} onChange={set("email")} maxLength={160} type="email" autoComplete="off" />
              </label>
              <label>{t("lead_channel", lang)}
                <select id="ld-add-channel" value={f.channel} onChange={set("channel")}>
                  {CHANNEL_ORDER.map((k) => <option key={k} value={k}>{t("lead_ch_" + k, lang)}</option>)}
                </select>
              </label>
              <label className="ld-dlg-check">
                <input id="ld-add-hot" type="checkbox" checked={f.hot} onChange={set("hot")} />
                <span>{t("lead_add_hot", lang)}</span>
              </label>
              <label className="wide">{t("lead_field_address", lang)}
                <input id="ld-add-address" value={f.address} onChange={set("address")} maxLength={200} autoComplete="off" />
              </label>
              <label className="wide">{t("lead_field_note", lang)}
                <textarea id="ld-add-note" value={f.note} onChange={set("note")} maxLength={500} rows={3} />
              </label>
            </div>
            {err && <p className="ld-dlg-err" role="alert">{err}</p>}
            <footer className="ld-dlg-foot">
              <button type="button" className="dx-btn" onClick={() => setOpen(false)}>{t("lead_cancel", lang)}</button>
              <button type="submit" className="dx-btn primary" disabled={pending} aria-busy={pending}>{t("lead_add_save", lang)}</button>
            </footer>
          </form>
        </div>,
        document.querySelector(".app") || document.body
      )}
    </>
  );
}
