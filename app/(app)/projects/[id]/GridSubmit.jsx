"use client";
// app/(app)/projects/[id]/GridSubmit.jsx — on the grid card (GridFile.jsx):
// send the package to the operator with a tracked reference, then record what
// the operator answers (documents requested, approved, meter installed,
// connected, rejected). Each change reaches /api/projects/[id]/grid-submission,
// which ticks the matching stage below and tells the client. What the operator
// asks for comes from its rules (lib/gridRules.js, /admin/grid): a document that
// must be recent asks for its issue date. A file that is not complete goes only
// with an owner's or a manager's written reason. The client's language picks the
// words of their messages; the text message for the current step is shown ready
// to copy until an SMS service is connected. Styles: gridfile.css (.gs-*).
import { useEffect, useId, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Send } from "lucide-react";
import { xt } from "../../../../lib/integrationText.js";
import { gt, gridSmsText } from "../../../../lib/gridText.js";
import { ft } from "../../../../lib/feeText.js";
import { checklistFor, docName as nameOf, checkPackage, gridNext } from "../../../../lib/gridSubmission.js";
import { overdueOf } from "../../../../lib/gridRules.js";
import { PROSUMER_FORM_MAX_KW } from "../../../../lib/gridPower.js";
import { gridApplicant, gridMissing } from "../../../../lib/gridDetails.js";
import { OPERATORS } from "../../../../lib/mdGrid.js";
import { dayKeyOf } from "../../../../lib/tz.js";

