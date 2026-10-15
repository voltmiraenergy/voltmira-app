// lib/Logo.jsx — the one VoltMira logo, exactly as on the homepage: the ink
// tile with its three strokes, ink "Volt" and brand-green "Mira" in Inter
// Tight. It is never recoloured for a dark background; on one (the app's
// sidebar) it sits on a small paper plate instead, so it reads as the same
// logo everywhere. The login, legal pages and homepage follow the same rule.
//   <Logo />            → mark + wordmark, for light surfaces
//   <Logo plate />      → the same on a paper plate, for dark surfaces
//   <Logo size={32} />  → mark size in px (default 32, as on the homepage)
//   <Logo markOnly />   → just the mark

export const LOGO_INK = "#142A21";
export const LOGO_GREEN = "#1E6B4E";
export const LOGO_PAPER = "#F6F5F0";

export function LogoMark({ size = 32 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 34 34" fill="none" aria-hidden="true" style={{ flex: "none", display: "block" }}>
      <rect width="34" height="34" rx="8" fill={LOGO_INK} />
      <path d="M8 25 L14 12" stroke="#C4543B" strokeWidth="2.6" strokeLinecap="round" />
      <path d="M14.5 25 L20.5 9" stroke="#E89B2D" strokeWidth="2.6" strokeLinecap="round" />
      <path d="M21 25 L27 6.5" stroke="#3FAE6A" strokeWidth="2.6" strokeLinecap="round" />
      <circle cx="20.5" cy="9" r="2.1" fill="#E89B2D" />
    </svg>
  );
}

export default function Logo({ size = 32, plate = false, markOnly = false }) {
  const logo = (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 10 }}>
      <LogoMark size={size} />
      {!markOnly && (
        // 20px beside a 32px mark, as on the homepage
        <span style={{ fontFamily: "'Inter Tight', Inter, system-ui, sans-serif", fontWeight: 800,
          fontSize: Math.round(size * 0.625), letterSpacing: "-0.02em", lineHeight: 1, color: LOGO_INK, whiteSpace: "nowrap" }}>
          Volt<span style={{ color: LOGO_GREEN }}>Mira</span>
        </span>
      )}
    </span>
  );
  if (!plate) return logo;
  return (
    <span style={{ display: "inline-flex", alignItems: "center", background: LOGO_PAPER, borderRadius: 12,
      padding: markOnly ? 5 : "5px 14px 5px 5px" }}>
      {logo}
    </span>
  );
}
