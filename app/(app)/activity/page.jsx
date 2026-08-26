// app/(app)/activity/page.jsx — the full Activity Log ("blame-shield"): a
// read-only ledger of who did what, grouped by day, filterable by person and
// type, searchable, paginated. Server-rendered; view state is in the query string.
import Link from "next/link";
import { supabaseServer, supabaseAdmin } from "../../../lib/supabase.js";
import { currentCompany } from "../../../lib/session.js";
import { t, normLang } from "../../../lib/i18n.js";
import { activityHtml } from "../../../lib/activity.js";
import { mdDayKey, fmtDate, fmtTime } from "../../../lib/tz.js";
import ActivityFilters from "./ActivityFilters.jsx";
import { initials } from "../../../lib/Avatar.jsx";

export const dynamic = "force-dynamic";
export const metadata = { title: "Activity — VoltMira" };

const PAGE = 25;
const TYPES = ["all", "quote", "proposal", "lead", "sys", "won"];
// "sent" was written by five call sites (proposal emailed, proforma emailed,
// seeded feed rows) and appeared in NO category, so those entries vanished the
// moment any filter was applied. Sending and opening are both proposal
// lifecycle events, so they belong together.
const TYPE_KINDS = { quote: ["quote"], proposal: ["proposal", "open", "sent"], lead: ["lead"], sys: ["sys"], won: ["won"] };
const TYPE_META = {
  quote: { key: "act_type_quote", c: "#378ADD" },
  proposal: { key: "act_type_proposal", c: "#378ADD" },
  open: { key: "act_type_proposal", c: "#378ADD" },
  // Without this, a "sent" row fell through to the quote badge and was labelled
  // "Quotes" while sitting under the Proposals filter.
  sent: { key: "act_type_proposal", c: "#378ADD" },
  lead: { key: "act_type_lead", c: "#C97F14" },
  won: { key: "act_type_won", c: "#1E6B4E" },
  sys: { key: "act_type_settings", c: "#5A4FB0" },
};

