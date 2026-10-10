"use client";
// app/(app)/dashboard/CommandPalette.jsx — jump anywhere from the keyboard.
//
// ⌘K / Ctrl+K (or "/" when not typing) opens it. It searches the quotes and
// leads the dashboard already loaded, plus every page in the sidebar, with
// accents folded so "sirbu" finds "Sîrbu" and "chisinau" finds "Chișinău",
// which is how people actually type on a phone keyboard.
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";

const fold = (s) => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

const I = {
  search: <><path d="m21 21-4.34-4.34" /><circle cx="11" cy="11" r="8" /></>,
  plus: <><path d="M5 12h14" /><path d="M12 5v14" /></>,
  quote: <><path d="M12.659 22H18a2 2 0 0 0 2-2V8a2.4 2.4 0 0 0-.706-1.706l-3.588-3.588A2.4 2.4 0 0 0 14 2H6a2 2 0 0 0-2 2v9.34" /><path d="M14 2v5a1 1 0 0 0 1 1h5" /></>,
  lead: <><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /></>,
  page: <><path d="M7 7h10v10" /><path d="M7 17 17 7" /></>,
  enter: <><path d="M20 4v7a4 4 0 0 1-4 4H4" /><path d="m9 10-5 5 5 5" /></>,
};
const Svg = ({ d, size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{I[d]}</svg>
);

export default function CommandPalette({ quotes, leads, pages, labels, statusLabels, newQuoteAction }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [idx, setIdx] = useState(0);
  const [, start] = useTransition();
  const inputRef = useRef(null);
  const listRef = useRef(null);
  const [isMac, setIsMac] = useState(false);
  useEffect(() => { setIsMac(/Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent)); }, []);

  useEffect(() => {
    function onKey(e) {
      const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(e.target?.tagName) || e.target?.isContentEditable;
      if ((e.key === "k" || e.key === "K") && (e.metaKey || e.ctrlKey)) { e.preventDefault(); setOpen((v) => !v); }
      else if (e.key === "/" && !typing && !open) { e.preventDefault(); setOpen(true); }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  useEffect(() => {
    if (open) { setQ(""); setIdx(0); setTimeout(() => inputRef.current?.focus(), 10); }
  }, [open]);

  const groups = useMemo(() => {
    const n = fold(q.trim());
    const hit = (...fields) => !n || fields.some((f) => fold(f).includes(n));
    const out = [];
    const actions = [{ kind: "new", label: labels.newQuote, icon: "plus" }].filter((a) => hit(a.label));
    if (actions.length) out.push({ title: labels.actions, items: actions });
    const qs = quotes.filter((p) => hit(p.title, p.client)).slice(0, n ? 8 : 5)
      .map((p) => ({ kind: "href", href: `/projects/${p.id}`, label: p.title, sub: p.client, tag: statusLabels[p.status], tagCls: p.status, icon: "quote" }));
    if (qs.length) out.push({ title: labels.quotes, items: qs });
    const ls = leads.filter((l) => hit(l.name, l.phone, l.email)).slice(0, n ? 6 : 3)
      .map((l) => ({ kind: "href", href: "/leads", label: l.name, sub: l.phone || l.email || "", icon: "lead" }));
    if (ls.length) out.push({ title: labels.leads, items: ls });
    const ps = pages.filter((p) => hit(p.label)).map((p) => ({ kind: "href", href: p.href, label: p.label, icon: "page" }));
    if (ps.length) out.push({ title: labels.pages, items: ps });
    return out;
  }, [q, quotes, leads, pages, labels, statusLabels]);
  const flat = groups.flatMap((g) => g.items);

  useEffect(() => { setIdx(0); }, [q]);
  useEffect(() => {
    listRef.current?.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: "nearest" });
  }, [idx]);

  function choose(item) {
    if (!item) return;
    setOpen(false);
    if (item.kind === "new") start(() => newQuoteAction());
    else router.push(item.href);
  }
  function onInputKey(e) {
    if (e.key === "ArrowDown") { e.preventDefault(); setIdx((i) => Math.min(flat.length - 1, i + 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setIdx((i) => Math.max(0, i - 1)); }
    else if (e.key === "Enter") { e.preventDefault(); choose(flat[idx]); }
    else if (e.key === "Escape") { e.preventDefault(); setOpen(false); }
  }

  let n = -1;
  return (
    <>
      <button type="button" className="dx-search" onClick={() => setOpen(true)} aria-haspopup="dialog">
        <Svg d="search" />
        <span>{labels.trigger}</span>
        <kbd>{isMac ? "⌘" : "Ctrl"} K</kbd>
      </button>

      {/* Portalled to the app root: the dashboard sections animate in with a
          transform, which would otherwise pin this fixed overlay inside the header. */}
      {open && createPortal(
        <div className="dx-pal-wrap" role="presentation" onMouseDown={(e) => { if (e.target === e.currentTarget) setOpen(false); }}>
          <div className="dx-pal" role="dialog" aria-modal="true" aria-label={labels.trigger}>
            <div className="dx-pal-in">
              <Svg d="search" size={18} />
              <input ref={inputRef} value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={onInputKey}
                placeholder={labels.placeholder} aria-label={labels.placeholder}
                role="combobox" aria-expanded="true" aria-controls="dx-pal-list"
                aria-activedescendant={flat[idx] ? `dx-pal-opt-${idx}` : undefined} />
              <kbd>Esc</kbd>
            </div>
            <div className="dx-pal-list" id="dx-pal-list" role="listbox" ref={listRef}>
              {flat.length === 0 && <p className="dx-pal-none">{labels.none}</p>}
              {groups.map((g) => (
                <div key={g.title} className="dx-pal-group" role="group" aria-label={g.title}>
                  <p className="dx-pal-gt">{g.title}</p>
                  {g.items.map((it) => {
                    n++;
                    const i = n;
                    return (
                      <div key={it.label + i} id={`dx-pal-opt-${i}`} role="option" aria-selected={i === idx}
                        className={"dx-pal-opt" + (i === idx ? " on" : "")}
                        onMouseMove={() => setIdx(i)} onClick={() => choose(it)}>
                        <span className="dx-pal-ic"><Svg d={it.icon} /></span>
                        <span className="dx-pal-tx"><b>{it.label}</b>{it.sub && <small>{it.sub}</small>}</span>
                        {it.tag && <span className={"chip static " + it.tagCls}>{it.tag}</span>}
                        {i === idx && <span className="dx-pal-enter" aria-hidden="true"><Svg d="enter" size={14} /></span>}
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
            <p className="dx-pal-hint">{labels.hint}</p>
          </div>
        </div>,
        document.querySelector(".app") || document.body
      )}
    </>
  );
}
