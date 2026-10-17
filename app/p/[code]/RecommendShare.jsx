"use client";
// app/p/[code]/RecommendShare.jsx — the signed client recommends their
// installer: Viber, WhatsApp, or the phone's own share sheet, each with a short
// message and the link to the recommendation page (/r/[code]), where a friend
// leaves a name and a phone for the installer to call.
import { useState, useSyncExternalStore } from "react";
import { ppt } from "./text.js";

const canShare = () => typeof navigator !== "undefined" && typeof navigator.share === "function";
const noSubscribe = () => () => {};   // the answer never changes while the page is open

export default function RecommendShare({ code, lang, company }) {
  const native = useSyncExternalStore(noSubscribe, canShare, () => false);
  const [copied, setCopied] = useState(false);
  const url = () => `${location.origin}/r/${code}`;
  const msg = () => ppt("rec_msg", lang, { co: company, url: url() });
  return (
    <div className="pp-rec-btns">
      <a className="pp-btn pp-viber" href="#" onClick={(e) => { e.preventDefault(); location.href = `viber://forward?text=${encodeURIComponent(msg())}`; }}>Viber</a>
      <a className="pp-btn pp-wapp" href="#" onClick={(e) => { e.preventDefault(); window.open(`https://wa.me/?text=${encodeURIComponent(msg())}`, "_blank", "noopener"); }}>WhatsApp</a>
      {native ? (
        <button type="button" className="pp-btn pp-btn-ghost" onClick={() => navigator.share({ text: msg() }).catch(() => {})}>{ppt("rec_more", lang)}</button>
      ) : (
        <button type="button" className="pp-btn pp-btn-ghost" onClick={() => { navigator.clipboard?.writeText(url()); setCopied(true); setTimeout(() => setCopied(false), 1800); }}>
          {copied ? ppt("rec_copied", lang) : ppt("rec_copy", lang)}
        </button>
      )}
    </div>
  );
}
