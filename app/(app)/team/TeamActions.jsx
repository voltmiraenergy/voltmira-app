"use client";
// app/(app)/team/TeamActions.jsx — member list with invite + remove.
// All mutations go through /api/team, which re-checks the caller is the owner.
import { useState } from "react";
import { useRouter } from "next/navigation";
import { t } from "../../../lib/i18n.js";

export default function TeamActions({ lang, meId, me, members, counts = {} }) {
  const router = useRouter();
  const isOwner = me?.role === "owner";
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [title, setTitle] = useState("sales");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null); // {ok, text}
  const [inviteLink, setInviteLink] = useState(null);
  const [linkCopied, setLinkCopied] = useState(false);

  async function invite(e) {
    e.preventDefault();
    if (busy) return;
    setMsg(null); setInviteLink(null); setBusy(true);
    try {
      const res = await fetch("/api/team", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, name, title }),
      });
      const j = await res.json().catch(() => ({}));
      if (res.ok) {
        setInviteLink(j.inviteLink || null);
        setMsg({ ok: true, text: j.emailed ? t("tm_emailed", lang, { e: email }) : t("tm_link_ready", lang) });
        setName(""); router.refresh();
      }
      else if (j.error === "seats") setMsg({ ok: false, text: t("tm_err_seats", lang) });
      else if (j.error === "exists") setMsg({ ok: false, text: t("tm_err_exists", lang) });
      else setMsg({ ok: false, text: t("tm_err", lang) });
    } finally { setBusy(false); }
  }

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

  return (
    <div className="grid-2">
      <section className="card">
        <h3>{t("members", lang)}</h3>
        {members.map(m => (
          <div key={m.id} className="member">
            <div className="avatar green">{(m.name || m.email || "?").trim()[0]?.toUpperCase() || "?"}</div>
            <div className="m-who">
              <b>{m.name || m.email}{m.id === meId && <span style={{ color: "var(--muted)", fontWeight: 400 }}> · {t("tm_you", lang)}</span>}</b>
              <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{m.email}</span>
            </div>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, color: "var(--muted)", whiteSpace: "nowrap" }}>
              <span aria-hidden="true" style={{ width: 7, height: 7, borderRadius: "50%", flex: "none", background: roleColor(m) }} />
              {roleLabel(m)}
            </span>
            <span className="m-count" title={projCount(m.id)} style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M14 3v4a1 1 0 0 0 1 1h4" /><path d="M17 21H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h7l5 5v11a2 2 0 0 1-2 2z" /><path d="M9 13h6M9 17h4" /></svg>
              {counts[m.id] || 0}
            </span>
            {isOwner && m.id !== meId && (
              <button className="btn icon del" onClick={() => remove(m.id)} disabled={busy} title={t("tm_remove", lang)} aria-label={t("tm_remove", lang)}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 7h16" /><path d="M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" /><path d="M6 7l1 13a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-13" /></svg>
              </button>
            )}
          </div>
        ))}
        <div className="seat-note"><b>{t("seats_used", lang, { n: members.length })}</b> · {t("team_plan_note", lang)}</div>
      </section>

      {isOwner ? (
        <section className="card">
          <h3>{t("add_member", lang)}</h3>
          <p style={{ color: "var(--muted)", fontSize: 13, marginTop: 0, marginBottom: 14 }}>{t("tm_invite_sub", lang)}</p>
          <form onSubmit={invite}>
            <div className="field">
              <label htmlFor="tmName">{t("name", lang)}</label>
              <input className="input" id="tmName" value={name}
                placeholder={t("ph_fullname", lang)} onChange={e => setName(e.target.value)} />
            </div>
            <div className="field">
              <label htmlFor="tmRole">{t("role", lang)}</label>
              <select className="input" id="tmRole" value={title} onChange={e => setTitle(e.target.value)}>
                <option value="sales">{t("role_sales", lang)}</option>
                <option value="engineer">{t("role_engineer", lang)}</option>
                <option value="manager">{t("role_manager", lang)}</option>
              </select>
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
        <section className="card"><p style={{ color: "var(--muted)", fontSize: 13, margin: 0 }}>{t("tm_owner_only", lang)}</p></section>
      )}
    </div>
  );
}
