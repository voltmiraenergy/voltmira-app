"use client";
// app/(app)/SideNav.jsx — sidebar nav with icons + active-page highlight (amber).
// Desktop: a full vertical list of every tab. Mobile: a 4-tab bottom bar
// (Dashboard, Leads, Quotes, Activity) + a "More" button that opens a bottom
// sheet with the rest (Catalog, Team, Settings, Guide). The desktop/mobile
// split is CSS-driven; the sheet toggle is the only client state. The sheet closes
// on a drag down (from its handle, or from anywhere while its list is at the top),
// on the backdrop, on Escape, or when a link in it is picked.
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Inbox, FileText, BriefcaseBusiness, Leaf, FolderOpen, Activity, PencilRuler, Package, Users, Settings, BookOpen, Ellipsis, PlugZap, HardHat, Wrench } from "lucide-react";

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
  "/jobs": <HardHat {...ICON} />,
  "/service": <Wrench {...ICON} />,
  "/grid": <PlugZap {...ICON} />,
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
  const sheetRef = useRef(null);
  const backRef = useRef(null);

  // Escape closes the sheet
  useEffect(() => {
    if (!moreOpen) return;
    const onKey = (e) => { if (e.key === "Escape") setMoreOpen(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [moreOpen]);

  // Drag down to close. Touch events (not pointer events) so a drag that starts on the list can take
  // over from scrolling only when the list is already at its top; the sheet follows the finger and
  // closes past 80px or on a quick flick, otherwise it springs back.
  useEffect(() => {
    const el = sheetRef.current;
    if (!el || !moreOpen) return;
    let d = null;
    const start = (e) => {
      if (e.touches.length !== 1) return;
      const onHandle = !!e.target.closest?.(".more-grab");
      if (!onHandle && el.scrollTop > 0) return;
      d = { y: e.touches[0].clientY, t: e.timeStamp, dy: 0, moved: false };
    };
    const move = (e) => {
      if (!d) return;
      const raw = e.touches[0].clientY - d.y;
      if (!d.moved) {
        if (raw < -6) { d = null; return; }   // an upward swipe scrolls the list as usual
        if (raw < 6) return;
        d.moved = true;
        el.style.transition = "none";
        if (backRef.current) backRef.current.style.transition = "none";
      }
      e.preventDefault();
      d.dy = Math.max(0, raw);
      el.style.transform = `translateY(${d.dy}px)`;
      if (backRef.current) backRef.current.style.opacity = String(Math.max(0, 1 - d.dy / 320));
    };
    const end = (e) => {
      if (!d) return;
      const { moved, dy, t } = d;
      d = null;
      if (!moved) return;
      const speed = dy / Math.max(1, e.timeStamp - t);   // px per ms
      el.style.transition = el.style.transform = "";
      if (backRef.current) backRef.current.style.transition = backRef.current.style.opacity = "";
      if (dy > 80 || (dy > 24 && speed > 0.6)) setMoreOpen(false);
    };
    el.addEventListener("touchstart", start, { passive: true });
    el.addEventListener("touchmove", move, { passive: false });
    el.addEventListener("touchend", end);
    el.addEventListener("touchcancel", end);
    return () => {
      el.removeEventListener("touchstart", start);
      el.removeEventListener("touchmove", move);
      el.removeEventListener("touchend", end);
      el.removeEventListener("touchcancel", end);
    };
  }, [moreOpen]);

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

      <div ref={backRef} className={"more-backdrop" + (moreOpen ? " open" : "")} onClick={close} aria-hidden="true" />
      <div ref={sheetRef} className={"more-sheet" + (moreOpen ? " open" : "")} role="menu" aria-label={moreLabel}>
        <div className="more-grab" aria-hidden="true"><div className="more-grip" /></div>
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
