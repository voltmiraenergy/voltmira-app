"use client";
// app/(app)/team/TeamActions.jsx — member list with invite + resend + remove.
// All mutations go through /api/team, which re-checks the caller is the owner.
import { useState } from "react";
import { useRouter } from "next/navigation";
import { t } from "../../../lib/i18n.js";

export default function TeamActions({ lang, meId, me, members, counts = {}, pending = [], stats = {}, currency = "EUR" }) {
  const router = useRouter();
  const isOwner = me?.role === "owner";
  const [openMember, setOpenMember] = useState(null);
  const money = (n) => "€" + Math.round(n || 0).toLocaleString("en-IE");
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [title, setTitle] = useState("sales");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null); // {ok, text}
  const [inviteLink, setInviteLink] = useState(null);
  const [linkCopied, setLinkCopied] = useState(false);
  // Set when the address already belongs to another workspace: holds the facts
  // the owner needs before deciding to move them. {email,name,title,detail}
  const [ask, setAsk] = useState(null);

  const isPending = (id) => pending.includes(id);

  // The link is only half the job — say plainly whether the email actually left.
  function deliveryText(j, addr) {
    if (j.moved) return t("tm_moved", lang, { e: addr });
    if (j.emailed) return t(j.resent ? "tm_resent" : "tm_emailed", lang, { e: addr });
    if (j.emailError && j.emailError !== "not_configured") return t("tm_mail_fail", lang);
    return t("tm_link_ready", lang);
  }

  async function post(body, addr) {
    setMsg(null); setInviteLink(null); setAsk(null); setBusy(true);
    try {
      const res = await fetch("/api/team", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const j = await res.json().catch(() => ({}));
      if (res.ok) {
        setInviteLink(j.inviteLink || null);
        setMsg({ ok: !!j.emailed || !j.emailError || j.emailError === "not_configured",
                 text: deliveryText(j, addr) });
        router.refresh();
        return true;
      }
      // Not a failure — the address already has a workspace, so the owner has a
      // decision to make. Show the numbers instead of a dead-end error.
      if (j.error === "other_team" && j.detail) {
        setAsk({ ...body, detail: j.detail });
        return false;
      }
      const ERR = { seats: "tm_err_seats", already_member: "tm_err_already",
                    other_team: "tm_err_other_team", exists: "tm_err_exists",
                    owner_only: "tm_owner_only" };
      setMsg({ ok: false, text: t(ERR[j.error] || "tm_err", lang) });
      return false;
    } finally { setBusy(false); }
  }

  async function invite(e) {
    e.preventDefault();
    if (busy) return;
    const addr = email;
    if (await post({ email, name, title }, addr)) { setName(""); setEmail(""); }
  }

  async function confirmMove() {
    if (busy || !ask) return;
    const { detail, ...body } = ask;
    if (await post({ ...body, confirm: true }, body.email)) { setName(""); setEmail(""); }
  }

  const resend = (m) => { if (!busy) post({ resend: m.id }, m.email); };

  async function remove(id) {
    if (busy) return;
    setBusy(true);
    try {
      const res = await fetch("/api/team", {
        method: "DELETE", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      if (res.ok) router.refresh();
    } finally { setBusy(false); }
  }

  // Owner always shows "Owner"; other members show their job title (Sales /
  // Engineer / Manager) if set, otherwise the generic "Member".
  const KNOWN = ["sales", "engineer", "manager", "owner"];
  const roleLabel = (m) => m.role === "owner" ? t("role_owner", lang)
    : (m.title && KNOWN.includes(m.title)) ? t("role_" + m.title, lang)
    : m.title ? m.title
    : t("tm_role_member", lang);
  // A distinct dot colour per role so the list is scannable at a glance.
  const ROLE_DOT = { owner: "#E89B2D", manager: "var(--green)", engineer: "#378ADD", sales: "#7F77DD" };
  const roleColor = (m) => m.role === "owner" ? ROLE_DOT.owner : (ROLE_DOT[m.title] || "var(--muted)");
  const projCount = (id) => {
    const n = counts[id] || 0;
    return n === 1 ? t("n_project", lang) : t("n_projects", lang, { n });
  };

  // Relative contribution: each member's share of the team's won value, so the
  // list reads as a leaderboard instead of a flat roster. Falls back to quote
  // count while nobody has closed anything yet, so the bars aren't all empty.
  const teamWon = members.reduce((s, m) => s + (stats[m.id]?.wonEur || 0), 0);
  const teamQuotes = members.reduce((s, m) => s + (counts[m.id] || 0), 0);
  const share = (m) => {
    const s = stats[m.id] || {};
    if (teamWon > 0) return (s.wonEur || 0) / teamWon;
    return teamQuotes > 0 ? (counts[m.id] || 0) / teamQuotes : 0;
  };
  const topId = teamWon > 0
    ? members.reduce((best, m) => ((stats[m.id]?.wonEur || 0) > (stats[best.id]?.wonEur || 0) ? m : best), members[0])?.id
    : null;

  return (
    <div className="team-grid">
      <section className="card">
        <div className="ch-row">
          <h3>{t("members", lang)}</h3>
          <span className="ch-count">{members.length}</span>
        </div>
        {members.map(m => {
          const open = openMember === m.id;
          const s = stats[m.id] || {};
          const stop = (fn) => (e) => { e.stopPropagation(); fn(); };
          const pct = Math.round(share(m) * 100);
          const isTop = m.id === topId && teamWon > 0;
          return (
          <div key={m.id} className={"member-wrap" + (open ? " open" : "")}>
            <div className={`member${open ? " open" : ""}`} role="button" tabIndex={0} aria-expanded={open}
              onClick={() => setOpenMember(open ? null : m.id)}
              onKeyDown={e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setOpenMember(open ? null : m.id); } }}>
              {/* Role-tinted ring turns the avatar into the row's colour key. */}
              <span className="m-av" style={{ "--rc": roleColor(m) }}>
                <span className="m-av-in">{(m.name || m.email || "?").trim()[0]?.toUpperCase() || "?"}</span>
                {isTop && <span className="m-crown" title={t("tm_top", lang)} aria-label={t("tm_top", lang)}>
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M3 18h18l-1.6-9-4.6 3.6L12 5l-2.8 7.6L4.6 9 3 18z" /></svg>
                </span>}
              </span>

              <div className="m-who">
                <div className="m-name">
                  <b>{m.name || m.email}</b>
                  {/* Role sits on the name line rather than in its own right-hand
                      column — that column was stealing ~90px from the name/email
                      block and forcing the row to wrap on a normal-width screen. */}
                  <span className="m-role" style={{ "--rc": roleColor(m) }}>{roleLabel(m)}</span>
                  {m.id === meId && <span className="m-you">{t("tm_you", lang)}</span>}
                  {isPending(m.id) && <span className="m-pending" title={t("tm_pending_title", lang)}>{t("tm_pending", lang)}</span>}
                </div>
                <div className="m-mail">{m.email}</div>
                {/* Always-visible headline metrics — the row should be useful
                    before you expand it. */}
                <div className="m-meta">
                  <span title={projCount(m.id)}>{counts[m.id] || 0} {t("tm_st_quotes", lang).toLowerCase()}</span>
                  <i />
                  <span>{money(s.wonEur)} {t("tm_st_won", lang).toLowerCase()}</span>
                  {pct > 0 && <><i /><span className="m-share">{pct}%</span></>}
                </div>
                <div className="m-bar" aria-hidden="true"><span style={{ width: Math.max(pct, pct > 0 ? 3 : 0) + "%", background: roleColor(m) }} /></div>
              </div>

              <span className="m-acts">
                {isOwner && m.id !== meId && isPending(m.id) && (
                  <button className="btn sm" onClick={stop(() => resend(m))} disabled={busy}
                    title={t("tm_resend_title", lang)}>{t("tm_resend", lang)}</button>
                )}
                {isOwner && m.id !== meId && (
                  <button className="btn icon del" onClick={stop(() => remove(m.id))} disabled={busy} title={t("tm_remove", lang)} aria-label={t("tm_remove", lang)}>
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 7h16" /><path d="M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" /><path d="M6 7l1 13a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-13" /></svg>
                  </button>
                )}
                <svg className="m-chev" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"
                  style={{ transform: open ? "rotate(180deg)" : "none" }}><path d="M6 9l6 6 6-6" /></svg>
              </span>
            </div>
            {open && (
              <div className="member-detail">
                <div className="md-stats">
                  <div className="md-stat"><b>{s.total || 0}</b><span>{t("tm_st_quotes", lang)}</span></div>
                  <div className="md-stat"><b>{s.won || 0}</b><span>{t("tm_st_won", lang)}</span></div>
                  <div className="md-stat"><b className={s.winRate != null && s.winRate >= 50 ? "good" : ""}>{s.winRate != null ? s.winRate + "%" : "—"}</b><span>{t("tm_st_winrate", lang)}</span></div>
                  <div className="md-stat"><b>{money(s.pipelineEur)}</b><span>{t("tm_st_pipeline", lang)}</span></div>
                  <div className="md-stat"><b className="good">{money(s.wonEur)}</b><span>{t("tm_st_wonval", lang)}</span></div>
                </div>
              </div>
            )}
          </div>
        ); })}
        <div className="seat-note"><b>{t("seats_used", lang, { n: members.length })}</b> · {t("team_plan_note", lang)}</div>
      </section>

      {isOwner ? (
        <section className="card invite-card">
          <div className="ch-row">
            <h3>{t("add_member", lang)}</h3>
          </div>
          <p className="invite-sub">{t("tm_invite_sub", lang)}</p>
          <form onSubmit={invite}>
            <div className="field">
              <label htmlFor="tmName">{t("name", lang)}</label>
              <input className="input" id="tmName" value={name}
                placeholder={t("ph_fullname", lang)} onChange={e => setName(e.target.value)} />
            </div>
            <div className="field">
              {/* Three fixed options read better as a segmented control than a
                  dropdown — the choice and its colour key are visible at once. */}
              <label>{t("role", lang)}</label>
              <div className="role-seg" role="radiogroup" aria-label={t("role", lang)}>
                {["sales", "engineer", "manager"].map(r => (
                  <button key={r} type="button" role="radio" aria-checked={title === r}
                    className={"role-opt" + (title === r ? " on" : "")}
                    style={{ "--rc": ROLE_DOT[r] }} onClick={() => setTitle(r)}>
                    <span className="ro-dot" />{t("role_" + r, lang)}
                  </button>
                ))}
              </div>
            </div>
            <div className="field">
              <label htmlFor="tmMail">{t("email", lang)}</label>
              <input className="input" id="tmMail" type="email" required value={email}
                placeholder={t("ph_company_mail", lang)} onChange={e => setEmail(e.target.value)} />
            </div>
            <button className="btn primary" style={{ width: "100%" }} disabled={busy}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>
              {busy ? t("tm_inviting", lang) : t("add_to_team", lang)}
            </button>
          </form>
          {msg && <p style={{ fontSize: 13, fontWeight: 600, margin: "12px 0 0",
            color: msg.ok ? "var(--green)" : "var(--red)" }}>{msg.text}</p>}

          {ask && (
            <div className="warn-card" style={{ marginTop: 14 }}>
              <b style={{ display: "block", marginBottom: 5 }}>{t("tm_move_title", lang)}</b>
              <p style={{ margin: "0 0 4px", lineHeight: 1.55 }}>
                {t("tm_move_body", lang, { e: ask.email, co: ask.detail.company,
                   q: ask.detail.quotes, l: ask.detail.leads })}
              </p>
              {ask.detail.lastMember && (
                <p style={{ margin: "0 0 4px", lineHeight: 1.55, fontWeight: 700 }}>
                  {t("tm_move_last", lang, { co: ask.detail.company })}
                </p>
              )}
              <div style={{ display: "flex", gap: 8, marginTop: 11, flexWrap: "wrap" }}>
                <button type="button" className="btn sm primary" disabled={busy} onClick={confirmMove}>
                  {busy ? t("tm_inviting", lang) : t("tm_move_yes", lang)}
                </button>
                <button type="button" className="btn sm" disabled={busy} onClick={() => setAsk(null)}>
                  {t("lead_cancel", lang)}
                </button>
              </div>
            </div>
          )}
          {inviteLink && (
            <div style={{ marginTop: 12 }}>
              <div className="link-row">
                <code>{inviteLink}</code>
                <button type="button" className="btn sm amber" onClick={() => {
                  navigator.clipboard?.writeText(inviteLink);
                  setLinkCopied(true); setTimeout(() => setLinkCopied(false), 1800);
                }}>{linkCopied ? t("t_copied", lang) : t("tm_copy_link", lang)}</button>
              </div>
              <a className="btn wapp sm" style={{ width: "100%" }} target="_blank" rel="noopener noreferrer"
                href={`https://wa.me/?text=${encodeURIComponent(t("tm_wa_invite", lang) + " " + inviteLink)}`}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12.04 2c-5.46 0-9.9 4.44-9.9 9.9 0 1.75.46 3.45 1.32 4.95L2 22l5.3-1.38a9.9 9.9 0 0 0 4.73 1.2h.01c5.46 0 9.9-4.44 9.9-9.9 0-2.64-1.03-5.13-2.9-7A9.82 9.82 0 0 0 12.04 2Zm5.52 12.22c-.25.7-1.44 1.33-2.02 1.42-.51.08-1.16.11-1.87-.12-.43-.14-.98-.32-1.69-.62-2.98-1.29-4.93-4.29-5.08-4.49-.15-.2-1.21-1.61-1.21-3.07 0-1.46.77-2.18 1.04-2.48.27-.3.6-.37.8-.37h.57c.18 0 .43-.07.67.51.25.6.84 2.06.91 2.21.07.15.12.32.02.51-.28.56-.58.53-.16 1.25.6 1.03 1.34 1.7 2.22 2.48.31.28.64.24.88-.02.19-.2.85-.99 1.15-1.33.2-.24.4-.2.67-.1.27.09 1.73.82 2.03.97.3.15.5.22.57.35.07.12.07.71-.18 1.41Z" /></svg>
                {t("tm_wa_send", lang)}
              </a>
            </div>
          )}
        </section>
      ) : (
        <section className="card invite-card">
          <div className="owner-only">
            <span className="oo-ic">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="5" y="11" width="14" height="9" rx="2" /><path d="M8 11V7a4 4 0 0 1 8 0v4" /></svg>
            </span>
            <p>{t("tm_owner_only", lang)}</p>
          </div>
        </section>
      )}
    </div>
  );
}