export default async function ActivityPage({ searchParams }) {
  const sb = supabaseServer();
  const co = await currentCompany();
  const lang = normLang(co?.lang);
  const q = (searchParams?.q || "").slice(0, 80);
  const who = searchParams?.who || "all";
  const type = TYPES.includes(searchParams?.type) ? searchParams.type : "all";
  const page = Math.max(1, parseInt(searchParams?.page || "1", 10) || 1);

  // Filter and paginate in the DATABASE. This used to pull the 600 most recent
  // rows and then filter in JavaScript, so a search reached only as far back as
  // those 600 — and the count read as a total. On a ledger whose whole job is
  // answering "who did what, and when", the answer quietly became "nothing"
  // for anything older. Now the query does the work and the count is real.
  //
  // Built fresh each time: a supabase-js builder is single-use, so the count
  // query and the page query cannot share one.
  const buildQuery = () => {
    let qb = sb.from("activity").select("*", { count: "exact" }).order("created_at", { ascending: false });
    if (type !== "all") qb = qb.in("kind", TYPE_KINDS[type] || []);
    if (who !== "all") qb = qb.eq("actor_id", who);
    if (q) {
      // Commas and parentheses are PostgREST's own or() syntax, so they have to
      // go or the whole filter is silently malformed.
      const safe = q.replace(/[,()%]/g, " ").trim();
      if (safe) qb = qb.or(`text.ilike.%${safe}%,actor_name.ilike.%${safe}%`);
    }
    return qb;
  };

  // range(0,0) fetches one row purely to get the exact count cheaply.
  const [{ count: matched }, { data: members }] = await Promise.all([
    buildQuery().range(0, 0),
    co ? supabaseAdmin().from("profiles").select("id, name, email").eq("company_id", co.id).order("created_at") : Promise.resolve({ data: [] }),
  ]);

  const total = matched || 0;
  const pages = Math.max(1, Math.ceil(total / PAGE));
  const p = Math.min(pages, page);
  const start = (p - 1) * PAGE;
  const { data: rows } = await buildQuery().range(start, start + PAGE - 1);
  const pageRows = rows || [];

  const locale = { en: "en-GB", ro: "ro-RO", ru: "ru-RU" }[lang] || "en-GB";
  // today/yesterday are decided in the app's timezone (Moldova/Romania), so the
  // day boundary matches the wall-clock the user sees — not the server's UTC.
  const todayK = mdDayKey(Date.now());
  const yestK = mdDayKey(Date.now() - 864e5);
  const dayLabel = (iso) => {
    const k = mdDayKey(iso);
    if (k === todayK) return t("day_today", lang);
    if (k === yestK) return t("day_yesterday", lang);
    return fmtDate(iso, locale, { day: "numeric", month: "short", year: "numeric" });
  };
  const time = (iso) => fmtTime(iso, locale);

  const href = (pg) => {
    const parts = [];
    if (q) parts.push("q=" + encodeURIComponent(q));
    if (who !== "all") parts.push("who=" + who);
    if (type !== "all") parts.push("type=" + type);
    if (pg > 1) parts.push("page=" + pg);
    return "/activity" + (parts.length ? "?" + parts.join("&") : "");
  };

  // Build day groups from the current page.
  const groups = [];
  let cur = null;
  for (const r of pageRows) {
    const d = dayLabel(r.created_at);
    if (!cur || cur.d !== d) { cur = { d, rows: [] }; groups.push(cur); }
    cur.rows.push(r);
  }

  return (
    <div style={{ maxWidth: 860, margin: "0 auto" }}>
      <style dangerouslySetInnerHTML={{ __html: ".act-clickable{transition:box-shadow .15s;cursor:pointer}.act-clickable:hover{box-shadow:inset 0 0 0 999px rgba(20,42,33,.035)}" }} />
      <div className="page-head">
        <h1>{t("activity_title", lang)}</h1>
        <span className="sub">{t("activity_sub", lang)}</span>
      </div>

      <ActivityFilters q={q} who={who} type={type} members={members || []} lang={lang} />

      {pageRows.length ? (
        <div style={{ display: "grid", gap: 18 }}>
          {groups.map(g => (
            <section key={g.d}>
              <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: ".08em", color: "var(--muted)", textTransform: "uppercase", margin: "0 0 8px" }}>{g.d}</div>
              <div className="card" style={{ padding: 0, overflow: "hidden" }}>
                {g.rows.map((r, i) => {
                  const meta = TYPE_META[r.kind] || TYPE_META.quote;
                  const isSettings = r.kind === "sys";
                  const rowStyle = { display: "flex", alignItems: "center", gap: 12, padding: "12px 15px",
                    borderTop: i ? "1px solid var(--line)" : "none", background: isSettings ? "var(--amber-tint)" : "transparent",
                    textDecoration: "none", color: "inherit" };
                  const inner = (<>
                    <span className="avatar sm" style={r.actor_name
                      ? { background: "var(--green-tint)", color: "var(--green)" }
                      : { background: "var(--paper)", color: "var(--muted)" }}>
                      {r.actor_name ? initials(r.actor_name) : "•"}
                    </span>
                    <div style={{ flex: 1, minWidth: 0, fontSize: 14, lineHeight: 1.4 }}>
                      {r.actor_name ? <><b style={{ fontWeight: 600 }}>{r.actor_name}</b><span style={{ color: "var(--muted)" }}> · </span></> : null}
                      <span dangerouslySetInnerHTML={{ __html: activityHtml(r, lang) }} />
                    </div>
                    <span style={{ fontSize: 11, fontWeight: 500, color: meta.c, border: "1px solid var(--line)", borderRadius: 99, padding: "2px 9px", whiteSpace: "nowrap" }}>{t(meta.key, lang)}</span>
                    <span style={{ fontSize: 12, color: "var(--muted)", whiteSpace: "nowrap", fontVariantNumeric: "tabular-nums" }}>{time(r.created_at)}</span>
                    {r.link ? <span aria-hidden="true" style={{ color: "var(--muted)", fontSize: 15, marginLeft: 2 }}>›</span> : null}
                  </>);
                  return r.link
                    ? <Link key={r.id} href={r.link} className="act-clickable" style={rowStyle}>{inner}</Link>
                    : <div key={r.id} style={rowStyle}>{inner}</div>;
                })}
              </div>
            </section>
          ))}

          {pages > 1 && (
            <div className="pager">
              <Link className={`btn sm ghost${p <= 1 ? " disabled" : ""}`} href={href(p - 1)} aria-disabled={p <= 1}>‹</Link>
              <span>{start + 1}–{Math.min(start + PAGE, total)} / {total}</span>
              <Link className={`btn sm ghost${p >= pages ? " disabled" : ""}`} href={href(p + 1)} aria-disabled={p >= pages}>›</Link>
            </div>
          )}
        </div>
      ) : (
        <div className="empty" style={{ maxWidth: 460, margin: "48px auto", textAlign: "center" }}>
          <b style={{ display: "block", fontSize: 17, marginBottom: 6 }}>{t("act_empty", lang)}</b>
          <span style={{ color: "var(--muted)", fontSize: 14 }}>{t("act_empty_sub", lang)}</span>
        </div>
      )}
    </div>
  );
}
