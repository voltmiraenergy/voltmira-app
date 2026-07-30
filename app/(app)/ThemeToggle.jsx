"use client";
// app/(app)/ThemeToggle.jsx — clearly-labeled light/dark switch for the app sidebar.
// Styled to match the nav links so it reads as a menu action. Reads/writes the
// same "voltmira_theme" key as the landing and flips html[data-theme], which the
// app-wide CSS variables respond to.
import { useEffect, useState } from "react";
import { t } from "../../lib/i18n.js";

export default function ThemeToggle({ lang }) {
  const [theme, setTheme] = useState("light");

  useEffect(() => {
    const cur = document.documentElement.getAttribute("data-theme") === "dark" ? "dark" : "light";
    setTheme(cur);
  }, []);

  function flip() {
    const next = theme === "dark" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", next);
    try { localStorage.setItem("voltmira_theme", next); } catch {}
    setTheme(next);
  }

  const isDark = theme === "dark";

  return (
    <button className="side-theme" onClick={flip} aria-pressed={isDark} aria-label={t("aria_theme", lang)}>
      {isDark ? (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <circle cx="12" cy="12" r="4.2" /><path d="M12 2v2.4M12 19.6V22M4.9 4.9l1.7 1.7M17.4 17.4l1.7 1.7M2 12h2.4M19.6 12H22M4.9 19.1l1.7-1.7M17.4 6.6l1.7-1.7" />
        </svg>
      ) : (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
        </svg>
      )}
      {isDark ? t("theme_light", lang) : t("theme_dark", lang)}
    </button>
  );
}
