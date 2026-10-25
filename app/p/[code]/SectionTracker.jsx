"use client";
// app/p/[code]/SectionTracker.jsx — which parts of the offer the client reads, and which option they look at, so the
// installer can answer what was actually read. Only seconds per section and the option's name are sent (no
// personal data), only while the section is on screen and the tab is in front, and never when the client said no
// (the link below, kept in this browser), the browser asks not to be tracked, or the offer is the installer's own
// view (the server drops those). Shown only when OFFER_TRACKING is on (lib/offerSwitches.js).
import { useEffect, useRef, useState } from "react";
import { ppt } from "./text.js";

const storeKey = (code) => "voltmira_notrack_" + code;
function refused(code) {
  try {
    if (navigator.doNotTrack === "1" || window.globalPrivacyControl === true) return true;
    return localStorage.getItem(storeKey(code)) === "1";
  } catch {
    return false;
  }
}

function send(code, body) {
  const url = `/api/proposal/${encodeURIComponent(code)}`;
  const json = JSON.stringify(body);
  try {
    if (navigator.sendBeacon && navigator.sendBeacon(url, new Blob([json], { type: "application/json" }))) return;
  } catch { /* fall through */ }
  fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: json, keepalive: true }).catch(() => {});
}

export default function SectionTracker({ code, lang, company }) {
  const [off, setOff] = useState(() => (typeof window === "undefined" ? false : refused(code)));
  const stopped = useRef(off);

  useEffect(() => {
    if (stopped.current) return;
    const seen = new Map();          // section name -> seconds not yet sent
    const optSeen = new Map();       // option name -> seconds looked at
    const optSent = new Set();
    const visible = new Set();
    const nameOf = (el) => el.dataset.opt ? "opt:" + el.dataset.opt
      : el.id === "pp-hero" ? "hero" : (el.getAttribute("aria-labelledby") || "").replace(/^pp-/, "").replace(/-h$/, "");
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) { const n = nameOf(e.target); if (e.isIntersecting) visible.add(n); else visible.delete(n); }
    }, { threshold: 0.35 });
    const els = document.querySelectorAll("#pp-hero, section[aria-labelledby^='pp-'], [data-opt]");
    els.forEach((el) => io.observe(el));

    const flush = () => {
      if (stopped.current) return;
      for (const [s, sec] of seen) if (sec >= 2) { send(code, { kind: "section", section: s, seconds: sec }); seen.delete(s); }
    };
    const tick = setInterval(() => {
      if (stopped.current || document.visibilityState !== "visible") return;
      for (const n of visible) {
        if (n.startsWith("opt:")) {
          const o = n.slice(4);
          const t = (optSeen.get(o) || 0) + 1;
          optSeen.set(o, t);
          if (t >= 3 && !optSent.has(o)) { optSent.add(o); send(code, { kind: "option", option: o }); }
        } else if (/^[a-z]{2,12}$/.test(n)) seen.set(n, (seen.get(n) || 0) + 1);
      }
    }, 1000);
    const every = setInterval(flush, 20000);
    const onHide = () => { if (document.visibilityState === "hidden") flush(); };
    document.addEventListener("visibilitychange", onHide);
    window.addEventListener("pagehide", flush);
    return () => {
      flush();
      io.disconnect(); clearInterval(tick); clearInterval(every);
      document.removeEventListener("visibilitychange", onHide);
      window.removeEventListener("pagehide", flush);
    };
  }, [code]);

  function refuse() {
    stopped.current = true;
    try { localStorage.setItem(storeKey(code), "1"); } catch { /* storage blocked: stops for this visit */ }
    setOff(true);
  }

  return (
    <p className="pp-track" suppressHydrationWarning>
      {off ? ppt("track_offed", lang) : (
        <>
          {ppt("track_note", lang, { co: company })}{" "}
          <button type="button" className="pp-link-btn" onClick={refuse}>{ppt("track_off", lang)}</button>
        </>
      )}
    </p>
  );
}
