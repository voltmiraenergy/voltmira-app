"use client";
// components/MobileBack.jsx — a way back on every inner page, where a phone or
// the installed app (standalone, no browser chrome, no back gesture on iOS)
// would otherwise leave a dead end: a slim bar with a back button on any page
// below the main sections (a quote, a portfolio, its report, a Studio job, the
// profile). router.back() returns to wherever the person came from; with no
// history (a deep link, the app launched into it) it goes up one level.
//
// In the installed app, a link that would open a page of the app in a new tab
// (the portfolio's report, bank summary, teaser) opens in the same window
// instead: a second window there has no way back either. Downloads (/api/)
// keep their own behaviour.
import { useEffect, useSyncExternalStore } from "react";
import { usePathname, useRouter } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { t } from "../lib/i18n.js";
import { parentPath, isInner } from "../lib/navPaths.js";

const noSubscribe = () => () => {};
const standalone = () => typeof window !== "undefined"
  && (window.matchMedia?.("(display-mode: standalone)")?.matches || window.navigator.standalone === true);

export default function MobileBack({ lang = "en" }) {
  const path = usePathname();
  const router = useRouter();
  // the installed app: read from the browser, false while rendering on the server
  const app = useSyncExternalStore(noSubscribe, standalone, () => false);

  // the installed app: the app's own pages stay in this window
  useEffect(() => {
    if (!app) return;
    const onClick = (e) => {
      const a = e.target?.closest?.("a[target=_blank]");
      if (!a || e.defaultPrevented || e.button !== 0) return;
      let u;
      try { u = new URL(a.href, location.href); } catch { return; }
      if (u.origin !== location.origin || u.pathname.startsWith("/api/") || a.hasAttribute("download")) return;
      e.preventDefault();
      router.push(u.pathname + u.search + u.hash);
    };
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, [app, router]);

  if (!isInner(path)) return null;
  const back = () => {
    if (window.history.length > 1) router.back();
    else router.push(parentPath(path));
  };
  return (
    <div className={"m-back" + (app ? " is-app" : "")}>
      <button type="button" className="m-back-btn" onClick={back}>
        <ChevronLeft size={20} aria-hidden="true" />{t("m_back", lang)}
      </button>
    </div>
  );
}
