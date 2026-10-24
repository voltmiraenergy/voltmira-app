"use client";
// app/(app)/jobs/JobsView.jsx — the jobs board and the crews' week. The board's columns are the install steps
// (lib/jobBoard.js): a card is dragged to another step on a computer, or moved with "Move to" anywhere, and the
// quote's install checklist follows. The week shows each crew's visits by day; a visit is planned or moved in a
// dialog that warns of a double booking and emails the client unless its switch is off (lib/jobActions.js).
import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CalendarDays, KanbanSquare, Plus, ChevronLeft, ChevronRight, Users, Mail, PenLine } from "lucide-react";
import { BOARD_COLUMNS, boardOf } from "../../../lib/jobBoard.js";
import { VISIT_KINDS, visitsByDay, mondayOf } from "../../../lib/crewVisits.js";
import { jt } from "../../../lib/jobText.js";
import { dayKeyOf, fmtDate, fmtTime } from "../../../lib/tz.js";
import { moveJob, saveVisit, deleteVisit, saveCrew } from "../../../lib/jobActions.js";

const LOCS = { en: "en-GB", ro: "ro-RO", ru: "ru-RU", uk: "uk-UA" };
const DAY = 864e5;
const shift = (key, days) => new Date(Date.parse(key + "T00:00:00Z") + days * DAY).toISOString().slice(0, 10);
const daysBetween = (a, b) => (a && b ? Math.max(0, Math.round((Date.parse(b + "T00:00:00Z") - Date.parse(String(a).slice(0, 10) + "T00:00:00Z")) / DAY)) : null);

