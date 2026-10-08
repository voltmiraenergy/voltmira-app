// app/(app)/activity/page.jsx — the Activity log: a read-only ledger of who did
// what, grouped by day, filterable by type and person, searchable, paginated.
// Server-rendered; view state lives in the query string.
//
// Same workspace look as the Dashboard, Quotes and Leads (dx.css): a header
// with the week in one sentence, type tabs, day groups of rows with a type
// icon, and a side column with the last 7 days by person and by type.
import "../dx.css";
import "./activity.css";
import Link from "next/link";
import { FileText, Send, Eye, UserPlus, Trophy, Settings2, Link2, Landmark, ChevronRight, ChevronLeft, Search } from "lucide-react";
import { supabaseServer, supabaseAdmin } from "../../../lib/supabase.js";
import { currentCompany } from "../../../lib/session.js";
import { t, normLang } from "../../../lib/i18n.js";
import { activityHtml } from "../../../lib/activity.js";
import { mdDayKey, fmtDate, fmtTime } from "../../../lib/tz.js";
import { initials } from "../../../lib/Avatar.jsx";
import ActivityFilters from "./ActivityFilters.jsx";
import { appTitle } from "../../../lib/pageTitle.js";

export const dynamic = "force-dynamic";
export const generateMetadata = appTitle("nav_activity");

const PAGE = 25;
const TYPES = ["all", "quote", "proposal", "bank", "lead", "won", "sys"];
// "sent" and "open" are proposal lifecycle events: they belong under Proposals,
// or they vanish the moment a filter is applied.
const TYPE_KINDS = { quote: ["quote"], proposal: ["proposal", "open", "sent"], bank: ["bank"], lead: ["lead"], sys: ["sys"], won: ["won"] };
const TYPE_LABEL = { all: "act_type_all", quote: "act_type_quote", proposal: "act_type_proposal", bank: "act_type_bank", lead: "act_type_lead", sys: "act_type_settings", won: "act_type_won" };
// One icon and one colour per kind of row; the side panel groups them by type.
const KIND = {
  quote: { Icon: FileText, c: "blue", type: "quote" },
  proposal: { Icon: Link2, c: "blue", type: "proposal" },
  sent: { Icon: Send, c: "blue", type: "proposal" },
  open: { Icon: Eye, c: "amber", type: "proposal" },
  // a bank on its deal room link (lib/dealNotify.js)
  bank: { Icon: Landmark, c: "green", type: "bank" },
  lead: { Icon: UserPlus, c: "amber", type: "lead" },
  won: { Icon: Trophy, c: "green", type: "won" },
  sys: { Icon: Settings2, c: "muted", type: "sys" },
};
const TYPE_COLOR = { quote: "blue", proposal: "blue", bank: "green", lead: "amber", won: "green", sys: "muted" };

