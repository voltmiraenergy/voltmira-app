"use client";
// app/(app)/service/ServiceView.jsx — "Service", four tabs: Systems (production against the offer, the portal, the
// next check; the inverter portals below), Requests (from clients and your own, with their history, photos and a
// visit), Yearly checks (what is due, planned and done) and Warranties (what ends soon, and each system's). Visits are
// planned in the crews' week (lib/jobActions.js saveVisit), so they show there too.
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Activity, MessageSquareWarning, CalendarCheck, ShieldCheck, Plus, Link2, CalendarPlus, Check, X } from "lucide-react";
import { svt } from "../../../lib/serviceText.js";
import { nextStatuses, REQUEST_KINDS, OPEN_STATUSES } from "../../../lib/service.js";
import { openRequest, moveRequestTo, requestDetail, bookCheck, markCheckDone, setChecksOff, saveWarranty, saveServiceSettings, serviceLink } from "../../../lib/serviceActions.js";
import { saveVisit } from "../../../lib/jobActions.js";
import InverterPortals from "../studio/monitoring/InverterPortals.jsx";

const LOCS = { en: "en-GB", ro: "ro-RO", ru: "ru-RU", uk: "uk-UA" };
const TABS = [["systems", Activity], ["requests", MessageSquareWarning], ["checks", CalendarCheck], ["warranty", ShieldCheck]];

