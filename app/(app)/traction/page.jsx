// app/(app)/traction/page.jsx — the platform's growth, across every real
// workspace. For VoltMira's own team (PLATFORM_ADMIN_EMAILS), not installers:
// anyone else gets a 404. What counts and why is documented in lib/traction.js.
// English only: it's an internal page, and the numbers go into an English deck.
import "../dx.css";
import "./traction.css";
import { notFound } from "next/navigation";
import { currentUser } from "../../../lib/session.js";
import { isPlatformAdmin } from "../../../lib/platformAdmin.js";
import { loadTraction } from "../../../lib/tractionData.js";
import { relTime } from "../../../lib/relTime.js";
import { fmtDate } from "../../../lib/tz.js";
import { openPackRequests } from "../../../lib/packAdmin.js";
import { paywallOn } from "../../../lib/packPricing.js";
import PackRequests from "./PackRequests.jsx";
import { monitoringBilled, FREE_SYSTEMS, EUR_PER_SYSTEM } from "../../../lib/monitoringPricing.js";
import FeeAdmin from "./FeeAdmin.jsx";
import { loadFeeAdmin } from "../../../lib/feeAdmin.js";
import { feeRevenue } from "../../../lib/feeRevenue.js";
import { jobAccess, feePaywallOn } from "../../../lib/jobFees.js";
import { feeRef } from "../../../lib/jobFeePay.js";

export const dynamic = "force-dynamic";
export const metadata = { title: "Traction | VoltMira", robots: { index: false } };

const EUR = (n) => "€" + Math.round(n || 0).toLocaleString("en-IE");
const KWP = (n) => (n || 0).toLocaleString("en-IE", { maximumFractionDigits: n >= 100 ? 0 : 1 }) + " kWp";
const PCT = (x) => (x == null ? "—" : Math.round(x * 100) + "%");
const INT = (n) => Math.round(n || 0).toLocaleString("en-IE");

function hours(h) {
  if (h == null) return "—";
  if (h < 1) return Math.max(1, Math.round(h * 60)) + " min";
  if (h < 48) return (h < 10 ? h.toFixed(1) : Math.round(h)) + " h";
  return (h / 24).toFixed(1) + " days";
}

/** Change against the 30 days before, as a small signed chip beside the figure. */
function Delta({ now, prev }) {
  if (!prev && !now) return null;
  if (!prev) return <span className="tr-delta up" title="Nothing in the 30 days before">new</span>;
  const d = (now - prev) / prev;
  const cls = d > 0.005 ? "up" : d < -0.005 ? "down" : "";
  return (
    <span className={"tr-delta " + cls} title={`Against the 30 days before: ${prev.toLocaleString("en-IE", { maximumFractionDigits: 1 })}`}>
      {d > 0 ? "+" : d < 0 ? "−" : "±"}{Math.abs(Math.round(d * 100))}%
    </span>
  );
}

