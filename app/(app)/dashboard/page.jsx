// app/(app)/dashboard/page.jsx — the installer's command centre. Server
// component: real data, RLS-scoped.
//
// Reads top to bottom, simplest first: four numbers that matter (each a link
// to its list), then what needs doing, most urgent first, every row with the
// button that fixes it, beside the jobs by phase (tap a phase for its jobs and
// their next steps) and who is reading your proposals; then the book in one
// tabbed card (recent quotes, new leads, installs, paperwork, activity, and
// the full numbers), and the installed base. Every number is computed from
// rows the app already stores; nothing on this page is illustrative.
import "../dx.css";
import "./dashboard.css";
import { Fragment } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { supabaseServer } from "../../../lib/supabase.js";
import { currentCompany, currentActor, currentUser } from "../../../lib/session.js";
import { isDemoEmail } from "../../../lib/demo.js";
import { createProject, cycleProjectStatus } from "../../../lib/actions.js";
import { quote } from "@voltmira/engine";
import { companyEngine } from "../../../lib/engineSettings.js";
import { t, normLang } from "../../../lib/i18n.js";
import { proposalStatsByProject } from "../../../lib/proposalStats.js";
import { rowToQuoteInput } from "../../../lib/quoteInput.js";
import { activityHtml } from "../../../lib/activity.js";
import { mdDayKey, fmtDate, fmtTime, APP_TZ } from "../../../lib/tz.js";
import { leadChannel, CHANNEL_DOT } from "../../../lib/leadChannels.js";
import { systemRatio } from "../../../lib/yieldCalibration.js";
import { relTime } from "../../../lib/relTime.js";
import { paperworkFor } from "../../../lib/paperwork.js";
import { buildMoves, flowStages, INSTALL_STEPS, LIVE_WINDOW_MIN } from "../../../lib/dashboardMoves.js";
import { workflowsFor, pipelineSummary, periodCompare, PHASES, PHASE } from "../../../lib/workflow.js";
import { wt, describe, stageName } from "../../../lib/workflowText.js";
import NextMoves from "./NextMoves.jsx";
import Phases from "./Phases.jsx";
import Numbers from "./Numbers.jsx";
import CommandPalette from "./CommandPalette.jsx";
import InstallBoard from "./InstallBoard.jsx";
import DashTabs from "./DashTabs.jsx";
import AutoRefresh from "./AutoRefresh.jsx";
import LeadActions from "../leads/LeadActions.jsx";
import Avatar from "../../../lib/Avatar.jsx";
import { moneyFormatter } from "../../../lib/money.js";

export const dynamic = "force-dynamic";
export const metadata = { title: "Dashboard | VoltMira" };

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

// Coarse "time ago" for list rows (matches the rest of the app's feeds).
function ago(iso, lang) {
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  const L = { en: ["just now", "m", "h", "d"], ro: ["acum", "m", "h", "z"], ru: ["сейчас", "м", "ч", "д"], uk: ["щойно", "хв", "год", "д"] }[lang] || ["just now", "m", "h", "d"];
  if (s < 60) return L[0];
  if (s < 3600) return Math.floor(s / 60) + L[1];
  if (s < 86400) return Math.floor(s / 3600) + L[2];
  return Math.floor(s / 86400) + L[3];
}

function dayLabel(iso, lang, locale) {
  const k = mdDayKey(iso);
  if (k === mdDayKey(Date.now())) return t("day_today", lang);
  if (k === mdDayKey(Date.now() - 864e5)) return t("day_yesterday", lang);
  return fmtDate(iso, locale, { day: "numeric", month: "short" });
}

