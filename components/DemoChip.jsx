"use client";
// components/DemoChip.jsx — the demo workspace's notice as a small chip in the bottom-right corner, in
// place of a full-width bar. The note ("example data, nothing is real") opens on the first page of a
// visit and can be closed; the chip itself, with its "Create your workspace" link, always stays, since
// the demo is for looking only (docs/features/fee-lockdown.md). Above the bottom bar on a phone.
import { useEffect, useState } from "react";
import Link from "next/link";
import { X } from "lucide-react";

const KEY = "vm_demo_note_closed";

export default function DemoChip({ badge, note, cta, closeLabel }) {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    let closed = false;
    try { closed = sessionStorage.getItem(KEY) === "1"; } catch { /* no storage: show it */ }
    if (closed) return;
    // after the first paint (the server cannot know), so the page never waits on it
    const id = requestAnimationFrame(() => setOpen(true));
    return () => cancelAnimationFrame(id);
  }, []);
  const close = () => {
    setOpen(false);
    try { sessionStorage.setItem(KEY, "1"); } catch { /* not remembered, still closes */ }
  };

  return (
    <aside className="demo-chip" aria-label={badge}>
      {open && (
        <div className="demo-pop" role="note">
          <p>{note}</p>
          <button type="button" className="demo-x" onClick={close} aria-label={closeLabel}><X size={14} aria-hidden="true" /></button>
        </div>
      )}
      <div className="demo-row">
        <button type="button" className="demo-badge" aria-expanded={open} onClick={() => (open ? close() : setOpen(true))}>{badge}</button>
        <Link className="demo-cta" href="/login">{cta}</Link>
      </div>
    </aside>
  );
}
