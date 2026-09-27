// app/p/[code]/not-found.jsx — a proposal link whose code doesn't exist.
//
// Answered with a real 404 so crawlers stop logging these as soft 404s. The
// installer's language isn't known without the proposal, and the person
// reading this is their client, so the message is given in all three.
import { t } from "../../../lib/i18n.js";

export const metadata = { title: "Solar proposal", robots: { index: false, follow: false } };

export default function ProposalNotFound() {
  return (
    <main style={{
      minHeight: "100vh", display: "grid", placeItems: "center", padding: "40px 20px",
      background: "var(--app-bg)", color: "var(--app-text)", fontFamily: "Inter, system-ui, sans-serif",
    }}>
      <div style={{ maxWidth: 440, textAlign: "center" }}>
        <svg width="44" height="44" viewBox="0 0 34 34" fill="none" aria-hidden="true" style={{ marginBottom: 20 }}>
          <rect width="34" height="34" rx="8" fill="#142A21" />
          <path d="M8 26 L14 12" stroke="#C4543B" strokeWidth="3.2" strokeLinecap="round" />
          <path d="M14.5 26 L20.5 8" stroke="#E89B2D" strokeWidth="3.2" strokeLinecap="round" />
          <path d="M21 26 L27 5.5" stroke="#3FAE6A" strokeWidth="3.2" strokeLinecap="round" />
        </svg>
        {["ro", "ru", "en"].map((l, i) => {
          const H = i ? "h2" : "h1";
          return (
          <div key={l} lang={l} style={{ marginTop: i ? 18 : 0, opacity: i ? 0.72 : 1 }}>
            <H style={{ fontSize: i ? 16 : 24, fontWeight: 700, letterSpacing: "-.02em", margin: "0 0 4px" }}>
              {t("pp_not_found", l)}
            </H>
            <p style={{ fontSize: 14.5, lineHeight: 1.55, margin: 0, color: "var(--app-muted)" }}>{t("pp_expired", l)}</p>
          </div>
          );
        })}
      </div>
    </main>
  );
}