const BOLT = <path d="M13 2 4.5 13.5H11L10 22l8.5-11.5H13L13 2z" />;
const FIRE = <path d="M12 22c4.4 0 7-2.8 7-6.6C19 10 14.5 7.6 13.6 2c-.3 3.4-2 5-3.8 6.8C8 10.6 5 12.4 5 15.7 5 19.3 7.6 22 12 22Z" />;
const EYE = <><path d="M2 12s3.5-6.5 10-6.5S22 12 22 12s-3.5 6.5-10 6.5S2 12 2 12Z" /><circle cx="12" cy="12" r="3" /></>;
const LINK = <><path d="M10 14a5 5 0 0 0 7.1 0l3-3a5 5 0 0 0-7.1-7.1L11.5 5.4" /><path d="M14 10a5 5 0 0 0-7.1 0l-3 3a5 5 0 0 0 7.1 7.1l1.5-1.5" /></>;
const BANK = <><path d="M3 10 12 4l9 6H3Z" /><path d="M5 10v8M9.5 10v8M14.5 10v8M19 10v8M3 20h18" /></>;
const COG = <><circle cx="12" cy="12" r="3.2" /><path d="M19.4 13a7.6 7.6 0 0 0 0-2l2-1.5-2-3.4-2.3.9a7 7 0 0 0-1.7-1l-.4-2.5H9l-.4 2.5a7 7 0 0 0-1.7 1l-2.3-.9-2 3.4 2 1.5a7.6 7.6 0 0 0 0 2l-2 1.5 2 3.4 2.3-.9a7 7 0 0 0 1.7 1l.4 2.5h4l.4-2.5a7 7 0 0 0 1.7-1l2.3.9 2-3.4-2-1.5Z" /></>;
function feedIcon(kind) {
  const map = { won: ["", BOLT], lead: ["amber", FIRE], open: ["blue", EYE], quote: ["blue", LINK], proposal: ["blue", LINK], bank: ["", BANK], sys: ["", COG] };
  const [cls, path] = map[kind] || map.sys;
  return { cls, svg: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{path}</svg> };
}

// Hour of day on the installer's wall clock, not the server's.
function localHour() {
  return Number(new Intl.DateTimeFormat("en-GB", { hour: "numeric", hour12: false, timeZone: APP_TZ }).format(new Date()));
}

