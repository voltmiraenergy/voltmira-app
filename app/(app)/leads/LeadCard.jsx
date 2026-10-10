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
//
// A new lead also shows how long it has been waiting for a first reply, and
// the contact line is three one-tap ways to reach them: call, WhatsApp, e-mail.
//
// A booked site visit shows under the contact line, with one tap to put it in
// the phone's calendar and one to confirm it to the client on Viber/WhatsApp.
import { useState, useRef, useEffect, useTransition } from "react";
import { updateLead, setLeadChannel } from "../../../lib/actions.js";
import { t } from "../../../lib/i18n.js";
import { CHANNEL_ORDER, CHANNEL_DOT, leadChannel } from "../../../lib/leadChannels.js";
import { relTime, LOCALE } from "../../../lib/relTime.js";
import Avatar from "../../../lib/Avatar.jsx";
import { fmtDate, fmtTime } from "../../../lib/tz.js";
import { visitIcs } from "../../../lib/ics.js";
import LeadActions from "./LeadActions.jsx";

// The technical origin, with a small glyph. Anything unexpected falls back to
// "manual", which is also what a hand-typed lead is.
const SOURCE_ICON = {
  widget: <><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3a15 15 0 0 1 0 18M12 3a15 15 0 0 0 0 18" /></>,
  proposal: <><path d="M5 3h9l5 5v13H5z" /><path d="M14 3v5h5M8 13h8M8 17h5" /></>,
  manual: <><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" /></>,
};
const SOURCE_KEY = { widget: "lead_src_widget", proposal: "lead_src_proposal", manual: "lead_src_manual" };
const I = {
  phone: <path d="M13.832 16.568a1 1 0 0 0 1.213-.303l.355-.465A2 2 0 0 1 17 15h3a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2A18 18 0 0 1 2 4a2 2 0 0 1 2-2h3a2 2 0 0 1 2 2v3a2 2 0 0 1-.8 1.6l-.468.351a1 1 0 0 0-.292 1.233 14 14 0 0 0 6.392 6.384" />,
  chat: <path d="M2.992 16.342a2 2 0 0 1 .094 1.167l-1.065 3.29a1 1 0 0 0 1.236 1.168l3.413-.998a2 2 0 0 1 1.099.092 10 10 0 1 0-4.777-4.719" />,
  mail: <><path d="m22 7-8.991 5.727a2 2 0 0 1-2.009 0L2 7" /><rect x="2" y="4" width="20" height="16" rx="2" /></>,
  pin: <><path d="M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0" /><circle cx="12" cy="10" r="3" /></>,
  clock: <><circle cx="12" cy="12" r="10" /><path d="M12 6v6h4" /></>,
  flame: <path d="M12 3q1 4 4 6.5t3 5.5a1 1 0 0 1-14 0 5 5 0 0 1 1-3 1 1 0 0 0 5 0c0-2-1.5-3-1.5-5q0-2 2.5-4" />,
  cal: <><path d="M8 2v4M16 2v4" /><rect x="3" y="4" width="18" height="18" rx="2" /><path d="M3 10h18" /></>,
};
const Svg = ({ children, size = 14 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{children}</svg>
);

// wa.me needs the full international number, digits only. A local "069…"
// number can't be turned into one without guessing the country, so those get
// the call button only.
function waNumber(phone) {
  const p = String(phone || "").trim();
  const digits = p.replace(/\D/g, "");
  return (p.startsWith("+") || p.startsWith("00")) && digits.length >= 10 ? digits.replace(/^00/, "") : "";
}

// "2 days" / "5 hours" for the waiting badge, in the workspace language.
function waitedFor(iso, locale) {
  const h = Math.max(0, (Date.now() - new Date(iso).getTime()) / 36e5);
  const [n, unit] = h < 1 ? [Math.max(1, Math.round(h * 60)), "minute"] : h < 24 ? [Math.round(h), "hour"] : [Math.floor(h / 24), "day"];
  return { h, text: new Intl.NumberFormat(locale, { style: "unit", unit, unitDisplay: "long" }).format(n) };
}

// ISO instant -> the "YYYY-MM-DDTHH:mm" a datetime-local input shows, in the
// browser's own time zone (the one the installer types in).
function toLocalInput(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

export default function LeadCard({ lead, lang, company = "" }) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(lead.name || "");
  const [phone, setPhone] = useState(lead.phone || "");
  const [email, setEmail] = useState(lead.email || "");
  const [address, setAddress] = useState(lead.address || "");
  const [note, setNote] = useState(lead.note || "");
  const [visit, setVisit] = useState(toLocalInput(lead.visit_at));
  const [pending, start] = useTransition();
  // Relative times are computed after mount so the server and first client
  // render agree (they would drift by the seconds in between).
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);
  const nameRef = useRef(null);
  const visitRef = useRef(null);
  const focusVisit = useRef(false);

  const locale = LOCALE[lang] || "en-GB";
  const status = lead.status || "new";
  const ch = leadChannel(lead);
  const src = SOURCE_ICON[lead.source] ? lead.source : "manual";
  const setChannel = (v) => start(() => setLeadChannel(lead.id, v));
  const wa = waNumber(lead.phone);
  const wait = status === "new" && mounted ? waitedFor(lead.created_at, locale) : null;
  const waitTier = wait ? (wait.h >= 72 ? " bad" : wait.h >= 24 ? " warn" : "") : "";

  // The booked visit, in the app's time zone so it reads the same everywhere.
  const visitWhen = lead.visit_at
    ? fmtDate(lead.visit_at, locale, { weekday: "long", day: "numeric", month: "long" }) + ", " + fmtTime(lead.visit_at, locale)
    : "";
  const visitMsg = lead.visit_at ? t("lead_visit_msg", lang, {
    name: lead.name || "", when: visitWhen, addr: lead.address ? ", " + lead.address : "", company,
  }) : "";
  function addToCalendar() {
    const ics = visitIcs({
      uid: `lead-${lead.id}@voltmira.com`,
      start: lead.visit_at,
      title: t("lead_visit_title", lang, { name: lead.name || "" }),
      location: lead.address || "",
      description: [lead.phone, lead.note].filter(Boolean).join("\n"),
    });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([ics], { type: "text/calendar;charset=utf-8" }));
    a.download = "vizita-" + (lead.name || "client").toLowerCase().replace(/[^a-z0-9ăâîșțа-я]+/gi, "-") + ".ics";
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  }

  // Focus the first field once the drawer has opened, not on the same tick the
  // class flips — otherwise the browser scroll-jumps to it mid-animation.
  useEffect(() => {
    if (!editing) return;
    const id = setTimeout(() => {
      if (focusVisit.current) { focusVisit.current = false; visitRef.current?.focus(); }
      else nameRef.current?.focus();
    }, 120);
    return () => clearTimeout(id);
  }, [editing]);

  function open() {
    setName(lead.name || ""); setPhone(lead.phone || "");
    setEmail(lead.email || ""); setAddress(lead.address || "");
    setNote(lead.note || ""); setVisit(toLocalInput(lead.visit_at));
    setEditing(true);
  }
  function bookVisit() { focusVisit.current = true; open(); }
  function save() {
    const visit_at = visit ? new Date(visit).toISOString() : null;
    start(() => updateLead(lead.id, { name, phone, email, address, note, visit_at }).then(() => setEditing(false)));
  }
  function cancel() { setEditing(false); }

  return (
    <article className={`lead-card ld-card s-${status}${editing ? " editing" : ""}${lead.hot ? " hot" : ""}`}>
      <div className="ld-top">
        <Avatar name={lead.name || "?"} size={40} />
        <div className="ld-main">
          <div className="ld-name-row">
            <h3 className="ld-name">{lead.name || "—"}</h3>
            {lead.hot && <span className="dx-hot ld-hot" title={t("lead_hot", lang)}><Svg size={11}>{I.flame}</Svg>{t("hot", lang)}</span>}
            <span className={"ld-status s-" + status}>{t("lead_" + status, lang)}</span>
            <time className="ld-time" dateTime={lead.created_at} suppressHydrationWarning>{mounted ? relTime(lead.created_at, locale) : ""}</time>
          </div>

          <div className="ld-meta">
            {/* A website-form lead starts on the "website form" channel: the same two words twice in a row is
                noise, so the read-only source badge only shows when it tells something the channel does not. */}
            {!(src === "widget" && ch === "website") && (
              <span className="lead-src" title={t("lead_source", lang)}>
                <Svg size={13}>{SOURCE_ICON[src]}</Svg>{t(SOURCE_KEY[src], lang)}
              </span>
            )}
            <span className="lead-chan" title={t("lead_set_channel", lang)}>
              <span className="lead-chan-dot" aria-hidden="true"
                style={{ background: CHANNEL_DOT[ch], boxShadow: `0 0 0 3px ${CHANNEL_DOT[ch]}22` }} />
              <select value={ch} disabled={pending} aria-label={t("lead_channel", lang)}
                onChange={e => setChannel(e.target.value)}>
                {CHANNEL_ORDER.map(k => <option key={k} value={k}>{t("lead_ch_" + k, lang)}</option>)}
              </select>
              <span className="caret" aria-hidden="true">▾</span>
            </span>
            {wait && <span className={"ld-wait" + waitTier}><Svg size={12}>{I.clock}</Svg>{t("lead_waiting", lang, { dur: wait.text })}</span>}
          </div>
        </div>
      </div>

      <div className="ld-body">
        <div className="ld-contact">
          {lead.phone ? <a className="ld-reach" href={`tel:${lead.phone.replace(/\s+/g, "")}`}><Svg>{I.phone}</Svg>{lead.phone}</a> : null}
          {wa ? <a className="ld-reach wa" href={`https://wa.me/${wa}`} target="_blank" rel="noopener noreferrer"><Svg>{I.chat}</Svg>WhatsApp</a> : null}
          {lead.email ? <a className="ld-reach" href={`mailto:${lead.email}`}><Svg>{I.mail}</Svg>{lead.email}</a> : null}
          {!lead.email && !lead.phone ? <span className="ld-none">{t("lead_no_contact", lang)}</span> : null}
        </div>

        {/* Shown even collapsed: whether a lead HAS an address is exactly
            what decides if "Generate offer" sizes a real system or just
            opens a blank quote — worth seeing without opening Edit. */}
        {lead.address ? <div className="ld-address"><Svg size={13}>{I.pin}</Svg>{lead.address}</div> : null}
        {lead.visit_at ? (
          <div className="ld-visit">
            <span className="ld-visit-when"><Svg size={14}>{I.cal}</Svg><b>{t("lead_visit", lang)}:</b>&nbsp;{visitWhen}</span>
            <span className="ld-visit-acts">
              <button type="button" className="ld-reach" onClick={addToCalendar}>{t("lead_visit_cal", lang)}</button>
              <a className="ld-reach vb" href={`viber://forward?text=${encodeURIComponent(visitMsg)}`} title={t("lead_visit_confirm", lang)}>Viber</a>
              {wa ? <a className="ld-reach wa" href={`https://wa.me/${wa}?text=${encodeURIComponent(visitMsg)}`} target="_blank" rel="noopener noreferrer" title={t("lead_visit_confirm", lang)}>WhatsApp</a> : null}
            </span>
          </div>
        ) : null}
        {lead.note ? <p className="ld-note">{lead.note}</p> : null}
      </div>

      <div className="ld-foot">
        <LeadActions id={lead.id} status={status} projectId={lead.project_id} lang={lang}
          onEdit={editing ? cancel : open} editing={editing}
          onVisit={!lead.visit_at && status !== "converted" && status !== "archived" && !editing ? bookVisit : null} />
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
            {/* Free text, not the geocoding picker used elsewhere (AddressField):
                this just needs to be good enough to feed "Generate offer",
                which geocodes it at that point — a full picker here would be
                one more thing standing between a phone call and a saved lead. */}
            <input className="lead-ed-input" style={{ flex: "1 1 100%" }} value={address} maxLength={200}
              placeholder={t("lead_field_address", lang)} aria-label={t("lead_field_address", lang)}
              tabIndex={editing ? 0 : -1}
              onChange={e => setAddress(e.target.value)} onKeyDown={e => e.key === "Enter" && save()} />
            <input className="lead-ed-input" style={{ flex: "1 1 100%" }} value={note} maxLength={500}
              placeholder={t("lead_field_note", lang)} aria-label={t("lead_field_note", lang)}
              tabIndex={editing ? 0 : -1}
              onChange={e => setNote(e.target.value)} onKeyDown={e => e.key === "Enter" && save()} />
            <label className="lead-ed-visit">
              <span>{t("lead_visit", lang)}</span>
              <input ref={visitRef} className="lead-ed-input" type="datetime-local" step={900} value={visit}
                tabIndex={editing ? 0 : -1} onChange={e => setVisit(e.target.value)} />
              {visit ? <button type="button" className="btn ghost sm" tabIndex={editing ? 0 : -1} onClick={() => setVisit("")}>{t("lead_visit_clear", lang)}</button> : null}
            </label>
            <div className="lead-ed-actions">
              <button className="btn ghost sm" disabled={pending} onClick={cancel} tabIndex={editing ? 0 : -1}>{t("lead_cancel", lang)}</button>
              <button className="btn primary sm" disabled={pending} onClick={save} tabIndex={editing ? 0 : -1}>{t("lead_save", lang)}</button>
            </div>
          </div>
        </div>
      </div>
    </article>
  );
}
