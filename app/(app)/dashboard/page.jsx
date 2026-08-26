// app/(app)/dashboard/page.jsx — server component: real data, RLS-scoped.
// Visual language matches the live demo (KPI strip, 6-month trend, dash-grid with
// recent-projects table + leads feed + activity feed).
import { Fragment } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { supabaseServer } from "../../../lib/supabase.js";
import { currentCompany } from "../../../lib/session.js";
import { createProject, cycleProjectStatus, maybeClaimReferral } from "../../../lib/actions.js";
import { quote } from "@voltmira/engine";
import { companyEngine } from "../../../lib/engineSettings.js";
import { t, normLang } from "../../../lib/i18n.js";
import { proposalStatsByProject, needsFollowUp, daysSince } from "../../../lib/proposalStats.js";
import { rowToQuoteInput } from "../../../lib/quoteInput.js";
import { activityHtml } from "../../../lib/activity.js";
import { mdDayKey, mdMonthKey, fmtDate } from "../../../lib/tz.js";
import TrendChart from "./TrendChart.jsx";
import FollowUpStrip from "./FollowUpStrip.jsx";
import LeadActions from "../leads/LeadActions.jsx";
import KpiValue from "./KpiValue.jsx";

// Post-sale install stages, mirrored from InstallChecklist.jsx. install_progress
// is a { step: completedDate } map, so a truthy value means the step is done.
const INSTALL_STEPS = ["deposit", "permit", "order", "install", "grid", "commission"];

export const dynamic = "force-dynamic";
export const metadata = { title: "Dashboard — VoltMira" };

async function newQuote() {
  "use server";
  const id = await createProject();
  redirect(`/projects/${id}`);
}

async function cycleStatus(formData) {
  "use server";
  const id = formData.get("id");
  if (id) await cycleProjectStatus(id);
  revalidatePath("/dashboard");
  revalidatePath("/projects");
}

// Live recompute uses the SAME input builder as the editor + projects list, so a
// battery/BOM project shows identical numbers everywhere. See lib/quoteInput.js.
const rowToProject = rowToQuoteInput;

// Relative "time ago" — server-rendered, coarse (matches the demo's ago()).
function ago(iso, lang) {
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  const L = { en: ["just now", "m", "h", "d"], ro: ["acum", "m", "h", "z"], ru: ["сейчас", "м", "ч", "д"] }[lang] || ["just now", "m", "h", "d"];
  if (s < 60) return L[0];
  if (s < 3600) return Math.floor(s / 60) + L[1];
  if (s < 86400) return Math.floor(s / 3600) + L[2];
  return Math.floor(s / 86400) + L[3];
}

// Sticky day-group label for the activity feed (demo's dayLabel()).
// today/yesterday resolved in the app timezone so the boundary matches the user's
// wall-clock rather than the server's UTC.
function dayLabel(iso, lang, locale) {
  const k = mdDayKey(iso);
  if (k === mdDayKey(Date.now())) return t("day_today", lang);
  if (k === mdDayKey(Date.now() - 864e5)) return t("day_yesterday", lang);
  return fmtDate(iso, locale, { day: "numeric", month: "short" });
}

// Feed icon + tint by activity kind (mirrors the demo FEED_IC).
const BOLT = <path d="M13 2 4.5 13.5H11L10 22l8.5-11.5H13L13 2z" />;
const FIRE = <path d="M12 22c4.4 0 7-2.8 7-6.6C19 10 14.5 7.6 13.6 2c-.3 3.4-2 5-3.8 6.8C8 10.6 5 12.4 5 15.7 5 19.3 7.6 22 12 22Z" />;
const EYE = <><path d="M2 12s3.5-6.5 10-6.5S22 12 22 12s-3.5 6.5-10 6.5S2 12 2 12Z" /><circle cx="12" cy="12" r="3" /></>;
const LINK = <><path d="M10 14a5 5 0 0 0 7.1 0l3-3a5 5 0 0 0-7.1-7.1L11.5 5.4" /><path d="M14 10a5 5 0 0 0-7.1 0l-3 3a5 5 0 0 0 7.1 7.1l1.5-1.5" /></>;
const COG = <><circle cx="12" cy="12" r="3.2" /><path d="M19.4 13a7.6 7.6 0 0 0 0-2l2-1.5-2-3.4-2.3.9a7 7 0 0 0-1.7-1l-.4-2.5H9l-.4 2.5a7 7 0 0 0-1.7 1l-2.3-.9-2 3.4 2 1.5a7.6 7.6 0 0 0 0 2l-2 1.5 2 3.4 2.3-.9a7 7 0 0 0 1.7 1l.4 2.5h4l.4-2.5a7 7 0 0 0 1.7-1l2.3.9 2-3.4-2-1.5Z" /></>;
function feedIcon(kind) {
  const map = {
    won: ["", BOLT], lead: ["amber", FIRE], open: ["blue", EYE],
    quote: ["blue", LINK], proposal: ["blue", LINK], sys: ["", COG],
  };
  const [cls, path] = map[kind] || map.sys;
  return { cls, svg: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{path}</svg> };
}

