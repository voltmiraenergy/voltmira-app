"use client";
// components/AppNavBar.jsx — back, forward, reload and home for the installed
// (home-screen) app, on every page: the app, sign-in, a client's offer. There
// the phone shows no browser bar and iOS has no back gesture, so without this
// a page reached by a link was a dead end. Shown only when installed, decided
// by CSS (display-mode: standalone, or the is-standalone class the theme
// script sets for older iPhones), so it is there from the first paint and
// never in a browser tab or a printed page.
//
// It also hosts the in-app PDF viewer (PdfViewer.jsx): in the installed app a
// link to a PDF, or a button that asks for one (lib/openPdf.js), opens it
// there, with an X, instead of replacing the whole app.
import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import { usePathname, useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight, RotateCw, House } from "lucide-react";
import PdfViewer from "./PdfViewer.jsx";
import { isPdfUrl, isStandalone } from "../lib/openPdf.js";
import { parentPath } from "../lib/navPaths.js";

const T = {
  en: { back: "Back", fwd: "Forward", reload: "Reload", home: "Home", nav: "Navigation" },
  ro: { back: "Înapoi", fwd: "Înainte", reload: "Reîncarcă", home: "Acasă", nav: "Navigare" },
  ru: { back: "Назад", fwd: "Вперёд", reload: "Обновить", home: "Главная", nav: "Навигация" },
  uk: { back: "Назад", fwd: "Вперед", reload: "Оновити", home: "Головна", nav: "Навігація" },
};

const CSS = `
.anb{display:none}
@media (display-mode: standalone){.anb{display:flex}}
html.is-standalone .anb{display:flex}
@media print{.anb,.pdfv{display:none!important}}
.anb{position:sticky;top:0;z-index:58;align-items:center;gap:2px;
  padding:calc(env(safe-area-inset-top,0px) + 4px) 8px 4px;background:#142A21;color:#F6F5F0;
  font:500 13px/1 Inter,system-ui,-apple-system,"Segoe UI",sans-serif}
.anb-btn{display:inline-flex;align-items:center;justify-content:center;width:44px;height:40px;border:0;border-radius:10px;
  background:none;color:inherit;cursor:pointer;-webkit-tap-highlight-color:transparent}
.anb-btn:active{background:rgba(255,255,255,.14)}
.anb-btn:disabled{opacity:.35}
.anb-btn:focus-visible{outline:2px solid #E89B2D;outline-offset:1px}
.anb-sp{flex:1}
/* in the installed app this bar is the way back: the app's own back bar steps aside */
@media (display-mode: standalone){.m-back,.m-back.is-app{display:none!important}}
html.is-standalone .m-back{display:none!important}

.pdfv{position:fixed;inset:0;z-index:300;display:flex;flex-direction:column;background:#2B302D;color:#F6F5F0;
  font:500 14px/1.4 Inter,system-ui,-apple-system,"Segoe UI",sans-serif}
.pdfv-bar{display:flex;align-items:center;gap:8px;padding:calc(env(safe-area-inset-top,0px) + 6px) 8px 6px;background:#142A21}
.pdfv-btn{display:inline-flex;align-items:center;gap:6px;min-height:40px;padding:0 12px;border:0;border-radius:10px;
  background:rgba(255,255,255,.1);color:inherit;font:inherit;font-weight:600;cursor:pointer}
.pdfv-btn:disabled{opacity:.4}
.pdfv-btn:focus-visible{outline:2px solid #E89B2D;outline-offset:1px}
.pdfv-title{flex:1;min-width:0;text-align:center;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.pdfv-pages{flex:1;overflow:auto;-webkit-overflow-scrolling:touch;padding:12px 12px calc(env(safe-area-inset-bottom,0px) + 16px)}
.pdfv-canvases{display:grid;gap:12px;justify-items:center}
.pdfv-page{display:block;width:100%;height:auto;background:#fff;border-radius:2px;box-shadow:0 4px 18px rgba(0,0,0,.35)}
.pdfv-msg{margin:40px auto;max-width:340px;text-align:center;color:#D9DED9}
.pdfv-msg a{color:#F2B85F}
`;

