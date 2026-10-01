// app/(app)/projects/page.jsx — the pipeline cockpit. Sortable/filterable table
// with per-quote follow-up intelligence: how long a quote has been sitting in
// "Sent" (aging), how many times the client opened it (engagement), whether it's
// gone stale past its validity window, a client-note indicator, and one-tap row
// actions (open / copy link / mark won / duplicate / delete). Server-rendered;
// all view state travels in the query string.
//
// Above the table: one tile per status with its count AND its money, so the
// filter row doubles as the pipeline summary, and a few "quick views" that
// answer the questions an installer actually asks of this list (who is reading
// it, who never opened it, what has expired, who is due a call today).
import "../dx.css";
import "./quotes.css";
import Link from "next/link";
import { supabaseServer, supabaseAdmin } from "../../../lib/supabase.js";
import { currentCompany, currentUser } from "../../../lib/session.js";
import { canViewAllProjects } from "../../../lib/rbac.js";
import { bulkUpdateStatus } from "../../../lib/actions.js";
import { revalidatePath } from "next/cache";
import { quote } from "@voltmira/engine";
import { companyEngine } from "../../../lib/engineSettings.js";
import { t, normLang } from "../../../lib/i18n.js";
import { proposalStatsByProject, agingLabel, agingTier, isStale } from "../../../lib/proposalStats.js";
import { rowToQuoteInput } from "../../../lib/quoteInput.js";
import { mdDayKey } from "../../../lib/tz.js";
import { relTime, LOCALE } from "../../../lib/relTime.js";
import RowActions from "./RowActions.jsx";
import StatusChip from "./StatusChip.jsx";
import NewQuoteMenu from "./NewQuoteMenu.jsx";
import TemplateBar from "./TemplateBar.jsx";
import BulkBar from "./BulkBar.jsx";
import Avatar, { initials } from "../../../lib/Avatar.jsx";
import { moneyFormatter, numFor } from "../../../lib/money.js";

export const dynamic = "force-dynamic";
export const metadata = { title: "Quotes | VoltMira" };

const PAGE_SIZE = 10;
const STATUSES = ["all", "draft", "sent", "won", "lost"];
const SORTS = ["title", "kw", "payback", "value", "status", "opens", "updated"];
const VIEWS = ["hot", "unopened", "stale", "followup"];

async function bulkStatus(formData) {
  "use server";
  const ids = formData.getAll("ids");
  const op = formData.get("op");
  await bulkUpdateStatus(ids, op);
  revalidatePath("/projects");
  revalidatePath("/dashboard");
}

