// app/not-found.jsx — branded 404 that respects the shared theme system.
import Link from "next/link";

export const metadata = { title: "Page not found — VoltMira", robots: { index: false, follow: true } };

export default function NotFound() {
  return (
    <div style={{
      minHeight: "100vh", background: "var(--app-bg)", color: "var(--app-text)",
      display: "grid", placeItems: "center", padding: "40px 24px",
      fontFamily: "Inter, system-ui, sans-serif",
    }}>
      <main style={{ maxWidth: 520, textAlign: "center" }}>
        <div aria-hidden="true" style={{ marginBottom: 22, display: "inline-flex" }}>
          <svg width="56" height="56" viewBox="0 0 34 34" fill="none">
            <rect width="34" height="34" rx="8" fill="#142A21" />
            <path d="M8 26 L14 12" stroke="#C4543B" strokeWidth="3.2" strokeLinecap="round" />
            <path d="M14.5 26 L20.5 8" stroke="#E89B2D" strokeWidth="3.2" strokeLinecap="round" />
            <path d="M21 26 L27 5.5" stroke="#3FAE6A" strokeWidth="3.2" strokeLinecap="round" />
          </svg>
        </div>
        <p style={{
          fontFamily: "'IBM Plex Mono', monospace", fontSize: 12.5,
          letterSpacing: ".14em", textTransform: "uppercase",
          color: "var(--app-muted)", margin: "0 0 12px",
        }}>Error 404</p>
        <h1 style={{
          fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700,
          fontSize: "clamp(30px, 5vw, 44px)", letterSpacing: "-.03em",
          lineHeight: 1.05, margin: "0 0 14px",
        }}>This roof isn&apos;t in our database.</h1>
        <p style={{
          fontSize: 15.5, lineHeight: 1.55, color: "var(--app-text)",
          opacity: .78, margin: "0 0 30px",
        }}>
          The page you&apos;re after moved, was renamed, or never existed.
          Head home or explore the live demo.
        </p>
        <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
          <Link href="/" style={{
            background: "#1E6B4E", color: "#fff", padding: "12px 20px",
            borderRadius: 10, fontWeight: 700, fontSize: 14.5, textDecoration: "none",
          }}>← Back home</Link>
          <Link href="/demo" style={{
            background: "transparent", color: "var(--app-text)",
            border: "1px solid var(--app-line)", padding: "12px 20px",
            borderRadius: 10, fontWeight: 600, fontSize: 14.5, textDecoration: "none",
          }}>Open the live demo →</Link>
        </div>
      </main>
    </div>
  );
}