export default async function Dashboard() {
  const sb = await supabaseServer();
  const since24h = new Date(Date.now() - 864e5).toISOString();
  const since48h = new Date(Date.now() - 2 * 864e5).toISOString();
  const demoUser = isDemoEmail((await currentUser())?.email);
  const [co, actor, { data: projects }, { data: leads }, { data: acts }, stats, { data: events }, readingsRes,
    linkedRes, portfoliosRes, opensRes] = await Promise.all([
    currentCompany(),
    currentActor(),
    // No limit: every KPI here is a whole-book figure (see /projects).
    sb.from("projects").select("*").order("updated_at", { ascending: false }),
    // Archived leads stay off the dashboard; status IS NULL covers pre-migration rows.
    sb.from("leads").select("*").is("project_id", null)
      .or("status.is.null,status.neq.archived")
      .order("created_at", { ascending: false }).limit(200),
    sb.from("activity").select("*").order("created_at", { ascending: false }).limit(40),
    proposalStatsByProject(sb),
    // The client page sends an event every 15 s while a proposal is open, which
    // is what makes "reading right now" knowable at all.
    sb.from("proposal_events").select("code, kind, created_at")
      .gte("created_at", since24h).order("created_at", { ascending: false }).limit(500),
    sb.from("production_readings").select("project_id, month, kwh"),
    // The lead each quote came from (site visit, first contact, phone), for
    // the workflow and the time-to-quote figure. select("*") so a workspace
    // that has not added visit_at yet still reads.
    sb.from("leads").select("*").not("project_id", "is", null).limit(1000),
    // Which quotes already sit in a lender portfolio; absent table = none.
    sb.from("portfolios").select("id, name, market, project_ids"),
    // Opens only (heartbeats would crowd them out of the 24 h feed above):
    // "opened 4 times in the last 2 days" is a call to make now.
    sb.from("proposal_events").select("code, created_at").eq("kind", "open")
      .gte("created_at", since48h).limit(1000),
  ]);

  const E = await companyEngine(co);
  const lang = normLang(co?.lang);
  const locale = { en: "en-GB", ro: "ro-RO", ru: "ru-RU", uk: "uk-UA" }[lang] || "en-GB";
  // In the workspace's currency (lei in Moldova) at today's rate (lib/money.js).
  const fmt = moneyFormatter({ currency: co?.currency, lang: normLang(co?.lang), fx: E?.fx });
  const list = projects || [];
  const leadList = leads || [];
  const openLeads = leadList.filter((l) => !l.status || l.status === "new" || l.status === "contacted");
  const now = Date.now();
  const todayKey = mdDayKey(now);

  // The engine runs once per quote; every figure below reads from this.
  const Q = new Map();
  for (const r of list) Q.set(r.id, quote(rowToQuoteInput(r), E).e);
  const gross = new Map([...Q].map(([id, q]) => [id, q.grossCost]));

  // ---------- vitals (the six KPIs) ----------
  let pipeline = 0, sentN = 0, won = 0, lost = 0, pbSum = 0, pbN = 0, wonValueSum = 0;
  for (const r of list) {
    const q = Q.get(r.id);
    // Pipeline = contract value you invoice (full system price), not the
    // client's post-grant out-of-pocket.
    if (r.status === "sent") { pipeline += q.grossCost; sentN++; }
    if (r.status === "won") { won++; wonValueSum += q.grossCost; }
    if (r.status === "lost") lost++;
    // Only quotes that went out; a quote that never pays back counts at the horizon.
    if (r.status === "sent" || r.status === "won") { pbSum += (q.payback === null ? q.horizon : q.payback); pbN++; }
  }
  const NONE = "-";
  const winRate = (won + lost) ? Math.round(won / (won + lost) * 100) + "%" : NONE;
  const avgPbVal = pbN ? pbSum / pbN : null;
  const avgPb = avgPbVal === null ? NONE : (avgPbVal >= E.horizon ? `${E.horizon}+` : avgPbVal.toLocaleString(locale, { minimumFractionDigits: 1, maximumFractionDigits: 1 })) + " " + t("yrs", lang);
  const yrsF = (p) => p === null ? "25+" : p === 0 ? "now" : p.toFixed(1);
  const avgDeal = won ? wonValueSum / won : null;

  // ---------- time to close ----------
  let closeSum = 0, closeN = 0;
  for (const r of list) {
    if (r.status !== "won") continue;
    const st = stats.get(r.id);
    if (!st?.sentAt) continue;
    // The acceptance date, not updated_at, which drifts whenever a won quote is edited.
    const dd = (new Date(st.acceptedAt || r.updated_at) - new Date(st.sentAt)) / 864e5;
    if (dd >= 0) { closeSum += dd; closeN++; }
  }
  const avgClose = closeN ? Math.round(closeSum / closeN) : null;

  // ---------- proposal pulse ----------
  const codeToProject = new Map();
  for (const [pid, st] of stats) if (st.code) codeToProject.set(st.code, pid);
  const lastEvent = new Map();
  for (const e of events || []) {
    const pid = codeToProject.get(e.code);
    if (pid && !lastEvent.has(pid)) lastEvent.set(pid, e.created_at);
  }
  const byId = new Map(list.map((r) => [r.id, r]));
  const pulse = [...stats.entries()]
    .map(([pid, st]) => {
      const r = byId.get(pid);
      if (!r || !st.lastOpen) return null;
      const last = [st.lastOpen, lastEvent.get(pid)].filter(Boolean).sort().pop();
      return { r, st, last, live: lastEvent.has(pid) && now - new Date(lastEvent.get(pid)).getTime() <= LIVE_WINDOW_MIN * 6e4 };
    })
    .filter((x) => x && now - new Date(x.last).getTime() <= 7 * 864e5)
    .sort((a, b) => (b.live - a.live) || (new Date(b.last) - new Date(a.last)))
    .slice(0, 5);
  const opened24h = [...stats.values()].filter((st) => st.lastOpen && now - new Date(st.lastOpen).getTime() <= 864e5).length;

  // ---------- installed base + system health ----------
  const readings = readingsRes?.error ? [] : (readingsRes?.data || []);
  const readingsBy = new Map();
  for (const rd of readings) {
    if (!readingsBy.has(rd.project_id)) readingsBy.set(rd.project_id, []);
    readingsBy.get(rd.project_id).push(rd);
  }
  const health = new Map();
  let baseActual = 0, baseExpected = 0;
  const isLive = (r) => r.status === "won" && (r.commissioned_at || INSTALL_STEPS.every((s) => r.install_progress?.[s]));
  const liveSystems = list.filter(isLive);
  for (const r of list.filter((x) => x.status === "won")) {
    const rows = readingsBy.get(r.id);
    if (!rows?.length) continue;
    const ratio = systemRatio({ kw: r.kw, yieldPerKwp: r.yield_per_kwp, monthlyShape: r.monthly_yield_shape, commissionedAt: r.commissioned_at, readings: rows }, E?.bands?.expc?.degr ?? 0.5);
    const lastMonth = rows.map((x) => new Date(x.month + (String(x.month).length === 7 ? "-01" : ""))).sort((a, b) => b - a)[0] || null;
    health.set(r.id, { ratio: ratio?.ratio ?? null, months: ratio?.months ?? 0, lastMonth });
    if (ratio && isLive(r)) { baseActual += ratio.actual; baseExpected += ratio.expected; }
  }
  const base = {
    n: liveSystems.length,
    kw: liveSystems.reduce((s, r) => s + (Number(r.kw) || 0), 0),
    kwh: liveSystems.reduce((s, r) => s + (Q.get(r.id).prod0 || 0), 0),
    save: liveSystems.reduce((s, r) => s + Math.max(0, Q.get(r.id).year1 || 0), 0),
    ratio: baseExpected > 0 ? Math.round((baseActual / baseExpected) * 100) : null,
  };

  // ---------- the planned line: every quote and open lead on it ----------
  const recentOpens = new Map();
  for (const e of opensRes?.error ? [] : (opensRes?.data || [])) {
    const pid = codeToProject.get(e.code);
    if (pid) recentOpens.set(pid, (recentOpens.get(pid) || 0) + 1);
  }
  const linkedLeads = linkedRes?.error ? [] : (linkedRes?.data || []);
  const wfMap = workflowsFor({
    projects: list, stats, leads: [...leadList, ...linkedLeads], readingsBy: new Set(readingsBy.keys()),
    portfolios: portfoliosRes?.error ? [] : (portfoliosRes?.data || []), recentOpens, now, todayKey,
  });
  const pipe = pipelineSummary(wfMap.values(), gross);
  const period = periodCompare({ projects: list, stats, leads: linkedLeads, value: gross, now });

  // ---------- jobs by phase: each phase's jobs, most urgent first ----------
  const PH_HREF = { sell: "/projects?status=sent", close: "/projects?stage=signed", build: "/projects?status=won", run: "/projects?stage=live" };
  const PH_SHOW = 6;
  const leadById = new Map(leadList.map((l) => [l.id, l]));
  const onLine = [...wfMap.values()].filter((w) => w && !w.lost && PHASE[w.stage]);
  const phaseData = PHASES.map((ph) => {
    const items = onLine.filter((w) => PHASE[w.stage] === ph)
      .sort((a, b) => (b.stuck - a.stuck) || (b.gap - a.gap) || ((b.idle ?? -1) - (a.idle ?? -1)));
    const value = items.reduce((s, w) => s + (w.kind === "project" ? gross.get(w.id) || 0 : 0), 0);
    const stuckN = items.filter((w) => w.stuck).length;
    const jobs = items.slice(0, PH_SHOW).map((w) => {
      const d = describe(w, lang, now);
      const lead = w.kind === "lead" ? leadById.get(w.id) : null;
      const r = w.kind === "project" ? byId.get(w.id) : null;
      const actions = [];
      if (w.next?.act) actions.push({ ...w.next.act, label: d.next });
      if (w.next?.alt && d.alt) actions.push({ ...w.next.alt, label: d.alt });
      return {
        key: w.kind + ":" + w.id,
        title: lead ? lead.name || t("untitled", lang) : r?.title || t("untitled", lang),
        sub: lead ? lead.phone || lead.email || "" : r?.client_name || "",
        href: lead ? w.next?.href || "/leads" : `/projects/${w.id}#workflow`,
        stage: d.stage, stuck: !!w.stuck, when: w.stuck ? d.stuckShort : d.days,
        actions,
      };
    });
    return {
      id: ph, label: wt("ph_" + ph, lang), n: items.length, nLabel: wt("pp_jobs", lang, { n: items.length }),
      value: value > 0 ? fmt.compact(value) : "", stuck: stuckN, stuckLabel: wt("at_stuck", lang, { n: stuckN }), jobs,
      more: items.length > PH_SHOW ? { href: PH_HREF[ph], label: wt("ph_more", lang, { n: items.length }) } : null,
    };
  });
  const lenderLine = pipe.lender.packable.n > 0
    ? { line: wt("pp_lender_line", lang, { n: pipe.lender.packable.n, v: fmt.compact(pipe.lender.packable.value) }), cta: wt("pp_lender_cta", lang) }
    : null;
  const actLabels = { copied: wt("rl_copied", lang), failed: wt("rl_failed", lang), invPick: wt("rl_inv_pick", lang), invFull: wt("rl_inv_full", lang) };

  // ---------- next moves ----------
  const when = (iso) => relTime(iso, locale, now);
  const dur = (n, unit = "day") => new Intl.NumberFormat(locale, { style: "unit", unit, unitDisplay: "long" }).format(n);
  const moves = buildMoves({
    projects: list, stats, leads: leadList, lastEvent, health, recentOpens, wf: wfMap, now, todayKey,
    f: {
      // "wf:" keys are the workflow's own words (lib/workflowText.js)
      tr: (k, v) => (k.startsWith("wf:") ? wt(k.slice(3), lang, v) : t(k, lang, v)),
      when, dur,
      date: (iso) => fmtDate(iso, locale, { day: "numeric", month: "long" }),
      month: (d) => d.toLocaleDateString(locale, { month: "long", year: "numeric", timeZone: "UTC" }),
      step: (k) => t("inst_" + k, lang),
      stage: (id, market) => stageName(id, lang, market, true),
      grid: (k) => t("gf_stage_" + k, lang),
      channel: (l) => t("lead_ch_" + leadChannel(l), lang),
      day: mdDayKey,
      // "today, 15:00" / "tomorrow, 10:00" / "Thursday, 2 October, 10:00"
      visit: (iso) => {
        const dk = mdDayKey(iso), tm = fmtTime(iso, locale);
        if (dk === todayKey) return t("vis_today", lang, { t: tm });
        if (dk === mdDayKey(now + 864e5)) return t("vis_tomorrow", lang, { t: tm });
        return fmtDate(iso, locale, { weekday: "long", day: "numeric", month: "long" }) + ", " + tm;
      },
    },
  }).map((m) => ({ ...m, ago: m.at ? ago(m.at, lang) : "" }));

  // ---------- open rate (the stage counts now come from the planned line) ----------
  const { openRate } = flowStages({ projects: list, stats, leads: leadList, gross });

  // ---------- the four numbers on top ----------
  const activeJobs = list.filter((r) => r.status === "won" && !isLive(r));
  const activeValue = activeJobs.reduce((sum, r) => sum + (gross.get(r.id) || 0), 0);
  const unbilled = pipe.money.unbilled;
  const kpis = [
    { id: "out", label: t("dx_k_out", lang), value: fmt(pipeline), sub: t("dx_v_out", lang, { n: sentN }), href: "/projects?status=sent" },
    { id: "win", label: t("kpi_winrate", lang), value: winRate, sub: t("dx_v_record", lang, { w: won, l: lost }), href: "/projects?status=won" },
    { id: "jobs", label: wt("k_active", lang), value: fmt(activeValue), sub: wt("k_active_s", lang, { n: activeJobs.length }), href: "/projects?status=won" },
    { id: "bill", label: wt("k_unbilled", lang), value: fmt(unbilled.value), sub: unbilled.n ? wt("k_unbilled_s", lang, { n: unbilled.n }) : wt("k_unbilled_0", lang), href: "/projects?view=unbilled" },
  ];
  const vitals = [
    { label: t("dx_k_out", lang), sub: t("dx_v_out", lang, { n: sentN }), value: fmt(pipeline) },
    { label: t("dx_k_open", lang), sub: t("dx_k_open_s", lang), value: openRate != null ? openRate + "%" : NONE },
    { label: t("kpi_winrate", lang), sub: t("dx_v_record", lang, { w: won, l: lost }), value: winRate },
    { label: t("kpi_avgclose", lang), sub: t("dx_v_close", lang), value: avgClose === null ? NONE : avgClose + " " + t("days", lang) },
    { label: t("kpi_payback", lang), sub: t("dx_v_pb", lang), value: avgPb },
    { label: t("kpi_avgdeal", lang), sub: t("dx_v_deals", lang), value: avgDeal === null ? NONE : fmt(avgDeal) },
  ];

  // ---------- header ----------
  // currentActor falls back to the e-mail when no name is set; greet without one then.
  const who = actor?.name || "";
  const first = who.includes("@") ? "" : who.trim().split(/\s+/)[0] || "";
  const h = localHour();
  const greet = t(h < 12 ? "dx_greet_morning" : h < 18 ? "dx_greet_afternoon" : "dx_greet_evening", lang);
  const dateLine = new Date().toLocaleDateString(locale, { weekday: "long", day: "numeric", month: "long", timeZone: APP_TZ });

  // Sample rows stay IN the numbers (that is what "Load sample pipeline" is
  // for); the risk is not knowing they are there, so the bar says so.
  // (a demo workspace already says so in the bar across the top of the app: two bars said it twice)
  const hasSample = !demoUser && (list.some((r) => r.sample) || leadList.some((l) => l.sample));
  const emptyWorkspace = list.length === 0 && leadList.length === 0;
  const recent = list.slice(0, 6);
  // Deals actively in installation: at least one step ticked, not yet live. A
  // just-won deal at 0/6 is a "start the job" move above instead; listing
  // untouched wins here was pure noise (stale test wins looked exactly like it).
  const installs = list.filter((r) => r.status === "won" && !isLive(r))
    .map((r) => ({ r, done: INSTALL_STEPS.filter((s) => r.install_progress?.[s]).length }))
    .filter((x) => x.done >= 1)
    .sort((a, b) => b.done - a.done)
    .slice(0, 6)
    .map(({ r }) => ({ id: r.id, title: r.title || t("untitled", lang), client: r.client_name, prog: r.install_progress || {} }));
  // Won jobs with a document still open (lib/paperwork.js, same rules as /documents).
  const papers = list.filter((r) => r.status === "won").map((r) => {
    const st = stats.get(r.id);
    return { r, ...paperworkFor(r, st ? { code: st.code, created_at: st.sentAt, accepted_at: st.acceptedAt } : null) };
  }).filter((x) => x.missing.length);
  const stepLabels = Object.fromEntries(INSTALL_STEPS.map((s) => [s, t("inst_" + s, lang)]));
  const statusLabels = Object.fromEntries(["draft", "sent", "won", "lost"].map((s) => [s, t("st_" + s, lang)]));
  const pages = [
    ["/leads", "nav_leads"], ["/projects", "nav_projects"], ["/activity", "nav_activity"], ["/studio", "nav_studio"],
    ["/catalog", "nav_catalog"], ["/team", "nav_team"], ["/settings", "nav_settings"], ["/profile", "pf_title"], ["/guide", "nav_guide"],
  ].map(([href, k]) => ({ href, label: t(k, lang) }));
  let lastDay = null;

  return (
    <div className="dx">
      <AutoRefresh seconds={60} />

      <header className="dx-head">
        <div className="dx-hello">
          <p className="dx-date">{dateLine.charAt(0).toUpperCase() + dateLine.slice(1)}</p>
          <h1>{greet}{first ? `, ${first}` : ""}.</h1>
          {!emptyWorkspace && <p className="dx-summary">{t("dx_summary", lang, { moves: moves.length, n: sentN, pipe: fmt(pipeline) })}</p>}
        </div>
        <div className="dx-head-tools">
          <CommandPalette
            quotes={list.map((r) => ({ id: r.id, title: r.title || t("untitled", lang), client: r.client_name || "", status: r.status }))}
            leads={openLeads.map((l) => ({ id: l.id, name: l.name, phone: l.phone || "", email: l.email || "" }))}
            pages={pages}
            statusLabels={statusLabels}
            newQuoteAction={newQuote}
            labels={{
              trigger: t("dx_search", lang), placeholder: t("dx_pal_ph", lang), actions: t("dx_pal_actions", lang),
              quotes: t("nav_projects", lang), leads: t("nav_leads", lang), pages: t("dx_pal_pages", lang),
              none: t("dx_pal_none", lang), hint: t("dx_pal_hint", lang), newQuote: t("btn_new_quote", lang),
            }} />
          <form action={newQuote}>
            <button className="dx-new" type="submit">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12h14" /><path d="M12 5v14" /></svg>
              {t("btn_new_quote", lang)}
            </button>
          </form>
        </div>
      </header>

      {hasSample && (
        <div className="sample-bar" role="status">
          <span className="sample-badge">{t("demo_badge", lang)}</span>
          <span className="sample-note">{t("sample_banner", lang)}</span>
          <Link className="sample-cta" href="/settings">{t("sample_clear", lang)}</Link>
        </div>
      )}

      {/* A new account lands on this same page: every card below has its own
          empty state (the first-run overlay was retired on purpose). */}
      {/* ---------------- four numbers, each a link to its list ---------------- */}
      <section className="dx-kpis" aria-label={t("dx_vitals", lang)}>
        {kpis.map((k) => (
          <Link key={k.id} href={k.href} className={"dx-kpi k-" + k.id}>
            <span className="dx-kpi-l">{k.label}</span>
            <b className="dx-kpi-v">{k.value}</b>
            <small className="dx-kpi-s">{k.sub}</small>
          </Link>
        ))}
      </section>

      {/* ---------------- what needs doing, beside the jobs by phase and who is reading ---------------- */}
      <div className="dx-grid dx-grid-main">
        <NextMoves
          moves={moves}
          todayKey={todayKey}
          stuck={{ n: pipe.stuck.n, label: wt("at_stuck", lang, { n: pipe.stuck.n }) }}
          labels={{
            title: wt("at_title", lang), sub: wt("at_sub", lang),
            kinds: {
              ...Object.fromEntries(["live", "hot", "followup", "lead", "visit", "visit_done", "won_start", "install", "invoice", "grid", "unopened", "quiet", "draft", "health", "nodata"].map((k) => [k, t("dx_kind_" + k, lang)])),
              unmonitored: wt("mv_kind_unmonitored", lang), gap: wt("mv_kind_gap", lang),
            },
            hot: t("hot", lang), done: t("dx_act_done", lang),
            more: wt("at_all", lang), less: wt("at_less", lang),
            hidden: t("dx_moves_hidden", lang), restore: t("dx_moves_restore", lang),
            emptyT: t("dx_moves_empty_t", lang), emptyS: t("dx_moves_empty_s", lang),
            acts: actLabels,
          }} />

        <div className="dx-stack">
          <Phases phases={phaseData} lender={lenderLine}
            labels={{ title: wt("ph_title", lang), sub: wt("ph_sub", lang), empty: wt("ph_empty", lang), acts: actLabels }} />

          <section className="dx-card dx-pulse" aria-labelledby="dx-pulse-h">
            <header className="dx-card-head">
              <div>
                <h2 id="dx-pulse-h">{t("dx_pulse_title", lang)}</h2>
                <p>{t("dx_pulse_sub", lang)}{opened24h ? `. ${t("dx_pulse_24h", lang, { n: opened24h })}` : ""}</p>
              </div>
            </header>
            {pulse.length ? (
              <ul className="dx-pulse-list">
                {pulse.map(({ r, st, last, live }) => (
                  <li key={r.id} className={live ? "live" : ""}>
                    <Link href={`/projects/${r.id}`}>
                      <Avatar name={r.title || r.client_name} size={34} title={r.title || ""} />
                      <span className="dx-pulse-tx">
                        <b>{r.title || t("untitled", lang)}</b>
                        <small>{live ? t("dx_pulse_now", lang) : t("dx_pulse_when", lang, { when: when(last) })}</small>
                      </span>
                      <span className="dx-pulse-n" title={t("pf_opened", lang)}>{st.opens}×</span>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="dx-muted-note">{t("dx_pulse_empty", lang)}</p>
            )}
          </section>
        </div>
      </div>

      {/* ---------------- the book, one tab at a time ---------------- */}
      <DashTabs label={t("dx_book", lang)} tabs={[
        {
          id: "quotes", label: t("recent_projects", lang), href: "/projects", linkLabel: t("dx_all_quotes", lang),
          content: recent.length ? (
            <div className="tbl-wrap"><table className="tbl dx-tbl">
              <thead><tr>
                <th>{t("col_project", lang)}</th><th>{t("col_system", lang)}</th><th>{t("dx_col_opens", lang)}</th>
                <th>{t("col_payback", lang)}</th><th>{t("col_value", lang)}</th><th>{t("col_status", lang)}</th>
              </tr></thead>
              <tbody>
                {recent.map((p) => {
                  const q = Q.get(p.id);
                  const st = stats.get(p.id);
                  const eng = !st?.sentAt ? t("dx_eng_notsent", lang)
                    : st.opens ? t("dx_eng_opens", lang, { n: st.opens, when: ago(st.lastOpen || st.sentAt, lang) })
                    : t("dx_eng_none", lang);
                  return (
                    <tr key={p.id}>
                      <td>
                        <div className="row-id">
                          <Avatar name={p.title || p.client_name} size={34} title={p.title || t("untitled", lang)} />
                          <div className="row-id-tx">
                            <Link className="t-title" href={`/projects/${p.id}`}>{p.title || t("untitled", lang)}</Link>
                            <div className="t-sub">{p.client_name || ""}</div>
                          </div>
                        </div>
                      </td>
                      <td className="dx-num">{Number(p.kw).toFixed(1)} kW{p.batt ? t("pp_plus_batt", lang) : ""}</td>
                      <td className={"dx-eng" + (st?.opens >= 3 ? " hot" : "")}>{eng}</td>
                      <td className="dx-num">{yrsF(q.payback)} {t("yrs", lang)}</td>
                      <td className="dx-num">{fmt(q.cost)}</td>
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
          ),
        },
        {
          id: "leads", label: t("incoming_leads", lang), count: openLeads.length, href: "/leads", linkLabel: t("dx_all_leads", lang),
          content: openLeads.length ? (
            <ul className="dx-leads">
              {openLeads.slice(0, 6).map((l) => {
                const ch = leadChannel(l);
                return (
                  <li key={l.id}>
                    <div className="dx-lead-top">
                      <i className="dx-ch" style={{ background: CHANNEL_DOT[ch] }} aria-hidden="true" />
                      <b>{l.name}</b>
                      {l.hot && <span className="dx-hot">{t("hot", lang)}</span>}
                      <span className="dx-lead-ch">{t("lead_ch_" + ch, lang)}</span>
                      <time>{ago(l.created_at, lang)}</time>
                    </div>
                    {l.note ? <p className="dx-lead-note">{l.note}</p> : null}
                    <div className="dx-lead-bottom">
                      {l.phone ? <a className="dx-phone" href={`tel:${l.phone.replace(/\s+/g, "")}`}>{l.phone}</a> : <span />}
                      <LeadActions id={l.id} status={l.status || "new"} projectId={l.project_id} lang={lang} />
                    </div>
                  </li>
                );
              })}
            </ul>
          ) : (
            <div className="empty"><b>{t("empty_noleads_t", lang)}</b>{t("empty_noleads_s", lang)}</div>
          ),
        },
        {
          id: "installs", label: t("dash_installing", lang), count: installs.length, note: installs.length ? t("dx_inst_sub", lang) : "",
          content: installs.length ? (
            <div className="dx-inst">
              <InstallBoard jobs={installs} stepLabels={stepLabels}
                labels={{ waiting: t("dx_inst_waiting", lang), next: t("dash_next", lang), mark: t("fu_done", lang) }} />
            </div>
          ) : (
            <div className="empty"><b>{t("empty_noinstall_t", lang)}</b>{t("empty_noinstall_s", lang)}</div>
          ),
        },
        {
          id: "papers", label: t("doc_dash_title", lang), count: papers.length, href: "/documents", linkLabel: t("doc_dash_open", lang),
          note: papers.length ? t("doc_dash_sub", lang) : "",
          content: papers.length ? (
            <ul className="dx-paper-list">
              {papers.slice(0, 8).map(({ r, missing }) => (
                <li key={r.id}>
                  <Link href={`/projects/${r.id}`} className="dx-paper-who">
                    <b>{r.title || t("untitled", lang)}</b>
                    <small>{r.client_name || ""}</small>
                  </Link>
                  <span className="dx-paper-tags">
                    {missing.map((k) => <i key={k}>{t("doc_short_" + k, lang)}</i>)}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <div className="dx-empty"><b>{t("doc_dash_clear", lang)}</b></div>
          ),
        },
        {
          id: "numbers", label: wt("tab_numbers", lang),
          content: <Numbers vitals={vitals} vitalsTitle={t("dx_vitals", lang)} period={period} lang={lang} fmt={fmt} />,
        },
        {
          id: "activity", label: t("activity", lang), href: "/activity", linkLabel: t("act_view_all", lang),
          content: (acts || []).length ? (
            <div className="feed-scroll dx-feed"><ul className="feed">
              {(acts || []).map((a) => {
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
                    <li>{a.link ? <Link href={a.link} className="f-link">{rowInner}</Link> : rowInner}</li>
                  </Fragment>
                );
              })}
            </ul></div>
          ) : (
            <div className="empty"><b>{t("empty_nofeed_t", lang)}</b>{t("empty_nofeed_s", lang)}</div>
          ),
        },
      ]} />

      <section className="dx-base" aria-labelledby="dx-base-h">
        <div className="dx-base-in">
          <div className="dx-base-copy">
            <h2 id="dx-base-h">{t("dx_base_title", lang)}</h2>
            <p>
              {base.n === 0 ? t("dx_base_empty", lang)
                : base.ratio != null ? t("dx_base_ratio", lang, { p: base.ratio }).split("**").map((s, i) => (i % 2 ? <b key={i}>{s}</b> : s))
                : t("dx_base_noread", lang)}
            </p>
          </div>
          <dl className="dx-base-stats">
            <div><dt>{t("dx_base_systems", lang)}</dt><dd>{base.n}</dd></div>
            <div><dt>{t("dx_base_kwp", lang)}</dt><dd>{base.kw.toLocaleString(locale, { maximumFractionDigits: 1 })}</dd></div>
            <div><dt>{t("dx_base_kwh", lang)}</dt><dd>{Math.round(base.kwh).toLocaleString(locale)}</dd></div>
            <div><dt>{t("dx_base_save", lang)}</dt><dd>{fmt(base.save)}</dd></div>
          </dl>
        </div>
        <svg className="dx-base-mark" viewBox="0 0 240 240" fill="none" aria-hidden="true">
          <path d="M38 208 L86 96" stroke="#C4543B" strokeWidth="17" strokeLinecap="round" />
          <path d="M104 208 L158 66" stroke="#E89B2D" strokeWidth="17" strokeLinecap="round" />
          <path d="M170 208 L222 34" stroke="#3FAE6A" strokeWidth="17" strokeLinecap="round" />
        </svg>
      </section>
    </div>
  );
}
