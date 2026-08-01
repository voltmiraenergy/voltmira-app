// app/(legal)/LegalShell.jsx — shared chrome for /privacy and /terms.
// Matches the landing page palette and typography so the pages feel on-brand.
import Link from "next/link";

const wrap = {
  maxWidth: 760, margin: "0 auto", padding: "0 24px",
};

export default function LegalShell({ title, updated, children }) {
  return (
    <div style={{
      background: "var(--app-bg)", color: "var(--app-text)", minHeight: "100vh",
      fontFamily: "Inter, system-ui, sans-serif", lineHeight: 1.65,
    }}>
      <header style={{
        borderBottom: "1px solid var(--app-line)",
        background: "var(--app-surface)", backdropFilter: "blur(10px)",
        position: "sticky", top: 0, zIndex: 10,
      }}>
        <div style={{ ...wrap, height: 68, display: "flex", alignItems: "center", gap: 11 }}>
          <Link href="/" style={{ display: "flex", alignItems: "center", gap: 11, textDecoration: "none" }}>
            <svg width="30" height="30" viewBox="0 0 34 34" fill="none" aria-hidden="true">
              <rect width="34" height="34" rx="8" fill="#142A21" />
              <path d="M8 25 L14 12" stroke="#C4543B" strokeWidth="2.6" strokeLinecap="round" />
              <path d="M14.5 25 L20.5 9" stroke="#E89B2D" strokeWidth="2.6" strokeLinecap="round" />
              <path d="M21 25 L27 6.5" stroke="#3FAE6A" strokeWidth="2.6" strokeLinecap="round" />
              <circle cx="20.5" cy="9" r="2.1" fill="#E89B2D" />
            </svg>
            <span style={{ fontFamily: "'Inter', system-ui, sans-serif", fontWeight: 700, fontSize: 20 }}>
              <span style={{ color: "var(--app-text)" }}>Volt</span><span style={{ color: "#1E6B4E" }}>Mira</span>
            </span>
          </Link>
          <Link href="/" style={{
            marginLeft: "auto", textDecoration: "none", color: "var(--app-muted)",
            fontSize: 14.5, fontWeight: 500,
          }}>← Back to site</Link>
        </div>
      </header>

      <main style={{ ...wrap, padding: "56px 24px 96px" }}>
        <h1 style={{
          fontFamily: "'Inter', system-ui, sans-serif", fontWeight: 700,
          fontSize: "clamp(30px,5vw,46px)", letterSpacing: "-.03em",
          lineHeight: 1.05, marginBottom: 10,
        }}>{title}</h1>
        <p style={{
          fontFamily: "'Inter', system-ui, sans-serif", fontSize: 12.5,
          letterSpacing: ".08em", textTransform: "uppercase", color: "var(--app-muted)",
          marginBottom: 40,
        }}>Last updated: {updated}</p>
        <div className="legal-body">{children}</div>
      </main>

      <footer style={{ borderTop: "1px solid var(--app-line)" }}>
        <div style={{ ...wrap, padding: "28px 24px", display: "flex", gap: 22, flexWrap: "wrap", fontSize: 13.5, color: "var(--app-muted)" }}>
          <span>© 2026 VoltMira</span>
          <Link href="/privacy" style={{ color: "#1E6B4E", textDecoration: "none", fontWeight: 500 }}>Privacy</Link>
          <Link href="/terms" style={{ color: "#1E6B4E", textDecoration: "none", fontWeight: 500 }}>Terms</Link>
          <a href="mailto:voltmiraenergy@gmail.com" style={{ color: "#1E6B4E", textDecoration: "none", fontWeight: 500 }}>voltmiraenergy@gmail.com</a>
        </div>
      </footer>
    </div>
  );
}
