// lib/navPaths.js — where the back bar shows and where it goes with no
// history (components/MobileBack.jsx). Pure.

/** The sections the side menu lists: their own pages need no back button. */
export const TOP_SECTIONS = ["/dashboard", "/leads", "/projects", "/portfolios", "/energy", "/documents", "/activity", "/studio", "/team", "/settings", "/guide"];

/** Where "up one level" goes from a path: /projects/abc/invoice -> /projects/abc. */
export function parentPath(path) {
  const parts = String(path || "/").split("?")[0].split("/").filter(Boolean);
  if (parts.length <= 1) return "/dashboard";
  return "/" + parts.slice(0, -1).join("/");
}

/** True on a page below the main sections. */
export function isInner(path) {
  const p = String(path || "").split("?")[0].replace(/\/+$/, "") || "/";
  return !TOP_SECTIONS.includes(p) && p !== "/";
}
