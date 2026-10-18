"use client";
// components/PdfViewer.jsx — a PDF inside the installed app, full screen, with
// an X to close it and a Save button (the phone's share sheet: Files, Mail,
// WhatsApp, or a download where there is no share sheet). Every page is drawn
// with PDF.js (unpdf, already used by the study reader): an iPhone shows only
// the first page of a PDF placed in a frame. Opened by AppNavBar.jsx.
import { useEffect, useRef, useState } from "react";
import { X, Share } from "lucide-react";

const T = {
  en: { close: "Close", save: "Save", loading: "Preparing the PDF...", failed: "The PDF could not be opened.", browser: "Open in the browser" },
  ro: { close: "Închide", save: "Salvează", loading: "Se pregătește PDF-ul...", failed: "PDF-ul nu s-a putut deschide.", browser: "Deschide în browser" },
  ru: { close: "Закрыть", save: "Сохранить", loading: "Готовим PDF...", failed: "Не удалось открыть PDF.", browser: "Открыть в браузере" },
  uk: { close: "Закрити", save: "Зберегти", loading: "Готуємо PDF...", failed: "Не вдалося відкрити PDF.", browser: "Відкрити в браузері" },
};

const nameFrom = (res, url) => {
  const cd = res.headers.get("content-disposition") || "";
  const m = /filename\*?=(?:UTF-8'')?"?([^";]+)"?/i.exec(cd);
  if (m) { try { return decodeURIComponent(m[1]); } catch { return m[1]; } }
  const last = new URL(url, location.href).pathname.split("/").filter(Boolean).slice(-2).join("-");
  return (last || "document").replace(/\.pdf$/i, "") + ".pdf";
};

export default function PdfViewer({ url, title, lang = "ro", onClose }) {
  const tx = T[lang] || T.ro;
  const pagesRef = useRef(null);
  const [state, setState] = useState("loading");   // loading | ready | failed
  const [file, setFile] = useState(null);

  useEffect(() => {
    let dead = false;
    (async () => {
      try {
        const res = await fetch(url, { credentials: "same-origin" });
        const type = res.headers.get("content-type") || "";
        // the PDF service answered with a page instead (its print fallback, sign-in): show that page
        if (res.ok && res.redirected && /html/i.test(type)) { location.assign(res.url); return; }
        if (!res.ok || !/pdf/i.test(type)) throw new Error("not a pdf");
        const buf = await res.arrayBuffer();
        if (dead) return;
        setFile(new File([buf], nameFrom(res, url), { type: "application/pdf" }));
        const { getDocumentProxy } = await import("unpdf");
        // isEvalSupported: false, or PDF.js tries to build font code from strings, which the policy refuses
        const pdf = await getDocumentProxy(new Uint8Array(buf.slice(0)), { isEvalSupported: false });
        const box = pagesRef.current;
        if (dead || !box) return;
        setState("ready");
        const dpr = Math.min(window.devicePixelRatio || 1, 3);
        const width = Math.max(280, box.clientWidth);
        for (let i = 1; i <= pdf.numPages; i++) {
          if (dead) return;
          const page = await pdf.getPage(i);
          const base = page.getViewport({ scale: 1 });
          const viewport = page.getViewport({ scale: (width / base.width) * dpr });
          const canvas = document.createElement("canvas");
          canvas.width = Math.floor(viewport.width);
          canvas.height = Math.floor(viewport.height);
          canvas.className = "pdfv-page";
          canvas.setAttribute("aria-label", `${i} / ${pdf.numPages}`);
          box.appendChild(canvas);
          await page.render({ canvasContext: canvas.getContext("2d"), viewport }).promise;
        }
      } catch {
        if (!dead) setState("failed");
      }
    })();
    return () => { dead = true; };
  }, [url]);

  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function save() {
    if (!file) return;
    if (navigator.canShare?.({ files: [file] })) {
      try { await navigator.share({ files: [file], title: title || file.name }); } catch { /* closed the sheet */ }
      return;
    }
    const a = document.createElement("a");
    a.href = URL.createObjectURL(file);
    a.download = file.name;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 30000);
  }

  return (
    <div className="pdfv" role="dialog" aria-modal="true" aria-label={title || "PDF"}>
      <div className="pdfv-bar">
        <button type="button" className="pdfv-btn" onClick={onClose} aria-label={tx.close}><X size={20} aria-hidden="true" /><span>{tx.close}</span></button>
        <span className="pdfv-title">{title || file?.name || "PDF"}</span>
        <button type="button" className="pdfv-btn" onClick={save} disabled={!file}><Share size={18} aria-hidden="true" /><span>{tx.save}</span></button>
      </div>
      <div className="pdfv-pages">
        {state === "loading" && <p className="pdfv-msg" role="status">{tx.loading}</p>}
        {state === "failed" && (
          <p className="pdfv-msg" role="alert">{tx.failed} <a href={url} target="_blank" rel="noopener noreferrer">{tx.browser}</a></p>
        )}
        {/* the drawn pages: filled by PDF.js, never by React */}
        <div className="pdfv-canvases" ref={pagesRef} />
      </div>
    </div>
  );
}
