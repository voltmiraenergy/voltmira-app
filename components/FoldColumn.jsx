"use client";
// components/FoldColumn.jsx — a long page made short on a phone. Each direct
// child of the column (a section card, a panel) is shown folded: its first
// lines (the heading and what it says at a glance) with a fade and "Show all".
// Short sections are left as they are, and a link to something inside a fold
// (#workflow, say) opens it. On a wider screen nothing changes: the children
// render exactly as before, with no wrapper. Used by the quote page
// (app/(app)/projects/[id]/editor.jsx), whose 18 sections ran to 10,000 px.
import { Children, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { t } from "../lib/i18n.js";

const PHONE = "(max-width: 760px)";
/** What a folded section shows, px; anything not much taller stays open. */
const SHOWN = 170, WORTH = 300;

const subscribe = (cb) => {
  if (typeof window === "undefined" || !window.matchMedia) return () => {};
  const m = window.matchMedia(PHONE);
  m.addEventListener("change", cb);
  return () => m.removeEventListener("change", cb);
};
const isPhone = () => typeof window !== "undefined" && !!window.matchMedia?.(PHONE).matches;

function Fold({ lang, children }) {
  const body = useRef(null);
  const [open, setOpen] = useState(false);
  const [tall, setTall] = useState(false);
  // folding is worth it only for a section much taller than what a fold shows
  useEffect(() => {
    const el = body.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => setTall(el.scrollHeight > WORTH));
    ro.observe(el);
    if (el.firstElementChild) ro.observe(el.firstElementChild);
    return () => ro.disconnect();
  }, []);
  // a link to something inside opens the fold
  useEffect(() => {
    const check = () => {
      try {
        const target = location.hash && document.querySelector(location.hash);
        if (target && body.current?.contains(target)) setOpen(true);
      } catch { /* not a selector */ }
    };
    const id = setTimeout(check, 0);
    window.addEventListener("hashchange", check);
    return () => { clearTimeout(id); window.removeEventListener("hashchange", check); };
  }, []);
  const closed = tall && !open;
  return (
    <div className="fold-wrap">
      <div ref={body} className={"fold-body" + (closed ? " closed" : "")} style={closed ? { maxHeight: SHOWN } : undefined}
        onFocusCapture={() => { if (closed) setOpen(true); }}>
        {children}
      </div>
      {tall && (
        <button type="button" className="fold-btn" aria-expanded={open}
          onClick={() => {
            setOpen((o) => !o);
            if (open) body.current?.scrollIntoView({ block: "start", behavior: "smooth" });
          }}>
          {open ? <ChevronUp size={16} aria-hidden="true" /> : <ChevronDown size={16} aria-hidden="true" />}
          {t(open ? "fold_less" : "fold_more", lang)}
        </button>
      )}
    </div>
  );
}

export default function FoldColumn({ className, lang = "en", children }) {
  const phone = useSyncExternalStore(subscribe, isPhone, () => false);
  if (!phone) return <div className={className}>{children}</div>;
  return (
    <div className={className}>
      {Children.map(children, (c) => (c ? <Fold lang={lang}>{c}</Fold> : c))}
    </div>
  );
}
