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
        admin.from("projects").select("owner_id, status").eq("company_id", co.id),
      ])
    : [{ data: [] }, { data: [] }];

  // count projects per owner for the member quote count
  const counts = {};
  for (const p of projs || []) if (p.owner_id) counts[p.owner_id] = (counts[p.owner_id] || 0) + 1;

  // top-of-page stats: seats (plan-aware cap, matches /api/team), members, and
  // quotes still in play (anything not yet won or lost).
  const memberCount = (members || []).length;
  const seatCap = co?.plan === "enterprise" ? null : 5;   // null = unlimited
  const seatPct = seatCap ? Math.min(100, Math.round((memberCount / seatCap) * 100)) : 100;
  const seatsOpen = seatCap ? Math.max(0, seatCap - memberCount) : 0;
  const staff = Math.max(0, memberCount - (members || []).filter(m => m.role === "owner").length);
  const inPlay = (projs || []).filter(p => p.status !== "won" && p.status !== "lost").length;

  const tile = { background: "var(--paper-2)", border: "1px solid var(--line)", borderRadius: "var(--radius)", padding: "14px 16px", boxShadow: "var(--shadow)" };
  const tLabel = { fontSize: 12, color: "var(--muted)" };
  const tVal = { fontFamily: "var(--font-d)", fontSize: 23, fontWeight: 700, letterSpacing: "-.02em", lineHeight: 1.1, margin: "3px 0 0" };
  const tSub = { fontSize: 11.5, color: "var(--muted)", marginTop: 9 };

  return (
    <div style={{ maxWidth: 900, margin: "0 auto" }}>
      <div className="page-head">
        <h1>{t("team_title", lang)}</h1>
        <span className="sub">{t("team_sub", lang, { co: co?.name || "" })}</span>
      </div>

      <div className="kpis">
        <div style={tile}>
          <div style={tLabel}>{t("team_seats_label", lang)}</div>
          {seatCap ? (
            <>
              <div style={{ ...tVal, margin: "3px 0 9px" }}>{memberCount} <span style={{ fontSize: 14, color: "var(--muted)", fontWeight: 400 }}>/ {seatCap}</span></div>
              <div style={{ height: 6, borderRadius: 99, background: "var(--line)", overflow: "hidden" }}>
                <div style={{ width: seatPct + "%", height: "100%", background: "var(--green)" }} />
              </div>
              <div style={{ ...tSub, marginTop: 7 }}>{t("team_seats_open", lang, { n: seatsOpen })}</div>
            </>
          ) : (
            <>
              <div style={tVal}>{memberCount}</div>
              <div style={tSub}>{t("team_seats_unlimited", lang)}</div>
            </>
          )}
        </div>
        <div style={tile}>
          <div style={tLabel}>{t("members", lang)}</div>
          <div style={tVal}>{memberCount}</div>
          <div style={tSub}>{t("team_members_sub", lang, { n: staff })}</div>
        </div>
        <div style={tile}>
          <div style={tLabel}>{t("team_stat_quotes", lang)}</div>
          <div style={tVal}>{inPlay}</div>
          <div style={tSub}>{t("team_quotes_sub", lang)}</div>
        </div>
      </div>

      <TeamActions lang={lang} meId={user?.id}
        me={(members || []).find(m => m.id === user?.id) || null}
        members={members || []} counts={counts} />
    </div>
  );
}
