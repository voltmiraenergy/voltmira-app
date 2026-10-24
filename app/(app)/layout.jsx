// app/(app)/layout.jsx — authenticated app shell: ink sidebar (icon nav, amber
// active, profile card), themed canvas. Same visual language as the live demo
// via <AppTheme/>. Responsive (collapses to a bottom bar on mobile).
import { redirect } from "next/navigation";
import Link from "next/link";
import { ChevronRight, Receipt } from "lucide-react";
import SignOut from "./signout.jsx";
import ThemeToggle from "./ThemeToggle.jsx";
import SideNav from "./SideNav.jsx";
import AppTheme from "./AppTheme.jsx";
import OfflineReady from "./OfflineReady.jsx";
import MobileBack from "../../components/MobileBack.jsx";
import KeepSignedIn from "../../components/KeepSignedIn.jsx";
import Logo from "../../lib/Logo.jsx";
import HtmlLang from "../../lib/HtmlLang.jsx";
import { t, normLang } from "../../lib/i18n.js";
import { pt } from "../../lib/portfolioText.js";
import { et } from "../../lib/energyText.js";
import { currentUser, currentCompany } from "../../lib/session.js";
import { supabaseAdmin } from "../../lib/supabase.js";
import { isDemoEmail } from "../../lib/demo.js";


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
  // NB: never fall back to the company name here — the card already shows it on
  // the line underneath, so a user with no profile name got it printed twice.
  const who = prof?.name || user.user_metadata?.full_name || user.user_metadata?.name || user.email || "";
  // Personal avatar wins; then the company logo; then initials.
  const avatar = prof?.avatar_url || co?.logo_url || "";


  const items = [
    { href: "/dashboard", label: t("nav_dashboard", lang) },
    { href: "/leads", label: t("nav_leads", lang) },
    { href: "/projects", label: t("nav_projects", lang) },
    // the signed jobs: the board by install step and the crews' week (Phase 3)
    { href: "/jobs", label: t("nav_jobs", lang) },
    // the grid connections overview: Moldova's operators only (Phase 2)
    ...((co?.default_market || "MD") === "MD" ? [{ href: "/grid", label: t("nav_grid", lang) }] : []),
    { href: "/portfolios", label: pt("nav", lang) },
    { href: "/energy", label: et("nav", lang) },
    { href: "/documents", label: t("nav_documents", lang) },
    { href: "/activity", label: t("nav_activity", lang) },
    { href: "/studio", label: t("nav_studio", lang) },
    { href: "/team", label: t("nav_team", lang) },
    { href: "/settings", label: t("nav_settings", lang) },
    { href: "/guide", label: t("nav_guide", lang) },
  ];

  return (
    <div className="app">
      <AppTheme />
      {/* also keeps the workspace language on the device, for the error page and /login (lib/HtmlLang.jsx) */}
      <HtmlLang lang={lang} persist />
      <a className="skip-link" href="#main">{lang === "ro" ? "Sari la conținut" : lang === "ru" ? "К содержимому" : lang === "uk" ? "До вмісту" : "Skip to content"}</a>
      <aside className="sidebar">
        <Link className="logo" href="/dashboard" aria-label="VoltMira"><Logo size={32} /></Link>
        <SideNav items={items} moreLabel={t("nav_more", lang)}
          sheetFooter={
            <>
              <Link className="more-foot-profile" href="/profile">
                {avatar
                  ? <img className="avatar" src={avatar} alt="" />
                  : <div className="avatar">{initialsOf(who)}</div>}
                <div className="who"><b>{who}</b><span>{co?.name}</span></div>
              </Link>
              <ThemeToggle lang={lang} />
              <SignOut lang={lang} />
            </>
          } />
        <div className="side-foot">
          <div className="side-card">
            <Link className="profile" href="/profile" style={{ textDecoration: "none", color: "inherit" }} title={t("pf_title", lang)}>
              {avatar
                ? <img className="avatar" src={avatar} alt="" style={{ objectFit: "cover", background: "var(--paper-2)" }} />
                : <div className="avatar">{initialsOf(who)}</div>}
              <div className="who"><b>{who}</b><span>{co?.name}</span></div>
            </Link>
            {/* VoltMira is free; the one charge is a fee per won project (lib/jobFees.js), explained in Settings */}
            <Link className="side-plan" href="/settings?tab=fees">
              <i className="sp-ico"><Receipt size={15} strokeWidth={2} aria-hidden="true" /></i>
              <span className="sp-tx">
                <b>{t("side_fees", lang)}</b>
                <small>{t("side_fees_sub", lang)}</small>
              </span>
              <ChevronRight className="sp-go" size={15} strokeWidth={2} aria-hidden="true" />
            </Link>
          </div>
          {/* theme and sign-out on one line, so a short screen still shows both */}
          <div className="side-acts">
            <ThemeToggle lang={lang} />
            <SignOut lang={lang} />
          </div>
        </div>
      </aside>
      <main className="main" id="main">
        {/* Demo tenants are real workspaces (see lib/demoSeed.js), so without this
            strip there is nothing telling a visitor the data is invented. */}
        {/* Offline mode: keeps opened pages and recent quotes for places
            with no signal, and says so when there is none. */}
        <OfflineReady lang={lang} demo={isDemoEmail(user.email)} />
        <MobileBack lang={lang} />
        {/* renews this device's 30-day sign-in once a day (lib/authCookie.js) */}
        <KeepSignedIn />
        {isDemoEmail(user.email) && (
          <div className="demo-bar">
            <span className="demo-badge">{t("demo_badge", lang)}</span>
            <span className="demo-note">{t("demo_note", lang)}</span>
            <Link className="demo-cta" href="/login">{t("demo_cta", lang)}</Link>
          </div>
        )}
        {children}
      </main>
    </div>
  );
}
