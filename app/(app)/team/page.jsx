// app/(app)/team/page.jsx — Team plan attribute: member list + seats + invites.
// RLS lets any member read teammates; invite/remove happen via /api/team
// (owner-gated server-side — the UI hiding is convenience, not security).
import { supabaseServer, supabaseAdmin } from "../../../lib/supabase.js";
import { currentCompany } from "../../../lib/session.js";
import { t, normLang } from "../../../lib/i18n.js";
import TeamActions from "./TeamActions.jsx";

export const dynamic = "force-dynamic";
export const metadata = { title: "Team — VoltMira" };

export default async function Team() {
  const sb = supabaseServer();
  const [co, { data: { user } }] = await Promise.all([currentCompany(), sb.auth.getUser()]);
  const lang = normLang(co?.lang);
  // Members + project owner counts via the service role, scoped to the caller's
  // own company id — the `profiles` RLS recurses, so a user-session read errors.
  const admin = supabaseAdmin();
  const [{ data: members }, { data: projs }] = co
    ? await Promise.all([
        // select("*") so the optional `title` column is included when present but
        // never errors on a workspace that hasn't run the add-profile-title migration.
        admin.from("profiles").select("*").eq("company_id", co.id).order("created_at"),
        admin.from("projects").select("owner_id").eq("company_id", co.id),
      ])
    : [{ data: [] }, { data: [] }];

  // count projects per owner for the member "N projects" pill
  const counts = {};
  for (const p of projs || []) if (p.owner_id) counts[p.owner_id] = (counts[p.owner_id] || 0) + 1;

  return (
    <div style={{ maxWidth: 900, margin: "0 auto" }}>
      <div className="page-head">
        <h1>{t("team_title", lang)}</h1>
        <span className="sub">{t("team_sub", lang, { co: co?.name || "" })}</span>
      </div>
      <TeamActions lang={lang} meId={user?.id}
        me={(members || []).find(m => m.id === user?.id) || null}
        members={members || []} counts={counts} />
    </div>
  );
}