export default function ServiceView({ data, tab: tab0, openId = null }) {
  const router = useRouter();
  const lang = data?.lang || "ro";
  const S = (k, v) => svt(k, lang, v);
  const loc = LOCS[lang] || "ro-RO";
  const day = (d) => (d ? new Date(String(d).slice(0, 10) + "T12:00:00Z").toLocaleDateString(loc, { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }) : "");
  const monthOf = (m) => (m ? new Date(m.slice(0, 7) + "-15T00:00:00Z").toLocaleDateString(loc, { month: "short", year: "numeric", timeZone: "UTC" }) : "");
  const [tab, setTab] = useState(tab0);
  const [note, setNote] = useState("");
  const [newReq, setNewReq] = useState(null);     // the "new request" dialog
  // the request open in its dialog: the one an email linked to (?r=), else none
  const [req, setReq] = useState(() => (openId ? (data?.requests || []).find((x) => x.id === openId) || null : null));
  const [visit, setVisit] = useState(null);       // the visit dialog: { kind, projectId, then }
  const [done, setDone] = useState(null);         // the "check done" dialog
  const [filter, setFilter] = useState({ systems: "attention", requests: "open", checks: "due" });
  const flash = (s) => { setNote(s); setTimeout(() => setNote(""), 2400); };
  const pick = (t) => { setTab(t); window.history.replaceState(null, "", t === "systems" ? "/service" : `/service?tab=${t}`); };
  const systems = useMemo(() => data?.systems || [], [data]);
  const sysById = useMemo(() => new Map(systems.map((s) => [s.id, s])), [systems]);

  if (data?.error) return <p className="dx-muted-note">{S("e_save")}</p>;
  const t = data?.tiles || {};

  async function copyLink(projectId) {
    const r = await serviceLink(projectId).catch(() => ({ ok: false }));
    if (!r.ok) { flash(S(r.error === "needs_db" ? "needs_db" : "e_save")); return; }
    try { await navigator.clipboard.writeText(window.location.origin + r.path); flash(S("a_copied")); } catch { window.open(r.path, "_blank", "noopener"); }
  }
  const healthChip = (h) => <span className={"sv-chip h-" + h.status}>{S("h_" + h.status)}</span>;

  return (
    <div className="dx svx">
      <header className="dx-head">
        <div className="dx-hello">
          <h1>{S("title")}</h1>
          <p className="dx-summary">{S("sub")}</p>
        </div>
        <div className="dx-head-tools">
          <nav className="dx-tabs" aria-label={S("title")}>
            {TABS.map(([k, I]) => <button key={k} type="button" className={tab === k ? "on" : ""} aria-pressed={tab === k} onClick={() => pick(k)}><I size={14} aria-hidden="true" />{S("tab_" + k)}</button>)}
          </nav>
          {!data?.needsDb && systems.length > 0 && <button type="button" className="btn amber" onClick={() => setNewReq({ projectId: systems[0].id, kind: "no_production", description: "", contact_name: "", contact_phone: "" })}><Plus size={15} aria-hidden="true" />{S("r_new_h")}</button>}
        </div>
      </header>
      {data?.needsDb && <p className="sv-warn" role="status">{S("needs_db")}</p>}
      {note && <p className="sv-note" role="status">{note}</p>}

      {tab === "systems" && (
        <>
          <dl className="sv-tiles">
            <div><dt>{S("t_live")}</dt><dd className="sv-big">{t.live || 0}</dd><dd>{S("t_live_sub", { kw: (t.kw || 0).toLocaleString(loc) })}</dd></div>
            <div className={t.attention ? "is-warn" : ""}><dt>{S("t_attention")}</dt><dd className="sv-big">{t.attention || 0}</dd><dd>{S("t_attention_sub")}</dd></div>
            <div><dt>{S("t_open")}</dt><dd className="sv-big">{t.open || 0}</dd><dd>{S("t_open_sub", { n: t.late || 0 })}</dd></div>
            <div><dt>{S("t_checks")}</dt><dd className="sv-big">{t.checks || 0}</dd><dd>{S("t_checks_sub", { n: t.overdue || 0 })}</dd></div>
          </dl>
          <Pills value={filter.systems} options={[["attention", S("f_attention")], ["all", S("f_all")]]} onChange={(v) => setFilter({ ...filter, systems: v })} />
          <section className="dx-card sv-card">
            {systems.length === 0 ? <p className="dx-muted-note">{S("empty_systems")}</p> : (
              <div className="sv-scroll">
                <table className="sv-table">
                  <thead><tr><th scope="col">{S("col_system")}</th><th scope="col">{S("col_health")}</th><th scope="col" className="r">{S("col_ratio")}</th><th scope="col">{S("col_last")}</th><th scope="col">{S("col_portal")}</th><th scope="col">{S("col_next")}</th><th scope="col"><span className="sr">{S("a_request")}</span></th></tr></thead>
                  <tbody>
                    {systems.filter((s) => filter.systems === "all" || s.attention).map((s) => (
                      <tr key={s.id}>
                        <td><Link className="sv-name" href={`/projects/${s.id}`}>{s.title || s.client}</Link><small>{s.client && s.title ? `${s.client}, ` : ""}{s.kw.toLocaleString(loc)} kW</small></td>
                        <td>{healthChip(s.health)}{s.health.cause && <small>{S("c_" + s.health.cause)}</small>}</td>
                        <td className="r">{s.health.ratio != null ? `${Math.round(s.health.ratio * 100)}%` : ""}</td>
                        <td className="sv-nowrap">{monthOf(s.health.lastMonth)}</td>
                        <td>{s.portal ? <span className="sv-chip h-ok">{S("portal_on")}</span> : <span className="sv-muted">{S("portal_off")}</span>}</td>
                        <td className="sv-nowrap">{s.checksOff ? <span className="sv-muted">{S("ch_off")}</span> : s.due ? <>{day(s.due)}{s.dueState !== "later" && <small className={"st-" + s.dueState}>{S("ch_" + s.dueState)}</small>}</> : ""}</td>
                        <td className="sv-acts">
                          <button type="button" className="sv-icon" title={S("a_request")} aria-label={S("a_request")} disabled={data?.needsDb} onClick={() => setNewReq({ projectId: s.id, kind: s.health.cause === "no_reading" || s.health.status === "critical" ? "no_production" : "other", description: s.attention && s.health.cause ? S("c_" + s.health.cause) : "", contact_name: s.client, contact_phone: "" })}><MessageSquareWarning size={15} /></button>
                          <button type="button" className="sv-icon" title={S("a_link")} aria-label={S("a_link")} disabled={data?.needsDb} onClick={() => copyLink(s.id)}><Link2 size={15} /></button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
          <details className="dx-card sv-card sv-portals">
            <summary>{S("portals_h")}</summary>
            <InverterPortals lang={lang} jobs={[]} fire={flash} onReadings={async () => router.refresh()} />
          </details>
        </>
      )}

      {tab === "requests" && (
        <>
          <Pills value={filter.requests} options={[["open", S("f_open")], ["all", S("f_all")]]} onChange={(v) => setFilter({ ...filter, requests: v })} />
          <section className="dx-card sv-card">
            {(() => {
              const list = (data?.requests || []).filter((r) => filter.requests === "all" || OPEN_STATUSES.includes(r.status));
              if (!list.length) return <p className="dx-muted-note">{S("empty_requests")}</p>;
              return (
                <div className="sv-scroll">
                  <table className="sv-table">
                    <thead><tr><th scope="col">{S("v_day")}</th><th scope="col">{S("col_system")}</th><th scope="col">{S("r_kind")}</th><th scope="col">{S("r_contact")}</th><th scope="col">{S("col_status")}</th><th scope="col"><span className="sr">{S("r_open")}</span></th></tr></thead>
                    <tbody>
                      {list.map((r) => (
                        <tr key={r.id} className="sv-click" onClick={() => setReq(r)}>
                          <td className="sv-nowrap">{day(r.created_at)}<small>{S("src_" + r.source)}</small></td>
                          <td>{r.system}</td>
                          <td>{S("rk_" + r.kind)}<small className="sv-clip">{r.description}</small></td>
                          <td>{r.contact_name}{r.contact_phone && <small><a href={`tel:${r.contact_phone.replace(/\s/g, "")}`} onClick={(e) => e.stopPropagation()}>{r.contact_phone}</a></small>}</td>
                          <td><span className={"sv-chip r-" + r.status}>{S("rs_" + r.status)}</span>{r.late && <small className="st-overdue">{S("late", { n: data.settings.replyDays })}</small>}</td>
                          <td className="sv-acts"><button type="button" className="btn ghost sm" onClick={(e) => { e.stopPropagation(); setReq(r); }}>{S("r_open")}</button></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              );
            })()}
          </section>
        </>
      )}

      {tab === "checks" && (
        <>
          <Pills value={filter.checks} options={[["due", S("t_checks")], ["all", S("f_all")]]} onChange={(v) => setFilter({ ...filter, checks: v })} />
          <section className="dx-card sv-card">
            {(() => {
              const list = systems.filter((s) => filter.checks === "all" || s.dueState === "soon" || s.dueState === "overdue").sort((a, b) => String(a.due || "9").localeCompare(String(b.due || "9")));
              if (!list.length) return <p className="dx-muted-note">{S("empty_checks")}</p>;
              return (
                <div className="sv-scroll">
                  <table className="sv-table">
                    <thead><tr><th scope="col">{S("col_system")}</th><th scope="col">{S("ch_col_due")}</th><th scope="col">{S("ch_col_last")}</th><th scope="col"><span className="sr">{S("v_h")}</span></th></tr></thead>
                    <tbody>
                      {list.map((s) => (
                        <tr key={s.id}>
                          <td><Link className="sv-name" href={`/projects/${s.id}`}>{s.title || s.client}</Link><small>{s.address}</small></td>
                          <td className="sv-nowrap">{s.checksOff ? <span className="sv-muted">{S("ch_off")}</span> : <>{day(s.due)}{s.dueState && <small className={"st-" + s.dueState}>{S("ch_" + s.dueState)}</small>}{s.plannedAt && <small>{S("ch_planned", { d: day(s.plannedAt) })}</small>}</>}</td>
                          <td className="sv-nowrap">{s.lastDone ? day(s.lastDone) : <span className="sv-muted">{S("ch_never")}</span>}</td>
                          <td className="sv-acts">
                            {!s.checksOff && s.due && <>
                              <button type="button" className="btn ghost sm" disabled={data?.needsDb} onClick={() => setVisit({ kind: "maintenance", projectId: s.id, dueOn: s.due })}><CalendarPlus size={14} aria-hidden="true" />{S("v_h")}</button>
                              <button type="button" className="btn primary sm" disabled={data?.needsDb} onClick={() => setDone({ projectId: s.id, dueOn: s.due, day: data.today, note: "" })}><Check size={14} aria-hidden="true" />{S("ch_done")}</button>
                            </>}
                            <button type="button" className="sv-text" disabled={data?.needsDb} onClick={async () => { const r = await setChecksOff(s.id, !s.checksOff).catch(() => ({ ok: false })); if (r.ok) router.refresh(); else flash(S("e_save")); }}>{S(s.checksOff ? "ch_turn_on" : "ch_turn_off")}</button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              );
            })()}
          </section>
          <SettingsCard data={data} S={S} flash={flash} onSaved={() => router.refresh()} />
        </>
      )}

      {tab === "warranty" && <Warranties data={data} S={S} day={day} flash={flash} onSaved={() => router.refresh()} />}

      {newReq && (
        <Modal title={S("r_new_h")} onClose={() => setNewReq(null)} S={S}>
          <form className="sv-form" onSubmit={async (e) => {
            e.preventDefault();
            const r = await openRequest(newReq.projectId, newReq).catch(() => ({ ok: false }));
            if (r.ok) { setNewReq(null); router.refresh(); pick("requests"); }
            else flash(S(r.error === "invalid" ? "e_fields" : r.error === "needs_db" ? "needs_db" : "e_save"));
          }}>
            <Field id="nrSys" label={S("r_system")}><select id="nrSys" className="input" value={newReq.projectId} onChange={(e) => setNewReq({ ...newReq, projectId: e.target.value })}>{systems.map((s) => <option key={s.id} value={s.id}>{s.title || s.client}</option>)}</select></Field>
            <Field id="nrKind" label={S("r_kind")}><select id="nrKind" className="input" value={newReq.kind} onChange={(e) => setNewReq({ ...newReq, kind: e.target.value })}>{REQUEST_KINDS.map((k) => <option key={k} value={k}>{S("rk_" + k)}</option>)}</select></Field>
            <Field id="nrDesc" label={S("r_desc")}><textarea id="nrDesc" className="input" rows={4} maxLength={2000} value={newReq.description} onChange={(e) => setNewReq({ ...newReq, description: e.target.value })} /></Field>
            <div className="sv-two">
              <Field id="nrName" label={S("r_contact")}><input id="nrName" className="input" maxLength={120} value={newReq.contact_name} onChange={(e) => setNewReq({ ...newReq, contact_name: e.target.value })} /></Field>
              <Field id="nrPhone" label={S("r_phone")}><input id="nrPhone" className="input" inputMode="tel" maxLength={24} value={newReq.contact_phone} onChange={(e) => setNewReq({ ...newReq, contact_phone: e.target.value })} /></Field>
            </div>
            <div className="modal-acts"><button type="button" className="btn ghost" onClick={() => setNewReq(null)}>{S("cancel")}</button><button type="submit" className="btn primary">{S("r_save")}</button></div>
          </form>
        </Modal>
      )}

      {req && <RequestDialog req={req} sys={sysById.get(req.project_id)} S={S} day={day} replyDays={data.settings.replyDays} onClose={() => setReq(null)}
        onPlan={() => setVisit({ kind: "service", projectId: req.project_id, requestId: req.id, note: S("rk_" + req.kind) + ": " + req.description.slice(0, 200) })}
        onSaved={() => { setReq(null); router.refresh(); }} flash={flash} />}

      {visit && <VisitDialog visit={visit} crews={data?.crews || []} S={S} today={data.today} onClose={() => setVisit(null)} flash={flash}
        onSaved={async (v) => {
          if (visit.requestId) await moveRequestTo(visit.requestId, "planned", { visitId: v.id }).catch(() => null);
          if (visit.kind === "maintenance") await bookCheck(visit.projectId, { visitId: v.id, dueOn: visit.dueOn }).catch(() => null);
          setVisit(null); setReq(null); router.refresh();
        }} />}

      {done && (
        <Modal title={S("ch_done_h")} onClose={() => setDone(null)} S={S}>
          <form className="sv-form" onSubmit={async (e) => {
            e.preventDefault();
            const r = await markCheckDone(done.projectId, done).catch(() => ({ ok: false }));
            if (r.ok) { setDone(null); router.refresh(); } else flash(S(r.error === "needs_db" ? "needs_db" : "e_save"));
          }}>
            <Field id="cdDay" label={S("v_day")}><input id="cdDay" type="date" className="input" max={data.today} value={done.day} onChange={(e) => setDone({ ...done, day: e.target.value })} /></Field>
            <Field id="cdNote" label={S("r_note")}><textarea id="cdNote" className="input" rows={3} maxLength={1000} value={done.note} onChange={(e) => setDone({ ...done, note: e.target.value })} /></Field>
            <div className="modal-acts"><button type="button" className="btn ghost" onClick={() => setDone(null)}>{S("cancel")}</button><button type="submit" className="btn primary">{S("ch_done")}</button></div>
          </form>
        </Modal>
      )}
    </div>
  );
}

function Pills({ value, options, onChange }) {
  return (
    <nav className="sv-pills">
      {options.map(([k, label]) => <button key={k} type="button" className={value === k ? "on" : ""} aria-pressed={value === k} onClick={() => onChange(k)}>{label}</button>)}
    </nav>
  );
}

function Field({ id, label, children }) {
  return <div className="field"><label htmlFor={id}>{label}</label>{children}</div>;
}

function Modal({ title, onClose, S, children, wide = false }) {
  return (
    <div className="overlay" onClick={onClose}>
      <div className={"modal sv-modal" + (wide ? " wide" : "")} role="dialog" aria-modal="true" aria-label={title} onClick={(e) => e.stopPropagation()}>
        <button type="button" className="sv-x" aria-label={S("close")} onClick={onClose}><X size={18} /></button>
        <h3>{title}</h3>
        {children}
      </div>
    </div>
  );
}

function RequestDialog({ req, sys, S, day, replyDays, onClose, onPlan, onSaved, flash }) {
  const [detail, setDetail] = useState(null);
  const options = nextStatuses(req.status);
  const [to, setTo] = useState(options[0] || "");
  const [text, setText] = useState("");
  const [tell, setTell] = useState(true);
  const [busy, setBusy] = useState(false);
  useEffect(() => { requestDetail(req.id).then(setDetail).catch(() => setDetail({ ok: false })); }, [req.id]);
  return (
    <Modal title={`${S("rk_" + req.kind)}, ${sys?.title || req.system}`} onClose={onClose} S={S} wide>
      <div className="sv-req">
        <p className="sv-req-meta"><span className={"sv-chip r-" + req.status}>{S("rs_" + req.status)}</span> {day(req.created_at)}, {S("src_" + req.source)}{req.late && <span className="st-overdue"> {S("late", { n: replyDays })}</span>}</p>
        <p className="sv-req-desc">{req.description}</p>
        {(req.contact_name || req.contact_phone) && <p className="sv-req-meta">{req.contact_name}{req.contact_phone && <> <a href={`tel:${req.contact_phone.replace(/\s/g, "")}`}>{req.contact_phone}</a></>}</p>}
        {req.resolution && <p className="sv-req-meta"><b>{S("r_resolution")}:</b> {req.resolution}</p>}
        {detail?.photos?.length > 0 && (
          <div className="sv-photos" aria-label={S("r_photos")}>
            {detail.photos.map((u, i) => (
              // eslint-disable-next-line @next/next/no-img-element
              <a key={i} href={u} target="_blank" rel="noopener noreferrer"><img src={u} alt={`${S("r_photos")} ${i + 1}`} /></a>
            ))}
          </div>
        )}
        {detail?.events?.length > 0 && (
          <details className="sv-hist"><summary>{S("r_history")}</summary>
            <ul>{detail.events.map((e, i) => <li key={i}>{day(e.created_at)}: {e.from_status ? S("ev_status", { a: S("rs_" + e.from_status), b: S("rs_" + e.to_status) }) : S("ev_created")}{e.actor ? `, ${e.actor}` : ""}{e.note ? `. ${e.note}` : ""}</li>)}</ul>
          </details>
        )}
        {options.length > 0 && (
          <form className="sv-form sv-move" onSubmit={async (e) => {
            e.preventDefault(); setBusy(true);
            const r = await moveRequestTo(req.id, to, { note: text, tellClient: to === "resolved" && tell }).catch(() => ({ ok: false }));
            setBusy(false);
            if (r.ok) onSaved(); else flash(S("e_save"));
          }}>
            <div className="sv-two">
              <Field id="rqTo" label={S("r_move")}><select id="rqTo" className="input" value={to} onChange={(e) => setTo(e.target.value)}>{options.map((s) => <option key={s} value={s}>{S("rs_" + s)}</option>)}</select></Field>
              <Field id="rqNote" label={to === "resolved" ? S("r_resolution") : S("r_note")}><input id="rqNote" className="input" maxLength={2000} value={text} onChange={(e) => setText(e.target.value)} /></Field>
            </div>
            {to === "resolved" && <label className="sv-check"><input type="checkbox" checked={tell} onChange={(e) => setTell(e.target.checked)} />{S("r_tell_client")}</label>}
            <div className="modal-acts">
              {OPEN_STATUSES.includes(req.status) && <button type="button" className="btn ghost" onClick={onPlan}><CalendarPlus size={14} aria-hidden="true" />{S("r_plan")}</button>}
              <button type="submit" className="btn primary" disabled={busy || !to} aria-busy={busy}>{S("r_apply")}</button>
            </div>
          </form>
        )}
      </div>
    </Modal>
  );
}

function VisitDialog({ visit, crews, S, today, onClose, onSaved, flash }) {
  const tomorrow = new Date(Date.parse(today + "T12:00:00Z") + 864e5).toISOString().slice(0, 10);
  const [f, setF] = useState({ day: tomorrow, from: "09:00", to: "12:00", crew_id: crews[0]?.id || "", note: visit.note || "", notify_client: true });
  const [clash, setClash] = useState(false);
  const [busy, setBusy] = useState(false);
  async function save(force) {
    setBusy(true);
    const r = await saveVisit({ project_id: visit.projectId, kind: visit.kind, ...f }, { force }).catch(() => ({ ok: false }));
    setBusy(false);
    if (r.ok) onSaved(r.visit);
    else if (r.error === "clash") setClash(true);
    else flash(S(r.error === "invalid" ? "e_fields" : "e_save"));
  }
  return (
    <Modal title={S("v_h")} onClose={onClose} S={S}>
      {!crews.length ? <p className="sv-req-meta">{S("v_no_crew")}</p> : (
        <form className="sv-form" onSubmit={(e) => { e.preventDefault(); save(false); }}>
          <div className="sv-three">
            <Field id="vDay" label={S("v_day")}><input id="vDay" type="date" className="input" min={today} value={f.day} onChange={(e) => setF({ ...f, day: e.target.value })} /></Field>
            <Field id="vFrom" label={S("v_from")}><input id="vFrom" type="time" className="input" value={f.from} onChange={(e) => setF({ ...f, from: e.target.value })} /></Field>
            <Field id="vTo" label={S("v_to")}><input id="vTo" type="time" className="input" value={f.to} onChange={(e) => setF({ ...f, to: e.target.value })} /></Field>
          </div>
          <Field id="vCrew" label={S("v_crew")}><select id="vCrew" className="input" value={f.crew_id} onChange={(e) => setF({ ...f, crew_id: e.target.value })}>{crews.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></Field>
          <Field id="vNote" label={S("v_note")}><textarea id="vNote" className="input" rows={2} maxLength={500} value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} /></Field>
          <label className="sv-check"><input type="checkbox" checked={f.notify_client} onChange={(e) => setF({ ...f, notify_client: e.target.checked })} />{S("v_notify")}</label>
          {clash && <p className="sv-err" role="alert">{S("v_clash")}</p>}
          <div className="modal-acts">
            <button type="button" className="btn ghost" onClick={onClose}>{S("cancel")}</button>
            {clash ? <button type="button" className="btn amber" disabled={busy} onClick={() => save(true)}>{S("v_anyway")}</button>
              : <button type="submit" className="btn amber" disabled={busy} aria-busy={busy}>{S("v_save")}</button>}
          </div>
        </form>
      )}
    </Modal>
  );
}

function SettingsCard({ data, S, flash, onSaved }) {
  const [f, setF] = useState({ replyDays: data?.settings?.replyDays || 2, months: data?.settings?.months || 12, clientReminder: data?.settings?.clientReminder !== false });
  if (!data?.isOwner) return null;
  return (
    <section className="dx-card sv-card sv-set">
      <h2>{S("set_h")}</h2>
      <p className="dx-muted-note">{S("set_p")}</p>
      <form className="sv-form" onSubmit={async (e) => {
        e.preventDefault();
        const r = await saveServiceSettings(f).catch(() => ({ ok: false }));
        if (r.ok) { flash(S("saved")); onSaved(); } else flash(S(r.error === "needs_db" ? "needs_db" : r.error === "owner" ? "e_owner" : "e_save"));
      }}>
        <div className="sv-two">
          <Field id="ssReply" label={S("set_reply")}><input id="ssReply" className="input" type="number" min={1} max={10} value={f.replyDays} onChange={(e) => setF({ ...f, replyDays: Number(e.target.value) })} /></Field>
          <Field id="ssMonths" label={S("set_months")}><input id="ssMonths" className="input" type="number" min={3} max={36} value={f.months} onChange={(e) => setF({ ...f, months: Number(e.target.value) })} /></Field>
        </div>
        <label className="sv-check"><input type="checkbox" checked={f.clientReminder} onChange={(e) => setF({ ...f, clientReminder: e.target.checked })} />{S("set_client")}</label>
        <div><button type="submit" className="btn primary" disabled={data?.needsDb}>{S("set_save")}</button></div>
      </form>
    </section>
  );
}

function Warranties({ data, S, day, flash, onSaved }) {
  const systems = data?.systems || [];
  const [pid, setPid] = useState(systems[0]?.id || "");
  const [edit, setEdit] = useState(null);
  const sys = systems.find((s) => s.id === pid);
  return (
    <>
      <section className="dx-card sv-card" aria-labelledby="sv-wsoon">
        <h2 id="sv-wsoon" className="sv-h">{S("w_soon_h")}</h2>
        {(data?.warrantySoon || []).length === 0 ? <p className="dx-muted-note">{S("w_soon_none")}</p> : (
          <ul className="sv-wsoon">{data.warrantySoon.map((w) => <li key={w.projectId + w.item}><button type="button" className="sv-text" onClick={() => setPid(w.projectId)}>{w.system}</button><span>{S("wi_" + w.item)}{w.product ? `, ${w.product}` : ""}</span><b>{day(w.ends_on)}</b></li>)}</ul>
        )}
      </section>
      {systems.length === 0 ? <p className="dx-muted-note">{S("empty_systems")}</p> : (
        <section className="dx-card sv-card">
          <div className="field sv-pick"><label htmlFor="wSys">{S("w_pick")}</label><select id="wSys" className="input" value={pid} onChange={(e) => setPid(e.target.value)}>{systems.map((s) => <option key={s.id} value={s.id}>{s.title || s.client}</option>)}</select></div>
          {sys && (
            <div className="sv-scroll">
              <table className="sv-table">
                <thead><tr><th scope="col">{S("w_product")}</th><th scope="col" className="r">{S("w_years")}</th><th scope="col">{S("w_until")}</th><th scope="col">{S("w_serials")}</th><th scope="col"><span className="sr">{S("w_edit")}</span></th></tr></thead>
                <tbody>
                  {sys.warranties.map((w) => (
                    <tr key={w.item}>
                      <td><b>{S("wi_" + w.item)}</b><small>{w.product}</small></td>
                      <td className="r">{w.years || <span className="sv-muted">{S("w_unknown")}</span>}</td>
                      <td className="sv-nowrap">{w.ends_on ? day(w.ends_on) : ""}{w.source !== "none" && <small>{S("w_src_" + w.source)}</small>}</td>
                      <td>{(w.serials || []).length ? <small className="sv-serials">{w.serials.slice(0, 6).join(", ")}{w.serials.length > 6 ? ` +${w.serials.length - 6}` : ""}</small> : ""}</td>
                      <td className="sv-acts"><button type="button" className="btn ghost sm" disabled={data?.needsDb} onClick={() => setEdit({ item: w.item, product: w.product || "", years: w.years || "", startsOn: w.starts_on || sys.live || "" })}>{S("w_edit")}</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}
      {edit && (
        <Modal title={`${S("wi_" + edit.item)}, ${sys?.title || ""}`} onClose={() => setEdit(null)} S={S}>
          <form className="sv-form" onSubmit={async (e) => {
            e.preventDefault();
            const r = await saveWarranty(pid, edit.item, edit).catch(() => ({ ok: false }));
            if (r.ok) { setEdit(null); onSaved(); } else flash(S(r.error === "needs_db" ? "needs_db" : r.error === "invalid" ? "e_fields" : "e_save"));
          }}>
            <Field id="wProd" label={S("w_product")}><input id="wProd" className="input" maxLength={160} value={edit.product} onChange={(e) => setEdit({ ...edit, product: e.target.value })} /></Field>
            <div className="sv-two">
              <Field id="wYears" label={S("w_years")}><input id="wYears" className="input" inputMode="decimal" value={edit.years} onChange={(e) => setEdit({ ...edit, years: e.target.value })} /></Field>
              <Field id="wFrom" label={S("w_from")}><input id="wFrom" type="date" className="input" value={edit.startsOn} onChange={(e) => setEdit({ ...edit, startsOn: e.target.value })} /></Field>
            </div>
            <div className="modal-acts"><button type="button" className="btn ghost" onClick={() => setEdit(null)}>{S("cancel")}</button><button type="submit" className="btn primary">{S("w_save")}</button></div>
          </form>
        </Modal>
      )}
    </>
  );
}
