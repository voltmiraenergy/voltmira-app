// app/(app)/grid/page.jsx — "Racordări": every grid-connection file the workspace has sent to an operator, how many
// days each has been in its step against that operator's usual days (lib/gridRules.js, set at /admin/grid), what
// is overdue, and the average days from a signed offer to a connected system (lib/gridOverview.js). The files are
// sent and moved from the grid card on each quote (GridSubmit.jsx); this page only reads.
import "../dx.css";
import "./grid.css";
import Link from "next/link";
import { supabaseServer } from "../../../lib/supabase.js";
import { currentCompany, currentUser } from "../../../lib/session.js";
import { projectVisibility } from "../../../lib/projectAccess.js";
import { normLang } from "../../../lib/i18n.js";
import { xt } from "../../../lib/integrationText.js";
import { gt } from "../../../lib/gridText.js";
import { allGridRules } from "../../../lib/gridRulesStore.js";
import { gridOverview } from "../../../lib/gridOverview.js";
import { OPERATORS } from "../../../lib/mdGrid.js";
import { mdDayKey, fmtDate } from "../../../lib/tz.js";
import { dec } from "../../../lib/decimals.js";
import { appTitle } from "../../../lib/pageTitle.js";

export const dynamic = "force-dynamic";
export const generateMetadata = appTitle("nav_grid");

const LOCS = { en: "en-GB", ro: "ro-RO", ru: "ru-RU", uk: "uk-UA" };
// today on the Chișinău clock, read once per request
const todayKey = () => mdDayKey(Date.now());

