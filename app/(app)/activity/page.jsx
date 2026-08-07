// app/(app)/activity/page.jsx — the full Activity Log ("blame-shield"): a
// read-only ledger of who did what, grouped by day, filterable by person and
// type, searchable, paginated. Server-rendered; view state is in the query string.
import Link from "next/link";
import { supabaseServer, supabaseAdmin } from "../../../lib/supabase.js";
import { currentCompany } from "../../../lib/session.js";
import { t, normLang } from "../../../lib/i18n.js";
import { activityHtml } from "../../../lib/activity.js";
import ActivityFilters from "./ActivityFilters.jsx";

export const dynamic = "force-dynamic";
export const metadata = { title: "Activity — VoltMira" };

const PAGE = 25;
const TYPES = ["all", "quote", "proposal", "lead", "sys", "won"];
const TYPE_KINDS = { quote: ["quote"], proposal: ["proposal", "open"], lead: ["lead"], sys: ["sys"], won: ["won"] };
const TYPE_META = {
  quote: { key: "act_type_quote", c: "#378ADD" },
  proposal: { key: "act_type_proposal", c: "#378ADD" },
  open: { key: "act_type_proposal", c: "#378ADD" },
  lead: { key: "act_type_lead", c: "#C97F14" },
  won: { key: "act_type_won", c: "#1E6B4E" },
  sys: { key: "act_type_settings", c: "#5A4FB0" },
};

function initials(s) {
  s = (s || "").trim();
  if (!s) return "•";
  if (s.includes("@")) return s.slice(0, 2).toUpperCase();
  const p = s.split(/\s+/);
  return ((p[0]?.[0] || "") + (p[1]?.[0] || "")).toUpperCase() || s.slice(0, 2).toUpperCase();
}

export default async function ActivityPage({ searchParams }) {
  const sb = supabaseServer();
  const co = await currentCompany();
  const lang = normLang(co?.lang);
  const q = (searchParams?.q || "").slice(0, 80);
  const who = searchParams?.who || "all";
  const type = TYPES.includes(searchParams?.type) ? searchParams.type : "all";
  const page = Math.max(1, parseInt(searchParams?.page || "1", 10) || 1);

  const [{ data: rows }, { data: members }] = await Promise.all([
    sb.from("activity").select("*").order("created_at", { ascending: false }).limit(600),
    co ? supabaseAdmin().from("profiles").select("id, name, email").eq("company_id", co.id).order("created_at") : Promise.resolve({ data: [] }),
  ]);

  let list = rows || [];
  if (type !== "all") { const kinds = TYPE_KINDS[type] || []; list = list.filter(r => kinds.includes(r.kind)); }
  if (who !== "all") list = list.filter(r => r.actor_id === who);
  if (q) { const qq = q.toLowerCase(); list = list.filter(r => (r.text || "").toLowerCase().includes(qq) || (r.actor_name || "").toLowerCase().includes(qq)); }

  const total = list.length;
  const pages = Math.max(1, Math.ceil(total / PAGE));
  const p = Math.min(pages, page);
  const start = (p - 1) * PAGE;
  const pageRows = list.slice(start, start + PAGE);

  const locale = { en: "en-GB", ro: "ro-RO", ru: "ru-RU" }[lang] || "en-GB";
  const now = new Date();
  const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const dayLabel = (iso) => {
    const ts = new Date(iso).getTime();
    if (ts >= startToday) return t("day_today", lang);
    if (ts >= startToday - 864e5) return t("day_yesterday", lang);
    return new Date(ts).toLocaleDateString(locale, { day: "numeric", month: "short", year: "numeric" });
  };
  const time = (iso) => new Date(iso).toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" });

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
                  return (
                    <div key={r.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 15px",
                      borderTop: i ? "1px solid var(--line)" : "none", background: isSettings ? "var(--amber-tint)" : "transparent" }}>
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
                    </div>
                  );
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
          <div style={{ fontSize: 34, marginBottom: 10 }} aria-hidden="true">📜</div>
          <b style={{ display: "block", fontSize: 17, marginBottom: 6 }}>{t("act_empty", lang)}</b>
          <span style={{ color: "var(--muted)", fontSize: 14 }}>{t("act_empty_sub", lang)}</span>
        </div>
      )}
    </div>
  );
}
