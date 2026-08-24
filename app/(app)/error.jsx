"use client";

// app/(app)/error.jsx — branded error boundary for the signed-in app.
// Without this, a thrown server/client component in any (app) route falls back
// to Next's bare unstyled error page. This keeps the sidebar-less crash on-brand,
// logs the error, and offers a one-click retry (Next's reset()) before a reload.
//
// It runs client-side only, so it can't read the server-side company language.
// The (app) layout stashes that language in localStorage ("voltmira_lang"); we
// read it here (falling back to the browser language, then English) so the crash
// screen speaks the same language as the rest of the dashboard.
import { useEffect, useState } from "react";
import { t } from "../../lib/i18n.js";

function detectLang() {
  try {
    const s = localStorage.getItem("voltmira_lang");
    if (s === "en" || s === "ro" || s === "ru") return s;
  } catch { /* ignore */ }
  try {
    const n = (navigator.language || "en").slice(0, 2).toLowerCase();
    if (n === "ro" || n === "ru") return n;
  } catch { /* ignore */ }
  return "en";
}

export default function AppError({ error, reset }) {
  // Resolve after mount to avoid any SSR/client hydration mismatch; "en" is a
  // safe first paint and is corrected instantly on the client.
  const [lang, setLang] = useState("en");
  useEffect(() => { setLang(detectLang()); }, []);

  useEffect(() => {
    // Surfaces in the browser console + Vercel logs; the digest ties a user report
    // to the server-side stack when the message itself is redacted in production.
    console.error("app error boundary:", error?.message, error?.digest);
  }, [error]);

  return (
    <div style={{ maxWidth: 520, margin: "8vh auto", textAlign: "center", padding: "0 20px" }}>
      <h1 style={{ fontFamily: "var(--font-d, inherit)", fontSize: 24, margin: "0 0 8px", color: "var(--ink)" }}>
        {t("err_title", lang)}
      </h1>
      <p style={{ color: "var(--muted)", fontSize: 15, lineHeight: 1.6, margin: "0 0 22px" }}>
        {t("err_body", lang)}
        {error?.digest ? (
          <><br /><span style={{ fontFamily: "monospace", fontSize: 11, opacity: 0.6 }}>ref: {error.digest}</span></>
        ) : null}
      </p>
      <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap" }}>
        <button
          onClick={() => reset()}
          style={{
            padding: "11px 20px", borderRadius: 11, border: "none", cursor: "pointer",
            background: "var(--ink)", color: "var(--paper)", fontWeight: 700,
            fontFamily: "var(--font-d, inherit)", fontSize: 14.5,
          }}>
          {t("err_retry", lang)}
        </button>
        <a
          href="/dashboard"
          style={{
            padding: "11px 20px", borderRadius: 11, cursor: "pointer", textDecoration: "none",
            background: "var(--paper-2)", color: "var(--ink)", fontWeight: 600,
            border: "1px solid var(--line)", fontFamily: "var(--font-d, inherit)", fontSize: 14.5,
          }}>
          {t("err_home", lang)}
        </a>
      </div>
    </div>
  );
}
