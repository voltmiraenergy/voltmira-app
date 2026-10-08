"use client";
// components/WorkflowRail.jsx — where one quote stands on the planned line
// (lib/workflow.js), as a compact strip for the quote editor: one step per
// stage, the stage it has reached, why the next step is next, who holds the
// ball, days in the stage against its stated rule, and the next action as a
// button that does it.
//
// Every step is a button. Tapping one opens that step's own panel: when it was
// done (and, for a tick this screen set, an undo), or the actions that record
// it right here (lib/workflow.js stageFixes). A red step, one never recorded
// although later steps were, is fixed the same way. The panel starts on the
// step that is next, so the strip still reads as "do this now" at a glance.
//
// Self-contained: it loads its own data through a server action
// (getProjectWorkflow in lib/workflowActions.js, RLS-scoped) and runs its own
// actions through the same server actions the rest of the app uses
// (setInstallStep, setGridFile, createProposal, markProjectWon in
// lib/actions.js). The root carries id="workflow", so a deep link
// /projects/<id>#workflow (the dashboard's and the projects list's next-step
// links) lands on it.
//
// Props
//   projectId   string, required    the quote's id
//   lang        "en"|"ro"|"ru"|"uk"  interface language (default "en")
//   status      string               the quote's status as the editor knows it;
//                                    a change reloads the rail (e.g. after "Mark won")
//   refreshKey  any                  bump it to reload after an edit elsewhere on the page
//   onAction    (action) => boolean | Promise<boolean>
//               optional; called first for every action. Return true to say
//               "handled" (e.g. send -> the editor's own share modal, invoice ->
//               its proforma modal, won -> its own status save) and the rail
//               only reloads. Action shapes:
//                 { type: "send" | "copy_link" | "invoice" | "won" | "portfolio", projectId }
//                 { type: "step", projectId, step, done? }      install checklist key (done: false = untick)
//                 { type: "grid", projectId, stage, operator?, clear? }  grid-file stage (clear = remove its date)
//                 { type: "link", href } and { type: "tel", phone } are plain links
//   onChange    ({ installProgress?, gridFile?, proposalCode? }) => void
//               optional; called after the rail itself changed the quote, with
//               what the server returned, so the editor can refresh its own
//               install checklist and grid-file cards (they keep local state).
//
// It also re-reads itself when the window regains focus (back from the
// invoice tab) and when AddToPortfolio announces a change for this quote
// (the "voltmira:workflow" window event), so the two need no wiring.
import "./workflow.css";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { getProjectWorkflow } from "../lib/workflowActions.js";
import { setInstallStep, setGridFile, createProposal, markProjectWon } from "../lib/actions.js";
import { wt, describe, stageName, actLabel } from "../lib/workflowText.js";
import { mdDayKey, fmtDate } from "../lib/tz.js";
import { LOCALE } from "../lib/relTime.js";

const DEPOSITS = [30, 50, 0];
/** Today on the installer's wall clock, the day a grid stage is marked done. */
const today = () => mdDayKey(Date.now());
/** Two actions that do the same thing are shown once. */
const sig = (a) => (a ? [a.type, a.step || a.stage || a.phone || a.href || "", a.done === false || a.clear ? "undo" : ""].join(":") : "");

