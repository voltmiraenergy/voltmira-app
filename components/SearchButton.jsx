"use client";
// components/SearchButton.jsx — a button that opens the Ctrl+K search (components/CommandPalette.jsx,
// mounted once in the app layout). Used in the sidebar, the phone's More sheet and the dashboard.
import { useEffect, useState } from "react";
import { OPEN_EVENT } from "./CommandPalette.jsx";

export default function SearchButton({ label, className = "dx-search", kbd = true }) {
  const [mac, setMac] = useState(false);
  useEffect(() => {
    const id = requestAnimationFrame(() => setMac(/Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent)));
    return () => cancelAnimationFrame(id);
  }, []);
  return (
    <button type="button" className={className} aria-haspopup="dialog" onClick={() => window.dispatchEvent(new Event(OPEN_EVENT))}>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m21 21-4.34-4.34" /><circle cx="11" cy="11" r="8" /></svg>
      <span>{label}</span>
      {kbd && <kbd>{mac ? "⌘" : "Ctrl"} K</kbd>}
    </button>
  );
}