export default async function ActivityPage(props) {
  const searchParams = await props.searchParams;
  const sb = await supabaseServer();
  const co = await currentCompany();
  const lang = normLang(co?.lang);
  const q = (searchParams?.q || "").slice(0, 80);
  const who = searchParams?.who || "all";
  const type = TYPES.includes(searchParams?.type) ? searchParams.type : "all";
  const page = Math.max(1, parseInt(searchParams?.page || "1", 10) || 1);

  // Filter and paginate in the database, so a search reaches the whole history
  // and the count is real. A supabase-js builder is single-use, hence a factory.
  const buildQuery = () => {
    let qb = sb.from("activity").select("*", { count: "exact" }).order("created_at", { ascending: false });
    if (type !== "all") qb = qb.in("kind", TYPE_KINDS[type] || []);
    if (who !== "all") qb = qb.eq("actor_id", who);
    if (q) {
      // Commas and parentheses are PostgREST's own or() syntax.
      const safe = q.replace(/[,()%]/g, " ").trim();
      if (safe) qb = qb.or(`text.ilike.%${safe}%,actor_name.ilike.%${safe}%`);
    }
    return qb;
  };

  const weekAgo = new Date(Date.now() - 7 * 864e5).toISOString();
  const [{ count: matched }, { data: members }, { data: week }] = await Promise.all([
    buildQuery().range(0, 0),
    co ? supabaseAdmin().from("profiles").select("id, name, email").eq("company_id", co.id).order("created_at") : Promise.resolve({ data: [] }),
    sb.from("activity").select("kind, actor_id, actor_name").gte("created_at", weekAgo).limit(3000),
  ]);

  const total = matched || 0;
  const pages = Math.max(1, Math.ceil(total / PAGE));
  const p = Math.min(pages, page);
  const start = (p - 1) * PAGE;
  const { data: rows } = await buildQuery().range(start, start + PAGE - 1);
  const pageRows = rows || [];

  // ---- the last 7 days, for the summary line and the side column
  const weekRows = week || [];
  const byPerson = new Map();
  for (const r of weekRows) {
    if (!r.actor_id) continue;
    const cur = byPerson.get(r.actor_id) || { id: r.actor_id, name: r.actor_name, n: 0 };
    cur.n++;
    if (!cur.name && r.actor_name) cur.name = r.actor_name;
    byPerson.set(r.actor_id, cur);
  }
  const people = [...byPerson.values()].sort((a, b) => b.n - a.n);
  const byType = { quote: 0, proposal: 0, bank: 0, lead: 0, won: 0, sys: 0 };
  for (const r of weekRows) byType[(KIND[r.kind] || KIND.quote).type]++;
  const typeMax = Math.max(1, ...Object.values(byType));
  const nPeople = Math.max(1, people.length);
  const summary = weekRows.length
    ? t("act_summary", lang, { n: weekRows.length, p: nPeople, ppl: t(nPeople === 1 ? "act_ppl_one" : "act_ppl_many", lang) })
    : t("act_summary_quiet", lang);

  const locale = { en: "en-GB", ro: "ro-RO", ru: "ru-RU", uk: "uk-UA" }[lang] || "en-GB";
  // Today/yesterday in the app's timezone, so the day boundary matches the
  // wall clock the user sees, not the server's UTC.
  const todayK = mdDayKey(Date.now());
  const yestK = mdDayKey(Date.now() - 864e5);
  const dayLabel = (iso) => {
    const k = mdDayKey(iso);
    if (k === todayK) return t("day_today", lang);
    if (k === yestK) return t("day_yesterday", lang);
    return fmtDate(iso, locale, { weekday: "long", day: "numeric", month: "long" });
  };

  const href = (o = {}) => {
    const s = { q, who, type, page: 1, ...o };
    const parts = [];
    if (s.q) parts.push("q=" + encodeURIComponent(s.q));
    if (s.who && s.who !== "all") parts.push("who=" + s.who);
    if (s.type && s.type !== "all") parts.push("type=" + s.type);
    if (s.page > 1) parts.push("page=" + s.page);
    return "/activity" + (parts.length ? "?" + parts.join("&") : "");
  };
  const filtered = Boolean(q) || who !== "all" || type !== "all";

  const groups = [];
  let cur = null;
  for (const r of pageRows) {
    const d = dayLabel(r.created_at);
    if (!cur || cur.d !== d) { cur = { d, rows: [] }; groups.push(cur); }
    cur.rows.push(r);
  }

  return (
    <div className="dx ax">
      <header className="dx-head">
        <div className="dx-hello">
          <h1>{t("activity_title", lang)}</h1>
          <p className="dx-summary">{summary}</p>
        </div>
        <div className="dx-head-tools">
          <form action="/activity" className="dx-find ax-search" role="search">
            {who !== "all" && <input type="hidden" name="who" value={who} />}
            {type !== "all" && <input type="hidden" name="type" value={type} />}
            <Search size={16} aria-hidden="true" />
            <input name="q" defaultValue={q} placeholder={t("act_search", lang)} aria-label={t("act_search", lang)} />
          </form>
          <ActivityFilters q={q} who={who} type={type} members={members || []} lang={lang} />
        </div>
      </header>

      <div className="ax-layout">
        <div className="ax-main">
          <nav className="dx-tabs ax-tabs" aria-label={t("act_kinds_h", lang)}>
            {TYPES.map((ty) => (
              <Link key={ty} href={href({ type: ty })} className={type === ty ? "on" : ""} aria-current={type === ty ? "page" : undefined}>
                {t(TYPE_LABEL[ty], lang)}
              </Link>
            ))}
          </nav>

          {pageRows.length === 0 ? (
            <section className="dx-card">
              <div className="dx-empty">
                <span className="dx-empty-ic" aria-hidden="true"><Settings2 size={20} /></span>
                <b>{filtered ? t("act_nomatch", lang) : t("act_empty", lang)}</b>
                {!filtered && <span>{t("act_empty_sub", lang)}</span>}
                {filtered && <Link className="dx-btn" href="/activity">{t("act_clear_filters", lang)}</Link>}
              </div>
            </section>
          ) : (
            <>
              {groups.map((g) => (
                <section key={g.d} className="ax-day" aria-label={g.d}>
                  <h2 className="ax-day-h">{g.d}<span>{g.rows.length}</span></h2>
                  <ol className="dx-card ax-list">
                    {g.rows.map((r) => {
                      const k = KIND[r.kind] || KIND.quote;
                      const inner = (
                        <>
                          <span className={"ax-ic c-" + k.c} aria-hidden="true"><k.Icon size={17} strokeWidth={2} /></span>
                          <span className="ax-body">
                            <span className="ax-text" dangerouslySetInnerHTML={{ __html: activityHtml(r, lang) }} />
                            <span className="ax-meta">
                              {r.actor_name
                                ? <span className="ax-who"><i aria-hidden="true">{initials(r.actor_name)}</i>{r.actor_name}</span>
                                : <span className="ax-who auto">{t("act_auto", lang)}</span>}
                              <span className="ax-kind">{t(TYPE_LABEL[k.type], lang)}</span>
                            </span>
                          </span>
                          <time className="ax-time" dateTime={r.created_at}>{fmtTime(r.created_at, locale)}</time>
                          {r.link ? <ChevronRight className="ax-go" size={16} aria-hidden="true" /> : null}
                        </>
                      );
                      return (
                        <li key={r.id} className={"ax-row" + (r.kind === "sys" ? " is-sys" : "")}>
                          {r.link ? <Link href={r.link} className="ax-in">{inner}</Link> : <div className="ax-in">{inner}</div>}
                        </li>
                      );
                    })}
                  </ol>
                </section>
              ))}

              {pages > 1 && (
                <nav className="ax-pager" aria-label={t("act_range", lang, { a: start + 1, b: Math.min(start + PAGE, total), n: total })}>
                  {p > 1
                    ? <Link className="dx-btn" href={href({ page: p - 1 })}><ChevronLeft size={15} aria-hidden="true" />{t("act_newer", lang)}</Link>
                    : <span className="dx-btn is-off" aria-disabled="true"><ChevronLeft size={15} aria-hidden="true" />{t("act_newer", lang)}</span>}
                  <span className="ax-range">{t("act_range", lang, { a: start + 1, b: Math.min(start + PAGE, total), n: total })}</span>
                  {p < pages
                    ? <Link className="dx-btn" href={href({ page: p + 1 })}>{t("act_older", lang)}<ChevronRight size={15} aria-hidden="true" /></Link>
                    : <span className="dx-btn is-off" aria-disabled="true">{t("act_older", lang)}<ChevronRight size={15} aria-hidden="true" /></span>}
                </nav>
              )}
            </>
          )}
        </div>

        <aside className="ax-side">
          <section className="dx-card">
            <div className="dx-card-head"><div><h2>{t("act_people_h", lang)}</h2><p>{t("act_people_p", lang)}</p></div></div>
            {people.length ? (
              <ul className="ax-people">
                {people.map((pp) => (
                  <li key={pp.id}>
                    <Link href={href({ who: who === pp.id ? "all" : pp.id })} className={who === pp.id ? "on" : ""} aria-current={who === pp.id ? "true" : undefined}>
                      <i aria-hidden="true">{initials(pp.name || "?")}</i>
                      <span>{pp.name || "?"}</span>
                      <b>{pp.n}</b>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : <p className="dx-muted-note">{t("act_summary_quiet", lang)}</p>}
          </section>

          <section className="dx-card">
            <div className="dx-card-head"><div><h2>{t("act_kinds_h", lang)}</h2><p>{t("act_kinds_p", lang)}</p></div></div>
            <ul className="ax-kinds">
              {["quote", "proposal", "bank", "lead", "won", "sys"].map((ty) => (
                <li key={ty}>
                  <Link href={href({ type: type === ty ? "all" : ty })} className={type === ty ? "on" : ""}>
                    <span className="ax-kinds-l">{t(TYPE_LABEL[ty], lang)}</span>
                    <span className="ax-kinds-bar"><i className={"c-" + TYPE_COLOR[ty]} style={{ width: `${Math.round((byType[ty] / typeMax) * 100)}%` }} /></span>
                    <b>{byType[ty]}</b>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        </aside>
      </div>
    </div>
  );
}