export default async function GridPage(props) {
  const sp = await props.searchParams;
  const onlyLate = sp?.view === "overdue";
  const sb = await supabaseServer();
  const [co, user] = await Promise.all([currentCompany(), currentUser()]);
  const lang = normLang(co?.lang);
  const G = (k, v) => gt(k, lang, v);

  // the workspace's files (row security keeps them to it), newest first
  let { data: subs, error } = await sb.from("grid_submissions").select("id, project_id, operator, reference, status, created_at, updated_at, overrides").order("created_at", { ascending: false }).limit(500);
  if (error && /overrides|column/i.test(error.message || "")) ({ data: subs, error } = await sb.from("grid_submissions").select("id, project_id, operator, reference, status, created_at, updated_at").order("created_at", { ascending: false }).limit(500));
  const needsDb = !!error && /grid_submissions|does not exist|schema cache/i.test(error.message || "");
  subs = subs || [];

  // one file per quote: its latest
  const seen = new Set();
  subs = subs.filter((s) => (seen.has(s.project_id) ? false : seen.add(s.project_id)));
  const ids = [...new Set(subs.map((s) => s.project_id))];
  const [{ data: projects }, { data: props_ }, { data: events }, rules] = await Promise.all([
    ids.length ? sb.from("projects").select("id, title, client_name, owner_id").in("id", ids) : { data: [] },
    ids.length ? sb.from("proposals").select("project_id, accepted_at").in("project_id", ids).not("accepted_at", "is", null) : { data: [] },
    subs.length ? sb.from("grid_submission_events").select("submission_id, to_status, created_at").in("submission_id", subs.map((s) => s.id)) : { data: [] },
    allGridRules(),
  ]);
  // a Sales title sees only its own quotes' files, when the owner has access control on
  const canSee = await projectVisibility(user, co);
  const visible = new Map((projects || []).filter(canSee).map((p) => [p.id, p]));
  const signedAt = new Map();
  for (const p of props_ || []) if (!signedAt.has(p.project_id) || signedAt.get(p.project_id) > p.accepted_at) signedAt.set(p.project_id, p.accepted_at);

  const today = todayKey();
  const view = gridOverview({ subs: subs.filter((s) => visible.has(s.project_id)), events: events || [], projects: visible, signedAt, rules, today });
  const rows = onlyLate ? view.open.filter((r) => r.overdue) : view.open;
  const day = (d) => (d ? fmtDate(d, LOCS[lang], { day: "numeric", month: "short" }) : "");

  return (
    <div className="dx gdx">
      <header className="dx-head">
        <div className="dx-hello">
          <h1>{G("go_title")}</h1>
          <p className="dx-summary">{G("go_sub")}</p>
        </div>
      </header>

      {needsDb && <p className="gdx-warn" role="status">{xt("bl_needs_db", lang)}</p>}

      <dl className="gdx-strip">
        <div><dt>{G("go_open")}</dt><dd>{view.stats.open}</dd></div>
        <div className={view.stats.overdue ? "is-late" : ""}><dt>{G("go_overdue")}</dt><dd>{view.stats.overdue}</dd></div>
        <div className="gdx-avg">
          <dt>{G("go_avg")}</dt>
          {view.stats.avgDays != null
            ? <><dd>{G("go_avg_v", { d: dec(view.stats.avgDays, 1, lang) })}</dd><dd className="gdx-sub">{G("go_avg_n", { n: view.stats.avgN })}</dd></>
            : <dd className="gdx-sub">{G("go_avg_none")}</dd>}
        </div>
      </dl>

      <section className="dx-card" aria-labelledby="gdx-open-h">
        <header className="dx-card-head gdx-card-head">
          <h2 id="gdx-open-h">{G("go_open")}<span className="dx-count">{view.open.length}</span></h2>
          <nav className="dx-tabs" aria-label={G("go_open")}>
            <Link href="/grid" className={!onlyLate ? "on" : ""} aria-current={!onlyLate ? "page" : undefined}>{G("go_all")}</Link>
            <Link href="/grid?view=overdue" className={onlyLate ? "on" : ""} aria-current={onlyLate ? "page" : undefined}>{G("go_only_overdue")}</Link>
          </nav>
        </header>
        {rows.length === 0 ? (
          <p className="gdx-empty">{subs.length === 0 ? G("go_empty") : onlyLate ? G("go_none_overdue") : G("go_empty")}</p>
        ) : (
          <div className="gdx-scroll">
            <table className="gdx-table">
              <thead>
                <tr><th scope="col">{G("go_col_client")}</th><th scope="col">{G("go_col_op")}</th><th scope="col">{G("go_col_status")}</th><th scope="col" className="num">{G("go_col_days")}</th><th scope="col">{G("go_col_ref")}</th></tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className={r.overdue ? "is-late" : ""}>
                    <td><Link href={`/projects/${r.projectId}`} className="gdx-who">{r.client || "?"}</Link>{r.exception && <small className="gdx-exc">{G("go_exception")}</small>}</td>
                    <td>{OPERATORS[r.operator]?.short || r.operator}</td>
                    <td><span className={"gdx-st s-" + r.status}>{xt("gs_st_" + r.status, lang)}</span><small>{day(r.since)}</small></td>
                    <td className="num">
                      {r.expected != null ? G("go_days", { d: r.days ?? 0, e: r.expected }) : r.days}
                      {r.overdue && <small className="gdx-late">{G("go_late", { n: r.late })}</small>}
                    </td>
                    <td className="gdx-ref">{r.reference}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="gdx-note">{G("go_rules")}</p>
      </section>

      {view.closed.length > 0 && (
        <section className="dx-card" aria-labelledby="gdx-closed-h">
          <header className="dx-card-head"><h2 id="gdx-closed-h">{G("go_closed_h")}<span className="dx-count">{view.closed.length}</span></h2></header>
          <ul className="gdx-closed">
            {view.closed.map((r) => (
              <li key={r.id}>
                <Link href={`/projects/${r.projectId}`} className="gdx-who">{r.client || "?"}</Link>
                <span>{OPERATORS[r.operator]?.short || r.operator}</span>
                <span className={"gdx-st s-" + r.status}>{xt("gs_st_" + r.status, lang)}</span>
                <small>{day(r.since)}</small>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