const I = {
  search: <><path d="m21 21-4.34-4.34" /><circle cx="11" cy="11" r="8" /></>,
  download: <><path d="M12 15V3" /><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><path d="m7 10 5 5 5-5" /></>,
  note: <><path d="M4 4h13l3 3v13H4z" /><path d="M8 10h8M8 14h6" /></>,
  flame: <path d="M12 3q1 4 4 6.5t3 5.5a1 1 0 0 1-14 0 5 5 0 0 1 1-3 1 1 0 0 0 5 0c0-2-1.5-3-1.5-5q0-2 2.5-4" />,
  mail: <><path d="m22 7-8.991 5.727a2 2 0 0 1-2.009 0L2 7" /><rect x="2" y="4" width="20" height="16" rx="2" /></>,
  clock: <><circle cx="12" cy="12" r="10" /><path d="M12 6v6h4" /></>,
  cal: <><path d="M8 2v3" /><path d="M16 2v3" /><rect x="3" y="3" width="18" height="18" rx="2" /><path d="M3 9h18" /></>,
  x: <><path d="M18 6 6 18" /><path d="m6 6 12 12" /></>,
};
const Svg = ({ d, size = 15, w = 2 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={w} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{I[d]}</svg>
);
const VIEW_ICON = { hot: "flame", unopened: "mail", stale: "clock", followup: "cal" };

export default async function Projects(props) {
  const searchParams = await props.searchParams;
  const status = STATUSES.includes(searchParams?.status) ? searchParams.status : "all";
  const view = VIEWS.includes(searchParams?.view) ? searchParams.view : "";
  const q = (searchParams?.q || "").slice(0, 80);
  const sort = SORTS.includes(searchParams?.sort) ? searchParams.sort : "updated";
  const dir = searchParams?.dir === "asc" ? "asc" : "desc";
  const sgn = dir === "asc" ? 1 : -1;

  const sb = await supabaseServer();
  const co = await currentCompany();
  const [{ data: allRowsRaw }, { data: team }, stats, user] = await Promise.all([
    sb.from("projects").select("*").order("updated_at", { ascending: false }),
    co ? supabaseAdmin().from("profiles").select("id, name, email, role, title").eq("company_id", co.id) : Promise.resolve({ data: [] }),
    proposalStatsByProject(sb),
    currentUser(),
  ]);
  // RBAC (lib/rbac.js, add-rbac.sql — off by default): a Sales title sees
  // only the projects they own once an owner has explicitly turned this on.
  // Filtered here at the query-result layer, not via RLS — a wrong RLS
  // policy on a live multi-tenant table risks locking everyone out or
  // leaking across companies, while this is a single reversible flag.
  const me = (team || []).find((m) => m.id === user?.id) || null;
  const allRows = (canViewAllProjects(me, co?.rbac_enabled)
    ? allRowsRaw
    : (allRowsRaw || []).filter((p) => p.owner_id === user?.id)) || [];
  const E = await companyEngine(co);
  const validityDays = E.quoteValidityDays || 30;
  const lang = normLang(co?.lang);
  const locale = LOCALE[lang] || "en-GB";
  const now = Date.now();
  const todayKey = mdDayKey(now);
  // In the workspace's currency (lei in Moldova) at today's rate (lib/money.js).
  const fmt = moneyFormatter({ currency: co?.currency, lang, fx: E?.fx });
  const kfmt = (n) => fmt.compact(n);
  const nf = numFor(lang);
  const yrsF = (p) => p === null ? "25+" : p === 0 ? "now" : nf(p, 1);
  const ownerOf = (id) => (team || []).find(m => m.id === id);
  // "sent" date proxied by the proposal; fall back to updated_at
  const sentOf = (p) => (stats.get(p.id)?.sentAt) || p.updated_at;

  // The engine runs once per quote; tiles, views, sort and rows all read this.
  const all = allRows.map((p) => ({ p, st: stats.get(p.id) || null, q: quote(rowToQuoteInput(p), E).e }));

  // One tile per status: how many, and how much contract value (pre-grant, so
  // "Sent" here equals the dashboard's Pipeline figure).
  const tiles = STATUSES.map((s) => {
    const rows = s === "all" ? all : all.filter((x) => x.p.status === s);
    return { s, n: rows.length, eur: rows.reduce((sum, x) => sum + x.q.grossCost, 0) };
  });
  const won = tiles.find((x) => x.s === "won").n, lost = tiles.find((x) => x.s === "lost").n;
  const winRate = won + lost ? Math.round((won / (won + lost)) * 100) + "%" : null;

  // Quick views, each a question about sent quotes the table can answer.
  const inView = {
    hot: ({ p, st }) => p.status === "sent" && (st?.opens || 0) >= 3,
    unopened: ({ p, st }) => p.status === "sent" && !!st?.sentAt && !(st?.opens > 0),
    stale: ({ p }) => p.status === "sent" && isStale(sentOf(p), validityDays),
    followup: ({ p }) => (p.status === "sent" || p.status === "draft") && !!p.next_follow_up && p.next_follow_up <= todayKey,
  };
  const viewCount = Object.fromEntries(VIEWS.map((v) => [v, all.filter(inView[v]).length]));

  let rows = status === "all" ? all : all.filter((x) => x.p.status === status);
  if (view) rows = rows.filter(inView[view]);
  if (q) {
    const qq = q.toLowerCase();
    rows = rows.filter(({ p }) => ((p.title || "") + " " + (p.client_name || "") + " " + (p.address || "")).toLowerCase().includes(qq));
  }

  rows.sort((a, b) => {
    let va, vb;
    if (sort === "title") { va = (a.p.title || "").toLowerCase(); vb = (b.p.title || "").toLowerCase(); return va < vb ? -sgn : va > vb ? sgn : 0; }
    if (sort === "status") { va = a.p.status; vb = b.p.status; return va < vb ? -sgn : va > vb ? sgn : 0; }
    if (sort === "kw") { va = +a.p.kw; vb = +b.p.kw; }
    else if (sort === "payback") { va = a.q.payback == null ? Infinity : a.q.payback; vb = b.q.payback == null ? Infinity : b.q.payback; }
    else if (sort === "value") { va = a.q.grossCost; vb = b.q.grossCost; }
    else if (sort === "opens") { va = a.st?.opens || 0; vb = b.st?.opens || 0; }
    else { va = new Date(a.p.updated_at).getTime(); vb = new Date(b.p.updated_at).getTime(); }
    return (va - vb) * sgn;
  });

  const pages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const page = Math.min(pages, Math.max(1, parseInt(searchParams?.page || "1", 10) || 1));
  const pStart = (page - 1) * PAGE_SIZE;
  const pageRows = rows.slice(pStart, pStart + PAGE_SIZE);

  const href = (o = {}) => {
    const s = { status, view, q, sort, dir, ...o };
    const parts = [];
    if (s.status && s.status !== "all") parts.push("status=" + s.status);
    if (s.view) parts.push("view=" + s.view);
    if (s.q) parts.push("q=" + encodeURIComponent(s.q));
    if (s.sort && s.sort !== "updated") parts.push("sort=" + s.sort);
    if (s.dir && s.dir !== "desc") parts.push("dir=" + s.dir);
    if (s.page && s.page > 1) parts.push("page=" + s.page);
    return "/projects" + (parts.length ? "?" + parts.join("&") : "");
  };

  const sh = (key, label, cls = "") => {
    const on = sort === key;
    const nextDir = on && dir === "asc" ? "desc" : "asc";
    return (
      <th className={"th-sort " + cls} aria-sort={on ? (dir === "asc" ? "ascending" : "descending") : "none"}>
        <Link href={href({ sort: key, dir: nextDir, page: 1 })} className="q-th">
          {label}{on && <span className="sort-arr">{dir === "asc" ? "▲" : "▼"}</span>}
        </Link>
      </th>
    );
  };

  // Opens: repeat opens are the strongest buying signal we capture, so the
  // count gets a small five-step meter and the last open is said in words.
  function opensCell(p, st) {
    if (p.status === "draft" || !st || !st.sentAt) return <span className="q-muted">—</span>;
    const n = st.opens || 0;
    if (n === 0) return <span className="q-muted">{t("opens_never", lang)}</span>;
    return (
      <div className={"q-eng" + (n >= 3 ? " hot" : "")}>
        <div className="q-eng-top">
          <span className="q-meter" aria-hidden="true">{[1, 2, 3, 4, 5].map((i) => <i key={i} className={i <= n ? "on" : ""} />)}</span>
          <b>{n}×</b>
        </div>
        {st.lastOpen && <div className="t-sub">{t("dx_pulse_when", lang, { when: relTime(st.lastOpen, locale, now) })}</div>}
      </div>
    );
  }

  const sentTile = tiles.find((x) => x.s === "sent");
  const visibleViews = VIEWS.filter((v) => viewCount[v] > 0 || view === v);

  return (
    <div className="dx qx">
      <header className="dx-head">
        <div className="dx-hello">
          <h1>{t("projects_title", lang)}</h1>
          <p className="dx-summary">
            {t("q_summary", lang, { n: all.length, pipe: fmt(sentTile.eur) })}
            {winRate ? " " + t("q_summary_rate", lang, { r: winRate }) : ""}
          </p>
        </div>
        <div className="dx-head-tools">
          <a className="btn ghost" href="/api/export-projects"><Svg d="download" />{t("exp_csv", lang)}</a>
          <NewQuoteMenu lang={lang} />
        </div>
      </header>

      <TemplateBar templates={co?.quote_templates || []} lang={lang} />

      {/* The status filter, with each status's count and money on it. */}
      <nav className="q-tiles" aria-label={t("col_status", lang)}>
        {tiles.map(({ s, n, eur }) => (
          <Link key={s} href={href({ status: s, page: 1 })} className={"q-tile s-" + s + (status === s ? " on" : "")}
            aria-current={status === s ? "page" : undefined}>
            <span className="q-tile-lbl">{s !== "all" && <i aria-hidden="true" />}{s === "all" ? t("f_all", lang) : t("st_" + s, lang)}</span>
            <b>{n}</b>
            <small>{eur > 0 ? kfmt(eur) : "€0"}</small>
          </Link>
        ))}
      </nav>

      <div className="q-bar">
        <form action="/projects" className="dx-find" role="search">
          {status !== "all" && <input type="hidden" name="status" value={status} />}
          {view && <input type="hidden" name="view" value={view} />}
          {sort !== "updated" && <input type="hidden" name="sort" value={sort} />}
          {dir !== "desc" && <input type="hidden" name="dir" value={dir} />}
          <Svg d="search" size={16} />
          <input name="q" defaultValue={q} placeholder={t("proj_search", lang)} aria-label={t("proj_search", lang)} />
          {q && <Link href={href({ q: "", page: 1 })} className="dx-find-x" aria-label={t("q_view_clear", lang)}><Svg d="x" size={14} /></Link>}
        </form>
        {visibleViews.length > 0 && (
          <div className="q-views" role="group" aria-label={t("q_views", lang)}>
            {visibleViews.map((v) => (
              <Link key={v} href={href({ view: view === v ? "" : v, page: 1 })} className={"q-view v-" + v + (view === v ? " on" : "")}
                aria-pressed={view === v}>
                <Svg d={VIEW_ICON[v]} size={14} />
                {t("q_view_" + v, lang)}<span>{viewCount[v]}</span>
              </Link>
            ))}
          </div>
        )}
      </div>

      {pageRows.length ? (
        <form action={bulkStatus} className="bulk-form">
          {/* Bulk editor: tick rows, then apply a status (or delete) to all at once.
              The bar stays hidden (CSS :has) until at least one row is ticked, so it
              never looks like a filter. RowActions/StatusChip are type="button" so
              they never submit this form. */}
          <BulkBar lang={lang} />
          <section className="dx-card q-card">
            <div className="tbl-wrap"><table className="tbl q-tbl">
              <thead><tr>
                <th className="col-sel"><input type="checkbox" className="sel-all" aria-label={t("bulk_select_all", lang)} /></th>
                {sh("title", t("col_project", lang))}
                {sh("kw", t("col_system", lang))}
                {sh("payback", t("col_payback", lang))}
                {sh("value", t("col_value", lang), "num")}
                {sh("status", t("col_status", lang))}
                {sh("opens", t("col_opens", lang))}
                <th><span className="sr">{t("col_owner", lang)}</span></th>
              </tr></thead>
              <tbody>
                {pageRows.map(({ p, q: qq, st }) => {
                  const ow = ownerOf(p.owner_id);
                  const sent = p.status === "sent";
                  const stale = sent && isStale(sentOf(p), validityDays);
                  const hot = sent && (st?.opens || 0) >= 3;
                  return (
                    <tr key={p.id} className={hot ? "hot" : ""}>
                      <td className="col-sel c-sel"><input type="checkbox" className="bulk-id" name="ids" value={p.id} aria-label={p.title || t("untitled", lang)} /></td>
                      <td className="c-quote">
                        <div className="row-id">
                          <Avatar name={p.title || p.client_name} size={36} title={p.title || t("untitled", lang)} />
                          <div className="row-id-tx">
                            <div className="q-title-row">
                              <Link className="t-title" href={`/projects/${p.id}`}>{p.title || t("untitled", lang)}</Link>
                              {p.notes ? <span className="note-dot" title={p.notes} aria-label={t("has_notes", lang)}><Svg d="note" size={13} /></span> : null}
                            </div>
                            <div className="t-sub">{p.client_name || "—"}{p.market ? <span className="q-tag">{p.market}</span> : null}</div>
                          </div>
                        </div>
                      </td>
                      <td className="c-sys dx-num">
                        {(+p.kw).toFixed(1)} kW
                        {p.batt ? <span className="q-tag batt">{t("q_batt", lang)}</span> : null}
                      </td>
                      <td className="c-pb dx-num">{yrsF(qq.payback)} {t("yrs", lang)}</td>
                      {/* contract value you invoice (pre-grant), so these rows sum
                          to the dashboard's Pipeline KPI */}
                      <td className="c-val dx-num num">{fmt(qq.grossCost)}</td>
                      <td className="c-st">
                        <StatusChip id={p.id} status={p.status} lang={lang} />
                        {sent && !stale && <div className={`age ${agingTier(sentOf(p))}`}>{agingLabel(sentOf(p), lang)}</div>}
                        {stale && <div className="age bad">{t("q_stale", lang)}</div>}
                      </td>
                      <td className="c-op">{opensCell(p, st)}</td>
                      {/* Owner sits with the actions (who has it, what to do with it)
                          instead of taking a whole column the table can't spare. */}
                      <td className="c-act">
                        <div className="q-act">
                          {ow ? <span className="avatar sm green q-owner" title={`${t("col_owner", lang)}: ${ow.name || ow.email}`}>{initials(ow.name || ow.email)}</span> : null}
                          <RowActions id={p.id} status={p.status} lang={lang} />
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table></div>
            <footer className="q-foot">
              <span className="q-count">{t("q_showing", lang, { a: pStart + 1, b: Math.min(pStart + PAGE_SIZE, rows.length), n: rows.length })}</span>
              {rows.length > PAGE_SIZE && (
                <div className="pager">
                  <Link className={`btn sm ghost${page <= 1 ? " disabled" : ""}`} href={href({ page: page - 1 })} aria-disabled={page <= 1} aria-label={t("q_prev", lang)}>‹</Link>
                  <span>{page} / {pages}</span>
                  <Link className={`btn sm ghost${page >= pages ? " disabled" : ""}`} href={href({ page: page + 1 })} aria-disabled={page >= pages} aria-label={t("q_next", lang)}>›</Link>
                </div>
              )}
            </footer>
          </section>
        </form>
      ) : (
        <section className="dx-card">
          <div className="dx-empty">
            <b>{all.length ? t("empty_nomatch_t", lang) : t("empty_noproj_t", lang)}</b>
            <span>{all.length ? t("q_nomatch_s", lang) : t("empty_noproj_s", lang)}</span>
            {all.length > 0 && <Link className="dx-btn" href="/projects">{t("q_view_clear", lang)}</Link>}
          </div>
        </section>
      )}
    </div>
  );
}
