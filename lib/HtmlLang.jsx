"use client";
// lib/HtmlLang.jsx — tells the browser the page's real language.
//
// The root layout renders <html lang="en"> for every page, because only it
// can render <html> and it does not know whose page it is. Pages in Romanian
// Russian or Ukrainian (the app, a client's proposal, the widgets) put this near the top
// instead. On the first load a one-line script goes into the server HTML, so
// the attribute is set while the page is still being read, before Chrome
// decides whether to offer "Translate this page from English" and before a
// screen reader picks its voice. The script is written only into the server
// stream (useServerInsertedHTML): React 19 warns about any <script> it renders
// on the client, which a plain <script> here did on every navigation into the
// app. On a client navigation an effect sets the attribute instead. The root
// <html> has suppressHydrationWarning, so React does not object to the change.
//
// `persist` (the signed-in app only) also keeps the workspace language on the
// device: in localStorage for the client error boundary, which cannot read the
// company row, and in a cookie so /login greets a signed-out user in it. Same
// two paths: the server stream on the first load, an effect after that.
//
// The script's text comes from lib/inlineScripts.js, where the
// Content-Security-Policy hashes it: it runs because its exact text is
// allowed, with no nonce to pass down.
import { useLayoutEffect, useRef } from "react";
import { useServerInsertedHTML } from "next/navigation";
import { htmlLangScript, PAGE_LANGS } from "./inlineScripts.js";

export default function HtmlLang({ lang, persist = false }) {
  const l = PAGE_LANGS.includes(lang) ? lang : "ro";
  const sent = useRef(false);
  useServerInsertedHTML(() => {
    if (sent.current) return null;
    sent.current = true;
    return <script dangerouslySetInnerHTML={{ __html: htmlLangScript(l, persist) }} />;
  });
  useLayoutEffect(() => {
    document.documentElement.lang = l;
    if (!persist) return;
    try { localStorage.setItem("voltmira_lang", l); } catch { /* storage blocked */ }
    document.cookie = `voltmira_lang=${l}; path=/; max-age=31536000; samesite=lax`;
  }, [l, persist]);
  return null;
}
