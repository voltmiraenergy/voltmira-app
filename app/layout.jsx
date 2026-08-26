import { Analytics } from "@vercel/analytics/next";

export const metadata = {
  title: "VoltMira — Solar quoting your clients can fact-check",
  description: "Honest three-band payback estimates, tracked proposals, and real PVGIS data for solar installers.",
};

// App-wide theme tokens. The authenticated app (sidebar + pages) reads these via
// var(--app-*); light is the default, html[data-theme="dark"] flips them. The
// choice is shared with the landing page through the same localStorage key
// ("voltmira_theme"), so a visitor's preference carries across the whole site.
const THEME_VARS = `
  :root{
    --app-bg:#F6F5F0; --app-surface:#FFFFFF; --app-text:#142A21;
    --app-muted:#66756C; --app-line:#E3E1D6; --app-brand:#142A21;
    --app-ok:#1E6B4E; --app-ok-tint:#E4EFE9;
    --app-warn-ink:#8A5A0F; --app-warn-tint:#FBF0DD;
    --app-bad:#C4543B; --app-bad-tint:#F7E6E1;
  }
  html{color-scheme:light}
  html[data-theme="dark"]{
    color-scheme:dark;
    --app-bg:#0F1310; --app-surface:#171B16; --app-text:#EEF1EA;
    --app-muted:#8E998F; --app-line:#28302A; --app-brand:#0A0D0B;
    --app-ok:#4FB584; --app-ok-tint:rgba(79,181,132,.16);
    --app-warn-ink:#F2B85F; --app-warn-tint:rgba(232,155,45,.14);
    --app-bad:#E0725A; --app-bad-tint:rgba(196,84,59,.18);
  }
  body{background:var(--app-bg);transition:background .2s}

  /* per-navigation page entrance (see app/(app)/template.jsx) */
  @keyframes vm-page-in{from{opacity:0;transform:translateY(7px)}to{opacity:1;transform:none}}
  .page-enter{animation:vm-page-in .26s cubic-bezier(.22,.9,.28,1) both}
  @media (prefers-reduced-motion: reduce){.page-enter{animation:none}}

  /* ---- authenticated app shell (responsive) ---- */
  .app-shell{display:grid;grid-template-columns:220px 1fr;min-height:100vh;font-family:Inter,system-ui,sans-serif}
  .app-side{background:var(--app-brand);color:#fff;padding:22px 14px;display:flex;flex-direction:column;position:sticky;top:0;height:100vh}
  .app-main{background:var(--app-bg);color:var(--app-text);min-width:0}
  .app-nav{display:grid;gap:4px}
  .app-navlink{color:rgba(255,255,255,.72);text-decoration:none;padding:10px 12px;border-radius:10px;
    font-size:14px;font-weight:500;transition:background .15s,color .15s;display:block;white-space:nowrap}
  .app-navlink:hover{background:rgba(255,255,255,.08);color:#fff}
  .app-navlink.active{background:rgba(255,255,255,.12);color:#fff}
  /* two-column page grids that collapse on small screens */
  .editor-grid{display:grid;grid-template-columns:minmax(280px,360px) 1fr;gap:18px;align-items:start}
  .app-cols2{display:grid;grid-template-columns:1fr 1fr;gap:16px}
  @media (max-width:860px){
    .editor-grid,.app-cols2{grid-template-columns:1fr}
  }
  .status-pill{display:inline-block;padding:3px 10px;border-radius:99px;font-size:11px;
    font-weight:700;text-transform:uppercase;letter-spacing:.05em;white-space:nowrap}

  @media (max-width:760px){
    .app-shell{grid-template-columns:1fr}
    .app-side{position:sticky;top:0;height:auto;flex-direction:row;align-items:center;gap:8px;
      padding:9px 12px;flex-wrap:wrap;z-index:40}
    .app-brand-row{padding:0 4px 0 6px!important;margin-right:auto}
    .app-nav{display:flex;gap:4px}
    .app-navlink{padding:8px 11px;font-size:13.5px}
    .app-side-foot{margin-top:0!important;padding:0!important;display:flex;align-items:center;gap:10px;
      order:3;flex-basis:100%;border-top:1px solid rgba(255,255,255,.12);padding-top:8px!important;margin-top:4px!important}
    .app-side-foot .foot-co,.app-side-foot .foot-plan{display:none}
  }
`;

// Runs before paint to set the theme attribute — prevents a light-then-dark flash.
const NO_FLASH = `(function(){try{var t=localStorage.getItem("voltmira_theme");if(t!=="dark"&&t!=="light"){t=(window.matchMedia&&window.matchMedia("(prefers-color-scheme: dark)").matches)?"dark":"light";}document.documentElement.setAttribute("data-theme",t);}catch(e){}})();`;

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <script dangerouslySetInnerHTML={{ __html: NO_FLASH }} />
        <style dangerouslySetInnerHTML={{ __html: THEME_VARS }} />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Inter+Tight:wght@600;700;800&display=swap" rel="stylesheet" />
      </head>
      <body style={{ margin: 0 }}>{children}<Analytics /></body>
    </html>
  );
}
