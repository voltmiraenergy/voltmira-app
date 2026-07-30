// app/(legal)/layout.jsx — loads brand fonts + body styling for legal pages.
export const metadata = { robots: { index: true, follow: true } };

export default function LegalLayout({ children }) {
  return (
    <>
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
      <link
        href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@600;700&family=Inter:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500&display=swap"
        rel="stylesheet"
      />
      <style>{`
        .legal-body h2{font-family:'Space Grotesk',sans-serif;font-weight:700;font-size:22px;
          letter-spacing:-.02em;margin:38px 0 12px;color:var(--app-text)}
        .legal-body h2:first-child{margin-top:0}
        .legal-body p{margin:0 0 15px;color:var(--app-text);opacity:.86;font-size:15.5px}
        .legal-body ul{margin:0 0 15px;padding-left:22px}
        .legal-body li{margin:0 0 9px;color:var(--app-text);opacity:.86;font-size:15.5px}
        .legal-body b,.legal-body strong{color:var(--app-text);opacity:1;font-weight:600}
        .legal-body a{color:#1E6B4E;text-decoration:underline;text-underline-offset:2px}
        html[data-theme="dark"] .legal-body a{color:#4FB584}
        .legal-body em{color:var(--app-muted)}
        .legal-body .note{background:#FBF0DD;border:1px solid rgba(232,155,45,.35);
          border-radius:12px;padding:16px 18px;font-size:14px;color:#7a5a1a;margin:0 0 28px}
        html[data-theme="dark"] .legal-body .note{background:rgba(232,155,45,.12);
          border-color:rgba(232,155,45,.35);color:#F2B85F}
        .legal-body hr{border:none;border-top:1px solid var(--app-line);margin:32px 0}
      `}</style>
      {children}
    </>
  );
}
