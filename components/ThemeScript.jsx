"use client";
// components/ThemeScript.jsx — the light or dark theme stamped on <html> before the first paint (lib/inlineScripts.js
// NO_FLASH, allowed by its hash in the Content-Security-Policy).
//
// It used to be a plain <script> in the root layout's <head>. React 19 warns about any <script> it renders in the
// browser ("Encountered a script tag while rendering React component"), and the root layout is rendered in the
// browser whenever Next shows its "not found" page, so every missing page logged it. Written only into the server's
// HTML (useServerInsertedHTML), as lib/HtmlLang.jsx does for the page language, it runs on the first load and the
// browser never renders it again; on later navigations the theme is already on <html>. When Next re-renders the root
// itself (its "not found" page), the attribute the script set is lost with the old <html>, so it is put back after.
import { useEffect, useRef } from "react";
import { useServerInsertedHTML } from "next/navigation";
import { NO_FLASH } from "../lib/inlineScripts.js";

export default function ThemeScript() {
  const sent = useRef(false);
  useServerInsertedHTML(() => {
    if (sent.current) return null;
    sent.current = true;
    return <script dangerouslySetInnerHTML={{ __html: NO_FLASH }} />;
  });
  useEffect(() => {
    const el = document.documentElement;
    if (el.getAttribute("data-theme")) return;
    let t = null;
    try { t = localStorage.getItem("voltmira_theme"); } catch { /* storage blocked */ }
    // the installed app opens light unless dark was picked; a browser tab follows the phone (lib/inlineScripts.js)
    const app = window.navigator.standalone === true || window.matchMedia?.("(display-mode: standalone)").matches;
    if (t !== "dark" && t !== "light") t = !app && window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light";
    el.setAttribute("data-theme", t);
  }, []);
  return null;
}
