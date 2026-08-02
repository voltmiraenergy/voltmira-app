"use client";
// app/(app)/leads/LeadCard.jsx — one lead row. Displays the contact + status, and
// flips to an inline editor (name / phone / email) when you hit Edit — no pop-ups.
import { useState, useTransition } from "react";
import { updateLead, setLeadChannel } from "../../../lib/actions.js";
import { t } from "../../../lib/i18n.js";
import { CHANNEL_ORDER, CHANNEL_DOT, leadChannel } from "../../../lib/leadChannels.js";
import LeadActions from "./LeadActions.jsx";

const STATUS_STYLE = {
  new:       { bg: "var(--green-tint,#E4EFE9)", fg: "var(--green,#1E6B4E)" },
  contacted: { bg: "var(--amber-tint,#FBF0DD)", fg: "var(--amber-deep,#C97F14)" },
  converted: { bg: "#E7EFF6", fg: "#2C5B84" },
  archived:  { bg: "var(--line,#eee)", fg: "var(--muted,#66756C)" },
};

function ago(iso, lang) {
  const d = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
  return d <= 0 ? t("lead_ago_today", lang) : t("lead_ago_days", lang, { n: d });
}

export default function LeadCard({ lead, lang }) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(lead.name || "");
  const [phone, setPhone] = useState(lead.phone || "");
  const [email, setEmail] = useState(lead.email || "");
  const [pending, start] = useTransition();

  const status = lead.status || "new";
  const ss = STATUS_STYLE[status] || STATUS_STYLE.new;
  const ch = leadChannel(lead);
  const setChannel = (v) => start(() => setLeadChannel(lead.id, v));

  function open() { setName(lead.name || ""); setPhone(lead.phone || ""); setEmail(lead.email || ""); setEditing(true); }
  function save() { start(() => updateLead(lead.id, { name, phone, email }).then(() => setEditing(false))); }

  const fieldLabel = { fontSize: 10.5, fontFamily: "var(--font-m,monospace)", textTransform: "uppercase",
    letterSpacing: ".06em", color: "var(--muted)" };
  const input = { width: "100%", marginTop: 3, padding: "8px 11px", border: "1.5px solid var(--line)",
    borderRadius: 9, fontSize: 14, fontFamily: "inherit", color: "var(--ink)", background: "var(--paper-2)" };

  return (
    <div className="card" style={{ padding: "16px 18px" }}>
      {editing ? (
        <div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <label style={{ gridColumn: "1 / -1" }}>
              <span style={fieldLabel}>{t("lead_field_name", lang)}</span>
              <input autoFocus style={input} value={name} maxLength={120} onChange={e => setName(e.target.value)} />
            </label>
            <label>
              <span style={fieldLabel}>{t("lead_field_phone", lang)}</span>
              <input style={input} value={phone} maxLength={40} onChange={e => setPhone(e.target.value)}
                onKeyDown={e => e.key === "Enter" && save()} />
            </label>
            <label>
              <span style={fieldLabel}>{t("lead_field_email", lang)}</span>
              <input style={input} value={email} maxLength={160} type="email" onChange={e => setEmail(e.target.value)}
                onKeyDown={e => e.key === "Enter" && save()} />
            </label>
          </div>
          <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
            <button className="btn primary" disabled={pending} onClick={save}>{t("lead_save", lang)}</button>
            <button className="btn ghost" disabled={pending} onClick={() => setEditing(false)}>{t("lead_cancel", lang)}</button>
          </div>
        </div>
      ) : (
        <div style={{ display: "flex", alignItems: "flex-start", gap: 12, flexWrap: "wrap" }}>
          <div style={{ flex: "1 1 240px", minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 9, flexWrap: "wrap" }}>
              <b style={{ fontSize: 16 }}>{lead.name || "—"}</b>
              {lead.hot && <span title={t("lead_hot", lang)} aria-label={t("lead_hot", lang)}>🔥</span>}
              <span title={t("lead_set_channel", lang)}
                style={{ display: "inline-flex", alignItems: "center", gap: 7, border: "1px solid var(--line)",
                  borderRadius: 99, padding: "3px 9px 3px 10px", background: "var(--paper-2)", position: "relative" }}>
                <span aria-hidden="true" style={{ width: 8, height: 8, borderRadius: "50%", flex: "none",
                  background: CHANNEL_DOT[ch], boxShadow: `0 0 0 3px ${CHANNEL_DOT[ch]}22` }} />
                <select value={ch} disabled={pending} onChange={e => setChannel(e.target.value)}
                  aria-label={t("lead_channel", lang)}
                  style={{ appearance: "none", WebkitAppearance: "none", MozAppearance: "none", border: "none",
                    background: "transparent", color: "var(--ink)", fontSize: 12, fontWeight: 600, cursor: "pointer",
                    fontFamily: "inherit", paddingRight: 13, outline: "none" }}>
                  {CHANNEL_ORDER.map(k => <option key={k} value={k}>{t("lead_ch_" + k, lang)}</option>)}
                </select>
                <span aria-hidden="true" style={{ position: "absolute", right: 9, fontSize: 9, color: "var(--muted)", pointerEvents: "none" }}>▾</span>
              </span>
              <span style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: ".05em",
                background: ss.bg, color: ss.fg, borderRadius: 99, padding: "3px 9px" }}>
                {t("lead_" + status, lang)}
              </span>
              <button onClick={open} title={t("lead_edit", lang)} aria-label={t("lead_edit", lang)}
                style={{ marginLeft: "auto", border: "1px solid var(--line)", background: "var(--paper-2)",
                  borderRadius: 8, padding: "4px 10px", fontSize: 12.5, cursor: "pointer", color: "var(--muted)" }}>
                ✏️ {t("lead_edit", lang)}
              </button>
            </div>
            <div style={{ marginTop: 6, fontSize: 13.5, color: "var(--ink-soft,#2B4438)", display: "flex", gap: 14, flexWrap: "wrap" }}>
              {lead.email ? <a href={`mailto:${lead.email}`} style={{ color: "var(--green)" }}>{lead.email}</a> : null}
              {lead.phone ? <a href={`tel:${lead.phone}`} style={{ color: "var(--green)" }}>{lead.phone}</a> : null}
              {!lead.email && !lead.phone ? <span style={{ color: "var(--muted)" }}>{t("lead_no_contact", lang)}</span> : null}
            </div>
            {lead.note ? <div style={{ marginTop: 7, fontSize: 13, color: "var(--muted)", lineHeight: 1.5 }}>{lead.note}</div> : null}
          </div>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 10 }}>
            <span style={{ fontSize: 12, color: "var(--muted)", fontFamily: "var(--font-m,monospace)", whiteSpace: "nowrap" }}>{ago(lead.created_at, lang)}</span>
            <LeadActions id={lead.id} status={status} projectId={lead.project_id} lang={lang} />
          </div>
        </div>
      )}
    </div>
  );
}
