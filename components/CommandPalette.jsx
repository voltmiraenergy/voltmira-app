"use client";
// components/CommandPalette.jsx — jump anywhere from the keyboard, on every page (mounted once in
// app/(app)/layout.jsx).
//
// ⌘K / Ctrl+K (or "/" when not typing) opens it, and so does any search button on the page
// (components/SearchButton.jsx sends a "vm:search" event). It looks through the quotes, the signed jobs
// and the open leads, loaded from /api/search-index each time it opens, plus every page, with accents
// folded so "sirbu" finds "Sîrbu" and "chisinau" finds "Chișinău", which is how people actually type on
// a phone keyboard.
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import "./commandPalette.css";

const fold = (s) => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
export const OPEN_EVENT = "vm:search";

const I = {
  search: <><path d="m21 21-4.34-4.34" /><circle cx="11" cy="11" r="8" /></>,
  plus: <><path d="M5 12h14" /><path d="M12 5v14" /></>,
  quote: <><path d="M12.659 22H18a2 2 0 0 0 2-2V8a2.4 2.4 0 0 0-.706-1.706l-3.588-3.588A2.4 2.4 0 0 0 14 2H6a2 2 0 0 0-2 2v9.34" /><path d="M14 2v5a1 1 0 0 0 1 1h5" /></>,
  job: <><path d="M10 10V5a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v5" /><path d="M14 6a6 6 0 0 1 6 6v3" /><path d="M4 15v-3a6 6 0 0 1 6-6" /><rect x="2" y="15" width="20" height="4" rx="1" /></>,
  lead: <><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /></>,
  page: <><path d="M7 7h10v10" /><path d="M7 17 17 7" /></>,
  enter: <><path d="M20 4v7a4 4 0 0 1-4 4H4" /><path d="m9 10-5 5 5 5" /></>,
};
const Svg = ({ d, size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{I[d]}</svg>
);

export default function CommandPalette({ pages, labels, statusLabels, newQuoteAction }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [idx, setIdx] = useState(0);
  const [data, setData] = useState(null);   // { quotes, jobs, leads } once loaded
  const [, start] = useTransition();
  const inputRef = useRef(null);
  const listRef = useRef(null);

  useEffect(() => {
    function onKey(e) {
      const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(e.target?.tagName) || e.target?.isContentEditable;
      if ((e.key === "k" || e.key === "K") && (e.metaKey || e.ctrlKey)) { e.preventDefault(); setOpen((v) => !v); }
      else if (e.key === "/" && !typing && !open) { e.preventDefault(); setOpen(true); }
    }
    const onAsk = () => setOpen(true);
    window.addEventListener("keydown", onKey);
    window.addEventListener(OPEN_EVENT, onAsk);
    return () => { window.removeEventListener("keydown", onKey); window.removeEventListener(OPEN_EVENT, onAsk); };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    let live = true;
    const id = setTimeout(() => { setQ(""); setIdx(0); inputRef.current?.focus(); }, 10);
    // the quotes, jobs and leads, fresh each time it opens (they change); offline it keeps the last ones
    fetch("/api/search-index", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (d && live) setData(d); })
      .catch(() => { /* offline: what it had, and the pages */ });
    return () => { live = false; clearTimeout(id); };
  }, [open]);

  const groups = useMemo(() => {
    const n = fold(q.trim());
    const hit = (...fields) => !n || fields.some((f) => fold(f).includes(n));
    const out = [];
    const actions = newQuoteAction ? [{ kind: "new", label: labels.newQuote, icon: "plus" }].filter((a) => hit(a.label)) : [];
    if (actions.length) out.push({ title: labels.actions, items: actions });
    const row = (icon) => (p) => ({ kind: "href", href: `/projects/${p.id}`, label: p.title || labels.untitled, sub: [p.client, p.address].filter(Boolean).join(", "), tag: statusLabels[p.status], tagCls: p.status, icon });
    const qs = (data?.quotes || []).filter((p) => hit(p.title, p.client, p.address)).slice(0, n ? 8 : 4).map(row("quote"));
    if (qs.length) out.push({ title: labels.quotes, items: qs });
    const js = (data?.jobs || []).filter((p) => hit(p.title, p.client, p.address)).slice(0, n ? 6 : 3).map(row("job"));
    if (js.length) out.push({ title: labels.jobs, items: js });
    const ls = (data?.leads || []).filter((l) => hit(l.name, l.phone, l.email)).slice(0, n ? 6 : 3)
      .map((l) => ({ kind: "href", href: `/leads?q=${encodeURIComponent(l.name || l.phone || l.email || "")}`, label: l.name || l.phone || l.email, sub: l.phone || l.email || "", icon: "lead" }));
    if (ls.length) out.push({ title: labels.leads, items: ls });
    const ps = pages.filter((p) => hit(p.label)).map((p) => ({ kind: "href", href: p.href, label: p.label, icon: "page" }));
    if (ps.length) out.push({ title: labels.pages, items: ps });
    return out;
  }, [q, data, pages, labels, statusLabels, newQuoteAction]);
  const flat = groups.flatMap((g) => g.items);

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

  if (!open) return null;
  let n = -1;
  // Portalled to the app root: animated sections use transforms, which would otherwise pin this fixed overlay.
  return createPortal(
    <div className="dx-pal-wrap" role="presentation" onMouseDown={(e) => { if (e.target === e.currentTarget) setOpen(false); }}>
      <div className="dx-pal" role="dialog" aria-modal="true" aria-label={labels.trigger}>
        <div className="dx-pal-in">
          <Svg d="search" size={18} />
          <input ref={inputRef} value={q} onChange={(e) => { setQ(e.target.value); setIdx(0); }} onKeyDown={onInputKey}
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
                  <div key={it.href || it.label} id={`dx-pal-opt-${i}`} role="option" aria-selected={i === idx}
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
  );
}
