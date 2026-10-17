"use client";
// app/p/[code]/RecommendShare.jsx — the signed client recommends their
// installer: Viber, WhatsApp, or the phone's own share sheet, each with a short
// message and the link to the recommendation page (/r/[code]), where a friend
// leaves a name and a phone for the installer to call. Shows the message
// before it goes, so the client knows exactly what their friend receives.
import { useState, useSyncExternalStore } from "react";
import { ppt } from "./text.js";

const canShare = () => typeof navigator !== "undefined" && typeof navigator.share === "function";
const noSubscribe = () => () => {};   // neither answer changes while the page is open
const originNow = () => location.origin;

export default function RecommendShare({ code, lang, company }) {
  const native = useSyncExternalStore(noSubscribe, canShare, () => false);
  const origin = useSyncExternalStore(noSubscribe, originNow, () => "");
  const [copied, setCopied] = useState(false);
  const url = `${origin}/r/${code}`;
  const msg = ppt("rec_msg", lang, { co: company, url });
  return (
    <>
      <div className="pp-rec-btns">
        <a className="pp-btn pp-viber" href={`viber://forward?text=${encodeURIComponent(msg)}`}>Viber</a>
        <a className="pp-btn pp-wapp" href={`https://wa.me/?text=${encodeURIComponent(msg)}`} target="_blank" rel="noopener noreferrer">WhatsApp</a>
        {native ? (
          <button type="button" className="pp-btn pp-btn-ghost" onClick={() => navigator.share({ text: msg }).catch(() => {})}>{ppt("rec_more", lang)}</button>
        ) : (
          <button type="button" className="pp-btn pp-btn-ghost" onClick={() => { navigator.clipboard?.writeText(url); setCopied(true); setTimeout(() => setCopied(false), 1800); }}>
            {copied ? ppt("rec_copied", lang) : ppt("rec_copy", lang)}
          </button>
        )}
      </div>
      <figure className="pp-rec-msg">
        <figcaption>{ppt("rec_preview", lang)}</figcaption>
        <blockquote>{msg}</blockquote>
      </figure>
    </>
  );
}