export default async function Dashboard() {
  // If this account arrived via a referral link, attribute it once (best-effort;
  // never allowed to break the dashboard).
  try { await maybeClaimReferral(); } catch {}
  const sb = supabaseServer();
  const [co, { data: projects }, { data: leads }, { data: acts }, stats] = await Promise.all([
    currentCompany(),
    // No limit. Every KPI on this page — pipeline, win rate, average deal,
    // the quote count — is a whole-book figure, and a cap silently turned them
    // into "your last 500 quotes" while /projects (unbounded) showed the truth.
    // Two screens disagreeing about the same number is worse than a slow query.
    sb.from("projects").select("*").order("updated_at", { ascending: false }),
    // Archived leads were reappearing here forever: /leads correctly hides them
    // but this query filtered only on project_id. neq() skips NULL rows in
    // Postgres, so the status IS NULL case (pre-migration leads) needs the or().
    sb.from("leads").select("*").is("project_id", null)
      .or("status.is.null,status.neq.archived")
      .order("created_at", { ascending: false }).limit(200),
    sb.from("activity").select("*").order("created_at", { ascending: false }).limit(40),
    proposalStatsByProject(sb),
  ]);

  const E = await companyEngine(co);
  const lang = normLang(co?.lang);
  const fmt = (n) => "€" + Math.round(n).toLocaleString("en-IE");
  const list = projects || [];

  // KPIs (over the whole pipeline, like the demo's computeStats()).
  let pipeline = 0, won = 0, lost = 0, pbSum = 0, pbN = 0, wonValueSum = 0;
  for (const r of list) {
    const q = quote(rowToProject(r), E).e;
    // Pipeline = contract value you invoice (full system price), NOT the client's
    // post-grant out-of-pocket. On subsidised quotes those differ by the whole
    // Casa Verde / MD grant, which was understating the pipeline.
    if (r.status === "sent") pipeline += q.grossCost;
    // wonValueSum feeds "average deal size" — the contract value of closed deals.
    if (r.status === "won") { won++; wonValueSum += q.grossCost; }
    if (r.status === "lost") lost++;
    // A quote that never pays back inside the horizon used to be dropped from the
    // average entirely, which flattered the KPI. Count it at the horizon ("25+").
    // Only quotes that actually went out. Pooling drafts and lost deals made
    // this "the average payback of every number I ever typed into this tool"
    // rather than the payback we put in front of clients.
    if (r.status === "sent" || r.status === "won") {
      pbSum += (q.payback === null ? q.horizon : q.payback); pbN++;
    }
  }
  const winRate = (won + lost) ? Math.round(won / (won + lost) * 100) + "%" : "—";
  // Raw twin of winRate, above, for the KpiValue count-up (a client component
  // can't receive the formatted string's logic as a function — see KpiValue.jsx).
  const winRatePct = (won + lost) ? Math.round(won / (won + lost) * 100) : null;
  const avgPbVal = pbN ? pbSum / pbN : null;
  const yrsF = (p) => p === null ? "25+" : p === 0 ? "now" : p.toFixed(1);
  // Average deal size = mean contract value of WON quotes; "—" until the first win.
  const avgDeal = won ? wonValueSum / won : null;

  const locale = { en: "en-GB", ro: "ro-RO", ru: "ru-RU" }[lang] || "en-GB";

  // Conversion funnel: Sent → Opened (viewed ≥1×) → Engaged (≥3×) → Won.
  //
  // "Sent" means the quote LEFT DRAFT — not "has a proposal row". The old
  // definition counted only tracked proposals while Won counted every won
  // project, so a deal closed verbally or at the counter made Won > Sent and
  // the last bar came out longer than the first. A funnel that grows makes the
  // whole dashboard look broken. Won is a subset of "left draft" by definition,
  // so this can no longer invert.
  //
  // Opened/Engaged still require a proposal, because they are only knowable
  // from tracking — a deal won without one legitimately skips those stages.
  let nSent = 0, nOpened = 0, nEngaged = 0;
  let eurSent = 0, eurOpened = 0, eurEngaged = 0;
  for (const r of list) {
    const st = stats.get(r.id);
    const left = r.status !== "draft" || !!(st && st.sentAt);
    const gc = quote(rowToProject(r), E).e.grossCost;
    if (left) { nSent++; eurSent += gc; }
    if (st && st.opens >= 1) { nOpened++; eurOpened += gc; }
    if (st && st.opens >= 3) { nEngaged++; eurEngaged += gc; }
  }
  // € alongside the count: three €12k deals and three €40k deals are very
  // different months, and a count-only funnel hides that completely.
  const funnel = [
    ["sent", t("pf_sent", lang), nSent, "var(--blue)", eurSent],
    ["opened", t("pf_opened", lang), nOpened, "var(--amber)", eurOpened],
    ["engaged", t("pf_engaged", lang), nEngaged, "#B4700F", eurEngaged],
    ["won", t("pf_won", lang), won, "var(--green)", wonValueSum],
  ];
  // Scale the funnel against its OWN widest stage, not the total quote count.
  // Using list.length squashed every bar whenever most quotes were still drafts
  // (20 quotes, 3 sent → the "Sent" bar rendered 15% wide instead of full).
  // `won` is included because a deal can be won without a tracked proposal, so
  // it can legitimately exceed "Sent".
  const fmax = Math.max(1, nSent, nOpened, nEngaged, won);

  // 6-month sent-vs-won trend (sent by proposal date, won by updated_at month).
  // Months are bucketed by their APP_TZ key so an event just after midnight in
  // Chisinau lands in the month the installer actually sees, not the UTC one.
  const nowKey = mdMonthKey(Date.now());
  const [nY, nM] = nowKey.split("-").map(Number);
  const months = [];
  const monthIdx = new Map();
  for (let mi = 5; mi >= 0; mi--) {
    const d = new Date(nY, nM - 1 - mi, 15);   // mid-month: safe from any TZ shift
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    monthIdx.set(key, months.length);
    months.push({ lbl: d.toLocaleDateString(locale, { month: "short" }), sent: 0, won: 0, sentEur: 0, wonEur: 0 });
  }
  // Time-to-close: days from proposal sent → won, averaged over closed deals.
  let closeSum = 0, closeN = 0;
  for (const r of list) {
    const st = stats.get(r.id);
    // Contract value drives the €-weighted view of the same trend.
    const gc = quote(rowToProject(r), E).e.grossCost;
    if (st && st.sentAt) { const i = monthIdx.get(mdMonthKey(st.sentAt)); if (i !== undefined) { months[i].sent++; months[i].sentEur += gc; } }
    // Prefer the client's acceptance date: updated_at drifts to "now" whenever a
    // won quote is edited later, which silently moved old wins into this month.
    const wonAt = r.status === "won" ? (st?.acceptedAt || r.updated_at) : null;
    if (wonAt) {
      const i = monthIdx.get(mdMonthKey(wonAt)); if (i !== undefined) { months[i].won++; months[i].wonEur += gc; }
      if (st?.sentAt) { const dd = (new Date(wonAt) - new Date(st.sentAt)) / 864e5; if (dd >= 0) { closeSum += dd; closeN++; } }
    }
  }
  // "—" until at least one tracked deal has both a sent and a won date.
  const avgClose = closeN ? Math.round(closeSum / closeN) : null;

  // Deals actively in installation: a won quote whose checklist has STARTED
  // (≥1 step) but isn't fully commissioned. Requiring ≥1 step is deliberate — a
  // just-won deal at 0/6 hasn't started installing and already shows in Recent
  // quotes with a "Won" chip, so listing untouched deals here would be pure noise
  // (exactly what stale "New quote" test wins looked like). Most-progressed first.
  const installing = list
    .filter(r => r.status === "won")
    .map(r => ({ r, done: INSTALL_STEPS.filter(s => r.install_progress?.[s]).length }))
    .filter(x => x.done >= 1 && x.done < INSTALL_STEPS.length)
    .sort((a, b) => b.done - a.done)
    .slice(0, 6);
  // Quotes worth chasing: sent over a week ago and either never opened or gone
  // quiet since. A quote sitting unopened for 16 days is a deal quietly dying,
  // so it gets surfaced at the top of the dashboard rather than buried in a
  // table. "Done" snoozes the row for a week (followup_snoozed_at).
  const followUps = list
    .filter(r => r.status === "sent")
    .map(r => ({ r, st: stats.get(r.id) }))
    // NB: daysSince(null) is 0, so a never-snoozed quote must be allowed
    // explicitly — testing `daysSince(...) > 7` alone hid every fresh reminder.
    .filter(({ r, st }) => needsFollowUp(st)
      && (!r.followup_snoozed_at || daysSince(r.followup_snoozed_at) > 7))
    .sort((a, b) => daysSince(b.st.sentAt) - daysSince(a.st.sentAt))
    .slice(0, 4)
    .map(({ r, st }) => ({
      id: r.id,
      title: r.title,
      client: r.client_name,
      // Days since it went out — drives the .fu-age urgency badge.
      age: daysSince(st.sentAt),
      // Never opened is the alarming case; "quiet since" is the softer one.
      // Guard on lastOpen, not just opens: a row with opens>0 and a null
      // last_open (imported or hand-inserted) rendered "no activity for 0d".
      reason: (!st.opens || !st.lastOpen)
        ? t("fu_never_opened", lang, { n: daysSince(st.sentAt) })
        : t("fu_quiet", lang, { n: daysSince(st.lastOpen) }),
    }));

  // Sample data is NOT filtered out of the KPIs — filtering would defeat the
  // "Load sample pipeline" button, whose entire purpose is to make the
  // dashboard look populated for a live demo. The danger isn't that the numbers
  // include sample rows; it's not KNOWING they do. So: say so, loudly.
  const hasSample = list.some(r => r.sample) || (leads || []).some(l => l.sample);

  const recent = list.slice(0, 5);

  // day-group inserts for the activity feed (demo behaviour)
  let lastDay = null;

  return (
    <>
      <div className="page-head">
        <h1>{t("dash_title", lang)}</h1>
        <span className="spacer" />
        <form action={newQuote}>
          <button className="btn primary" type="submit">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>
            {t("btn_new_quote", lang)}
          </button>
        </form>
      </div>

      {hasSample && (
        <div className="sample-bar" role="status">
          <span className="sample-badge">{t("demo_badge", lang)}</span>
          <span className="sample-note">{t("sample_banner", lang)}</span>
          <Link className="sample-cta" href="/settings">{t("sample_clear", lang)}</Link>
        </div>
      )}

      {(
        <>
      <FollowUpStrip items={followUps} lang={lang} />
      <div className="kpis">
        <div className="kpi"><b><KpiValue value={pipeline} kind="currency" /></b><span>{t("kpi_pipeline", lang)}</span></div>
        <div className="kpi"><b><KpiValue value={winRatePct} kind="percent" /></b><span>{t("kpi_winrate", lang)}</span></div>
        <div className="kpi"><b><KpiValue value={avgPbVal} kind="years" extra={{ horizon: E.horizon, suffix: t("yrs", lang) }} /></b><span>{t("kpi_payback", lang)}</span></div>
        <div className="kpi"><b><KpiValue value={list.length} kind="count" /></b><span>{t("kpi_projects", lang)}</span></div>
        <div className="kpi"><b><KpiValue value={avgDeal} kind="currency" /></b><span>{t("kpi_avgdeal", lang)}</span></div>
        <div className="kpi"><b><KpiValue value={avgClose} kind="days" extra={{ suffix: t("days", lang) }} /></b><span>{t("kpi_avgclose", lang)}</span></div>
      </div>

      <div className="grid-2" style={{ marginBottom: 18 }}>
        <section className="card">
          <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", marginBottom: 16 }}>
            <h3 style={{ margin: 0 }}>{t("pipe_title", lang)}</h3>
            <span className="spacer" />
            <span style={{ fontSize: 12.5, color: "var(--muted)" }}>
              {t("pipe_count", lang, { n: list.length })}
              {winRate !== "—" && <> · <b style={{ color: "var(--green)" }}>{t("pipe_winrate", lang, { r: winRate })}</b></>}
            </span>
          </div>
          {list.length ? (
            <div className="pipe-funnel">
              {funnel.map(([k, label, val, color, eur]) => (
                <div className="pf-row" key={k}>
                  <span className="pf-lbl">{label}</span>
                  <div className="pf-track"><i style={{ width: Math.round(val / fmax * 100) + "%", background: color }} /></div>
                  <b className="pf-val" style={{ color }}>{val}</b>
                  <span className="pf-eur">{eur > 0 ? fmt(eur) : ""}</span>
                </div>
              ))}
            </div>
          ) : (
            <div className="empty"><b>{t("empty_noproj_t", lang)}</b>{t("empty_noproj_s", lang)}</div>
          )}
        </section>

        <TrendChart months={months} title={t("mth_title", lang)}
          sentLabel={t("trend_sent", lang)} wonLabel={t("trend_won", lang)} />
      </div>

      <div className="dash-grid">
        <div className="stack">
          <section className="card">
            <h3>{t("recent_projects", lang)}</h3>
            {recent.length ? (
              <div className="tbl-wrap"><table className="tbl">
                <thead><tr>
                  <th>{t("col_project", lang)}</th><th>{t("col_system", lang)}</th>
                  <th>{t("col_payback", lang)}</th><th>{t("col_value", lang)}</th><th>{t("col_status", lang)}</th>
                </tr></thead>
                <tbody>
                  {recent.map(p => {
                    const q = quote(rowToProject(p), E).e;
                    return (
                      <tr key={p.id}>
                        <td>
                          <Link className="t-title" href={`/projects/${p.id}`}>{p.title || t("untitled", lang)}</Link>
                          <div className="t-sub">{p.client_name || "—"}</div>
                        </td>
                        <td>{Number(p.kw).toFixed(1)} kW{p.batt ? t("pp_plus_batt", lang) : ""}</td>
                        <td>{yrsF(q.payback)} {t("yrs", lang)}</td>
                        <td>{fmt(q.cost)}</td>
                        <td>
                          <form action={cycleStatus} style={{ display: "inline" }}>
                            <input type="hidden" name="id" value={p.id} />
                            <button className={`chip ${p.status}`} type="submit">{t("st_" + p.status, lang)}</button>
                          </form>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table></div>
            ) : (
              <div className="empty"><b>{t("empty_noproj_t", lang)}</b>{t("empty_noproj_s", lang)}</div>
            )}
          </section>

          <section className="card">
            <h3>{t("incoming_leads", lang)}</h3>
            {(leads || []).slice(0, 5).length ? (
              <ul className="feed">
                {(leads || []).slice(0, 5).map(l => {
                  const ic = feedIcon("lead");
                  return (
                    <li key={l.id}>
                      <div className={`f-ic ${ic.cls}`}>{ic.svg}</div>
                      <div className="f-tx" style={{ minWidth: 0 }}>
                        <b>{l.name}</b>{l.hot && <span className="chip hot static" style={{ padding: "2px 8px", fontSize: 10.5, marginLeft: 6 }}>{t("hot", lang)}</span>}
                        {l.phone ? <a href={`tel:${l.phone}`} style={{ marginLeft: 8, fontSize: 12.5, fontWeight: 600, color: "var(--green)", textDecoration: "none" }}>{l.phone}</a> : null}
                        {l.note ? <div style={{ color: "var(--muted)" }}>{l.note}</div> : null}
                        {/* Convert / mark-contacted / archive inline, so a lead can be
                            actioned without leaving the dashboard. Reuses the /leads row. */}
                        <div style={{ marginTop: 9 }}>
                          <LeadActions id={l.id} status={l.status || "new"} projectId={l.project_id} lang={lang} />
                        </div>
                      </div>
                      <time>{ago(l.created_at, lang)}</time>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <div className="empty"><b>{t("empty_noleads_t", lang)}</b>{t("empty_noleads_s", lang)}</div>
            )}
          </section>

          {/* Post-sale queue — surfaces the per-project InstallChecklist so the
              paperwork after a win (ANRE permit, grid connection, commissioning)
              is visible from the dashboard, not buried inside each quote. */}
          <section className="card">
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
              <h3 style={{ margin: 0 }}>{t("dash_installing", lang)}</h3>
            </div>
            {installing.length ? (
              <div style={{ display: "flex", flexDirection: "column" }}>
                {installing.map(({ r, done }, i) => {
                  const nextStep = INSTALL_STEPS.find(s => !r.install_progress?.[s]);
                  const pct = Math.round(done / INSTALL_STEPS.length * 100);
                  return (
                    <div key={r.id} style={{ padding: "13px 0", borderTop: i ? "1px solid var(--line)" : "none" }}>
                      <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
                        <Link className="t-title" href={`/projects/${r.id}`} style={{ fontSize: 14 }}>{r.title || t("untitled", lang)}</Link>
                        {r.client_name ? <span style={{ fontSize: 12, color: "var(--muted)" }}>· {r.client_name}</span> : null}
                        <span className="spacer" style={{ flex: 1 }} />
                        <span style={{ fontFamily: "var(--font-m,monospace)", fontSize: 12, color: "var(--muted)" }}>{done}/{INSTALL_STEPS.length}</span>
                      </div>
                      <div style={{ height: 6, borderRadius: 99, background: "var(--line)", overflow: "hidden", margin: "9px 0 6px" }}>
                        <div style={{ height: "100%", width: pct + "%", background: "var(--green)", borderRadius: 99 }} />
                      </div>
                      {nextStep ? <div style={{ fontSize: 12, color: "var(--muted)" }}>{t("dash_next", lang)}: <b style={{ color: "var(--ink-soft,#2B4438)", fontWeight: 600 }}>{t("inst_" + nextStep, lang)}</b></div> : null}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="empty"><b>{t("empty_noinstall_t", lang)}</b>{t("empty_noinstall_s", lang)}</div>
            )}
          </section>
        </div>

        <section className="card">
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <h3 style={{ margin: 0 }}>{t("activity", lang)}</h3>
            <span className="spacer" />
            <Link href="/activity" style={{ fontSize: 12.5, color: "var(--green)", fontWeight: 600, textDecoration: "none" }}>{t("act_view_all", lang)} →</Link>
          </div>
          {(acts || []).length ? (
            <div className="feed-scroll"><ul className="feed">
              {(acts || []).map(a => {
                const ic = feedIcon(a.kind);
                const dl = dayLabel(a.created_at, lang, locale);
                const head = dl !== lastDay ? <li className="f-day">{dl}</li> : null;
                lastDay = dl;
                const rowInner = (<>
                  <div className={`f-ic ${ic.cls}`}>{ic.svg}</div>
                  <div className="f-tx" dangerouslySetInnerHTML={{ __html: activityHtml(a, lang) }} />
                  <time>{ago(a.created_at, lang)}</time>
                </>);
                return (
                  <Fragment key={a.id}>
                    {head}
                    <li>
                      {a.link
                        ? <Link href={a.link} className="f-link">{rowInner}</Link>
                        : rowInner}
                    </li>
                  </Fragment>
                );
              })}
            </ul></div>
          ) : (
            <div className="empty"><b>{t("empty_nofeed_t", lang)}</b>{t("empty_nofeed_s", lang)}</div>
          )}
        </section>
      </div>
        </>
      )}
    </>
  );
}
