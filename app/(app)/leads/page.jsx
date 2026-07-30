// app/(app)/leads/page.jsx — the Leads / Inbox tab. Incoming leads from the
// website widget (and proposals/manual) land here to be worked: triage by status,
// then one-click "Create quote" turns a lead into a pre-filled project.
import { supabaseServer } from "../../../lib/supabase.js";
import { currentCompany } from "../../../lib/session.js";
import { t, normLang } from "../../../lib/i18n.js";
import LeadCard from "./LeadCard.jsx";

export const dynamic = "force-dynamic";
export const metadata = { title: "Leads — VoltMira" };

const STATUSES = ["new", "contacted", "converted", "archived"];

export default async function LeadsPage({ searchParams }) {
  const sb = supabaseServer();
  const co = await currentCompany();
  const lang = normLang(co?.lang);
  const filter = STATUSES.includes(searchParams?.status) ? searchParams.status : "all";

  const { data: allLeads } = await sb.from("leads").select("*").order("created_at", { ascending: false });
  const leads = (allLeads || []).map(l => ({ ...l, status: l.status || "new" }));

  const counts = leads.reduce((m, l) => (m[l.status] = (m[l.status] || 0) + 1, m), {});
  const shown = filter === "all" ? leads.filter(l => l.status !== "archived") : leads.filter(l => l.status === filter);

  const chip = (key, label, n) => {
    const active = filter === key;
    const href = key === "all" ? "/leads" : `/leads?status=${key}`;
    return (
      <a key={key} href={href} className={active ? "fchip active" : "fchip"}>
        {label}{typeof n === "number" ? <span style={{ opacity: .6, marginLeft: 5 }}>{n}</span> : null}
      </a>
    );
  };

  return (
    <>
      <div className="page-head">
        <h1>{t("nav_leads", lang)}</h1>
        <span className="spacer" />
        <span style={{ color: "var(--muted)", fontSize: 13.5 }}>
          {t("lead_count", lang, { n: leads.filter(l => l.status === "new").length })}
        </span>
      </div>

      <div className="filters" style={{ marginBottom: 18 }}>
        {chip("all", t("lead_all", lang))}
        {chip("new", t("lead_new", lang), counts.new || 0)}
        {chip("contacted", t("lead_contacted", lang), counts.contacted || 0)}
        {chip("converted", t("lead_converted", lang), counts.converted || 0)}
        {chip("archived", t("lead_archived", lang), counts.archived || 0)}
      </div>

      {shown.length === 0 ? (
        <div className="empty" style={{ maxWidth: 460, margin: "48px auto", textAlign: "center" }}>
          <div style={{ fontSize: 34, marginBottom: 10 }} aria-hidden="true">📨</div>
          <b style={{ display: "block", fontSize: 17, marginBottom: 6 }}>{t("lead_empty", lang)}</b>
          <span style={{ color: "var(--muted)", fontSize: 14, lineHeight: 1.6 }}>{t("lead_empty_sub", lang)}</span>
        </div>
      ) : (
        <div style={{ display: "grid", gap: 12 }}>
          {shown.map(l => <LeadCard key={l.id} lead={l} lang={lang} />)}
        </div>
      )}
    </>
  );
}
