// app/(app)/admin/page.jsx — the Overview: the numbers that run VoltMira on one page, for its own team
// (PLATFORM_ADMIN_EMAILS); anyone else gets a 404. Who signed up and whether they got going, how much the
// installers quote and sign, what VoltMira bills and is owed, who to call today and who is doing best.
// English, like /traction. Data: lib/signupsLoad.js, lib/tractionData.js, lib/feeAdmin.js; shaped by lib/ceoOverview.js.
import "../dx.css";
import "./overview.css";
import Link from "next/link";
import { notFound } from "next/navigation";
import { currentUser, currentCompany } from "../../../lib/session.js";
import { isPlatformAdmin } from "../../../lib/platformAdmin.js";
import { supabaseAdmin } from "../../../lib/supabase.js";
import { normLang } from "../../../lib/i18n.js";
import { loadSignups } from "../../../lib/signupsLoad.js";
import { loadTraction } from "../../../lib/tractionData.js";
import { loadFeeAdmin } from "../../../lib/feeAdmin.js";
import { feeRevenue } from "../../../lib/feeRevenue.js";
import { feePaywallOn } from "../../../lib/jobFees.js";
import { change, weeklySignups, funnel, toCall, topInstallers, breakdown, signupWindow, headline } from "../../../lib/ceoOverview.js";
import { relTime } from "../../../lib/relTime.js";
import AdminNav, { ADMIN_CSS } from "./AdminNav.jsx";

export const dynamic = "force-dynamic";
export const metadata = { title: "Overview | VoltMira", robots: { index: false } };

const INT = (n) => Math.round(n || 0).toLocaleString("en-GB");
const EUR = (n) => "€" + Math.round(n || 0).toLocaleString("en-GB");
// short for the tiles: €125.1k, €1.2M
const EUR_S = (n) => (Math.abs(n || 0) < 10000 ? EUR(n) : "€" + (n || 0).toLocaleString("en-GB", { notation: "compact", maximumFractionDigits: 1 }));
const KWP = (n) => (n || 0).toLocaleString("en-GB", { maximumFractionDigits: n >= 100 ? 0 : 1 }) + " kWp";
const LEI = (minor) => `${Math.round((Number(minor) || 0) / 100).toLocaleString("en-GB")} lei`;
const PCT = (x) => (x == null ? "-" : Math.round(x * 100) + "%");
const HRS = (h) => (h == null ? "-" : h < 1 ? Math.max(1, Math.round(h * 60)) + " min" : h < 48 ? (h < 10 ? h.toFixed(1) : Math.round(h)) + " h" : (h / 24).toFixed(1) + " days");
// the time the page is made at (a server render: once per request)
const clock = () => Date.now();
const STEP = { accounts: "Made an account", workspace: "Set up a workspace", quote: "Made a quote", sent: "Sent an offer", signed: "Signed at least one job" };

function Delta({ now, prev }) {
  const c = change(now, prev);
  if (c == null) return now > 0 ? <span className="ov-delta up">new</span> : null;
  const r = Math.round(c * 100);
  return <span className={"ov-delta " + (r > 0 ? "up" : r < 0 ? "down" : "flat")} title="Against the 30 days before">{r > 0 ? "+" : ""}{r}%</span>;
}

/** Bars over time, one series, scaled to the largest and as tall as the card; each bar's value on hover, the
 *  highest and the last labelled. HTML, not SVG, so the dates stay sharp at any width. */
function Bars({ data, label, fmt = INT }) {
  const max = Math.max(1, ...data.map((d) => d.v));
  const top = data.reduce((b, d, i) => (d.v > data[b].v ? i : b), 0);
  const every = Math.ceil(data.length / 6);
  return (
    <figure className="ov-chart">
      <div className="ov-cols" role="img" aria-label={label}>
        {data.map((d, i) => (
          <div key={d.k} className="ov-col" title={`${d.label}: ${fmt(d.v)}`}>
            {(i === data.length - 1 || (i === top && d.v > 0)) && <span className="ov-val">{fmt(d.v)}</span>}
            <i style={{ height: d.v > 0 ? `max(3px, calc((100% - 18px) * ${d.v / max}))` : 0 }} />
          </div>
        ))}
      </div>
      <div className="ov-ticks" aria-hidden="true">
        {data.map((d, i) => <span key={d.k}>{i % every === 0 || i === data.length - 1 ? d.label : ""}</span>)}
      </div>
      <table className="sr"><caption>{label}</caption><tbody>{data.map((d) => <tr key={d.k}><th>{d.label}</th><td>{fmt(d.v)}</td></tr>)}</tbody></table>
    </figure>
  );
}

