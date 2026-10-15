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
import { useLayoutEffect, useRef } from "react";
import { useServerInsertedHTML } from "next/navigation";

export default function HtmlLang({ lang }) {
  const l = ["en", "ro", "ru", "uk"].includes(lang) ? lang : "ro";
  const sent = useRef(false);
  useServerInsertedHTML(() => {
    if (sent.current) return null;
    sent.current = true;
    return <script dangerouslySetInnerHTML={{ __html: `document.documentElement.lang=${JSON.stringify(l)}` }} />;
  });
  useLayoutEffect(() => { document.documentElement.lang = l; }, [l]);
  return null;
}