const noSubscribe = () => () => {};
const langNow = () => document.documentElement.lang || "ro";
const subscribeLang = (cb) => {
  const mo = new MutationObserver(cb);
  mo.observe(document.documentElement, { attributes: true, attributeFilter: ["lang"] });
  return () => mo.disconnect();
};

export default function AppNavBar() {
  const path = usePathname() || "/";
  const router = useRouter();
  const lang = useSyncExternalStore(subscribeLang, langNow, () => "ro");
  const tx = T[lang] || T.ro;
  const installed = useSyncExternalStore(noSubscribe, isStandalone, () => false);
  const [pdf, setPdf] = useState(null);   // { url, title } while the viewer is open
  // the Navigation API says whether there is a page to go back or forward to;
  // read after the first paint (the server cannot know), and without it both stay on
  const [can, setCan] = useState({ back: true, fwd: true });
  useEffect(() => {
    const nav = window.navigation;
    if (!nav) return;
    const read = () => setCan({ back: nav.canGoBack ?? true, fwd: nav.canGoForward ?? true });
    read();
    nav.addEventListener("currententrychange", read);
    return () => nav.removeEventListener("currententrychange", read);
  }, []);
  const canBack = can.back, canFwd = can.fwd;

  const open = useCallback((url, title) => {
    // a history entry for the viewer, so Back (this bar, Android's button) closes it
    history.pushState({ ...(history.state || {}), vmPdf: true }, "");
    setPdf({ url, title });
  }, []);
  const close = useCallback(() => {
    if (history.state?.vmPdf) history.back(); else setPdf(null);
  }, []);

  useEffect(() => {
    const onPop = () => { if (!history.state?.vmPdf) setPdf(null); };
    const onAsk = (e) => open(e.detail.url, e.detail.title);
    window.addEventListener("popstate", onPop);
    window.addEventListener("vm:pdf", onAsk);
    return () => { window.removeEventListener("popstate", onPop); window.removeEventListener("vm:pdf", onAsk); };
  }, [open]);

  // installed: a tap on a link to a PDF opens the viewer instead of leaving the app for it
  useEffect(() => {
    if (!installed) return;
    const onClick = (e) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey) return;
      const a = e.target?.closest?.("a[href]");
      if (!a || a.hasAttribute("download")) return;
      // a PDF by its address, or marked data-pdf (the portfolio's report and teaser)
      if (!a.hasAttribute("data-pdf") && !isPdfUrl(a.href, location.origin)) return;
      if (new URL(a.href, location.href).origin !== location.origin) return;
      e.preventDefault();
      open(a.href, "");   // the viewer heads it with the PDF's own file name
    };
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, [installed, open]);

  const back = () => {
    if (canBack && history.length > 1) history.back();
    else router.push(path.startsWith("/p/") || path.startsWith("/r/") || path === "/login" ? "/dashboard" : parentPath(path));
  };

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <nav className="anb" aria-label={tx.nav}>
        <button type="button" className="anb-btn" onClick={back} aria-label={tx.back} title={tx.back}><ChevronLeft size={24} aria-hidden="true" /></button>
        <button type="button" className="anb-btn" onClick={() => history.forward()} disabled={!canFwd} aria-label={tx.fwd} title={tx.fwd}><ChevronRight size={24} aria-hidden="true" /></button>
        <span className="anb-sp" />
        <button type="button" className="anb-btn" onClick={() => location.reload()} aria-label={tx.reload} title={tx.reload}><RotateCw size={19} aria-hidden="true" /></button>
        {path !== "/login" && path !== "/dashboard" && (
          <button type="button" className="anb-btn" onClick={() => router.push("/dashboard")} aria-label={tx.home} title={tx.home}><House size={20} aria-hidden="true" /></button>
        )}
      </nav>
      {pdf && <PdfViewer url={pdf.url} title={pdf.title} lang={lang} onClose={close} />}
    </>
  );
}
