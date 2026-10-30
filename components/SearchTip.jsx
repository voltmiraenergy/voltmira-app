"use client";
// components/SearchTip.jsx — a one-line tip on the dashboard that the search (components/CommandPalette.jsx)
// finds any client, quote or page from anywhere: Ctrl K on a computer, "Search" in the More menu on a phone.
// It stops showing once the search has been used, or when closed (this browser only).
import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { OPEN_EVENT } from "./CommandPalette.jsx";

const KEY = "vm_search_tip";

export default function SearchTip({ desk, touch, closeLabel }) {
  const [show, setShow] = useState(null);   // null until the browser says whether it is a phone
  useEffect(() => {
    let off = false;
    try { off = localStorage.getItem(KEY) === "1"; } catch { /* no storage: show it */ }
    if (off) return;
    const coarse = window.matchMedia?.("(pointer: coarse)").matches;
    const id = requestAnimationFrame(() => setShow(coarse ? "touch" : "desk"));
    // using the search once is enough: the tip has done its job
    const used = () => { try { localStorage.setItem(KEY, "1"); } catch { /* fine */ } setShow(null); };
    window.addEventListener(OPEN_EVENT, used);
    const onKey = (e) => { if ((e.key === "k" || e.key === "K") && (e.metaKey || e.ctrlKey)) used(); };
    window.addEventListener("keydown", onKey);
    return () => { cancelAnimationFrame(id); window.removeEventListener(OPEN_EVENT, used); window.removeEventListener("keydown", onKey); };
  }, []);
  if (!show) return null;
  const close = () => { try { localStorage.setItem(KEY, "1"); } catch { /* fine */ } setShow(null); };
  return (
    <p className="search-tip" role="note">
      <span>{show === "touch" ? touch : desk}</span>
      <button type="button" onClick={close} aria-label={closeLabel}><X size={14} aria-hidden="true" /></button>
    </p>
  );
}