export default function WorkflowRail({ projectId, lang = "en", status, refreshKey, onAction, onChange }) {
  const router = useRouter();
  const [data, setData] = useState(null);
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);
  const [invOpen, setInvOpen] = useState(false);
  // the step whose panel is open; null = the step that is next
  const [sel, setSel] = useState(null);

  // Re-read where the quote stands; state is only set once the answer is in.
  const load = useCallback(() => getProjectWorkflow(projectId).then(
    (r) => { if (r && r.ok) { setData(r); setFailed(false); } else setFailed(true); },
    () => setFailed(true),
  ), [projectId]);

  useEffect(() => { load(); }, [load, status, refreshKey]);
  // Back from the invoice tab (the number is drawn there) or another window,
  // or the portfolio card changed this quote: re-read.
  useEffect(() => {
    const onFocus = () => { load(); };
    const onChanged = (e) => { if (!e.detail || e.detail.projectId === projectId) load(); };
    window.addEventListener("focus", onFocus);
    window.addEventListener("voltmira:workflow", onChanged);
    return () => {
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("voltmira:workflow", onChanged);
    };
  }, [load, projectId]);

  async function run(a) {
    if (!a || busy) return;
    setMsg(null);
    if (onAction) {
      let handled = false;
      try { handled = (await onAction(a)) === true; } catch { handled = false; }
      if (handled) { await load(); if (a.type === "won") setMsg({ ok: true, text: wt("rl_saved", lang) }); return; }
    }
    if (a.type === "invoice") { setInvOpen((v) => !v); return; }
    if (a.type === "portfolio") {
      const el = document.getElementById("portfolio");
      if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
      else router.push("/portfolios");
      return;
    }
    const undo = a.done === false || a.clear;
    setBusy(true);
    try {
      if (a.type === "step") {
        const prog = await setInstallStep(projectId, a.step, a.done !== false);
        onChange?.({ installProgress: prog || null });
      } else if (a.type === "grid") {
        const file = await setGridFile(projectId, a.clear
          ? { stage: a.stage, date: null }
          : { stage: a.stage, date: today(), ...(a.operator ? { operator: a.operator } : {}) });
        onChange?.({ gridFile: file || null });
      } else if (a.type === "won") {
        await markProjectWon(projectId);
      } else if (a.type === "send" || a.type === "copy_link") {
        const code = await createProposal(projectId);
        const url = `${window.location.origin}/p/${code}`;
        try { await navigator.clipboard?.writeText(url); } catch { /* the link is shown below either way */ }
        setMsg({ ok: true, text: `${wt("rl_copied", lang)}: ${url}` });
        onChange?.({ proposalCode: code });
      }
      await load();
      router.refresh();
      if (a.type === "step" || a.type === "grid" || a.type === "won") setMsg({ ok: true, text: wt(undo ? "rl_undone" : "rl_saved", lang) });
    } catch {
      setMsg({ ok: false, text: wt("rl_failed", lang) });
    } finally {
      setBusy(false);
    }
  }

  const w = data?.wf || null;

  if (!w) {
    return (
      <section id="workflow" className="card wfr" aria-busy={!failed}>
        <div className="wfr-head"><h3>{wt("rl_title", lang)}</h3></div>
        <ol className="wfr-track" style={{ gridTemplateColumns: "repeat(12, minmax(0, 1fr))" }} aria-hidden="true">
          {Array.from({ length: 12 }, (_, i) => <li key={i}><span className="wfr-step"><span className="wfr-seg" /></span></li>)}
        </ol>
        {failed ? (
          <p className="wfr-msg bad" role="alert">
            {wt("rl_error", lang)}{" "}
            <button type="button" className="btn ghost sm" onClick={() => { setFailed(false); load(); }}>{wt("rl_retry", lang)}</button>
          </p>
        ) : (
          <div className="wfr-skel"><span className="sr">{wt("rl_loading", lang)}</span></div>
        )}
      </section>
    );
  }

  const d = describe(w, lang);
  const loc = LOCALE[lang] || "en-GB";
  const cols = { gridTemplateColumns: `repeat(${w.stages.length}, minmax(0, 1fr))` };
  const dateOf = (at) => fmtDate(String(at).length === 10 ? at + "T12:00:00Z" : at, loc, { day: "numeric", month: "long" });
  const tip = (s) => {
    const name = stageName(s.id, lang, w.market, true);
    const extra = s.state === "done" && s.at
      ? ", " + wt("rl_done_on", lang, { date: fmtDate(String(s.at).length === 10 ? s.at + "T12:00:00Z" : s.at, loc, { day: "numeric", month: "short" }) })
      : s.optional ? ` (${wt("rl_optional", lang)})` : "";
    return name + extra;
  };
  const position = Math.max(1, w.stages.findIndex((s) => s.id === w.stage) + 1);
  const targetId = w.target || null;
  const openId = sel && w.stages.some((s) => s.id === sel) ? sel : targetId;
  const open = w.stages.find((s) => s.id === openId) || null;
  const onTarget = !open || open.id === targetId;

  function actionEl(a, label, primary) {
    if (!a || !label) return null;
    const cls = "btn sm " + (primary ? "primary" : "ghost");
    if (a.type === "tel") return <a key={sig(a)} className={cls} href={`tel:${String(a.phone).replace(/\s+/g, "")}`}>{label}</a>;
    if (a.type === "link") return <Link key={sig(a)} className={cls} href={a.href}>{label}</Link>;
    return (
      <button key={sig(a)} type="button" className={cls} disabled={busy} aria-busy={busy} onClick={() => run(a)}
        aria-expanded={a.type === "invoice" ? invOpen : undefined}>
        {label}
      </button>
    );
  }

  // The panel's buttons. On the step that is next: the workflow's next action
  // and its alternative first (they know about a hot client or a planned
  // follow-up), then any other way to record the step. Elsewhere: the step's
  // own fixes, or, on a done step, the undo.
  const buttons = [];
  if (open && onTarget && w.next) {
    if (w.next.act) buttons.push({ a: w.next.act, label: d.next });
    if (w.next.alt) buttons.push({ a: w.next.alt, label: d.alt || actLabel(w.next.altKey, null, lang) });
  }
  if (open) {
    for (const f of open.fix || []) {
      if (buttons.some((b) => sig(b.a) === sig(f.act))) continue;
      buttons.push({ a: f.act, label: actLabel(f.key, f.vars, lang) });
    }
  }

  let stateLine = "";
  if (open && !onTarget) {
    if (open.state === "done") stateLine = open.at ? wt("rs_done", lang, { date: dateOf(open.at) }) : wt("rs_done0", lang);
    else if (open.state === "gap") stateLine = wt("rs_gap", lang);
    else if (open.state === "skipped") stateLine = wt("rs_skipped", lang);
    else if (!(open.fix || []).length) stateLine = wt("rs_auto", lang);
    else stateLine = wt("rs_todo", lang);
  }

  return (
    <section id="workflow" className="card wfr" aria-labelledby="wfr-h" aria-busy={busy}>
      <div className="wfr-head">
        <h3 id="wfr-h">{wt("rl_title", lang)}</h3>
        {!w.lost && <span className="wfr-count">{wt("rl_step", lang, { i: position, n: w.stages.length })}</span>}
        <span className="wfr-badges">
          {w.financingReady && <span className="wfr-badge ready" title={wt("rl_ready_h", lang)}>{wt("rl_ready", lang)}</span>}
          {(data.portfolios || []).map((pf) => (
            <Link key={pf.id} className="wfr-badge pf" href={`/portfolios/${pf.id}`}>{wt("rl_in_pf", lang, { name: pf.name || wt("ap_title", lang) })}</Link>
          ))}
        </span>
      </div>

      <ol className="wfr-track" style={cols} aria-label={wt("rl_title", lang)}>
        {w.stages.map((s) => (
          <li key={s.id}>
            <button type="button" className={`wfr-step ${s.state}${s.optional ? " opt" : ""}${s.id === openId ? " on" : ""}`}
              title={tip(s)} aria-pressed={s.id === openId} aria-controls="wfr-panel"
              onClick={() => { setSel(s.id === targetId ? null : s.id); setMsg(null); setInvOpen(false); }}>
              <span className="wfr-seg" aria-hidden="true" />
              <span className="wfr-lbl">{stageName(s.id, lang, w.market)}</span>
              <span className="sr">{tip(s)}</span>
            </button>
          </li>
        ))}
      </ol>

      <div id="wfr-panel" className={"wfr-now" + (onTarget && w.stuck ? " stuck" : "") + (open && open.state === "gap" ? " gap" : "")} aria-live="polite">
        <div className="wfr-now-tx">
          {onTarget ? (
            <>
              <span className="wfr-stage">{open ? stageName(open.id, lang, w.market, true) : d.stageLong}</span>
              {d.why && <p className="wfr-why">{d.why}</p>}
              {(d.wait || d.days) && (
                <div className="wfr-meta">
                  {d.wait && <span className={"w-" + w.waitingOn}>{d.wait}</span>}
                  {d.days && <span>{d.days}</span>}
                </div>
              )}
              {d.stuck && <p className="wfr-stuck">{d.stuck}</p>}
            </>
          ) : (
            <>
              <span className="wfr-stage">{stageName(open.id, lang, w.market, true)}</span>
              <p className="wfr-why">{stateLine}</p>
              {open.undo && <p className="wfr-undo-h">{wt("rs_undo_h", lang)}</p>}
            </>
          )}
        </div>
        <div className="wfr-acts">
          {buttons.map((b, i) => actionEl(b.a, b.label, i === 0))}
          {!onTarget && open?.undo && actionEl(open.undo, wt("do_undo", lang), false)}
          {onTarget && !w.next && !w.lost && !buttons.length && <p className="wfr-done">{wt("rl_done_all", lang)}</p>}
          {!onTarget && targetId && (
            <button type="button" className="btn sm link wfr-back" onClick={() => { setSel(null); setMsg(null); }}>{wt("rl_back", lang)}</button>
          )}
        </div>
      </div>

      {invOpen && (
        <div className="wfr-inv" role="group" aria-label={wt("rl_inv_pick", lang)}>
          <b>{wt("rl_inv_pick", lang)}</b>
          {DEPOSITS.map((pct) => (
            <a key={pct} className="btn ghost sm" target="_blank" rel="noopener noreferrer"
              href={`/projects/${projectId}/invoice${pct > 0 ? `?deposit=${pct}` : ""}`}
              onClick={() => setInvOpen(false)}>
              {pct > 0 ? `${pct}%` : wt("rl_inv_full", lang)}
            </a>
          ))}
        </div>
      )}
      {msg ? <p className={"wfr-msg " + (msg.ok ? "ok" : "bad")} role="status">{msg.text}</p>
        : <p className="wfr-hint">{wt("rl_tap", lang)}</p>}
    </section>
  );
}
