"use client";
// app/(app)/SideNav.jsx — sidebar nav with icons + active-page highlight (amber),
// matching the live demo. Labels are translated in the server layout and passed in.
// Uses next/link (not <a>) so navigation is client-side + prefetched on hover.
import Link from "next/link";
import { usePathname } from "next/navigation";

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
  "/guide": (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 4.5A1.5 1.5 0 0 1 5.5 3H19v16H5.5A1.5 1.5 0 0 0 4 20.5z" /><path d="M4 20.5A1.5 1.5 0 0 1 5.5 19H19v2H5.5A1.5 1.5 0 0 1 4 20.5z" />
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
};

export default function SideNav({ items }) {
  const path = usePathname() || "";
  return (
    <nav className="nav">
      {items.map(({ href, label }) => {
        const active = href === "/dashboard" ? path === "/dashboard" : path.startsWith(href);
        return (
          <Link key={href} href={href} className={active ? "active" : ""}
            aria-current={active ? "page" : undefined}>
            {ICONS[href]}{label}
          </Link>
        );
      })}
    </nav>
  );
}
