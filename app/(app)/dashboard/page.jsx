// app/(app)/dashboard/page.jsx — server component: real data, RLS-scoped.
// Visual language matches the live demo (KPI strip, 6-month trend, dash-grid with
// recent-projects table + leads feed + activity feed).
import { Fragment } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { supabaseServer } from "../../../lib/supabase.js";
import { currentCompany } from "../../../lib/session.js";
import { createProject, cycleProjectStatus } from "../../../lib/actions.js";
import { quote, defaultEngineSettings } from "@voltmira/engine";
import { escapeHtml } from "../../../lib/safe.js";
import { t, normLang } from "../../../lib/i18n.js";
import { proposalStatsByProject, daysSince, needsFollowUp } from "../../../lib/proposalStats.js";

// Activity text may contain ONLY <b>…</b> for emphasis. Escape everything, then
// re-allow the bold tags. Defense in depth even if a bad value was stored.
function renderActivity(text) {
  return escapeHtml(text).replace(/&lt;b&gt;/g, "<b>").replace(/&lt;\/b&gt;/g, "</b>");
}

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

function rowToProject(r) {
  return {
    kw: Number(r.kw), price: Number(r.price), cons: Number(r.cons), batt: r.batt,
    market: r.market, useMonthly: r.use_monthly, consMonthly: r.cons_monthly,
    afmSubsidy: r.afm_subsidy, yieldOverride: r.yield_per_kwp ? Number(r.yield_per_kwp) : undefined,
    monthlyYieldShape: r.monthly_yield_shape || undefined,
  };
}

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
function dayLabel(iso, lang, locale) {
  const ts = new Date(iso).getTime();
  const now = new Date();
  const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  if (ts >= startToday) return t("day_today", lang);
  if (ts >= startToday - 864e5) return t("day_yesterday", lang);
  return new Date(ts).toLocaleDateString(locale, { day: "numeric", month: "short" });
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
  const sb = supabaseServer();
  const [co, { data: projects }, { data: leads }, { data: acts }, stats] = await Promise.all([
    currentCompany(),
    sb.from("projects").select("*").order("updated_at", { ascending: false }).limit(500),
    sb.from("leads").select("*").is("project_id", null).order("created_at", { ascending: false }).limit(200),
    sb.from("activity").select("*").order("created_at", { ascending: false }).limit(40),
    proposalStatsByProject(sb),
  ]);

  const E = { ...defaultEngineSettings(), ...(co?.engine || {}) };
  const lang = normLang(co?.lang);
  const fmt = (n) => "€" + Math.round(n).toLocaleString("en-IE");
  const list = projects || [];

  // KPIs (over the whole pipeline, like the demo's computeStats()).
  let pipeline = 0, won = 0, lost = 0, pbSum = 0, pbN = 0;
  for (const r of list) {
    const q = quote(rowToProject(r), E).e;
    if (r.status === "sent") pipeline += q.cost;
    if (r.status === "won") won++;
    if (r.status === "lost") lost++;
    if (q.payback !== null) { pbSum += q.payback; pbN++; }
  }
  const winRate = (won + lost) ? Math.round(won / (won + lost) * 100) + "%" : "—";
  const avgPb = pbN ? (pbSum / pbN).toFixed(1) + " " + t("yrs", lang) : "—";
  const yrsF = (p) => p === null ? "25+" : p === 0 ? "now" : p.toFixed(1);

  const locale = { en: "en-GB", ro: "ro-RO", ru: "ru-RU" }[lang] || "en-GB";

  // Conversion funnel — where do leads drop off? Sent (has a proposal) → Opened
  // (client viewed ≥1×) → Engaged (viewed ≥3×, a near-close signal) → Won.
  let nSent = 0, nOpened = 0, nEngaged = 0;
  for (const r of list) {
    const st = stats.get(r.id);
    if (st && st.sentAt) nSent++;
    if (st && st.opens >= 1) nOpened++;
    if (st && st.opens >= 3) nEngaged++;
  }
  const funnel = [
    ["sent", t("pf_sent", lang), nSent, "var(--blue)"],
    ["opened", t("pf_opened", lang), nOpened, "var(--amber)"],
    ["engaged", t("pf_engaged", lang), nEngaged, "#B4700F"],
    ["won", t("pf_won", lang), won, "var(--green)"],
  ];
  const fmax = Math.max(1, nSent, list.length);

  // 6-month sent-vs-won trend (sent by proposal date, won by updated_at month).
  const now = new Date();
  const months = [];
  for (let mi = 5; mi >= 0; mi--) {
    const d0 = new Date(now.getFullYear(), now.getMonth() - mi, 1).getTime();
    const d1 = new Date(now.getFullYear(), now.getMonth() - mi + 1, 1).getTime();
    let s = 0, w = 0;
    for (const r of list) {
      const st = stats.get(r.id);
      if (st && st.sentAt) { const x = new Date(st.sentAt).getTime(); if (x >= d0 && x < d1) s++; }
      if (r.status === "won") { const x = new Date(r.updated_at).getTime(); if (x >= d0 && x < d1) w++; }
    }
    months.push({ lbl: new Date(d0).toLocaleDateString(locale, { month: "short" }), sent: s, won: w });
  }
  const mMax = Math.max(1, ...months.map(m => Math.max(m.sent, m.won)));
  const CW = 560, CH = 150, cBase = CH - 24, cPlot = cBase - 16, cGroup = CW / 6, cBar = 18;

  // "Needs follow-up": cold sent quotes worth chasing now (top 4 by age).
  const followUps = list
    .filter(r => r.status === "sent" && needsFollowUp(stats.get(r.id)))
    .map(r => ({ r, st: stats.get(r.id), age: daysSince(stats.get(r.id)?.sentAt) }))
    .sort((a, b) => b.age - a.age)
    .slice(0, 4);

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

      <div className="kpis">
        <div className="kpi"><b>{fmt(pipeline)}</b><span>{t("kpi_pipeline", lang)}</span></div>
        <div className="kpi"><b>{winRate}</b><span>{t("kpi_winrate", lang)}</span></div>
        <div className="kpi"><b>{avgPb}</b><span>{t("kpi_payback", lang)}</span></div>
        <div className="kpi"><b>{list.length}</b><span>{t("kpi_projects", lang)}</span></div>
      </div>

      {followUps.length > 0 && (
        <section className="followup-strip">
          <h3>⚠ {t("fu_title", lang)}</h3>
          <div className="fu-sub">{t("fu_sub", lang, { n: followUps.length })}</div>
          {followUps.map(({ r, age }) => (
            <div className="fu-row" key={r.id}>
              <div className="fu-who">
                <b>{r.title || t("untitled", lang)}</b>
                <span>{r.client_name || "—"} · {t("aged_days", lang, { n: age })}</span>
              </div>
              <Link className="btn sm amber" href={`/projects/${r.id}`}>{t("ttl_open", lang)}</Link>
            </div>
          ))}
        </section>
      )}

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
              {funnel.map(([k, label, val, color]) => (
                <div className="pf-row" key={k}>
                  <span className="pf-lbl">{label}</span>
                  <div className="pf-track"><i style={{ width: Math.round(val / fmax * 100) + "%", background: color }} /></div>
                  <b className="pf-val" style={{ color }}>{val}</b>
                </div>
              ))}
            </div>
          ) : (
            <div className="empty"><b>{t("empty_noproj_t", lang)}</b>{t("empty_noproj_s", lang)}</div>
          )}
        </section>

        <section className="card">
          <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", marginBottom: 6 }}>
            <h3 style={{ margin: 0 }}>{t("mth_title", lang)}</h3>
            <span className="spacer" />
            <span className="tr-leg"><i style={{ background: "var(--blue)" }} />{t("trend_sent", lang)}</span>
            <span className="tr-leg"><i style={{ background: "var(--green)" }} />{t("trend_won", lang)}</span>
          </div>
          <svg viewBox={`0 0 ${CW} ${CH}`} role="img" aria-label={t("mth_title", lang)} style={{ width: "100%", height: "auto", display: "block" }}>
            <line x1="0" y1={cBase} x2={CW} y2={cBase} stroke="var(--line)" strokeWidth="1" />
            {months.map((m, i) => {
              const cx = i * cGroup + cGroup / 2;
              const hS = Math.round(m.sent / mMax * cPlot), hW = Math.round(m.won / mMax * cPlot);
              return (
                <g key={i}>
                  <rect x={cx - cBar - 3} y={cBase - hS} width={cBar} height={hS} rx="4" fill="var(--blue)" opacity=".85" />
                  {m.sent ? <text x={cx - cBar / 2 - 3} y={cBase - hS - 5} textAnchor="middle" fontSize="11" fill="var(--muted)">{m.sent}</text> : null}
                  <rect x={cx + 3} y={cBase - hW} width={cBar} height={hW} rx="4" fill="var(--green)" opacity=".9" />
                  {m.won ? <text x={cx + 3 + cBar / 2} y={cBase - hW - 5} textAnchor="middle" fontSize="11" fill="var(--muted)">{m.won}</text> : null}
                  <text x={cx} y={CH - 7} textAnchor="middle" fontSize="11.5" fill="var(--muted)">{m.lbl}</text>
                </g>
              );
            })}
          </svg>
        </section>
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
                        <td>{Number(p.kw).toFixed(1)} kW{p.batt ? " + batt" : ""}</td>
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
                      <div className="f-tx">
                        <b>{l.name}</b>{l.hot && <span className="chip hot static" style={{ padding: "2px 8px", fontSize: 10.5, marginLeft: 6 }}>{t("hot", lang)}</span>}
                        <div style={{ color: "var(--muted)" }}>{l.note}</div>
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
        </div>

        <section className="card">
          <h3>{t("activity", lang)}</h3>
          {(acts || []).length ? (
            <div className="feed-scroll"><ul className="feed">
              {(acts || []).map(a => {
                const ic = feedIcon(a.kind);
                const dl = dayLabel(a.created_at, lang, locale);
                const head = dl !== lastDay ? <li className="f-day">{dl}</li> : null;
                lastDay = dl;
                return (
                  <Fragment key={a.id}>
                    {head}
                    <li>
                      <div className={`f-ic ${ic.cls}`}>{ic.svg}</div>
                      <div className="f-tx" dangerouslySetInnerHTML={{ __html: renderActivity(a.text) }} />
                      <time>{ago(a.created_at, lang)}</time>
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
  );
}
