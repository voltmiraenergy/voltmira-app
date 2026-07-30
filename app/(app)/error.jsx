"use client";

// app/(app)/error.jsx — branded error boundary for the signed-in app.
// Without this, a thrown server/client component in any (app) route falls back
// to Next's bare unstyled error page. This keeps the sidebar-less crash on-brand,
// logs the error, and offers a one-click retry (Next's reset()) before a reload.
import { useEffect } from "react";

export default function AppError({ error, reset }) {
  useEffect(() => {
    // Surfaces in the browser console + Vercel logs; the digest ties a user report
    // to the server-side stack when the message itself is redacted in production.
    console.error("app error boundary:", error?.message, error?.digest);
  }, [error]);

  return (
    <div style={{ maxWidth: 520, margin: "8vh auto", textAlign: "center", padding: "0 20px" }}>
      <div style={{ fontSize: 40, lineHeight: 1, marginBottom: 14 }} aria-hidden="true">⚡</div>
      <h1 style={{ fontFamily: "var(--font-d, inherit)", fontSize: 24, margin: "0 0 8px", color: "var(--ink)" }}>
        Ceva n-a mers cum trebuia
      </h1>
      <p style={{ color: "var(--muted)", fontSize: 15, lineHeight: 1.6, margin: "0 0 22px" }}>
        A apărut o eroare neașteptată la încărcarea acestei pagini. Nu s-a pierdut nimic —
        încearcă din nou sau reîncarcă aplicația.
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
          Încearcă din nou
        </button>
        <a
          href="/dashboard"
          style={{
            padding: "11px 20px", borderRadius: 11, cursor: "pointer", textDecoration: "none",
            background: "var(--paper-2)", color: "var(--ink)", fontWeight: 600,
            border: "1px solid var(--line)", fontFamily: "var(--font-d, inherit)", fontSize: 14.5,
          }}>
          Înapoi la panou
        </a>
      </div>
    </div>
  );
}
