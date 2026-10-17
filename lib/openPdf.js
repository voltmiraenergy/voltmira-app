// lib/openPdf.js — opening a PDF in the installed (home-screen) app. There a
// PDF opened like a web page fills the whole app with no way back: no browser
// bar, no back gesture on iOS. So in the installed app a PDF opens in the
// app's own viewer (components/PdfViewer.jsx, hosted by AppNavBar.jsx), which
// has an X and a Save button. In a browser nothing changes: a new tab.

/** True when VoltMira runs from the home screen (no browser bar). */
export function isStandalone() {
  if (typeof window === "undefined") return false;
  return !!(window.matchMedia?.("(display-mode: standalone)")?.matches || window.navigator.standalone === true);
}

/** A same-origin address that answers with a PDF: /api/proposal/abc/pdf, /api/projects/x/racordare-pdf, file.pdf. */
export function isPdfUrl(href, origin) {
  let u;
  try { u = new URL(href, origin); } catch { return false; }
  if (u.origin !== origin) return false;
  return /\.pdf$/i.test(u.pathname) || (u.pathname.startsWith("/api/") && /(^|[/-])pdf$/i.test(u.pathname));
}

/** Open a PDF in the app's viewer when installed; false in a browser, where the caller keeps its own way. */
export function openPdfInApp(url, title = "") {
  if (!isStandalone()) return false;
  window.dispatchEvent(new CustomEvent("vm:pdf", { detail: { url, title } }));
  return true;
}
