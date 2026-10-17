"use client";
// app/(app)/projects/[id]/RoofPhoto.jsx — "Roof photo" in the quote's tools:
// the installer's own photo of the roof (a drone shot is best) becomes the
// offer's picture, sharper than satellite imagery outside Chișinău. The photo
// is shrunk here to a JPEG of at most 1,600 px, sent to the quote's
// roof-photo route, and its address kept in site_design.photoUrl; the next
// offer link (or "Update with the latest changes") carries it.
import { useRef, useState } from "react";
import { t } from "../../../../lib/i18n.js";

const MAX = 1600;

/** A photo as a JPEG blob no larger than MAX on its long side. */
function shrink(file) {
  return new Promise((resolve, reject) => {
    if (!file?.type?.startsWith("image/")) { reject(new Error("not_image")); return; }
    // read as a data: URL, which the CSP allows for images (a blob: URL it blocks)
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("read"));
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const s = Math.min(1, MAX / Math.max(img.width, img.height));
        const c = document.createElement("canvas");
        c.width = Math.max(1, Math.round(img.width * s)); c.height = Math.max(1, Math.round(img.height * s));
        c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
        c.toBlob((b) => (b ? resolve(b) : reject(new Error("encode"))), "image/jpeg", 0.82);
      };
      img.onerror = () => reject(new Error("decode"));
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

export default function RoofPhoto({ projectId, url, lang, onChange }) {
  const input = useRef(null);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  async function pick(file) {
    if (!file) return;
    setBusy(true); setFailed(false);
    try {
      const blob = await shrink(file);
      const form = new FormData();
      form.append("photo", blob, "roof.jpg");
      const res = await fetch(`/api/projects/${projectId}/roof-photo`, { method: "POST", body: form });
      const j = await res.json().catch(() => ({}));
      if (!res.ok || !j.url) throw new Error(j.error || "upload");
      onChange(j.url);
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
