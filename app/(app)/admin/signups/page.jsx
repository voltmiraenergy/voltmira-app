// app/(app)/admin/signups/page.jsx — who is signing up: every real account (the demo's are never logged), newest
// first, with name, email, company, country, how they signed up and whether they have quoted. Platform admins only
// (PLATFORM_ADMIN_EMAILS); anyone else gets a 404. English only, like /traction. Data: supabase/add-signup-log.sql.
import { notFound } from "next/navigation";
import { currentUser, currentCompany } from "../../../../lib/session.js";
import { isPlatformAdmin } from "../../../../lib/platformAdmin.js";
import { normLang } from "../../../../lib/i18n.js";
import { at } from "../../../../lib/adminText.js";
import { deviceOf } from "../../../../lib/signupsAdmin.js";
import { loadSignups } from "../../../../lib/signupsLoad.js";
import { fmtDate, fmtTime } from "../../../../lib/tz.js";
import { relTime } from "../../../../lib/relTime.js";
import AdminNav, { ADMIN_CSS } from "../AdminNav.jsx";

export const dynamic = "force-dynamic";
export const metadata = { title: "Sign-ups | VoltMira", robots: { index: false } };

const KIND = { owner: "New workspace", teammate: "Invited teammate", unfinished: "Did not finish" };

export default async function SignupsPage() {
  const user = await currentUser();
  if (!isPlatformAdmin(user?.email)) notFound();
  const co = await currentCompany().catch(() => null);
  const lang = normLang(co?.lang);
  const s = await loadSignups();
  const needsDb = s.needsDb;
  const T = s.totals;
  const tile = (n, label) => <div className="adm-card" style={{ margin: 0 }}><h2 style={{ fontSize: 26 }}>{n}</h2><p style={{ margin: 0 }}>{label}</p></div>;

  return (
    <div className="dx adm">
      <style dangerouslySetInnerHTML={{ __html: ADMIN_CSS }} />
      <header className="dx-head"><div className="dx-hello"><h1>{at("ad_signups", lang)}</h1><p className="dx-summary">Every real person who made an account. The demo is left out.</p></div></header>
      <AdminNav lang={lang} here="/admin/signups" />
      {needsDb && <p className="adm-warn" role="note">The sign-up log is not in the database yet: run supabase/add-signup-log.sql in Supabase, SQL Editor.</p>}

      <div className="adm-grid" style={{ marginBottom: 16 }}>
        {tile(T.people, "people, in all")}
        {tile(T.today, "in the last 24 hours")}
        {tile(T.week, "in the last 7 days")}
        {tile(T.month, "in the last 30 days")}
        {tile(T.withQuote, "have made a quote")}
        {tile(T.unfinished, "did not finish")}
      </div>

      {s.countries.length > 0 && (
        <section className="adm-card">
          <h2>Countries</h2>
          <p>From the connection the first time they opened the app.</p>
          <div className="adm-checks">{s.countries.map(([c, n]) => <span key={c}><b>{n}</b>&nbsp;{c}</span>)}</div>
        </section>
      )}

      <section className="adm-card">
        <h2>Sign-ups</h2>
        {/* on a phone: one card per person (AdminNav.jsx styles), the full table on a computer */}
        <ul className="su-cards">
          {s.rows.map((r) => (
            <li key={r.id}>
              <div className="su-top"><b>{r.name || r.company || r.email}</b><time dateTime={r.at}>{relTime(r.at, "en-GB")}</time></div>
              <a className="su-mail" href={`mailto:${r.email}`}>{r.email}</a>
              <div className="su-meta">
                {r.company && r.name && <span>{r.company}</span>}
                <span>{KIND[r.kind]}</span>
                <span>{r.quotes} {r.quotes === 1 ? "quote" : "quotes"}</span>
                {r.country && r.country !== "Unknown" && <span>{r.country}{r.city ? `, ${r.city}` : ""}</span>}
                <span>{r.provider === "google" ? "Google" : "Email"}</span>
                {deviceOf(r.userAgent) && deviceOf(r.userAgent) !== "-" && <span>{deviceOf(r.userAgent)}</span>}
              </div>
              {r.phone && <a className="su-call" href={`tel:${r.phone}`}>{r.phone}</a>}
            </li>
          ))}
          {!s.rows.length && <li>No sign-ups yet.</li>}
        </ul>
        <div className="adm-scroll su-scroll">
          <table className="adm-table">
            <thead><tr><th>When</th><th>Name</th><th>Email</th><th>Phone</th><th>Company</th><th>Country</th><th>First opened</th><th>Device</th><th>Signed up with</th><th>Status</th><th>Quotes</th><th>User id</th></tr></thead>
            <tbody>
              {s.rows.map((r) => (
                <tr key={r.id}>
                  <td className="num" title={`${fmtDate(r.at, "en-GB", { day: "numeric", month: "short", year: "numeric" })} ${fmtTime(r.at, "en-GB")}`}>{relTime(r.at, "en-GB")}</td>
                  <td>{r.name || "-"}</td>
                  <td><a href={`mailto:${r.email}`}>{r.email}</a></td>
                  <td className="num">{r.phone ? <a href={`tel:${r.phone}`}>{r.phone}</a> : "-"}</td>
                  <td>{r.company || "-"}</td>
                  <td>{r.country}{r.city ? `, ${r.city}` : ""}</td>
                  <td className="num">{r.seen ? `${fmtDate(r.seen, "en-GB", { day: "numeric", month: "short" })} ${fmtTime(r.seen, "en-GB")}` : "not yet"}</td>
                  <td title={r.userAgent}>{deviceOf(r.userAgent)}</td>
                  <td>{r.provider === "google" ? "Google" : "Email"}</td>
                  <td>{KIND[r.kind]}</td>
                  <td className="num">{r.quotes}</td>
                  <td><code title={r.id} style={{ fontSize: 11 }}>{r.id}</code></td>
                </tr>
              ))}
              {!s.rows.length && <tr><td colSpan={12}>No sign-ups yet.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
