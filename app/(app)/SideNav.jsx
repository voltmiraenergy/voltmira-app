"use client";
// app/(app)/SideNav.jsx — sidebar nav with icons + active-page highlight (amber).
// Desktop: a full vertical list of every tab. Mobile: a 4-tab bottom bar
// (Dashboard, Leads, Quotes, Activity) + a "More" button that opens a bottom
// sheet with the rest (Catalog, Team, Refer, Settings, Guide). The desktop/mobile
// split is CSS-driven; the sheet toggle is the only client state.
import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

// Tabs shown directly in the mobile bottom bar; the rest go in the More sheet.
const PRIMARY = ["/dashboard", "/leads", "/projects", "/activity"];

// Icons ported from the demo's IC set (dash/proj/team/cog).
const ICONS = {
  "/dashboard": (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="3" width="7" height="9" rx="1.5" /><rect x="14" y="3" width="7" height="5" rx="1.5" />
      <rect x="14" y="12" width="7" height="9" rx="1.5" /><rect x="3" y="16" width="7" height="5" rx="1.5" />
    </svg>
  ),
  "/projects": (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
    </svg>
  ),
  "/leads": (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 5h18v14H3z" /><path d="M3 7l9 6 9-6" />
    </svg>
  ),
  "/catalog": (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" />
      <rect x="3" y="14" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" />
    </svg>
  ),
  "/activity": (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 12h4l2 6 4-14 2 8h6" />
    </svg>
  ),
  "/studio": (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 3l9 5-9 5-9-5 9-5z" /><path d="M3 12l9 5 9-5" /><path d="M3 16l9 5 9-5" />
    </svg>
  ),
  "/guide": (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 4.5A1.5 1.5 0 0 1 5.5 3H19v16H5.5A1.5 1.5 0 0 0 4 20.5z" /><path d="M4 20.5A1.5 1.5 0 0 1 5.5 19H19v2H5.5A1.5 1.5 0 0 1 4 20.5z" />
    </svg>
  ),
  "/refer": (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="8" width="18" height="4" rx="1" /><path d="M12 8v13M5 12v7a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-7" />
      <path d="M12 8S10.5 3.5 8 4.2C6.3 4.7 6.4 7 8 7.6 9.6 8.2 12 8 12 8ZM12 8s1.5-4.5 4-3.8c1.7.5 1.6 2.8 0 3.4C14.4 8.2 12 8 12 8Z" />
    </svg>
  ),
  "/team": (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="9" cy="8" r="3.4" /><path d="M2.8 20c.7-3.4 3.2-5.2 6.2-5.2s5.5 1.8 6.2 5.2" />
      <circle cx="17.4" cy="9.4" r="2.6" /><path d="M15.5 14.9c2.8-.4 5.2 1.2 5.8 4.3" />
    </svg>
  ),
  "/settings": (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="3.2" /><path d="M19 12a7 7 0 0 0-.14-1.4l2-1.55-2-3.46-2.35.95A7 7 0 0 0 14.1 5.1L13.75 2.6h-3.5L9.9 5.1a7 7 0 0 0-2.41 1.44l-2.35-.95-2 3.46 2 1.55A7 7 0 0 0 5 12c0 .48.05.94.14 1.4l-2 1.55 2 3.46 2.35-.95c.7.63 1.52 1.12 2.41 1.44l.35 2.5h3.5l.35-2.5a7 7 0 0 0 2.41-1.44l2.35.95 2-3.46-2-1.55c.09-.46.14-.92.14-1.4Z" />
    </svg>
  ),
  more: (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="5" cy="12" r="1.6" /><circle cx="12" cy="12" r="1.6" /><circle cx="19" cy="12" r="1.6" />
    </svg>
  ),
};

export default function SideNav({ items, moreLabel = "More", sheetFooter = null }) {
  const path = usePathname() || "";
  const [moreOpen, setMoreOpen] = useState(false);
  const isActive = (href) => href === "/dashboard" ? path === "/dashboard" : path.startsWith(href);
  const secondary = items.filter((i) => !PRIMARY.includes(i.href));
  const secondaryActive = secondary.some((i) => isActive(i.href));
  const close = () => setMoreOpen(false);

  return (
    <>
      <nav className="nav">
        {items.map(({ href, label }) => {
          const active = isActive(href);
          // secondary tabs render in the desktop list, but are hidden from the
          // mobile bar (they live in the More sheet instead).
          const cls = [active ? "active" : "", PRIMARY.includes(href) ? "" : "nav-secondary"].filter(Boolean).join(" ");
          return (
            <Link key={href} href={href} className={cls} onClick={close}
              aria-current={active ? "page" : undefined}>
              {ICONS[href]}{label}
            </Link>
          );
        })}
        <button type="button" className={"nav-more" + (secondaryActive ? " active" : "")}
          onClick={() => setMoreOpen((v) => !v)} aria-expanded={moreOpen} aria-haspopup="menu">
          {ICONS.more}{moreLabel}
        </button>
      </nav>

      <div className={"more-backdrop" + (moreOpen ? " open" : "")} onClick={close} aria-hidden="true" />
      <div className={"more-sheet" + (moreOpen ? " open" : "")} role="menu" aria-label={moreLabel}>
        <div className="more-grip" aria-hidden="true" />
        {secondary.map(({ href, label }) => {
          const active = isActive(href);
          return (
            <Link key={href} href={href} className={active ? "active" : ""} role="menuitem"
              onClick={close} aria-current={active ? "page" : undefined}>
              {ICONS[href]}{label}
            </Link>
          );
        })}
        {sheetFooter && <div className="more-foot" onClick={close}>{sheetFooter}</div>}
      </div>
    </>
  );
}