const newKey = () => (globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`);
const LOCS = { en: "en-GB", ro: "ro-RO", ru: "ru-RU", uk: "uk-UA" };
const LANGS = ["ro", "ru", "en", "uk"];

export default function GridSubmit({ projectId, operator, details, client, lang, latest, events = [], channels = {}, needsDb = false, installedKw = null, ceilingKw = null,
  rules = null, canOverride = false, clientLang, companyName = "", today = "" }) {
  const router = useRouter();
  const id = useId();
  const T = (k, v) => xt(k, lang, v);
  const G = (k, v) => gt(k, lang, v);
  const op = OPERATORS[operator] ? operator : "premier";
  const opShort = OPERATORS[op].short;
  const opRules = rules?.[op] || null;
  // what was ticked and dated stays across a refresh (it was lost, and the checklist read as untouched again)
  const [kept, setKept] = useState({ attached: [], docDates: {} });
  const { attached, docDates } = kept;
  const tickKey = `vm-grid-ticks-${projectId}`, dateKey = `vm-grid-dates-${projectId}`;
  useEffect(() => {
    const read = (k, d) => { try { return JSON.parse(localStorage.getItem(k) || d); } catch { return null; } };
    const a = read(tickKey, "[]"), d = read(dateKey, "{}");
    setKept({
      attached: Array.isArray(a) ? a.filter((x) => typeof x === "string").slice(0, 20) : [],
      docDates: d && typeof d === "object" ? Object.fromEntries(Object.entries(d).filter(([, v]) => /^\d{4}-\d{2}-\d{2}$/.test(String(v)))) : {},
    });
  }, [tickKey, dateKey]);
  const [rep, setRep] = useState(!!details?.repName);
  const [note, setNote] = useState("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);
  const [cLang, setCLang] = useState(clientLang || "");
  const [copied, setCopied] = useState(false);

  const applicant = useMemo(() => gridApplicant(details, client), [details, client]);
  const missingDetails = useMemo(() => gridMissing(applicant), [applicant]);
  const kind = applicant.kind;
  const list = checklistFor(op, kind, opRules);
  const pkg = checkPackage({ operator: op, kind, missingDetails, attached, representative: rep, installedKw, contractedKw: applicant.contractedKw, ceilingKw, rules: opRules, docDates, today });
  const docName = (d) => nameOf(d, lang, opRules);
  const kwTxt = (v) => Number(v).toLocaleString(LOCS[lang] || "ro-RO", { maximumFractionDigits: 1 });
  const powerMax = { over_contracted: applicant.contractedKw, over_household_ceiling: ceilingKw, over_form_max: PROSUMER_FORM_MAX_KW };
  const connected = latest?.status === "connected";
  const open = latest && !["rejected", "connected"].includes(latest.status);
  const when = (d) => new Intl.DateTimeFormat(LOCS[lang] || "ro-RO", { day: "numeric", month: "short" }).format(new Date(d));

  // how long the file has been in its step, against the operator's usual days
  const since = latest ? [...events].reverse().find((e) => e.to_status === latest.status)?.created_at || latest.updated_at || latest.created_at : null;
  const wait = latest && today ? overdueOf(latest.status, dayKeyOf(since), today, rules?.[latest.operator]) : null;
  // the text message for the step the file is in, in the client's language
  const smsLang = LANGS.includes(cLang) ? cLang : lang;
  const sms = latest ? gridSmsText(latest.status, smsLang, { company: companyName, op: OPERATORS[latest.operator]?.short || "", ref: latest.reference }) : "";

  async function call(payload) {
    if (busy) return null;
    setBusy(true); setMsg(null);
    try {
      const res = await fetch(`/api/projects/${projectId}/grid-submission`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const j = await res.json().catch(() => ({}));
      // a won job whose fee is overdue (lib/jobFees.js): the fee card's payment opens
      if (j.error === "not_signed") { window.dispatchEvent(new Event("vm-sign-needed")); return j; }
      if (j.error === "demo_only") { setMsg(ft("demo_only", lang)); return j; }
      if (j.error === "job_fee_due" || j.error === "needs_idno" || j.error === "needs_kw") { window.dispatchEvent(new Event("vm-fee-locked")); setMsg(ft(j.error === "job_fee_due" ? "locked_short" : j.error, lang)); return j; }
      if (!j.ok) {
        const k = "gs_e_" + j.error;
        setMsg(G(k) !== k ? G(k) : T(k) !== k ? T(k) : j.error === "needs_db" ? T("bl_needs_db") : T("gs_e_other"));
      } else if (payload.action !== "client_lang") { setNote(""); setReason(""); router.refresh(); }
      return j;
    } catch { setMsg(T("gs_e_other")); return null; }
    finally { setBusy(false); }
  }

  const toggle = (d) => setKept((k) => {
    const next = k.attached.includes(d) ? k.attached.filter((x) => x !== d) : [...k.attached, d];
    try { localStorage.setItem(tickKey, JSON.stringify(next)); } catch { /* not kept */ }
    return { ...k, attached: next };
  });
  const setDate = (d, v) => setKept((k) => {
    const next = { ...k.docDates, [d]: v };
    if (!v) delete next[d];
    try { localStorage.setItem(dateKey, JSON.stringify(next)); } catch { /* not kept */ }
    return { ...k, docDates: next };
  });
  async function pickLang(v) {
    const before = cLang;
    setCLang(v);
    const j = await call({ action: "client_lang", lang: v || null });
    if (!j?.ok) setCLang(before);
  }

  // what an exception sends past, said plainly
  const blockerText = (b) => {
    const [k, v] = b.split(":");
    if (k === "doc") return docName(v);
    if (k === "age") return G("gs_ov_age", { doc: docName(v) });
    return G("gs_ov_power");
  };
  const submitBody = { action: "submit", operator: op, attached, representative: rep, note, docDates };

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
          {wait?.expected != null && wait.days != null && (
            <p className={wait.overdue ? "gs-warn" : "gs-hint"}>{G("gs_overdue", { d: wait.days, e: wait.expected })}</p>
          )}
          {latest.channel === "mock" && <p className="gs-warn">{T("gs_mock")}</p>}
          <div className="gs-acts">
            {gridNext(latest.status).filter((s) => s !== "submitted").map((s) => (
              <button key={s} type="button" className={"gf-mark" + (["approved", "meter_installed", "connected"].includes(s) ? " primary" : "")} disabled={busy}
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
              const old = pkg.expiredDocs.find((x) => x.id === d.id);
              return (
                <div key={d.id} className="gs-doc-row">
                  <label className={"gs-doc" + ((c?.required && !c.present) || old ? " miss" : "")}>
                    <input type="checkbox" checked={!!c?.present} disabled={d.auto} onChange={() => toggle(d.id)} />
                    <span>{d.name[lang] || d.name.ro}
                      {d.auto ? <small>{T("gs_auto")}</small> : d.optional ? <small>{T("gs_optional")}</small> : null}
                      {d.maxAgeDays ? <small>{G("gs_age_note", { max: d.maxAgeDays })}</small> : null}
                    </span>
                  </label>
                  {d.maxAgeDays && c?.present && (
                    <label className="gs-date" htmlFor={`${id}-d-${d.id}`}>
                      <span>{G("gs_issued")}</span>
                      <input id={`${id}-d-${d.id}`} className="input" type="date" max={today || undefined} value={docDates[d.id] || ""} onChange={(e) => setDate(d.id, e.target.value)} />
                    </label>
                  )}
                </div>
              );
            })}
            <label className="gs-doc gs-rep"><input type="checkbox" checked={rep} onChange={(e) => setRep(e.target.checked)} /><span>{T("gs_rep")}</span></label>
          </fieldset>
          <p className="gs-hint">{T("gs_confirm_note")}</p>
          {missingDetails.length > 0 && <p className="gs-warn">{T("gs_details_first")}</p>}
          {pkg.expiredDocs.map((x) => (
            <p key={x.id} className="gs-warn" role="alert">{G("gs_age_" + x.state, { doc: docName(x.id), age: x.age, max: x.max })}</p>
          ))}
          {pkg.powerBlocks.map((c) => <p key={c} className="gs-warn" role="alert">{T("gs_power_" + c, { kw: kwTxt(installedKw), max: kwTxt(powerMax[c]) })}</p>)}
          {pkg.powerWarns.map((c) => <p key={c} className="gs-hint">{T("gs_power_" + c, { kw: kwTxt(installedKw) })}</p>)}
          {pkg.missingDocs.length > 0 && <p className="gs-hint">{T("gs_missing_docs", { list: pkg.missingDocs.map(docName).join(", ") })}</p>}
          <label className="gs-field" htmlFor={`${id}-note`}><span>{T("gs_note")}</span>
            <input id={`${id}-note`} className="input" maxLength={300} value={note} onChange={(e) => setNote(e.target.value)} />
          </label>
          <button type="button" className="gf-mark primary gs-send" disabled={busy || needsDb || !pkg.complete}
            onClick={() => call(submitBody)}>
            <Send size={14} aria-hidden="true" />{busy ? T("gs_sending") : T("gs_send", { op: opShort })}
          </button>

          {/* not complete: the owner or a manager may still send it, with a reason that stays with the file */}
          {!pkg.complete && pkg.overridable && !needsDb && (canOverride ? (
            <details className="gs-ov">
              <summary>{G("gs_ov_h")}</summary>
              <p className="gs-hint">{G("gs_ov_p", { list: pkg.blockers.map(blockerText).join(", ") })}</p>
              <label className="gs-field" htmlFor={`${id}-why`}><span>{G("gs_ov_reason")}</span>
                <textarea id={`${id}-why`} className="input" rows={2} maxLength={500} value={reason} onChange={(e) => setReason(e.target.value)} />
              </label>
              <button type="button" className="gf-mark gs-send" disabled={busy || reason.trim().length < 10}
                onClick={() => call({ ...submitBody, override: { reason } })}>{G("gs_ov_send", { op: opShort })}</button>
            </details>
          ) : <p className="gs-hint">{G("gs_ov_only")}</p>)}
        </>
      )}
      {msg && <p className="gf-err" role="alert">{msg}</p>}

      {/* the language of the client's emails and text messages */}
      <label className="gs-field gs-lang" htmlFor={`${id}-lang`}><span>{G("gs_lang")}</span>
        <select id={`${id}-lang`} className="input" value={cLang} disabled={busy} onChange={(e) => pickLang(e.target.value)}>
          <option value="">{G("gs_lang_auto", { l: G("lang_" + lang) })}</option>
          {LANGS.map((l) => <option key={l} value={l}>{G("lang_" + l)}</option>)}
        </select>
      </label>

      {sms && (
        <details className="gs-sms">
          <summary>{G("gs_sms_h")}</summary>
          <p className="gs-hint">{G("gs_sms_p")}</p>
          <div className="gs-sms-box">
            <p lang={smsLang}>{sms}</p>
            <button type="button" className="gf-mark" onClick={() => { navigator.clipboard?.writeText(sms); setCopied(true); setTimeout(() => setCopied(false), 1600); }}>
              {copied ? G("gs_copied") : G("gs_copy")}
            </button>
          </div>
        </details>
      )}

      {latest && events.length > 0 && (
        <details className="gs-hist">
          <summary>{T("gs_history")} ({events.length})</summary>
          <ol>
            {events.map((e) => (
              <li key={e.id}>{when(e.created_at)}: {String(e.note || "").startsWith("override: ")
                ? G("gs_ov_hist", { r: e.note.slice(10) })
                : <>{T("gs_st_" + e.to_status)}{e.note && e.note !== "mock" && e.note !== "email" ? `, ${e.note}` : ""}</>}</li>
            ))}
          </ol>
        </details>
      )}
    </div>
  );
}
