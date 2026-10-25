"use client";
// app/(app)/projects/[id]/RoofPhoto.jsx — "Roof photo" in the quote's tools:
// the installer's own photo of the roof (a drone shot is best) becomes the
// offer's picture, sharper than satellite imagery outside Chișinău. The photo
// is shrunk here to a JPEG of at most 1,600 px, sent to the quote's
// roof-photo route, and its address kept in site_design.photoUrl; the next
// offer link (or "Update with the latest changes") carries it.
import { useRef, useState } from "react";
import { t } from "../../../../lib/i18n.js";
import { uploadRoofPhoto } from "../../../../lib/photoShrink.js";


export default function RoofPhoto({ projectId, url, lang, onChange }) {
  const input = useRef(null);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  async function pick(file) {
    if (!file) return;
    setBusy(true); setFailed(false);
    try {
      const url2 = await uploadRoofPhoto(projectId, file);
      onChange(url2);
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={"qb-tool qb-photo" + (url ? " done" : "")}>
      <input ref={input} type="file" accept="image/*" capture="environment" hidden
        onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; pick(f); }} />
      {url
        // eslint-disable-next-line @next/next/no-img-element
        ? <img className="qb-photo-img" src={url} alt="" />
        : <span className="qb-tool-ic" aria-hidden="true">
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 8h3l2-3h6l2 3h3v11H4z" /><circle cx="12" cy="13" r="3.5" /></svg>
          </span>}
      <span className="qb-tool-tx">
        <b>{busy ? t("qb_photo_busy", lang) : url ? t("qb_photo_done", lang) : t("qb_photo", lang)}</b>
        <small role={failed ? "alert" : undefined}>{failed ? t("qb_photo_fail", lang) : t("qb_photo_sub", lang)}</small>
      </span>
      <span className="qb-photo-acts">
        <button type="button" className="btn ghost sm" disabled={busy} onClick={() => input.current?.click()}>{url ? t("qb_photo_change", lang) : t("qb_photo_add", lang)}</button>
        {url && <button type="button" className="btn ghost sm" disabled={busy} onClick={() => onChange(null)}>{t("qb_photo_remove", lang)}</button>}
      </span>
    </div>
  );
}
