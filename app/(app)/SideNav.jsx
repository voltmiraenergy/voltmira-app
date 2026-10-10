"use client";
// app/(app)/SideNav.jsx — sidebar nav with icons + active-page highlight (amber).
// Desktop: a full vertical list of every tab. Mobile: a 4-tab bottom bar
// (Dashboard, Leads, Quotes, Activity) + a "More" button that opens a bottom
// sheet with the rest (Catalog, Team, Settings, Guide). The desktop/mobile
// split is CSS-driven; the sheet toggle is the only client state.
import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Inbox, FileText, BriefcaseBusiness, Leaf, FolderOpen, Activity, PencilRuler, Package, Users, Settings, BookOpen, Ellipsis } from "lucide-react";

// Tabs shown directly in the mobile bottom bar; the rest go in the More sheet.
const PRIMARY = ["/dashboard", "/leads", "/projects", "/activity"];

// One icon family (lucide), one size and one stroke weight, one distinct icon per
// tab: the hand-drawn set this replaced had two weights and gave the dashboard
// and the catalog the same four squares.
const ICON = { size: 18, strokeWidth: 1.85, "aria-hidden": true };
const ICONS = {
  "/dashboard": <LayoutDashboard {...ICON} />,
  "/leads": <Inbox {...ICON} />,
  "/projects": <FileText {...ICON} />,
  "/portfolios": <BriefcaseBusiness {...ICON} />,
  "/energy": <Leaf {...ICON} />,
  "/documents": <FolderOpen {...ICON} />,
  "/activity": <Activity {...ICON} />,
  "/studio": <PencilRuler {...ICON} />,
  "/catalog": <Package {...ICON} />,
  "/team": <Users {...ICON} />,
  "/settings": <Settings {...ICON} />,
  "/guide": <BookOpen {...ICON} />,
  more: <Ellipsis {...ICON} />,
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
