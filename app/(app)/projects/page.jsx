// app/(app)/projects/page.jsx — the pipeline cockpit. Sortable/filterable table
// with per-quote follow-up intelligence: how long a quote has been sitting in
// "Sent" (aging), how many times the client opened it (engagement), whether it's
// gone stale past its validity window, a client-note indicator, and one-tap row
// actions (open / copy link / mark won / duplicate / delete). Server-rendered;
// all view state travels in the query string.
import Link from "next/link";
import { supabaseServer, supabaseAdmin } from "../../../lib/supabase.js";
import { currentCompany } from "../../../lib/session.js";
import { bulkUpdateStatus } from "../../../lib/actions.js";
import { revalidatePath } from "next/cache";
import { quote } from "@voltmira/engine";
import { companyEngine } from "../../../lib/engineSettings.js";
import { t, normLang } from "../../../lib/i18n.js";
import { proposalStatsByProject, daysSince, agingLabel, agingTier, isStale } from "../../../lib/proposalStats.js";
import { rowToQuoteInput } from "../../../lib/quoteInput.js";
import RowActions from "./RowActions.jsx";
import StatusChip from "./StatusChip.jsx";
import NewQuoteMenu from "./NewQuoteMenu.jsx";
import TemplateBar from "./TemplateBar.jsx";
import BulkBar from "./BulkBar.jsx";

export const dynamic = "force-dynamic";
export const metadata = { title: "Quotes — VoltMira" };

const PAGE_SIZE = 10;
const STATUSES = ["all", "draft", "sent", "won", "lost"];
const SORTS = ["title", "kw", "payback", "value", "status", "opens", "updated"];

async function bulkStatus(formData) {
  "use server";
  const ids = formData.getAll("ids");
  const op = formData.get("op");
  await bulkUpdateStatus(ids, op);
  revalidatePath("/projects");
  revalidatePath("/dashboard");
}

function initials(s) {
  s = (s || "").trim();
  if (!s) return "—";
  if (s.includes("@")) return s.slice(0, 2).toUpperCase();
  const p = s.split(/\s+/);
  return ((p[0]?.[0] || "") + (p[1]?.[0] || "")).toUpperCase() || s.slice(0, 2).toUpperCase();
}

