// app/(app)/leads/page.jsx — the Leads / Inbox tab. Incoming leads from the
// website widget (and proposals/manual) land here to be worked: triage by status,
// then one-click "Create quote" turns a lead into a pre-filled project.
//
// The header says how long the oldest unanswered lead has waited, because the
// first reply is what wins a roof. "All" groups the list by where each lead
// stands (new first), and "Add lead" logs the phone calls the widget never sees.
import "../dx.css";
import "./leads.css";
import Link from "next/link";
import { supabaseServer } from "../../../lib/supabase.js";
import { currentCompany } from "../../../lib/session.js";
import { t, normLang } from "../../../lib/i18n.js";
import { LOCALE } from "../../../lib/relTime.js";
import LeadCard from "./LeadCard.jsx";
import LeadAttribution from "./LeadAttribution.jsx";
import AddLead from "./AddLead.jsx";

export const dynamic = "force-dynamic";
export const metadata = { title: "Leads · VoltMira" };

const STATUSES = ["new", "contacted", "converted", "archived"];

export default async function LeadsPage({ searchParams }) {
  const sb = supabaseServer();
  const co = await currentCompany();
  const lang = normLang(co?.lang);
  const locale = LOCALE[lang] || "en-GB";
  const filter = STATUSES.includes(searchParams?.status) ? searchParams.status : "all";
  const q = (searchParams?.q || "").trim().slice(0, 80);

  const { data: allLeads } = await sb.from("leads").select("*").order("created_at", { ascending: false });
  const leads = (allLeads || []).map(l => ({ ...l, status: l.status || "new" }));

  const counts = leads.reduce((m, l) => (m[l.status] = (m[l.status] || 0) + 1, m), {});
  let shown = filter === "all" ? leads.filter(l => l.status !== "archived") : leads.filter(l => l.status === filter);
  if (q) {
    const qq = q.toLowerCase();
    shown = shown.filter((l) => [l.name, l.phone, l.email, l.note, l.address].some((v) => String(v || "").toLowerCase().includes(qq)));
  }

  // How long the oldest new lead has gone without a reply.
  const newLeads = leads.filter((l) => l.status === "new");
  const oldest = newLeads.reduce((o, l) => (!o || new Date(l.created_at) < new Date(o.created_at) ? l : o), null);
  let waited = "";
  if (oldest) {
    const h = Math.max(0, (Date.now() - new Date(oldest.created_at).getTime()) / 36e5);
    const [n, unit] = h < 24 ? [Math.max(1, Math.round(h)), "hour"] : [Math.floor(h / 24), "day"];
    waited = new Intl.NumberFormat(locale, { style: "unit", unit, unitDisplay: "long" }).format(n);
  }

  const href = (o = {}) => {
    const s = { status: filter, q, ...o };
    const parts = [];
    if (s.status && s.status !== "all") parts.push("status=" + s.status);
    if (s.q) parts.push("q=" + encodeURIComponent(s.q));
    return "/leads" + (parts.length ? "?" + parts.join("&") : "");
  };
  const tabs = [["all", t("lead_all", lang), leads.length - (counts.archived || 0)], ...STATUSES.map((s) => [s, t("lead_" + s, lang), counts[s] || 0])];

  // "All" reads as a triage queue: new, then contacted, then converted.
  const groups = filter === "all"
    ? ["new", "contacted", "converted"].map((s) => ({ s, items: shown.filter((l) => l.status === s) })).filter((g) => g.items.length)
    : [{ s: filter, items: shown }];

  return (
    <div className="dx lx">
      <header className="dx-head">
        <div className="dx-hello">
          <h1>{t("nav_leads", lang)}</h1>
          <p className="dx-summary">
            {newLeads.length
              ? t("lead_summary_new", lang, { n: newLeads.length, dur: waited })
              : t("lead_summary_clear", lang)}
          </p>
        </div>
        <div className="dx-head-tools">
          <form action="/leads" className="dx-find ld-search" role="search">
            {filter !== "all" && <input type="hidden" name="status" value={filter} />}
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m21 21-4.34-4.34" /><circle cx="11" cy="11" r="8" /></svg>
            <input name="q" defaultValue={q} placeholder={t("lead_search", lang)} aria-label={t("lead_search", lang)} />
          </form>
          <AddLead lang={lang} />
        </div>
      </header>

      <div className="ld-layout">
        <div className="ld-main-col">
          <nav className="dx-tabs ld-tabs" aria-label={t("col_status", lang)}>
            {tabs.map(([k, label, n]) => (
              <Link key={k} href={href({ status: k })} className={"ld-tab t-" + k + (filter === k ? " on" : "")} aria-current={filter === k ? "page" : undefined}>
                {k !== "all" && <i aria-hidden="true" />}{label}<span>{n}</span>
              </Link>
            ))}
          </nav>

          {shown.length === 0 ? (
            <section className="dx-card">
              <div className="dx-empty">
                <span className="dx-empty-ic" aria-hidden="true">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m22 7-8.991 5.727a2 2 0 0 1-2.009 0L2 7" /><rect x="2" y="4" width="20" height="16" rx="2" /></svg>
                </span>
                <b>{q ? t("empty_nomatch_t", lang) : t("lead_empty", lang)}</b>
                <span>{q ? t("q_nomatch_s", lang) : t("lead_empty_sub", lang)}</span>
                {q && <Link className="dx-btn" href={href({ q: "" })}>{t("q_view_clear", lang)}</Link>}
              </div>
            </section>
          ) : (
            groups.map((g) => (
              <section key={g.s} className="ld-group" aria-label={t("lead_" + g.s, lang)}>
                {filter === "all" && (
                  <h2 className={"ld-group-h t-" + g.s}><i aria-hidden="true" />{t("lead_" + g.s, lang)}<span>{g.items.length}</span></h2>
                )}
                <div className="ld-list">
                  {g.items.map(l => <LeadCard key={l.id} lead={l} lang={lang} />)}
                </div>
              </section>
            ))
          )}
        </div>

        <aside className="ld-side-col">
          <LeadAttribution leads={leads} lang={lang} />
        </aside>
      </div>
    </div>
  );
}
