"use client";
// app/(app)/leads/LeadCard.jsx — one lead row for the Leads/Inbox tab.
//
// The summary is always visible; hitting Edit expands an editor DRAWER beneath
// it rather than swapping the whole card out. The drawer animates open with a
// grid-template-rows transition (see .lead-editor in AppTheme), so there is no
// instant, jarring flip — the fields slide in and the card grows to fit.
//
// Two origin signals, deliberately distinct:
//   • source  — where the lead technically reached us (website form / quote
//               request / added manually). The app records it; it is read-only
//               and shown as a badge, because "where did this come from" is the
//               first thing you want to know about an unfamiliar lead.
//   • channel — the MARKETING channel the installer assigns for attribution.
//               Editable, because only they know the ad or post behind it.
import { useState, useRef, useEffect, useTransition } from "react";
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

// The technical origin, with a small glyph. Anything unexpected falls back to
// "manual", which is also what a hand-typed lead is.
const SOURCE_ICON = {
  widget: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3a15 15 0 0 1 0 18M12 3a15 15 0 0 0 0 18" />
    </svg>
  ),
  proposal: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M5 3h9l5 5v13H5z" /><path d="M14 3v5h5M8 13h8M8 17h5" />
    </svg>
  ),
  manual: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" />
    </svg>
  ),
};
const SOURCE_KEY = { widget: "lead_src_widget", proposal: "lead_src_proposal", manual: "lead_src_manual" };

function ago(iso, lang) {
  const d = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
  return d <= 0 ? t("lead_ago_today", lang) : t("lead_ago_days", lang, { n: d });
}

export default function LeadCard({ lead, lang }) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(lead.name || "");
  const [phone, setPhone] = useState(lead.phone || "");
  const [email, setEmail] = useState(lead.email || "");
  const [note, setNote] = useState(lead.note || "");
  const [pending, start] = useTransition();
  const nameRef = useRef(null);

  const status = lead.status || "new";
  const ss = STATUS_STYLE[status] || STATUS_STYLE.new;
  const ch = leadChannel(lead);
  const src = SOURCE_ICON[lead.source] ? lead.source : "manual";
  const setChannel = (v) => start(() => setLeadChannel(lead.id, v));

  // Focus the first field once the drawer has opened, not on the same tick the
  // class flips — otherwise the browser scroll-jumps to it mid-animation.
  useEffect(() => {
    if (!editing) return;
    const id = setTimeout(() => nameRef.current?.focus(), 120);
    return () => clearTimeout(id);
  }, [editing]);

  function open() {
    setName(lead.name || ""); setPhone(lead.phone || "");
    setEmail(lead.email || ""); setNote(lead.note || "");
    setEditing(true);
  }
  function save() {
    start(() => updateLead(lead.id, { name, phone, email, note }).then(() => setEditing(false)));
  }
  function cancel() { setEditing(false); }

  return (
    <div className={`lead-card${editing ? " editing" : ""}`}>
      <div className="lead-top">
        <div className="lead-main">
          <div className="lead-name-row">
            <span className="lead-name">{lead.name || "—"}</span>
            {lead.hot && <span className="lead-hot" title={t("lead_hot", lang)} aria-label={t("lead_hot", lang)} />}
            <span className="lead-status" style={{ background: ss.bg, color: ss.fg }}>{t("lead_" + status, lang)}</span>
          </div>

          <div className="lead-meta">
            <span className="lead-src" title={t("lead_source", lang)}>
              {SOURCE_ICON[src]}{t(SOURCE_KEY[src], lang)}
            </span>
            <span className="lead-chan" title={t("lead_set_channel", lang)}>
              <span className="lead-chan-dot" aria-hidden="true"
                style={{ background: CHANNEL_DOT[ch], boxShadow: `0 0 0 3px ${CHANNEL_DOT[ch]}22` }} />
              <select value={ch} disabled={pending} aria-label={t("lead_channel", lang)}
                onChange={e => setChannel(e.target.value)}>
                {CHANNEL_ORDER.map(k => <option key={k} value={k}>{t("lead_ch_" + k, lang)}</option>)}
              </select>
              <span className="caret" aria-hidden="true">▾</span>
            </span>
          </div>

          <div className="lead-contact">
            {lead.email ? <a href={`mailto:${lead.email}`}>{lead.email}</a> : null}
            {lead.phone ? <a href={`tel:${lead.phone}`}>{lead.phone}</a> : null}
            {!lead.email && !lead.phone ? <span className="none">{t("lead_no_contact", lang)}</span> : null}
          </div>

          {lead.note ? <div className="lead-note">{lead.note}</div> : null}
        </div>

        <div className="lead-side">
          <span className="lead-time">{ago(lead.created_at, lang)}</span>
          <LeadActions id={lead.id} status={status} projectId={lead.project_id} lang={lang}
            onEdit={editing ? cancel : open} editing={editing} />
        </div>
      </div>

      {/* Editor drawer — always mounted so it can animate; height is driven by
          the .editing class on the card, not by conditional rendering. */}
      <div className="lead-editor" aria-hidden={!editing}>
        <div className="lead-editor-inner">
          <div className="lead-ed-fields" role="group" aria-label={t("lead_edit_title", lang)}>
            <input ref={nameRef} className="lead-ed-input" style={{ flex: "2 1 160px" }} value={name} maxLength={120}
              placeholder={t("lead_field_name", lang)} aria-label={t("lead_field_name", lang)}
              tabIndex={editing ? 0 : -1}
              onChange={e => setName(e.target.value)} onKeyDown={e => e.key === "Enter" && save()} />
            <input className="lead-ed-input" style={{ flex: "1 1 130px" }} value={phone} maxLength={40}
              placeholder={t("lead_field_phone", lang)} aria-label={t("lead_field_phone", lang)}
              tabIndex={editing ? 0 : -1}
              onChange={e => setPhone(e.target.value)} onKeyDown={e => e.key === "Enter" && save()} />
            <input className="lead-ed-input" style={{ flex: "1 1 150px" }} value={email} maxLength={160} type="email"
              placeholder={t("lead_field_email", lang)} aria-label={t("lead_field_email", lang)}
              tabIndex={editing ? 0 : -1}
              onChange={e => setEmail(e.target.value)} onKeyDown={e => e.key === "Enter" && save()} />
            <input className="lead-ed-input" style={{ flex: "1 1 100%" }} value={note} maxLength={500}
              placeholder={t("lead_field_note", lang)} aria-label={t("lead_field_note", lang)}
              tabIndex={editing ? 0 : -1}
              onChange={e => setNote(e.target.value)} onKeyDown={e => e.key === "Enter" && save()} />
            <div className="lead-ed-actions">
              <button className="btn ghost sm" disabled={pending} onClick={cancel} tabIndex={editing ? 0 : -1}>{t("lead_cancel", lang)}</button>
              <button className="btn primary sm" disabled={pending} onClick={save} tabIndex={editing ? 0 : -1}>{t("lead_save", lang)}</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