export default async function Projects({ searchParams }) {
  const status = STATUSES.includes(searchParams?.status) ? searchParams.status : "all";
  const q = (searchParams?.q || "").slice(0, 80);
  const sort = SORTS.includes(searchParams?.sort) ? searchParams.sort : "updated";
  const dir = searchParams?.dir === "asc" ? "asc" : "desc";
  const sgn = dir === "asc" ? 1 : -1;

  const sb = supabaseServer();
  const co = await currentCompany();
  const [{ data: allRows }, { data: team }, stats] = await Promise.all([
    sb.from("projects").select("*").order("updated_at", { ascending: false }),
    co ? supabaseAdmin().from("profiles").select("id, name, email").eq("company_id", co.id) : Promise.resolve({ data: [] }),
    proposalStatsByProject(sb),
  ]);
  const E = await companyEngine(co);
  const validityDays = E.quoteValidityDays || 30;
  const lang = normLang(co?.lang);
  const fmt = (n) => "€" + Math.round(n).toLocaleString("en-IE");
  const yrsF = (p) => p === null ? "25+" : p === 0 ? "now" : p.toFixed(1);
  const ownerOf = (id) => (team || []).find(m => m.id === id);
  // "sent" date proxied by the proposal; fall back to updated_at
  const sentOf = (p) => (stats.get(p.id)?.sentAt) || p.updated_at;

  const total = (allRows || []).length;
  let rows = status === "all" ? (allRows || []) : (allRows || []).filter(p => p.status === status);
  if (q) {
    const qq = q.toLowerCase();
    rows = rows.filter(p => ((p.title || "") + " " + (p.client_name || "") + " " + (p.address || "")).toLowerCase().includes(qq));
  }

  const enriched = rows.map(p => ({
    p, st: stats.get(p.id) || null, q: quote(rowToQuoteInput(p), E).e,
  }));
  enriched.sort((a, b) => {
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

  const pages = Math.max(1, Math.ceil(enriched.length / PAGE_SIZE));
  const page = Math.min(pages, Math.max(1, parseInt(searchParams?.page || "1", 10) || 1));
  const pStart = (page - 1) * PAGE_SIZE;
  const pageRows = enriched.slice(pStart, pStart + PAGE_SIZE);

  const href = (o = {}) => {
    const s = { status, q, sort, dir, ...o };
    const parts = [];
    if (s.status && s.status !== "all") parts.push("status=" + s.status);
    if (s.q) parts.push("q=" + encodeURIComponent(s.q));
    if (s.sort && s.sort !== "updated") parts.push("sort=" + s.sort);
    if (s.dir && s.dir !== "desc") parts.push("dir=" + s.dir);
    if (s.page && s.page > 1) parts.push("page=" + s.page);
    return "/projects" + (parts.length ? "?" + parts.join("&") : "");
  };

  const sh = (key, label) => {
    const on = sort === key;
    const nextDir = on && dir === "asc" ? "desc" : "asc";
    return (
      <th className="th-sort" aria-sort={on ? (dir === "asc" ? "ascending" : "descending") : "none"}>
        <Link href={href({ sort: key, dir: nextDir, page: 1 })} style={{ color: "inherit", textDecoration: "none", display: "inline-flex", gap: 4, alignItems: "center" }}>
          {label}{on && <span className="sort-arr">{dir === "asc" ? "▲" : "▼"}</span>}
        </Link>
      </th>
    );
  };

  // Opens cell: repeat opens are the strongest buying signal we capture.
  function opensCell(p, st) {
    if (p.status === "draft" || !st || !st.sentAt) return <span style={{ color: "var(--muted)" }}>—</span>;
    const n = st.opens || 0;
    if (n === 0) return <span style={{ color: "var(--muted)", fontSize: 12.5 }}>{t("opens_never", lang)}</span>;
    return (
      <span>
        <b className={"opens" + (n >= 3 ? " hot" : "")}>{n}×</b>
        {st.lastOpen && <div className="t-sub">{agingLabelOpen(st.lastOpen)}</div>}
      </span>
    );
  }
  const agingLabelOpen = (iso) => { const d = daysSince(iso); return d <= 0 ? t("aged_today", lang) : t("aged_days", lang, { n: d }); };

  return (
    <>
      <div className="page-head">
        <h1>{t("projects_title", lang)}</h1>
        <span className="spacer" />
        <a className="btn ghost" href="/api/export-projects">{t("exp_csv", lang)}</a>
        <NewQuoteMenu lang={lang} />
      </div>

      <TemplateBar templates={co?.quote_templates || []} lang={lang} />

      <div className="filters">
        <form action="/projects" style={{ display: "contents" }}>
          {status !== "all" && <input type="hidden" name="status" value={status} />}
          {sort !== "updated" && <input type="hidden" name="sort" value={sort} />}
          {dir !== "desc" && <input type="hidden" name="dir" value={dir} />}
          <input className="input" name="q" defaultValue={q} placeholder={t("proj_search", lang)} />
        </form>
        {STATUSES.map(s => (
          <Link key={s} href={href({ status: s, page: 1 })} className={`fchip${status === s ? " on" : ""}`}>
            {s === "all" ? t("f_all", lang) : t("st_" + s, lang)}
          </Link>
        ))}
      </div>

      {pageRows.length ? (
        <form action={bulkStatus} className="bulk-form">
          {/* Bulk editor: tick rows, then apply a status (or delete) to all at once.
              The bar stays hidden (CSS :has) until at least one row is ticked, so it
              never looks like a filter. RowActions/StatusChip are type="button" so
              they never submit this form. */}
          <BulkBar lang={lang} />
          <section className="card" style={{ padding: "6px 6px 2px" }}>
            <div className="tbl-wrap"><table className="tbl">
              <thead><tr>
                <th className="col-sel"><input type="checkbox" className="sel-all" aria-label={t("bulk_select_all", lang)} /></th>
                {sh("title", t("col_project", lang))}
                {sh("kw", t("col_system", lang))}
                {sh("payback", t("col_payback", lang))}
                {sh("value", t("col_value", lang))}
                {sh("status", t("col_status", lang))}
                {sh("opens", t("col_opens", lang))}
                <th>{t("col_owner", lang)}</th><th />
              </tr></thead>
              <tbody>
                {pageRows.map(({ p, q: qq, st }) => {
                  const ow = ownerOf(p.owner_id);
                  const sent = p.status === "sent";
                  const stale = sent && isStale(sentOf(p), validityDays);
                  return (
                    <tr key={p.id}>
                      <td className="col-sel"><input type="checkbox" className="bulk-id" name="ids" value={p.id} aria-label={p.title || t("untitled", lang)} /></td>
                      <td>
                        <Link className="t-title" href={`/projects/${p.id}`}>{p.title || t("untitled", lang)}</Link>
                        {p.notes ? <span className="note-dot" title={p.notes} aria-label={t("has_notes", lang)}><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 4h13l3 3v13H4z"/><path d="M8 10h8M8 14h6"/></svg></span> : null}
                        <div className="t-sub">{p.client_name || "—"} · {p.market}</div>
                      </td>
                      <td>{(+p.kw).toFixed(1)} kW{p.batt ? " + batt" : ""}</td>
                      <td>{yrsF(qq.payback)} {t("yrs", lang)}</td>
                      {/* contract value you invoice (pre-grant), so these rows sum
                          to the dashboard's Pipeline KPI */}
                      <td>{fmt(qq.grossCost)}</td>
                      <td>
                        <StatusChip id={p.id} status={p.status} lang={lang} />
                        {sent && <div className={`age ${agingTier(sentOf(p))}`}>{agingLabel(sentOf(p), lang)}</div>}
                        {stale && <div className="age bad">{t("q_stale", lang)}</div>}
                      </td>
                      <td>{opensCell(p, st)}</td>
                      <td>{ow ? <span className="avatar sm green" title={ow.name || ow.email}>{initials(ow.name || ow.email)}</span> : "—"}</td>
                      <td><RowActions id={p.id} status={p.status} lang={lang} /></td>
                    </tr>
                  );
                })}
              </tbody>
            </table></div>
            {enriched.length > PAGE_SIZE && (
              <div className="pager">
                <Link className={`btn sm ghost${page <= 1 ? " disabled" : ""}`} href={href({ page: page - 1 })} aria-disabled={page <= 1}>‹</Link>
                <span>{pStart + 1}–{Math.min(pStart + PAGE_SIZE, enriched.length)} / {enriched.length}</span>
                <Link className={`btn sm ghost${page >= pages ? " disabled" : ""}`} href={href({ page: page + 1 })} aria-disabled={page >= pages}>›</Link>
              </div>
            )}
          </section>
        </form>
      ) : (
        <section className="card" style={{ padding: "6px 6px 2px" }}>
          <div className="empty" style={{ margin: 14 }}>
            <b>{total ? t("empty_nomatch_t", lang) : t("empty_noproj_t", lang)}</b>
            {total ? t("empty_nomatch_s", lang) : t("empty_noproj_s", lang)}
          </div>
        </section>
      )}
    </>
  );
}
