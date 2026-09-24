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

export default function GlobalError({ error, reset }) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="en">
      <body style={{
        margin: 0, minHeight: "100vh", display: "flex", alignItems: "center",
        justifyContent: "center", background: "#0E1613", color: "#EAF0EC",
        fontFamily: "system-ui, sans-serif", padding: 24, textAlign: "center",
      }}>
        <div>
          <h1 style={{ fontSize: 22, margin: "0 0 8px" }}>Something went wrong.</h1>
          <p style={{ color: "#8FA398", margin: "0 0 20px", maxWidth: 420 }}>
            The error's been reported automatically. Try again, or reload the page.
          </p>
          <button onClick={() => reset()} style={{
            padding: "10px 20px", borderRadius: 8, border: "none", cursor: "pointer",
            background: "#3FA66B", color: "#fff", fontWeight: 600, fontSize: 14,
          }}>Try again</button>
        </div>
      </body>
    </html>
  );
}
