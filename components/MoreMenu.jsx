"use client";
// components/MoreMenu.jsx — a "more" button (three dots) that opens a small menu of secondary actions,
// so a row keeps one clear main button. Keyboard: Enter or Space opens it, the arrows move, Escape
// closes and gives focus back; a click outside closes it. Near the bottom of the screen it opens upward.
//   items  [{ label, onClick, danger?, disabled? }]  (falsy entries are skipped)
//   label  the button's accessible name ("More actions")
import { useEffect, useId, useRef, useState } from "react";
import { Ellipsis } from "lucide-react";
import "./moreMenu.css";

export default function MoreMenu({ items, label, disabled = false }) {
  const list = (items || []).filter(Boolean);
  const [open, setOpen] = useState(false);
  const [up, setUp] = useState(false);
  const wrap = useRef(null);
  const btn = useRef(null);
  const id = useId();

  useEffect(() => {
    if (!open) return;
    const away = (e) => { if (!wrap.current?.contains(e.target)) setOpen(false); };
    document.addEventListener("pointerdown", away);
    wrap.current?.querySelector('[role="menuitem"]:not([disabled])')?.focus();
    return () => document.removeEventListener("pointerdown", away);
  }, [open]);

  function toggle() {
    if (!open) {
      const r = btn.current?.getBoundingClientRect();
      setUp(!!r && r.bottom + 46 * list.length + 24 > window.innerHeight);
    }
    setOpen((v) => !v);
  }

  function onKey(e) {
    if (e.key === "Escape") { e.preventDefault(); setOpen(false); btn.current?.focus(); return; }
    if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
    e.preventDefault();
    const els = [...(wrap.current?.querySelectorAll('[role="menuitem"]:not([disabled])') || [])];
    const at = els.indexOf(document.activeElement);
    els[(at + (e.key === "ArrowDown" ? 1 : -1) + els.length) % els.length]?.focus();
  }

  if (!list.length) return null;
  return (
    <div className="mm" ref={wrap} onKeyDown={onKey}>
      <button ref={btn} type="button" className="dx-btn icon mm-btn" disabled={disabled} onClick={toggle}
        aria-haspopup="menu" aria-expanded={open} aria-controls={open ? id : undefined} aria-label={label} title={label}>
        <Ellipsis size={16} aria-hidden="true" />
      </button>
      {open && (
        <div id={id} className={"mm-list" + (up ? " up" : "")} role="menu" aria-label={label}>
          {list.map((it) => (
            <button key={it.label} type="button" role="menuitem" className={"mm-item" + (it.danger ? " danger" : "")}
              disabled={it.disabled} onClick={() => { setOpen(false); it.onClick?.(); }}>{it.label}</button>
          ))}
        </div>
      )}
    </div>
  );
}