/** Twelve weekly bars on one scale; the running week is drawn lighter. */
function WeekBars({ title, series, pick, fmt }) {
  const vals = series.map(pick);
  const max = Math.max(...vals, 0);
  const W = 300, H = 96, gap = 4, top = 14, bottom = 16;
  const bw = (W - gap * (vals.length - 1)) / vals.length;
  const plotH = H - top - bottom;
  const label = (w) => new Date(w + "T00:00:00Z").toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });
  const last = vals.at(-1), prev = vals.at(-2);
  return (
    <figure className="tr-chart">
      <figcaption>
        <span>{title}</span>
        <b>{fmt(prev ?? 0)}</b>
        <small>last full week, this week so far {fmt(last ?? 0)}</small>
      </figcaption>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${title}, weekly, ${series[0]?.week} to ${series.at(-1)?.week}`}>
        <line x1="0" x2={W} y1={H - bottom} y2={H - bottom} className="tr-axis" />
        {vals.map((v, i) => {
          const h = max ? Math.max(v > 0 ? 2 : 0, (v / max) * plotH) : 0;
          return (
            <rect key={i} x={i * (bw + gap)} y={H - bottom - h} width={bw} height={h} rx="2"
              className={i === vals.length - 1 ? "tr-bar now" : "tr-bar"}>
              <title>{`Week of ${label(series[i].week)}: ${fmt(v)}`}</title>
            </rect>
          );
        })}
        <text x="0" y="10" className="tr-tick">{max ? fmt(max) : "0"}</text>
        <text x="0" y={H - 3} className="tr-tick">{label(series[0].week)}</text>
        <text x={W} y={H - 3} textAnchor="end" className="tr-tick">{label(series.at(-1).week)}</text>
      </svg>
    </figure>
  );
}

export default async function TractionPage() {
  const user = await currentUser();
  if (!isPlatformAdmin(user?.email)) notFound();
  const [r, packs] = await Promise.all([loadTraction({ weeks: 12 }), openPackRequests().catch(() => [])]);
  // the fee per won project (lib/jobFees.js), for the real workspaces only
  const fa = await loadFeeAdmin(r.workspaces.map((w) => w.id));
  const rev = feeRevenue({ fees: fa.fees, months: 6 });
  const LEI = (minor) => `${Math.round((Number(minor) || 0) / 100).toLocaleString("en-GB")} lei`;
  const owed = fa.fees.filter((f) => f.status === "due" || f.status === "void").map((f) => ({
    id: f.id, workspace: fa.companies.get(f.company_id) || "", job: fa.projects.get(f.project_id) || "", amount_minor: f.amount_minor,
    status: f.status, locked: jobAccess({ fee: f, on: true }).locked, ref: feeRef(f.id),
    payBy: f.grace_ends_at ? fmtDate(f.grace_ends_at, "en-GB", { day: "numeric", month: "short" }) : "",
  }));
  const feesBy = new Map();
  for (const f of fa.fees) {
    const x = feesBy.get(f.company_id) || { paid: 0, due: 0 };
    if (f.status === "paid" && f.payment_method !== "credit") x.paid += Number(f.amount_minor) || 0;
    if (f.status === "due") x.due += Number(f.amount_minor) || 0;
    feesBy.set(f.company_id, x);
  }
  const T = r.totals;
  const thisWeek = r.series.at(-1), lastWeek = r.series.at(-2);
  // monitoring, invoiced by hand each month (lib/monitoringPricing.js)
  const monitoring = r.workspaces.reduce((t, w) => ({ systems: t.systems + (w.monitored || 0), eur: t.eur + (w.monitoringEur || 0), due: t.due + (w.monitoringEur > 0 ? 1 : 0) }), { systems: 0, eur: 0, due: 0 });

  return (
    <div className="dx trx">
      <header className="dx-head">
        <div className="dx-hello">
          <h1>Traction</h1>
          <p className="dx-summary">
            {INT(T.workspaces)} real workspaces; {LEI(rev.totals.paidMinor)} paid in fees for won projects, {LEI(rev.totals.dueMinor)} still due.
            {" "}{INT(T.excluded)} left out: demo, empty, and your team&rsquo;s own workspaces. Sample pipelines don&rsquo;t count either.
          </p>
        </div>
        <div className="dx-head-tools">
          <a className="dx-btn" href="/admin/tariffs">Tariff rules</a>
          <a className="dx-btn" href="/admin/subsidies">Support programmes</a>
          <a className="dx-btn" href="/api/admin/traction?format=csv">Download weekly CSV</a>
        </div>
      </header>

      <dl className="tr-strip">
        <div>
          <dt>Proposals sent</dt><dd>{INT(r.last30.sent)}<Delta now={r.last30.sent} prev={r.prev30.sent} /></dd>
          <dd className="tr-sub">last 30 days</dd>
        </div>
        <div>
          <dt>kWp quoted</dt><dd>{KWP(r.last30.kwp)}<Delta now={r.last30.kwp} prev={r.prev30.kwp} /></dd>
          <dd className="tr-sub">last 30 days</dd>
        </div>
        <div>
          <dt>€ in proposals</dt><dd>{EUR(r.last30.eur)}<Delta now={r.last30.eur} prev={r.prev30.eur} /></dd>
          <dd className="tr-sub">last 30 days, contract value</dd>
        </div>
        <div>
          <dt>Active workspaces</dt><dd>{INT(r.last30.active)}<small>/ {INT(T.workspaces)}</small><Delta now={r.last30.active} prev={r.prev30.active} /></dd>
          <dd className="tr-sub">last 30 days, {INT(lastWeek?.activeWorkspaces)} last full week</dd>
        </div>
        <div>
          <dt>New workspaces</dt><dd>{INT(r.last30.fresh)}<Delta now={r.last30.fresh} prev={r.prev30.fresh} /></dd>
          <dd className="tr-sub">last 30 days</dd>
        </div>
        <div>
          <dt>Win rate</dt><dd>{PCT(T.winRate)}</dd>
          <dd className="tr-sub">{INT(T.won)} won of {INT(T.won + T.lost)} decided</dd>
        </div>
      </dl>

      <section className="dx-card" aria-labelledby="tr-fees-h">
        <header className="dx-card-head">
          <div>
            <h2 id="tr-fees-h">Fees per won project<span className="dx-count">{fa.fees.length}</span></h2>
            <p className="dx-muted-note">
              {fa.needsDb ? "add-job-fees.sql has not run yet: no fee is recorded." : feePaywallOn() ? "JOB_FEES is on: a due fee locks the job's paperwork after its 14 days." : "JOB_FEES is off: fees are recorded, nothing is locked and no reminder goes out."}
              {" "}Income per paid job: {rev.perJobMinor == null ? "none yet" : LEI(rev.perJobMinor)}; per kW won and paid: {rev.perKwMinor == null ? "none yet" : LEI(rev.perKwMinor)}.
              {" "}{INT(rev.totals.freeN)} free, {INT(rev.totals.lockedN)} locked, {INT(rev.totals.waivedN)} waived, {INT(rev.totals.creditN)} paid from credit.
            </p>
          </div>
          <a className="dx-btn" href="/api/admin/job-fees?format=csv">Download fees CSV</a>
        </header>
        <div className="tr-tbl-wrap">
          <table className="tr-tbl">
            <thead><tr><th>Month</th><th className="n">Paid</th><th className="n">Lei paid</th><th className="n">Due</th><th className="n">Lei due</th><th className="n">Free</th><th className="n">Lost</th><th className="n">Waived</th></tr></thead>
            <tbody>
              {rev.months.map((m) => (
                <tr key={m.month}><td>{m.month}</td><td className="n">{INT(m.paid.n)}</td><td className="n">{LEI(m.paid.minor)}</td><td className="n">{INT(m.due.n)}</td><td className="n">{LEI(m.due.minor)}</td><td className="n">{INT(m.free)}</td><td className="n">{INT(m.void)}</td><td className="n">{INT(m.waived)}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
        <h3 className="tr-h3">Owed: mark a transfer paid, or waive</h3>
        <FeeAdmin rows={owed} />
        <p className="dx-muted-note">To compare against the fee once measurable: what AI and monitoring cost per won job.</p>
      </section>

      <section className="dx-card" aria-labelledby="tr-packs-h">
        <header className="dx-card-head">
          <div>
            <h2 id="tr-packs-h">Bank packs to unlock<span className="dx-count">{packs.length}</span></h2>
            <p className="dx-muted-note">Paid by bank transfer: unlock once the money has arrived. Card payments unlock on their own. The pack gate is {paywallOn() ? "on" : "off (PACK_PAYWALL is not set), so every pack downloads freely"}.</p>
          </div>
        </header>
        <PackRequests initial={packs} />
      </section>

      <p className="dx-muted-note tr-mon">
        Monitoring: {INT(monitoring.systems)} systems monitored across all workspaces.
        {" "}{monitoringBilled()
          ? <>To invoice this month: <b>€{monitoring.eur.toFixed(2)}</b> from {INT(monitoring.due)} workspaces (the first {FREE_SYSTEMS} systems free, then €{EUR_PER_SYSTEM.toFixed(2)} each). The per-workspace amounts are in the table below.</>
          : <>Billing is off (MONITORING_BILLING is not set): installers are told it is free while it is tested. Once on, the first {FREE_SYSTEMS} systems are free, then €{EUR_PER_SYSTEM.toFixed(2)} each a month.</>}
      </p>

      <section className="dx-card" aria-labelledby="tr-weeks-h">
        <header className="dx-card-head"><div><h2 id="tr-weeks-h">Week by week</h2></div></header>
        <div className="tr-charts">
          <WeekBars title="Active workspaces" series={r.series} pick={(s) => s.activeWorkspaces} fmt={INT} />
          <WeekBars title="Proposals sent" series={r.series} pick={(s) => s.sent} fmt={INT} />
          <WeekBars title="kWp quoted" series={r.series} pick={(s) => s.kwpQuoted} fmt={KWP} />
          <WeekBars title="€ in proposals" series={r.series} pick={(s) => s.eurQuoted} fmt={EUR} />
          <WeekBars title="New workspaces" series={r.series} pick={(s) => s.newWorkspaces} fmt={INT} />
          <WeekBars title="Leads captured" series={r.series} pick={(s) => s.leads} fmt={INT} />
        </div>
      </section>

      <div className="tr-two">
        <section className="dx-card" aria-labelledby="tr-speed-h">
          <header className="dx-card-head"><div><h2 id="tr-speed-h">Speed</h2></div></header>
          <dl className="tr-kv">
            <div><dt>Lead in to proposal sent</dt><dd>{hours(T.hoursLeadToQuote)}</dd><dd className="tr-sub">median of {INT(T.leadToQuoteN)} leads that became a quote</dd></div>
            <div><dt>Quote started to sent</dt><dd>{hours(T.hoursDraftToSent)}</dd><dd className="tr-sub">median of {INT(T.draftToSentN)} sent quotes</dd></div>
          </dl>
        </section>
        <section className="dx-card" aria-labelledby="tr-all-h">
          <header className="dx-card-head"><div><h2 id="tr-all-h">All time</h2></div></header>
          <dl className="tr-kv">
            <div><dt>Quotes sent</dt><dd>{INT(T.sent)}</dd><dd className="tr-sub">{KWP(T.kwpQuoted)}, {EUR(T.eurQuoted)}</dd></div>
            <div><dt>Won</dt><dd>{INT(T.won)}</dd><dd className="tr-sub">{KWP(T.kwpWon)}, {EUR(T.eurWon)}</dd></div>
            <div><dt>Proposals opened by the client</dt><dd>{PCT(T.openRate)}</dd><dd className="tr-sub">{INT(T.signed)} signed online</dd></div>
            <div><dt>Leads captured</dt><dd>{INT(T.leads)}</dd><dd className="tr-sub">widget, proposal and manual</dd></div>
          </dl>
        </section>
      </div>

      <section className="dx-card" aria-labelledby="tr-ws-h">
        <header className="dx-card-head">
          <div><h2 id="tr-ws-h">Workspaces<span className="dx-count">{r.workspaces.length}</span></h2></div>
        </header>
        {r.workspaces.length === 0 ? (
          <p className="dx-muted-note">No real workspaces yet.</p>
        ) : (
          <div className="tr-tbl-wrap">
            <table className="tr-tbl">
              <thead>
                <tr>
                  <th>Workspace</th><th>Fees paid, due</th><th>Joined</th><th>Last active</th>
                  <th className="n">People</th><th className="n">Quotes</th><th className="n">Sent</th><th className="n">Won</th>
                  <th className="n">kWp quoted</th><th className="n">€ quoted</th><th className="n">Leads</th>
                  <th className="n" title="Systems whose portal delivered one of the last two finished months">Monitored</th><th className="n">Monitoring €/mo</th>
                </tr>
              </thead>
              <tbody>
                {r.workspaces.slice(0, 200).map((w) => (
                  <tr key={w.id}>
                    <td className="tr-name" title={`Workspace id: ${w.id}`}>{w.name || "Unnamed"}</td>
                    <td><span className={"tr-plan " + (feesBy.get(w.id)?.paid ? "paid" : "")}>{LEI(feesBy.get(w.id)?.paid || 0)}{feesBy.get(w.id)?.due ? `, ${LEI(feesBy.get(w.id).due)} due` : ""}</span></td>
                    <td>{fmtDate(w.createdAt, "en-GB", { day: "numeric", month: "short", year: "numeric" })}</td>
                    <td>{w.lastActive ? relTime(w.lastActive, "en-GB") : "—"}</td>
                    <td className="n">{w.members}</td><td className="n">{w.quotes}</td><td className="n">{w.sent}</td><td className="n">{w.won}</td>
                    <td className="n">{KWP(w.kwpQuoted)}</td><td className="n">{EUR(w.eurQuoted)}</td><td className="n">{w.leads}</td>
                    <td className="n">{w.monitored || 0}</td><td className="n">{w.monitoringEur > 0 ? "€" + w.monitoringEur.toFixed(2) : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
      <p className="dx-muted-note tr-foot">
        This week so far: {INT(thisWeek?.sent)} sent, {INT(thisWeek?.activeWorkspaces)} active. A quote counts once, in the week its first proposal link was created, at the price the quote engine gives it today.
        {" "}Figures change against the 30 days before. To leave out another internal workspace, add its id (hover its name) to TRACTION_EXCLUDE_COMPANY_IDS.
      </p>
    </div>
  );
}
