// app/(app)/layout.jsx — authenticated app shell: ink sidebar (icon nav, amber
// active, profile card), themed canvas. Same visual language as the live demo
// via <AppTheme/>. Responsive (collapses to a bottom bar on mobile).
import { redirect } from "next/navigation";
import Link from "next/link";
import SignOut from "./signout.jsx";
import ThemeToggle from "./ThemeToggle.jsx";
import SideNav from "./SideNav.jsx";
import AppTheme from "./AppTheme.jsx";
import Logo from "../../lib/Logo.jsx";
import { t, normLang } from "../../lib/i18n.js";
import { currentUser, currentCompany } from "../../lib/session.js";
import { supabaseAdmin } from "../../lib/supabase.js";

// Initials for the profile avatar — first letters of the first two words, or the
// first two characters of an email local-part. Matches the demo's initialsOf().
function initialsOf(name) {
  const s = (name || "").trim();
  if (!s) return "—";
  if (s.includes("@")) return s.slice(0, 2).toUpperCase();
  const parts = s.split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] || "") + (parts[1]?.[0] || "")).toUpperCase() || s.slice(0, 2).toUpperCase();
}

export default async function AppLayout({ children }) {
  const user = await currentUser();
  if (!user) redirect("/login");
  const co = await currentCompany();
  const lang = normLang(co?.lang);

  // The logged-in user's own profile (name + personal avatar) for the sidebar card.
  const { data: prof } = await supabaseAdmin().from("profiles").select("name, avatar_url").eq("id", user.id).maybeSingle();
  const who = prof?.name || user.user_metadata?.full_name || user.user_metadata?.name || co?.name || user.email || "";
  // Personal avatar wins; then the company logo; then initials.
  const avatar = prof?.avatar_url || co?.logo_url || "";

  const items = [
    { href: "/dashboard", label: t("nav_dashboard", lang) },
    { href: "/leads", label: t("nav_leads", lang) },
    { href: "/projects", label: t("nav_projects", lang) },
    { href: "/catalog", label: t("nav_catalog", lang) },
    { href: "/team", label: t("nav_team", lang) },
    { href: "/settings", label: t("nav_settings", lang) },
    { href: "/guide", label: t("nav_guide", lang) },
  ];

  return (
    <div className="app">
      <AppTheme />
      <a className="skip-link" href="#main">{lang === "ro" ? "Sari la conținut" : lang === "ru" ? "К содержимому" : "Skip to content"}</a>
      <aside className="sidebar">
        <div className="logo"><Logo dark size={26} /></div>
        <SideNav items={items} />
        <div className="side-foot">
          <Link className="profile" href="/profile" style={{ textDecoration: "none", color: "inherit" }} title={t("pf_title", lang)}>
            {avatar
              ? <img className="avatar" src={avatar} alt="" style={{ objectFit: "cover", background: "var(--paper-2)" }} />
              : <div className="avatar">{initialsOf(who)}</div>}
            <div className="who"><b>{who}</b><span>{co?.name}</span></div>
          </Link>
          <div className="side-plan">{(co?.plan || "free") + " " + t("plan_suffix", lang)}</div>
          <ThemeToggle lang={lang} />
          <SignOut lang={lang} />
        </div>
      </aside>
      <main className="main" id="main">{children}</main>
    </div>
  );
}
