// lib/Logo.jsx — the one VoltMira logo, identical to the landing page mark.
// Use everywhere a logo is needed so the brand never drifts.
//   <Logo />            → mark + two-tone wordmark for light backgrounds
//   <Logo dark />       → wordmark colors for the dark (ink) sidebar
//   <Logo size={30} />  → mark size in px (default 28)
//   <Logo markOnly />   → just the mark

export function LogoMark({ size = 28 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 34 34" fill="none" aria-hidden="true">
      <rect width="34" height="34" rx="8" fill="#142A21" />
      <path d="M8 25 L14 12" stroke="#C4543B" strokeWidth="2.6" strokeLinecap="round" />
      <path d="M14.5 25 L20.5 9" stroke="#E89B2D" strokeWidth="2.6" strokeLinecap="round" />
      <path d="M21 25 L27 6.5" stroke="#3FAE6A" strokeWidth="2.6" strokeLinecap="round" />
      <circle cx="20.5" cy="9" r="2.1" fill="#E89B2D" />
    </svg>
  );
}

export default function Logo({ size = 28, dark = false, markOnly = false }) {
  const volt = dark ? "#F6F5F0" : "#142A21";
  const mira = dark ? "#7FDCA4" : "#1E6B4E";
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 10 }}>
      <LogoMark size={size} />
      {!markOnly && (
        <span style={{ fontFamily: "Inter, system-ui, sans-serif", fontWeight: 700,
          fontSize: Math.round(size * 0.72), letterSpacing: "-0.02em", lineHeight: 1 }}>
          <span style={{ color: volt }}>Volt</span><span style={{ color: mira }}>Mira</span>
        </span>
      )}
    </span>
  );
}
