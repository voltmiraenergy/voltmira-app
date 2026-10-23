"use client";
// app/(app)/projects/[id]/GridSubmit.jsx — on the grid card (GridFile.jsx):
// send the package to the operator with a tracked reference, then record what
// the operator answers (documents requested, approved, connected, rejected).
// Each change reaches /api/projects/[id]/grid-submission, which ticks the
// matching stage below and tells the client. Styles: gridfile.css (.gs-*).
import { useEffect, useId, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Send } from "lucide-react";
import { xt } from "../../../../lib/integrationText.js";
import { checklistFor, docName as nameOf, checkPackage, gridNext } from "../../../../lib/gridSubmission.js";
import { PROSUMER_FORM_MAX_KW } from "../../../../lib/gridPower.js";
import { gridApplicant, gridMissing } from "../../../../lib/gridDetails.js";
import { OPERATORS } from "../../../../lib/mdGrid.js";

const newKey = () => (globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`);

export default function GridSubmit({ projectId, operator, details, client, lang, latest, events = [], channels = {}, needsDb = false, installedKw = null, ceilingKw = null }) {
  const router = useRouter();
  const id = useId();
  const T = (k, v) => xt(k, lang, v);
  const op = OPERATORS[operator] ? operator : "premier";
  const opShort = OPERATORS[op].short;
  const [attached, setAttached] = useState([]);
  // what was ticked stays across a refresh (it was lost, and the checklist read as untouched again)
  const tickKey = `vm-grid-ticks-${projectId}`;
  useEffect(() => {
    try { const v = JSON.parse(localStorage.getItem(tickKey) || "[]"); if (Array.isArray(v)) setAttached(v.filter((x) => typeof x === "string").slice(0, 20)); } catch { /* none kept */ }
  }, [tickKey]);
  const [rep, setRep] = useState(!!details?.repName);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);

  const applicant = useMemo(() => gridApplicant(details, client), [details, client]);
  const missingDetails = useMemo(() => gridMissing(applicant), [applicant]);
  const kind = applicant.kind;
  const list = checklistFor(op, kind);
  const pkg = checkPackage({ operator: op, kind, missingDetails, attached, representative: rep, installedKw, contractedKw: applicant.contractedKw, ceilingKw });
  const docName = (oid, d) => nameOf(d, lang);
  const kwTxt = (v) => Number(v).toLocaleString({ en: "en-GB", ro: "ro-RO", ru: "ru-RU", uk: "uk-UA" }[lang] || "ro-RO", { maximumFractionDigits: 1 });
  const powerMax = { over_contracted: applicant.contractedKw, over_household_ceiling: ceilingKw, over_form_max: PROSUMER_FORM_MAX_KW };
  const connected = latest?.status === "connected";
  const open = latest && !["rejected", "connected"].includes(latest.status);
  const when = (d) => new Intl.DateTimeFormat({ en: "en-GB", ro: "ro-RO", ru: "ru-RU", uk: "uk-UA" }[lang] || "ro-RO", { day: "numeric", month: "short" }).format(new Date(d));

  async function call(payload) {
    if (busy) return;
    setBusy(true); setMsg(null);
    try {
      const res = await fetch(`/api/projects/${projectId}/grid-submission`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const j = await res.json().catch(() => ({}));
      if (!j.ok) setMsg(T("gs_e_" + j.error) !== "gs_e_" + j.error ? T("gs_e_" + j.error) : j.error === "needs_db" ? T("bl_needs_db") : T("gs_e_other"));
      else { setNote(""); router.refresh(); }
    } catch { setMsg(T("gs_e_other")); }
    finally { setBusy(false); }
  }

  const toggle = (d) => setAttached((a) => {
    const next = a.includes(d) ? a.filter((x) => x !== d) : [...a, d];
    try { localStorage.setItem(tickKey, JSON.stringify(next)); } catch { /* not kept */ }
    return next;
  });

  return (
    <div className="gs" aria-labelledby={`${id}-h`}>
      <div className="gs-head">
        <b id={`${id}-h`}>{T("gs_h")}</b>
        {latest && <span className={"gs-st s-" + latest.status}>{T("gs_st_" + latest.status)}</span>}
      </div>
      {needsDb && <p className="gs-warn">{T("bl_needs_db")}</p>}

      {connected ? (
        <>
          <p className="gs-p">{OPERATORS[latest.operator]?.short}, {T("gs_ref", { ref: latest.reference })}, {when(latest.updated_at || latest.created_at)}</p>
          <p className="gs-hint">{T("gs_done")}</p>
        </>
      ) : open ? (
        <>
          <p className="gs-p">{OPERATORS[latest.operator]?.short}, {T("gs_ref", { ref: latest.reference })}, {when(latest.created_at)}</p>
          {latest.channel === "mock" && <p className="gs-warn">{T("gs_mock")}</p>}
          <div className="gs-acts">
            {gridNext(latest.status).filter((s) => s !== "submitted").map((s) => (
              <button key={s} type="button" className={"gf-mark" + (s === "approved" || s === "connected" ? " primary" : "")} disabled={busy}
                onClick={() => call({ action: "status", submissionId: latest.id, to: s, note, eventId: newKey() })}>{T("gs_to_" + s)}</button>
            ))}
            {latest.status === "docs_requested" && (
              <button type="button" className="gf-mark primary" disabled={busy} onClick={() => call({ action: "resend", submissionId: latest.id })}>{T("gs_resend")}</button>
            )}
          </div>
          <label className="gs-field" htmlFor={`${id}-note`}><span>{T("gs_note")}</span>
            <input id={`${id}-note`} className="input" maxLength={300} value={note} onChange={(e) => setNote(e.target.value)} />
          </label>
        </>
      ) : (
        <>
          <p className="gs-p">{T("gs_lead", { op: opShort })}</p>
          <p className={channels[op] ? "gs-p" : "gs-warn"}>{channels[op] ? T("gs_by_email", { to: channels[op] }) : T("gs_mock")}</p>
          <fieldset className="gs-list">
            <legend>{T("gs_checklist")}, {T(kind === "company" ? "gs_for_company" : "gs_for_person").toLowerCase()}</legend>
            {list.map((d) => {
              const c = pkg.checklist.find((x) => x.id === d.id);
              return (
                <label key={d.id} className={"gs-doc" + (c?.required && !c.present ? " miss" : "")}>
                  <input type="checkbox" checked={!!c?.present} disabled={d.auto} onChange={() => toggle(d.id)} />
                  <span>{d.name[lang] || d.name.ro}{d.auto ? <small>{T("gs_auto")}</small> : d.optional ? <small>{T("gs_optional")}</small> : null}</span>
                </label>
              );
            })}
            <label className="gs-doc gs-rep"><input type="checkbox" checked={rep} onChange={(e) => setRep(e.target.checked)} /><span>{T("gs_rep")}</span></label>
          </fieldset>
          <p className="gs-hint">{T("gs_confirm_note")}</p>
          {missingDetails.length > 0 && <p className="gs-warn">{T("gs_details_first")}</p>}
          {pkg.powerBlocks.map((c) => <p key={c} className="gs-warn" role="alert">{T("gs_power_" + c, { kw: kwTxt(installedKw), max: kwTxt(powerMax[c]) })}</p>)}
          {pkg.powerWarns.map((c) => <p key={c} className="gs-hint">{T("gs_power_" + c, { kw: kwTxt(installedKw) })}</p>)}
          {pkg.missingDocs.length > 0 && <p className="gs-hint">{T("gs_missing_docs", { list: pkg.missingDocs.map((d) => docName(op, d)).join(", ") })}</p>}
          <label className="gs-field" htmlFor={`${id}-note`}><span>{T("gs_note")}</span>
            <input id={`${id}-note`} className="input" maxLength={300} value={note} onChange={(e) => setNote(e.target.value)} />
          </label>
          <button type="button" className="gf-mark primary gs-send" disabled={busy || needsDb || !pkg.complete}
            onClick={() => call({ action: "submit", operator: op, attached, representative: rep, note })}>
            <Send size={14} aria-hidden="true" />{busy ? T("gs_sending") : T("gs_send", { op: opShort })}
          </button>
        </>
      )}
      {msg && <p className="gf-err" role="alert">{msg}</p>}

      {latest && events.length > 0 && (
        <details className="gs-hist">
          <summary>{T("gs_history")} ({events.length})</summary>
          <ol>
            {events.map((e) => (
              <li key={e.id}>{when(e.created_at)}: {T("gs_st_" + e.to_status)}{e.note && e.note !== "mock" && e.note !== "email" ? `, ${e.note}` : ""}</li>
            ))}
          </ol>
        </details>
      )}
    </div>
  );
}