export default async function Overview() {
  const user = await currentUser();
  if (!isPlatformAdmin(user?.email)) notFound();
  const co = await currentCompany().catch(() => null);
  const lang = normLang(co?.lang);
  const now = clock();

  const [s, r, prof] = await Promise.all([
    loadSignups(),
    loadTraction({ weeks: 12 }),
    supabaseAdmin().from("profiles").select("name").eq("id", user.id).maybeSingle().then((x) => x.data).catch(() => null),
  ]);
  const fa = await loadFeeAdmin(r.workspaces.map((w) => w.id)).catch(() => ({ fees: [] }));
  const rev = feeRevenue({ fees: fa.fees || [], months: 6, now });
  const T = r.totals;
  const sw = signupWindow(s.rows, now);
  const weeks = weeklySignups(s.rows, { weeks: 12, now }).map((w) => ({ k: w.week, v: w.n, label: new Date(w.week + "T12:00:00Z").toLocaleDateString("en-GB", { day: "numeric", month: "short" }) }));
  const steps = funnel(s.rows, r.workspaces);
  const calls = toCall(s.rows, { now });
  const top = topInstallers(r.workspaces);
  const countries = breakdown(s.rows, "country").slice(0, 6);
  const methods = breakdown(s.rows.map((x) => ({ ...x, how: x.provider === "google" ? "Google" : "Email" })), "how");
  const months = rev.months.map((m) => ({ k: m.month, v: (m.feesMinor || 0) / 100, label: new Date(m.month + "-15T00:00:00Z").toLocaleDateString("en-GB", { month: "short", timeZone: "UTC" }) }));
  const first = (prof?.name || user.email || "").split(/[\s@]/)[0];
  const hour = Number(new Date(now).toLocaleString("en-GB", { hour: "numeric", hour12: false, timeZone: "Europe/Chisinau" }));
  const hello = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
  const today = new Date(now).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "Europe/Chisinau" });
  const maxCountry = Math.max(1, ...countries.map((c) => c.n));

  const kpis = [
    { label: "New sign-ups", value: INT(sw.last30), sub: `${INT(s.totals.people)} in all`, delta: <Delta now={sw.last30} prev={sw.prev30} />, href: "/admin/signups" },
    { label: "Active workspaces", value: INT(r.last30.active), sub: `${INT(T.workspaces)} workspaces in all`, delta: <Delta now={r.last30.active} prev={r.prev30.active} /> },
    { label: "Offers sent", value: INT(r.last30.sent), sub: `${KWP(r.last30.kwp)} quoted`, delta: <Delta now={r.last30.sent} prev={r.prev30.sent} /> },
    { label: "Value quoted", value: EUR_S(r.last30.eur), sub: `${EUR(r.last30.eur)}, offers sent`, delta: <Delta now={r.last30.eur} prev={r.prev30.eur} /> },
    { label: "Jobs signed", value: INT(T.won), sub: `${KWP(T.kwpWon)}, ${EUR(T.eurWon)}`, delta: null },
    { label: "VoltMira collected", value: LEI(rev.totals.paidMinor), sub: `${LEI(rev.totals.dueMinor)} still owed`, delta: null, href: "/traction" },
  ];

  return (
    <div className="dx adm ov">
      <style dangerouslySetInnerHTML={{ __html: ADMIN_CSS }} />

      {/* the day, and the month in one line */}
      <header className="ov-hero">
        <div className="ov-band" aria-hidden="true"><i /><i /><i /></div>
        <div className="ov-hero-in">
          <span className="ov-kicker">{today}</span>
          <h1>{hello}{first ? `, ${first}` : ""}</h1>
          <p>{headline({ signups30: sw.last30, sent30: r.last30.sent, won: T.won, active30: r.last30.active })}</p>
        </div>
      </header>

      <AdminNav lang={lang} here="/admin" />
      {s.needsDb && <p className="adm-warn" role="note">The sign-up log is not in the database yet: run supabase/add-signup-log.sql.</p>}

      {/* the six numbers */}
      <section className="ov-kpis" aria-label="Key numbers">
        {kpis.map((k) => {
          const body = (
            <>
              <span className="ov-k-label">{k.label}</span>
              <span className="ov-k-row"><b className="ov-k-val">{k.value}</b>{k.delta}</span>
              <span className="ov-k-sub">{k.sub}</span>
            </>
          );
          return k.href ? <Link key={k.label} className="ov-kpi is-link" href={k.href}>{body}</Link> : <div key={k.label} className="ov-kpi">{body}</div>;
        })}
      </section>

      <div className="ov-grid2">
        {/* growth */}
        <section className="ov-card">
          <header className="ov-card-h"><h2>Sign-ups per week</h2><span>last 12 weeks, people (not teammates)</span></header>
          <Bars data={weeks} label="Sign-ups per week" />
        </section>

        {/* the funnel */}
        <section className="ov-card">
          <header className="ov-card-h"><h2>From sign-up to a signed job</h2><span>everyone so far, a workspace counted once</span></header>
          <ol className="ov-funnel">
            {steps.map((st) => (
              <li key={st.key}>
                <div className="ov-f-top"><span>{STEP[st.key]}</span><b>{INT(st.n)}</b></div>
                <div className="ov-f-track"><i style={{ width: `${Math.max(2, (st.ofTop ?? 0) * 100)}%` }} /></div>
                {st.ofPrev != null && <small>{PCT(st.ofPrev)} of the step before</small>}
              </li>
            ))}
          </ol>
        </section>
      </div>

      <div className="ov-grid2">
        {/* who to call */}
        <section className="ov-card">
          <header className="ov-card-h"><h2>Call these people</h2><span>new in the last 14 days, no quote yet</span></header>
          {calls.length ? (
            <ul className="ov-list">
              {calls.map((c) => (
                <li key={c.id}>
                  <div className="ov-l-main"><b>{c.name || c.email}</b><span>{[c.company, c.country !== "Unknown" ? c.country : ""].filter(Boolean).join(", ") || c.email}</span></div>
                  <div className="ov-l-side">
                    {c.phone ? <a className="ov-pill is-call" href={`tel:${c.phone}`}>{c.phone}</a> : <a className="ov-pill" href={`mailto:${c.email}`}>Email</a>}
                    <small>{relTime(c.at, "en-GB", now)}</small>
                  </div>
                </li>
              ))}
            </ul>
          ) : <p className="ov-empty">Nobody waiting: everyone new has made a quote.</p>}
          <Link className="ov-more" href="/admin/signups">All sign-ups</Link>
        </section>

        {/* who is doing best */}
        <section className="ov-card">
          <header className="ov-card-h"><h2>Top installers</h2><span>by jobs signed, then offers sent</span></header>
          {top.length ? (
            <table className="ov-table">
              <thead><tr><th>Workspace</th><th>Quotes</th><th>Sent</th><th>Signed</th><th>Quoted</th></tr></thead>
              <tbody>{top.map((w) => (
                <tr key={w.id || w.name}><td><b>{w.name || "Unnamed"}</b><small>{w.lastActive ? `active ${relTime(w.lastActive, "en-GB", now)}` : "not active yet"}</small></td>
                  <td>{INT(w.quotes)}</td><td>{INT(w.sent)}</td><td className={w.won ? "is-won" : ""}>{INT(w.won)}</td><td>{KWP(w.kwpQuoted)}</td></tr>
              ))}</tbody>
            </table>
          ) : <p className="ov-empty">No quotes yet.</p>}
          <Link className="ov-more" href="/traction">Every workspace</Link>
        </section>
      </div>

      <div className="ov-grid2">
        {/* what VoltMira bills */}
        <section className="ov-card">
          <header className="ov-card-h"><h2>VoltMira fees billed</h2><span>per month, lei{feePaywallOn() ? "" : ", fees are not switched on yet"}</span></header>
          {months.some((m) => m.v > 0)
            ? <Bars data={months} label="Fees billed per month, lei" />
            : <p className="ov-empty ov-nofees">No fees billed in the last 6 months.{feePaywallOn() ? "" : " Set JOB_FEES=on on Vercel to start billing signed jobs."}</p>}
          <dl className="ov-money">
            <div><dt>Collected</dt><dd>{LEI(rev.totals.paidMinor)}</dd></div>
            <div><dt>Still owed</dt><dd>{LEI(rev.totals.dueMinor)}</dd></div>
            <div className={rev.totals.lateN ? "is-late" : ""}><dt>Overdue</dt><dd>{LEI(rev.totals.lateMinor)}{rev.totals.lateN ? ` (${rev.totals.lateN} jobs)` : ""}</dd></div>
            <div><dt>Per signed job</dt><dd>{rev.perJobMinor != null ? LEI(rev.perJobMinor) : "none yet"}</dd></div>
          </dl>
        </section>

        {/* where they come from, and the quality of the work */}
        <section className="ov-card">
          <header className="ov-card-h"><h2>Where they come from</h2><span>country from the connection at sign-up</span></header>
          <ul className="ov-hbars">
            {countries.map((c) => (
              <li key={c.label}><span>{c.label === "Unknown" ? "Not recorded" : c.label}</span><i style={{ width: `${(c.n / maxCountry) * 100}%` }} /><b>{INT(c.n)}</b></li>
            ))}
            {!countries.length && <li className="ov-empty">No sign-ups yet.</li>}
          </ul>
          <p className="ov-split">{methods.map((m) => `${m.label} ${INT(m.n)}`).join(", ") || "-"}</p>
          <h3 className="ov-h3">How well it works</h3>
          <dl className="ov-money">
            <div><dt>Offers opened</dt><dd>{PCT(T.openRate)}</dd></div>
            <div><dt>Win rate</dt><dd>{PCT(T.winRate)}</dd></div>
            <div><dt>Lead to quote</dt><dd>{HRS(T.hoursLeadToQuote)}</dd></div>
            <div><dt>Draft to sent</dt><dd>{HRS(T.hoursDraftToSent)}</dd></div>
          </dl>
        </section>
      </div>
    </div>
  );
}