export default function JobsView({ data, tab: tab0 }) {
  const router = useRouter();
  const lang = data?.lang || "ro";
  const J = (k, v) => jt(k, lang, v);
  const loc = LOCS[lang] || "ro-RO";
  const [tab, setTab] = useState(tab0);
  const [projects, setProjects] = useState(data?.projects || []);
  const [msg, setMsg] = useState("");
  const [drag, setDrag] = useState(null);
  const [visit, setVisit] = useState(null);     // the visit in the dialog
  const [crewEdit, setCrewEdit] = useState(null);

  const crewById = useMemo(() => new Map((data?.crews || []).map((c) => [c.id, c])), [data]);
  const board = useMemo(() => boardOf(projects, data?.upcoming || []), [projects, data]);
  const day = (iso) => fmtDate(iso, loc, { weekday: "short", day: "numeric", month: "short" });

  if (data?.error) return <div className="dx"><p className="dx-muted-note">{data.error}</p></div>;

  async function move(id, column) {
    const before = projects;
    setProjects((ps) => ps.map((p) => (p.id === id ? { ...p, install_progress: movedProg(p.install_progress, column, data.today) } : p)));
    const r = await moveJob(id, column).catch(() => ({ ok: false }));
    if (!r.ok) { setProjects(before); setMsg(J("e_move")); }
    else setProjects((ps) => ps.map((p) => (p.id === id ? { ...p, install_progress: r.install_progress } : p)));
  }
  const goWeek = (monday) => { router.push(`/jobs?view=week&week=${monday}`); };
  const pick = (t) => { setTab(t); window.history.replaceState(null, "", t === "week" ? `/jobs?view=week&week=${data.monday}` : "/jobs"); };

  const byDay = visitsByDay(data?.weekVisits || [], data?.monday);
  const crewRows = [...(data?.crews || []).filter((c) => c.active), ...((data?.weekVisits || []).some((v) => !v.crew_id) ? [{ id: null, name: J("no_crew"), color: "#8E998F" }] : [])];
  const jobName = new Map((data?.visitJobs || []).map((j) => [j.id, j.label]));

  return (
    <div className="dx jbx">
      <header className="dx-head">
        <div className="dx-hello">
          <h1>{J("title")}</h1>
          <p className="dx-summary">{J("sub")}</p>
        </div>
        <div className="dx-head-tools">
          <nav className="dx-tabs" aria-label={J("title")}>
            <button type="button" className={tab === "board" ? "on" : ""} aria-pressed={tab === "board"} onClick={() => pick("board")}><KanbanSquare size={14} aria-hidden="true" />{J("tab_board")}</button>
            <button type="button" className={tab === "week" ? "on" : ""} aria-pressed={tab === "week"} onClick={() => pick("week")}><CalendarDays size={14} aria-hidden="true" />{J("tab_week")}</button>
          </nav>
          {!data?.needsDb && <button type="button" className="btn amber" onClick={() => setVisit(blankVisit(data))}><Plus size={15} aria-hidden="true" />{J("add_visit")}</button>}
        </div>
      </header>

      {data?.needsDb && <p className="jb-warn" role="status">{J("needs_db")}</p>}
      {msg && <p className="jb-warn" role="alert">{msg}</p>}

      {tab === "board" ? (
        projects.length === 0 ? <p className="dx-muted-note">{J("board_empty")}</p> : (
          <>
            <p className="jb-hint">{J("move_hint")}</p>
            <div className="jb-board" role="list">
              {BOARD_COLUMNS.map((col) => (
                <section key={col} className={"jb-col" + (drag && drag.from !== col ? " is-target" : "")} role="listitem" aria-labelledby={`jb-h-${col}`}
                  onDragOver={(e) => { if (drag) e.preventDefault(); }}
                  onDrop={(e) => { e.preventDefault(); if (drag && drag.from !== col) move(drag.id, col); setDrag(null); }}>
                  <h2 id={`jb-h-${col}`}>{J("col_" + col)}<span className="dx-count">{board[col].length}</span></h2>
                  {board[col].length === 0 && <p className="jb-none">{J("col_empty")}</p>}
                  {board[col].map((c) => {
                    const site = data.sites?.[c.id];
                    const waited = daysBetween(c.since, data.today);
                    return (
                      <article key={c.id} className="jb-card" draggable onDragStart={() => setDrag({ id: c.id, from: col })} onDragEnd={() => setDrag(null)}>
                        <Link href={`/projects/${c.id}`} className="jb-name">{c.client_name || c.title}</Link>
                        <small>{c.title && c.client_name ? c.title + ", " : ""}{Number(c.kw).toLocaleString(loc, { maximumFractionDigits: 1 })} kW</small>
                        {waited != null && <small>{J("days_here", { n: waited })}</small>}
                        {c.nextVisit && <small className="jb-next"><CalendarDays size={12} aria-hidden="true" />{J("next_visit", { d: `${day(c.nextVisit.starts_at)}, ${fmtTime(c.nextVisit.starts_at, loc)}` })}</small>}
                        {site && (site.done > 0 || site.signed) && <small className="jb-site">{site.signed ? <><PenLine size={12} aria-hidden="true" />{J("signed_by_client")}</> : J("record_n", { d: site.done, t: site.total })}</small>}
                        <label className="jb-move">
                          <span className="sr">{J("move_to")}</span>
                          <select value={col} onChange={(e) => move(c.id, e.target.value)} aria-label={`${J("move_to")}: ${c.client_name || c.title}`}>
                            {BOARD_COLUMNS.map((x) => <option key={x} value={x}>{J("col_" + x)}</option>)}
                          </select>
                        </label>
                      </article>
                    );
                  })}
                </section>
              ))}
            </div>
          </>
        )
      ) : (
        <section className="dx-card jb-week" aria-labelledby="jb-week-h">
          <header className="jb-week-head">
            <h2 id="jb-week-h">{J("week_of", { d: fmtDate(data.monday + "T12:00:00Z", loc, { day: "numeric", month: "long" }) })}</h2>
            <div className="jb-week-nav">
              <button type="button" className="dx-btn icon" aria-label={J("prev_week")} onClick={() => goWeek(shift(data.monday, -7))}><ChevronLeft size={16} /></button>
              <button type="button" className="dx-btn" onClick={() => goWeek(mondayOf(data.today))}>{J("this_week")}</button>
              <button type="button" className="dx-btn icon" aria-label={J("next_week")} onClick={() => goWeek(shift(data.monday, 7))}><ChevronRight size={16} /></button>
            </div>
          </header>
          {crewRows.length === 0 ? <p className="dx-muted-note">{J("crews_empty")}</p> : (
            <div className="jb-grid-wrap">
              <table className="jb-grid">
                <thead>
                  <tr><th scope="col">{J("crews_h")}</th>{data.days.map((d) => <th key={d} scope="col" className={d === data.today ? "is-today" : ""}>{fmtDate(d + "T12:00:00Z", loc, { weekday: "short", day: "numeric" })}</th>)}</tr>
                </thead>
                <tbody>
                  {crewRows.map((c) => (
                    <tr key={c.id || "none"}>
                      <th scope="row"><span className="jb-dot" style={{ background: c.color }} aria-hidden="true" />{c.name}{c.members && <small>{c.members}</small>}</th>
                      {data.days.map((d) => (
                        <td key={d} className={d === data.today ? "is-today" : ""}>
                          {byDay[d].filter((v) => (v.crew_id || null) === c.id).map((v) => (
                            <button key={v.id} type="button" className={"jb-visit k-" + v.kind} style={{ borderColor: c.color }} onClick={() => setVisit(toForm(v))}>
                              <b>{fmtTime(v.starts_at, loc)} {fmtTime(v.ends_at, loc)}</b>
                              <span>{jobName.get(v.project_id) || ""}</span>
                              <small>{J("k_" + v.kind)}{v.notified_at ? <> <Mail size={11} aria-label={J("v_told", { d: day(v.notified_at) })} /></> : null}</small>
                            </button>
                          ))}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <div className="jb-crews">
            <h3><Users size={15} aria-hidden="true" />{J("crews_h")}</h3>
            <ul>
              {(data?.crews || []).map((c) => (
                <li key={c.id} className={c.active ? "" : "is-off"}>
                  <span className="jb-dot" style={{ background: c.color }} aria-hidden="true" />
                  <b>{c.name}</b><span>{c.members}</span>
                  <button type="button" className="dx-btn" onClick={() => setCrewEdit({ ...c })}>{J("edit")}</button>
                </li>
              ))}
            </ul>
            {!data?.needsDb && <button type="button" className="btn ghost sm" onClick={() => setCrewEdit({ name: "", members: "", color: "#1e6b4e", active: true })}><Plus size={14} aria-hidden="true" />{J("crew_add")}</button>}
          </div>
        </section>
      )}

      {visit && <VisitDialog lang={lang} form={visit} data={data} crewById={crewById} onClose={() => setVisit(null)} onSaved={() => { setVisit(null); router.refresh(); }} />}
      {crewEdit && <CrewDialog lang={lang} crew={crewEdit} onClose={() => setCrewEdit(null)} onSaved={() => { setCrewEdit(null); router.refresh(); }} />}
    </div>
  );
}

// the board's optimistic move, the same rule as lib/jobBoard.js moveTo
function movedProg(prog, column, today) {
  const at = BOARD_COLUMNS.indexOf(column);
  const out = { ...(prog || {}) };
  BOARD_COLUMNS.slice(1).forEach((s, i) => { if (i < at) { if (!out[s]) out[s] = today; } else delete out[s]; });
  return out;
}

function blankVisit(data) {
  return { id: null, project_id: data?.visitJobs?.[0]?.id || "", crew_id: (data?.crews || []).find((c) => c.active)?.id || "", kind: "install", day: data?.today || "", from: "08:00", to: "16:00", note: "", notify_client: true };
}
function toForm(v) {
  const hm = (iso) => fmtTime(iso, "ro-RO");
  return { id: v.id, project_id: v.project_id, crew_id: v.crew_id || "", kind: v.kind, day: dayKeyOf(v.starts_at), from: hm(v.starts_at), to: hm(v.ends_at), note: v.note || "", notify_client: v.notify_client !== false, notified_at: v.notified_at };
}

function VisitDialog({ lang, form: f0, data, crewById, onClose, onSaved }) {
  const J = (k, v) => jt(k, lang, v);
  const loc = LOCS[lang] || "ro-RO";
  const [f, setF] = useState(f0);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [clash, setClash] = useState(null);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.type === "checkbox" ? e.target.checked : e.target.value });
  const jobs = data?.visitJobs || [];

  async function save(force = false) {
    setBusy(true); setErr("");
    const r = await saveVisit(f, { force }).catch(() => ({ ok: false, error: "save_failed" }));
    setBusy(false);
    if (r.ok) return onSaved();
    if (r.error === "clash") {
      const list = r.clashes.map((c) => `${fmtTime(c.starts_at, loc)} ${fmtTime(c.ends_at, loc)}`).join(", ");
      setClash(J("clash", { crew: crewById.get(f.crew_id)?.name || "", list }));
      return;
    }
    const field = (r.fields || [])[0];
    setErr(field === "project" ? J("e_project") : field === "crew" ? J("e_crew") : field === "time" || field === "day" ? J("e_time") : r.error === "needs_db" ? J("needs_db") : J("e_save"));
  }
  async function remove() {
    setBusy(true);
    await deleteVisit(f.id).catch(() => null);
    setBusy(false);
    onSaved();
  }

  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal jb-dialog" role="dialog" aria-modal="true" aria-labelledby="jb-v-h" onClick={(e) => e.stopPropagation()}>
        <h4 id="jb-v-h">{J("visit_h")}</h4>
        <div className="jb-form">
          <label className="field"><span>{J("v_job")}</span>
            <select className="input" value={f.project_id} onChange={set("project_id")}>
              <option value="">{J("pick")}</option>
              {jobs.map((j) => <option key={j.id} value={j.id}>{j.label}</option>)}
            </select>
          </label>
          <label className="field"><span>{J("v_crew")}</span>
            <select className="input" value={f.crew_id} onChange={set("crew_id")}>
              <option value="">{J("pick")}</option>
              {(data?.crews || []).filter((c) => c.active || c.id === f.crew_id).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </label>
          <label className="field"><span>{J("v_kind")}</span>
            <select className="input" value={f.kind} onChange={set("kind")}>{VISIT_KINDS.map((k) => <option key={k} value={k}>{J("k_" + k)}</option>)}</select>
          </label>
          <div className="jb-when">
            <label className="field"><span>{J("v_day")}</span><input className="input" type="date" value={f.day} onChange={set("day")} /></label>
            <label className="field"><span>{J("v_from")}</span><input className="input" type="time" step="900" value={f.from} onChange={set("from")} /></label>
            <label className="field"><span>{J("v_to")}</span><input className="input" type="time" step="900" value={f.to} onChange={set("to")} /></label>
          </div>
          <label className="field"><span>{J("v_note")}</span><textarea className="input" rows={2} maxLength={500} value={f.note} onChange={set("note")} /></label>
          <label className="check"><input type="checkbox" checked={f.notify_client} onChange={set("notify_client")} /><span className="txt">{J("v_notify")}</span></label>
          {f.notified_at && <p className="set-note">{J("v_told", { d: fmtDate(f.notified_at, loc, { day: "numeric", month: "short" }) })}</p>}
        </div>
        {err && <p className="jb-err" role="alert">{err}</p>}
        {clash && <p className="jb-warn" role="alert">{clash}</p>}
        <div className="jb-acts">
          {f.id && <button type="button" className="btn ghost" disabled={busy} onClick={remove}>{J("delete")}</button>}
          <span className="jb-sp" />
          <button type="button" className="btn ghost" onClick={onClose}>{J("cancel")}</button>
          {clash
            ? <button type="button" className="btn amber" disabled={busy} onClick={() => save(true)}>{J("save_anyway")}</button>
            : <button type="button" className="btn primary" disabled={busy} onClick={() => save(false)}>{J("save")}</button>}
        </div>
      </div>
    </div>
  );
}

function CrewDialog({ lang, crew, onClose, onSaved }) {
  const J = (k, v) => jt(k, lang, v);
  const [c, setC] = useState(crew);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  async function save() {
    setBusy(true); setErr("");
    const r = await saveCrew(c).catch(() => ({ ok: false }));
    setBusy(false);
    if (r.ok) onSaved(); else setErr(r.error === "needs_db" ? J("needs_db") : J("e_save"));
  }
  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal jb-dialog" role="dialog" aria-modal="true" aria-labelledby="jb-c-h" onClick={(e) => e.stopPropagation()}>
        <h4 id="jb-c-h">{c.id ? c.name : J("crew_add")}</h4>
        <div className="jb-form">
          <label className="field"><span>{J("crew_name")}</span><input className="input" maxLength={60} value={c.name} onChange={(e) => setC({ ...c, name: e.target.value })} /></label>
          <label className="field"><span>{J("crew_members")}</span><input className="input" maxLength={200} value={c.members} onChange={(e) => setC({ ...c, members: e.target.value })} /></label>
          <label className="field jb-color"><span>{J("crew_color")}</span><input type="color" value={c.color} onChange={(e) => setC({ ...c, color: e.target.value })} /></label>
          {c.id && <label className="check"><input type="checkbox" checked={!c.active} onChange={(e) => setC({ ...c, active: !e.target.checked })} /><span className="txt">{J("crew_off")}</span></label>}
        </div>
        {err && <p className="jb-err" role="alert">{err}</p>}
        <div className="jb-acts"><span className="jb-sp" /><button type="button" className="btn ghost" onClick={onClose}>{J("cancel")}</button><button type="button" className="btn primary" disabled={busy || !c.name.trim()} onClick={save}>{J("save")}</button></div>
      </div>
    </div>
  );
}

