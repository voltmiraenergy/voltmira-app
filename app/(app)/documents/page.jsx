// app/(app)/documents/page.jsx — every quote's paperwork in one place.
//
// The documents already exist, spread across each quote: the tracked proposal
// and its PDF, the client's signed acceptance, the service contract, the
// proforma invoice, the grid-connection request (Moldova), the commissioning
// act and the single-line diagram. This page gathers them, says which ones
// are done (from real records, see lib/paperwork.js), and puts every
// unfinished item for a won job one click from the place that produces it.
import "../dx.css";
import "./documents.css";
import Link from "next/link";
import { supabaseServer, supabaseAdmin } from "../../../lib/supabase.js";
import { currentCompany, currentUser } from "../../../lib/session.js";
import { canViewAllProjects } from "../../../lib/rbac.js";
import { t, normLang } from "../../../lib/i18n.js";
import { fmtDate } from "../../../lib/tz.js";
import { LOCALE } from "../../../lib/relTime.js";
import { paperworkFor, paperworkTotals } from "../../../lib/paperwork.js";
import Avatar from "../../../lib/Avatar.jsx";

export const dynamic = "force-dynamic";
export const metadata = { title: "Documents | VoltMira" };

const VIEWS = ["all", "todo", "won", "signed"];

const I = {
  file: <><path d="M6 22a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h8a2.4 2.4 0 0 1 1.704.706l3.588 3.588A2.4 2.4 0 0 1 20 8v12a2 2 0 0 1-2 2z" /><path d="M14 2v5a1 1 0 0 0 1 1h5" /></>,
  pen: <><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" /></>,
  receipt: <><path d="M13 16H8" /><path d="M14 8H8" /><path d="M16 12H8" /><path d="M4 3a1 1 0 0 1 1-1 1.3 1.3 0 0 1 .7.2l.933.6a1.3 1.3 0 0 0 1.4 0l.934-.6a1.3 1.3 0 0 1 1.4 0l.933.6a1.3 1.3 0 0 0 1.4 0l.933-.6a1.3 1.3 0 0 1 1.4 0l.934.6a1.3 1.3 0 0 0 1.4 0l.933-.6A1.3 1.3 0 0 1 19 2a1 1 0 0 1 1 1v18a1 1 0 0 1-1 1 1.3 1.3 0 0 1-.7-.2l-.933-.6a1.3 1.3 0 0 0-1.4 0l-.934.6a1.3 1.3 0 0 1-1.4 0l-.933-.6a1.3 1.3 0 0 0-1.4 0l-.933.6a1.3 1.3 0 0 1-1.4 0l-.934-.6a1.3 1.3 0 0 0-1.4 0l-.933.6a1.3 1.3 0 0 1-.7.2 1 1 0 0 1-1-1z" /></>,
  plug: <><path d="M12 22v-5" /><path d="M9 8V2" /><path d="M15 8V2" /><path d="M18 8v5a4 4 0 0 1-4 4h-4a4 4 0 0 1-4-4V8Z" /></>,
  stamp: <><path d="M5 22h14" /><path d="M19.27 13.73A2.5 2.5 0 0 0 17.5 13h-11A2.5 2.5 0 0 0 4 15.5V17a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-1.5c0-.66-.26-1.3-.73-1.77Z" /><path d="M14 13V8.5C14 7 15 7 15 5a3 3 0 0 0-6 0c0 2 1 2 1 3.5V13" /></>,
  diagram: <><path d="M6 3v12" /><circle cx="18" cy="6" r="3" /><circle cx="6" cy="18" r="3" /><path d="M18 9a9 9 0 0 1-9 9" /></>,
  badge: <><path d="M3.85 8.62a4 4 0 0 1 4.78-4.77 4 4 0 0 1 6.74 0 4 4 0 0 1 4.78 4.78 4 4 0 0 1 0 6.74 4 4 0 0 1-4.77 4.78 4 4 0 0 1-6.75 0 4 4 0 0 1-4.78-4.77 4 4 0 0 1 0-6.76Z" /><path d="m9 12 2 2 4-4" /></>,
  check: <path d="M20 6 9 17l-5-5" />,
  clock: <><circle cx="12" cy="12" r="10" /><path d="M12 6v6h4" /></>,
  search: <><path d="m21 21-4.34-4.34" /><circle cx="11" cy="11" r="8" /></>,
  download: <><path d="M12 15V3" /><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><path d="m7 10 5 5 5-5" /></>,
};
const Svg = ({ d, size = 14, w = 2 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={w} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{I[d]}</svg>
);

export default async function DocumentsPage(props0) {
  const searchParams = await props0.searchParams;
  const view = VIEWS.includes(searchParams?.view) ? searchParams.view : "all";
  const q = (searchParams?.q || "").trim().slice(0, 80);
  const sb = await supabaseServer();
  const co = await currentCompany();
  const lang = normLang(co?.lang);
  const locale = LOCALE[lang] || "en-GB";

  // signer_name needs add-proposal-signature.sql; read without it if absent.
  const propSel = async () => {
    let r = await sb.from("proposals").select("project_id, code, created_at, accepted_at, signer_name");
    if (r.error) r = await sb.from("proposals").select("project_id, code, created_at, accepted_at");
    return r;
  };
  const [{ data: rowsRaw }, { data: props }, { data: team }, user] = await Promise.all([
    sb.from("projects").select("*").order("updated_at", { ascending: false }),
    propSel(),
    co ? supabaseAdmin().from("profiles").select("id, title, role").eq("company_id", co.id) : Promise.resolve({ data: [] }),
    currentUser(),
  ]);
  // Same visibility rule as the Quotes list (lib/rbac.js).
  const me = (team || []).find((m) => m.id === user?.id) || null;
  const rows = (canViewAllProjects(me, co?.rbac_enabled) ? rowsRaw : (rowsRaw || []).filter((p) => p.owner_id === user?.id)) || [];

  const byProject = new Map();
  for (const pr of props || []) {
    const prev = byProject.get(pr.project_id);
    // keep the accepted one if there are several, else the earliest
    if (!prev || (pr.accepted_at && !prev.accepted_at)) byProject.set(pr.project_id, pr);
  }

  const live = rows.filter((p) => p.status !== "lost");
  const all = live.map((p) => ({ p, ...paperworkFor(p, byProject.get(p.id) || null) }));
  const totals = paperworkTotals(live, byProject);
  const date = (iso) => (iso ? fmtDate(String(iso).length === 10 ? iso + "T12:00:00Z" : iso, locale, { day: "numeric", month: "short" }) : "");

  // Won first (that is where paperwork is owed), then sent, then drafts.
  const rank = { won: 0, sent: 1, draft: 2 };
  all.sort((a, b) => (rank[a.p.status] ?? 3) - (rank[b.p.status] ?? 3));

  const todo = all.filter((x) => x.missing.length);
  let shown = view === "todo" ? todo
    : view === "won" ? all.filter((x) => x.p.status === "won")
    : view === "signed" ? all.filter((x) => x.docs.signed.state === "done")
    : all;
  if (q) {
    const qq = q.toLowerCase();
    shown = shown.filter(({ p }) => [p.title, p.client_name, p.address, p.invoice_no].some((v) => String(v || "").toLowerCase().includes(qq)));
  }
  const counts = { all: all.length, todo: todo.length, won: all.filter((x) => x.p.status === "won").length, signed: all.filter((x) => x.docs.signed.state === "done").length };
  const href = (o = {}) => {
    const s = { view, q, ...o };
    const parts = [];
    if (s.view && s.view !== "all") parts.push("view=" + s.view);
    if (s.q) parts.push("q=" + encodeURIComponent(s.q));
    return "/documents" + (parts.length ? "?" + parts.join("&") : "");
  };

  // Where each missing item gets done. The invoice link is a plain <a> so it
  // only draws an invoice number when actually clicked, never on prefetch.
  function action(p, k) {
    const id = p.id;
    if (k === "signed") return <Link className="doc-todo-act" href={`/projects/${id}?docs=contract`}><Svg d="pen" />{t("doc_act_sign", lang)}</Link>;
    if (k === "invoice") return <a className="doc-todo-act" href={`/projects/${id}/invoice`}><Svg d="receipt" />{t("doc_act_invoice", lang)}</a>;
    if (k === "permit") return <Link className="doc-todo-act" href={`/projects/${id}`}><Svg d="badge" />{t("inst_permit", lang)}</Link>;
    if (k === "grid") return p.market === "MD"
      ? <a className="doc-todo-act" href={`/api/projects/${id}/racordare-pdf`} target="_blank" rel="noopener noreferrer"><Svg d="plug" />{t("doc_act_grid_md", lang)}</a>
      : <Link className="doc-todo-act" href={`/projects/${id}`}><Svg d="plug" />{t("inst_grid", lang)}</Link>;
    if (k === "commissioning") return <Link className="doc-todo-act" href={`/projects/${id}?docs=commissioning`}><Svg d="stamp" />{t("doc_act_commission", lang)}</Link>;
    return null;
  }

  // One pill per document on a row: green when done, plain when ready to produce.
  function pills({ p, docs }) {
    const id = p.id, won = p.status === "won", out = [];
    if (docs.proposal.state === "done") out.push(
      <a key="prop" className="doc-pill done" href={`/api/proposal/${docs.proposal.code}/pdf`} target="_blank" rel="noopener noreferrer" title={t("doc_sent_on", lang, { date: date(docs.proposal.at) })}>
        <Svg d="file" />{t("doc_proposal_pdf", lang)}</a>);
    if (docs.signed.state === "done") out.push(
      <Link key="sig" className="doc-pill done" href={`/projects/${id}`}>
        <Svg d="check" w={2.6} />{t("doc_signed_on", lang, { date: date(docs.signed.at) })}{docs.signed.by ? <em>{docs.signed.by}</em> : null}</Link>);
    else if (docs.signed.state === "waiting") out.push(
      <span key="sig" className="doc-pill wait"><Svg d="clock" />{t("doc_awaiting", lang)}</span>);
    out.push(<Link key="con" className="doc-pill" href={`/projects/${id}?docs=contract`}><Svg d="pen" />{t("ld_tab_contract", lang)}</Link>);
    if (docs.invoice.state === "done") out.push(
      <a key="inv" className="doc-pill done" href={`/projects/${id}/invoice`}><Svg d="receipt" />{docs.invoice.no}</a>);
    else if (won) out.push(<a key="inv" className="doc-pill" href={`/projects/${id}/invoice`}><Svg d="receipt" />{t("doc_issue_invoice", lang)}</a>);
    if (p.market === "MD") out.push(
      <a key="grid" className={"doc-pill" + (docs.grid.state === "done" ? " done" : "")} href={`/api/projects/${id}/racordare-pdf`} target="_blank" rel="noopener noreferrer">
        <Svg d="plug" />{docs.grid.state === "done" ? t("doc_grid_done", lang, { date: date(docs.grid.at) }) : t("doc_grid_req", lang)}</a>);
    // Ukraine has no single national form: the file lives on the quote (GridFile.jsx)
    else if (p.market === "UA") out.push(
      <Link key="grid" className={"doc-pill" + (docs.grid.state === "done" ? " done" : "")} href={`/projects/${id}`}>
        <Svg d="plug" />{docs.grid.state === "done" ? t("doc_grid_done", lang, { date: date(docs.grid.at) }) : t("gf_title", lang)}</Link>);
    if (won) out.push(
      <Link key="com" className={"doc-pill" + (docs.commissioning.state === "done" ? " done" : "")} href={`/projects/${id}?docs=commissioning`}>
        <Svg d="stamp" />{docs.commissioning.state === "done" ? t("doc_commission_done", lang, { date: date(docs.commissioning.at) }) : t("ld_tab_commissioning", lang)}</Link>);
    out.push(<Link key="dia" className="doc-pill" href={`/projects/${id}?docs=diagram`}><Svg d="diagram" />{t("ld_tab_diagram", lang)}</Link>);
    return out;
  }

  return (
    <div className="dx dcx">
      <header className="dx-head">
        <div className="dx-hello">
          <h1>{t("nav_documents", lang)}</h1>
          <p className="dx-summary">
            {totals.won
              ? (totals.toFinish ? t("doc_summary", lang, { n: totals.toFinish, w: totals.won }) : t("doc_summary_clear", lang, { w: totals.won }))
              : t("doc_summary_none", lang)}
          </p>
        </div>
      </header>

      <dl className="doc-strip">
        <div><dt>{t("doc_st_signed", lang)}</dt><dd>{totals.signed}</dd><dd className="doc-sub">{t("doc_st_signed_sub", lang)}</dd></div>
        <div><dt>{t("doc_st_invoiced", lang)}</dt><dd>{totals.invoiced}</dd><dd className="doc-sub">{t("doc_st_invoiced_sub", lang)}</dd></div>
        <div><dt>{t("inst_grid", lang)}</dt><dd>{totals.connected}<small>/ {totals.won}</small></dd><dd className="doc-sub">{t("doc_of_won", lang)}</dd></div>
        <div><dt>{t("doc_st_commissioned", lang)}</dt><dd>{totals.commissioned}<small>/ {totals.won}</small></dd><dd className="doc-sub">{t("doc_of_won", lang)}</dd></div>
      </dl>

      {todo.length > 0 && view === "all" && !q && (
        <section className="dx-card doc-todo" aria-labelledby="doc-todo-h">
          <header className="dx-card-head">
            <div>
              <h2 id="doc-todo-h">{t("doc_todo_title", lang)}<span className="dx-count">{todo.length}</span></h2>
              <p>{t("doc_todo_sub", lang)}</p>
            </div>
          </header>
          <ul className="doc-todo-list">
            {todo.map(({ p, missing }) => (
              <li key={p.id}>
                <Link href={`/projects/${p.id}`} className="doc-who">
                  <Avatar name={p.title || p.client_name} size={34} title={p.title || ""} />
                  <span className="doc-who-tx"><b>{p.title || t("untitled", lang)}</b><small>{p.client_name || "—"}</small></span>
                </Link>
                <div className="doc-todo-acts">{missing.map((k) => <span key={k}>{action(p, k)}</span>)}</div>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="dx-card doc-lib" aria-labelledby="doc-lib-h">
        <header className="dx-card-head">
          <div><h2 id="doc-lib-h">{t("doc_all_title", lang)}</h2><p>{t("doc_all_sub", lang)}</p></div>
        </header>
        <div className="doc-bar">
          <nav className="dx-tabs" aria-label={t("doc_all_title", lang)}>
            {VIEWS.map((v) => (
              <Link key={v} href={href({ view: v })} className={view === v ? "on" : ""} aria-current={view === v ? "page" : undefined}>
                {t("doc_tab_" + v, lang)}<span>{counts[v]}</span>
              </Link>
            ))}
          </nav>
          <form action="/documents" className="dx-find doc-find" role="search">
            {view !== "all" && <input type="hidden" name="view" value={view} />}
            <Svg d="search" size={16} />
            <input name="q" defaultValue={q} placeholder={t("doc_search", lang)} aria-label={t("doc_search", lang)} />
          </form>
        </div>

        {shown.length ? (
          <ul className="doc-rows">
            {shown.map((x) => (
              <li key={x.p.id} className={"doc-row s-" + x.p.status}>
                <Link href={`/projects/${x.p.id}`} className="doc-who">
                  <Avatar name={x.p.title || x.p.client_name} size={34} title={x.p.title || ""} />
                  <span className="doc-who-tx">
                    <b>{x.p.title || t("untitled", lang)}</b>
                    <small>{x.p.client_name || "—"}<i className={"chip static " + x.p.status}>{t("st_" + x.p.status, lang)}</i></small>
                  </span>
                </Link>
                <div className="doc-pills">{pills(x)}</div>
              </li>
            ))}
          </ul>
        ) : (
          <div className="dx-empty">
            <b>{q || view !== "all" ? t("empty_nomatch_t", lang) : t("doc_empty", lang)}</b>
            <span>{q || view !== "all" ? t("q_nomatch_s", lang) : t("doc_empty_sub", lang)}</span>
            {(q || view !== "all") && <Link className="dx-btn" href="/documents">{t("q_view_clear", lang)}</Link>}
          </div>
        )}
      </section>
    </div>
  );
}
