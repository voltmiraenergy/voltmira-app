"use client";
// app/global-error.jsx — Next.js's last-resort boundary: only fires when the
// ROOT layout itself throws, which is also the one class of error Sentry's
// automatic instrumentation can't see any other way (a route-level error
// stays inside <body>, but a root-layout crash replaces it, so this file
// must supply its own <html>/<body>). Kept dependency-free on purpose — it
// has to render even if whatever crashed the root layout was a shared
// import (theme, session, i18n) this file would otherwise also pull in.
import { useEffect } from "react";
import * as Sentry from "@sentry/nextjs";

// In the language the app last ran in (localStorage, kept by lib/HtmlLang.jsx); English when there is none. No
// import of the app's own dictionaries: this file must render even when a shared import is what crashed.
const WORDS = {
  en: { h: "Something went wrong.", p: "The error’s been reported automatically. Try again, or reload the page.", b: "Try again" },
  ro: { h: "Ceva nu a mers bine.", p: "Eroarea a fost raportată automat. Încearcă din nou sau reîncarcă pagina.", b: "Încearcă din nou" },
  ru: { h: "Что-то пошло не так.", p: "Об ошибке сообщено автоматически. Попробуйте ещё раз или перезагрузите страницу.", b: "Повторить" },
  uk: { h: "Щось пішло не так.", p: "Про помилку повідомлено автоматично. Спробуйте ще раз або перезавантажте сторінку.", b: "Спробувати ще раз" },
};
function savedLang() {
  if (typeof window === "undefined") return "en";
  try { const l = localStorage.getItem("voltmira_lang"); return WORDS[l] ? l : "en"; } catch { return "en"; }
}

export default function GlobalError({ error, reset }) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);
  const lang = savedLang();
  const w = WORDS[lang];

  return (
    <html lang={lang} suppressHydrationWarning>
      <body style={{
        margin: 0, minHeight: "100vh", display: "flex", alignItems: "center",
        justifyContent: "center", background: "#0E1613", color: "#EAF0EC",
        fontFamily: "system-ui, sans-serif", padding: 24, textAlign: "center",
      }}>
        <div>
          <h1 style={{ fontSize: 22, margin: "0 0 8px" }} suppressHydrationWarning>{w.h}</h1>
          <p style={{ color: "#8FA398", margin: "0 0 20px", maxWidth: 420 }} suppressHydrationWarning>
            {w.p}
          </p>
          <button onClick={() => reset()} style={{
            padding: "10px 20px", borderRadius: 8, border: "none", cursor: "pointer",
            background: "#3FA66B", color: "#fff", fontWeight: 600, fontSize: 14,
          }} suppressHydrationWarning>{w.b}</button>
        </div>
      </body>
    </html>
  );
}
