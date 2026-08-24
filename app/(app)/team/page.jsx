// app/(app)/team/page.jsx — Team plan attribute: member list + seats + invites.
// RLS lets any member read teammates; invite/remove happen via /api/team
// (owner-gated server-side — the UI hiding is convenience, not security).
import { supabaseServer, supabaseAdmin } from "../../../lib/supabase.js";
import { currentCompany } from "../../../lib/session.js";
import { t, normLang } from "../../../lib/i18n.js";
import { seatCap as planSeatCap, seatsOpen as planSeatsOpen } from "../../../lib/plans.js";
import { quote } from "@voltmira/engine";
import { companyEngine } from "../../../lib/engineSettings.js";
import { rowToQuoteInput } from "../../../lib/quoteInput.js";
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
        admin.from("projects").select("*").eq("company_id", co.id),
      ])
    : [{ data: [] }, { data: [] }];

  // Per-member breakdown: quotes, wins, win rate and the € pipeline they own, so
  // clicking a teammate shows who's actually closing vs whose pipeline is stuck.
  const E = await companyEngine(co);
  const counts = {};
  const stats = {};
  for (const p of projs || []) {
    const o = p.owner_id; if (!o) continue;
    counts[o] = (counts[o] || 0) + 1;
    const s = (stats[o] ||= { total: 0, won: 0, lost: 0, pipelineEur: 0, wonEur: 0 });
    s.total++;
    let gc = 0; try { gc = quote(rowToQuoteInput(p), E).e.grossCost || 0; } catch { gc = 0; }
    if (p.status === "won") { s.won++; s.wonEur += gc; }
    else if (p.status === "lost") s.lost++;
    else if (p.status === "sent") s.pipelineEur += gc;
  }
  for (const o of Object.keys(stats)) {
    const s = stats[o];
    s.winRate = (s.won + s.lost) ? Math.round((s.won / (s.won + s.lost)) * 100) : null;
  }

  // Who has actually accepted? A profile row exists the moment they're invited,
  // so without this the owner can't tell "joined" from "never opened the email".
  // last_sign_in_at is the honest signal, and it only lives on the auth user.
  const pending = [];
  await Promise.all((members || []).map(async (m) => {
    try {
      const { data } = await admin.auth.admin.getUserById(m.id);
      if (data?.user && !data.user.last_sign_in_at) pending.push(m.id);
    } catch { /* auth lookup is a nicety — never break the page over it */ }
  }));

  // top-of-page stats: seats (plan-aware cap, matches /api/team), members, and
  // quotes still in play (anything not yet won or lost).
  const memberCount = (members || []).length;
  // Single source of truth (lib/plans.js), and it matches what /api/team will
  // actually enforce — the meter used to promise five seats on every plan.
  const capRaw = planSeatCap(co?.plan, memberCount);
  const seatCap = capRaw === Infinity ? null : capRaw;    // null = unlimited
  const seatPct = seatCap ? Math.min(100, Math.round((memberCount / seatCap) * 100)) : 100;
  const seatsOpen = planSeatsOpen(co?.plan, memberCount) ?? 0;
  const staff = Math.max(0, memberCount - (members || []).filter(m => m.role === "owner").length);
  const inPlay = (projs || []).filter(p => p.status !== "won" && p.status !== "lost").length;

  // Team-wide money, so the header answers "is this team actually producing?"
  const teamWonEur = Object.values(stats).reduce((s, x) => s + (x.wonEur || 0), 0);
  const fmt = (n) => "€" + Math.round(n || 0).toLocaleString("en-IE");

  return (
    <div style={{ maxWidth: 980, margin: "0 auto" }}>
      <div className="page-head">
        <h1>{t("team_title", lang)}</h1>
        <span className="sub">{t("team_sub", lang, { co: co?.name || "" })}</span>
      </div>

      {/* One measured strip instead of three floating tiles — seats read as
          discrete pips (you can count what's left at a glance), and the money
          column gives the team a scoreboard rather than just a headcount. */}
      <section className="team-hero">
        <div className="th-item">
          <div className="th-lbl">{t("team_seats_label", lang)}</div>
          {seatCap ? (
            <>
              <div className="th-val">{memberCount}<span className="th-of">/ {seatCap}</span></div>
              <div className="seat-pips" aria-hidden="true">
                {Array.from({ length: seatCap }).map((_, i) => (
                  <span key={i} className={"pip" + (i < memberCount ? " on" : "")} />
                ))}
              </div>
              <div className="th-sub">{t("team_seats_open", lang, { n: seatsOpen })}</div>
            </>
          ) : (
            <>
              <div className="th-val">{memberCount}</div>
              <div className="th-sub" style={{ marginTop: 12 }}>{t("team_seats_unlimited", lang)}</div>
            </>
          )}
        </div>

        <div className="th-item">
          <div className="th-lbl">{t("members", lang)}</div>
          <div className="th-val">{memberCount}</div>
          <div className="th-sub">{t("team_members_sub", lang, { n: staff })}</div>
        </div>

        <div className="th-item">
          <div className="th-lbl">{t("team_stat_quotes", lang)}</div>
          <div className="th-val">{inPlay}</div>
          <div className="th-sub">{t("team_quotes_sub", lang)}</div>
        </div>

        <div className="th-item">
          <div className="th-lbl">{t("tm_st_wonval", lang)}</div>
          <div className="th-val th-money">{fmt(teamWonEur)}</div>
          <div className="th-sub">{t("team_won_sub", lang)}</div>
        </div>
      </section>

      <TeamActions lang={lang} meId={user?.id}
        me={(members || []).find(m => m.id === user?.id) || null}
        members={members || []} counts={counts} pending={pending} stats={stats}
        currency={co?.currency || "EUR"} />
    </div>
  );
}
