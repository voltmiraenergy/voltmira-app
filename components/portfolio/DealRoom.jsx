"use client";
// components/portfolio/DealRoom.jsx — a plant's deal room for the banks, as
// the installer runs it: open a read-only link for one bank (its name, how
// long it stays open, the page's language), copy it, see it as the bank does,
// close it; which questions still wait for an answer; and the log of who
// opened what and when (each visitor numbered per link; no address is kept).
// The data and the writes are useDealRoom's.
import { useId, useState } from "react";
import { dt } from "../../lib/dealText.js";
import { plt } from "../../lib/plantText.js";
import { namesList } from "../../lib/portfolioDisplay.js";
import { BANK_SUGGESTIONS, EXPIRY_DAYS, DEFAULT_EXPIRY_DAYS, LINK_LANGS, linkState, viewSummary, isAnswered, ITEM_IDS } from "../../lib/dealRoom.js";
import { fmtDate } from "../../lib/tz.js";

const LOC = { en: "en-IE", ro: "ro-RO", ru: "ru-RU", uk: "uk-UA" };
const LANG_NAME = { ro: { en: "Romanian", ro: "română", ru: "румынский", uk: "румунська" }, en: { en: "English", ro: "engleză", ru: "английский", uk: "англійська" } };

export default function DealRoom({ deal, lang, disabled = false }) {
  const id = useId();
  const [bank, setBank] = useState("");
  const [days, setDays] = useState(DEFAULT_EXPIRY_DAYS);
  const [linkLang, setLinkLang] = useState("ro");
  const [notify, setNotifyOn] = useState(true);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [copied, setCopied] = useState("");
  const day = (iso) => fmtDate(iso, LOC[lang], { day: "numeric", month: "long", year: "numeric" });
  const when = (iso) => fmtDate(iso, LOC[lang], { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

  if (deal.ready && deal.needsDb) {
    return (
      <section className="dr" aria-label={dt("dr_h", lang)}>
        <h4>{dt("dr_h", lang)}</h4>
        <p className="pf-hint">{dt("dr_needs_db", lang)}</p>
      </section>
    );
  }

  const summary = viewSummary(deal.views);
  // visitors numbered per link, in the order they first came
  const visitorNo = {};
  for (const v of [...deal.views].sort((a, b) => String(a.at).localeCompare(String(b.at)))) {
    const k = `${v.link_id}|${v.visitor}`;
    if (!visitorNo[k]) visitorNo[k] = Object.keys(visitorNo).filter((x) => x.startsWith(v.link_id + "|")).length + 1;
  }
  const bankOf = (linkId) => deal.links.find((l) => l.id === linkId)?.bank || "";
  const open = deal.questions.filter((q) => !isAnswered(q));
  const openItems = [...new Set(open.map((q) => q.item_id))].filter((x) => ITEM_IDS.includes(x)).map((x) => plt("pm_" + x, lang));
  const what = (v) => v.what === "document" ? dt("lw_document", lang, { x: v.detail }) : v.what === "question" ? dt("lw_question", lang, { x: v.detail }) : dt("lw_" + v.what, lang);

  async function create(e) {
    e.preventDefault();
    if (!bank.trim()) { setErr(dt("dr_err_bank", lang)); return; }
    setBusy(true); setErr("");
    const r = await deal.createLink({ bank, days, lang: linkLang, notify });
    setBusy(false);
    if (r.ok) setBank("");
    else setErr(r.error === "needs_db" ? dt("dr_needs_db", lang) : r.error === "plant" ? dt("dr_err_save_first", lang) : r.error === "bank" ? dt("dr_err_bank", lang) : dt("dr_err", lang));
  }
  async function copy(l) {
    const url = `${window.location.origin}/d/${l.token}`;
    try { await navigator.clipboard.writeText(url); } catch { window.prompt(dt("dr_copy", lang), url); }
    setCopied(l.id);
    setTimeout(() => setCopied(""), 2000);
  }
  async function close(l) {
    if (!window.confirm(dt("dr_revoke_q", lang, { x: l.bank }))) return;
    await deal.revoke(l.id);
  }

  return (
    <section className="dr" aria-label={dt("dr_h", lang)}>
      <h4>{dt("dr_h", lang)}</h4>
      <p className="pf-hint">{dt("dr_p", lang)}</p>
      {open.length > 0 && <p className="pl-line dr-open">{dt("dr_open_q", lang, { n: open.length, x: namesList(openItems, lang, 4) })}</p>}

      <form className="dr-form" onSubmit={create}>
        <div className="field">
          <label htmlFor={id + "b"}>{dt("dr_bank", lang)}</label>
          <input id={id + "b"} className="input" list={id + "bl"} value={bank} maxLength={80} placeholder={dt("dr_bank_ph", lang)} onChange={(e) => setBank(e.target.value)} />
          <datalist id={id + "bl"}>{BANK_SUGGESTIONS.map((b) => <option key={b} value={b} />)}</datalist>
        </div>
        <div className="field">
          <label htmlFor={id + "d"}>{dt("dr_days", lang)}</label>
          <select id={id + "d"} className="input" value={days} onChange={(e) => setDays(Number(e.target.value))}>
            {EXPIRY_DAYS.map((n) => <option key={n} value={n}>{dt("dr_days_v", lang, { n })}</option>)}
          </select>
        </div>
        <div className="field">
          <label htmlFor={id + "l"}>{dt("dr_lang", lang)}</label>
          <select id={id + "l"} className="input" value={linkLang} onChange={(e) => setLinkLang(e.target.value)}>
            {LINK_LANGS.map((l) => <option key={l} value={l}>{LANG_NAME[l][lang] || LANG_NAME[l].en}</option>)}
          </select>
        </div>
        <button type="submit" className="btn primary sm" disabled={busy || disabled || !deal.ready} aria-busy={busy}>{dt("dr_create", lang)}</button>
        <label className="dr-notify"><input type="checkbox" checked={notify} onChange={(e) => setNotifyOn(e.target.checked)} />{dt("dr_notify", lang)}</label>
      </form>
      {err && <p className="if-err" role="alert">{err}</p>}

      {deal.links.length === 0 ? <p className="pf-hint">{dt("dr_none", lang)}</p> : (
        <div className="pf-scroll">
          <table className="pf-t dr-links">
            <thead><tr><th>{dt("dr_c_bank", lang)}</th><th>{dt("dr_c_until", lang)}</th><th>{dt("dr_c_state", lang)}</th><th className="r">{dt("dr_c_visits", lang)}</th><th>{dt("dr_c_last", lang)}</th><th>{dt("dr_alerts", lang)}</th><th /></tr></thead>
            <tbody>
              {deal.links.map((l) => {
                const st = linkState(l);
                const s = summary[l.id];
                return (
                  <tr key={l.id} className={"dr-" + st}>
                    <td><b>{l.bank}</b><small>{LANG_NAME[l.lang]?.[lang] || l.lang}</small></td>
                    <td className="nw">{day(l.expires_at)}</td>
                    <td><span className={"dr-st dr-st-" + st}>{dt("ls_" + st, lang)}</span></td>
                    <td className="r">{s ? s.visits : 0}</td>
                    <td className="nw">{s?.last ? when(s.last) : ""}</td>
                    <td>{st === "active" && (
                      <button type="button" className={"dr-alert" + (l.notify !== false ? " on" : "")} aria-pressed={l.notify !== false} title={dt("dr_alerts_h", lang, { x: l.bank })}
                        onClick={() => deal.setNotify(l, l.notify === false)}>{dt(l.notify !== false ? "dr_alerts_on" : "dr_alerts_off", lang)}</button>
                    )}</td>
                    <td className="dr-acts">
                      {st === "active" && (
                        <>
                          <button type="button" className="btn ghost sm" onClick={() => copy(l)}>{copied === l.id ? dt("dr_copied", lang) : dt("dr_copy", lang)}</button>
                          <a className="btn ghost sm" href={`/d/${l.token}`} target="_blank" rel="noopener noreferrer">{dt("dr_view", lang)}</a>
                          <button type="button" className="btn ghost sm dr-close" onClick={() => close(l)}>{dt("dr_revoke", lang)}</button>
                        </>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {deal.links.length > 0 && (
        <>
          <h5 className="dr-log-h">{dt("dr_log_h", lang)}</h5>
          {deal.views.length === 0 ? <p className="pf-hint">{dt("dr_log_none", lang)}</p> : (
            <>
              <div className="pf-scroll dr-log">
                <table className="pf-t">
                  <tbody>
                    {deal.views.slice(0, 60).map((v) => (
                      <tr key={v.id}>
                        <td className="nw">{when(v.at)}</td>
                        <td><b>{bankOf(v.link_id)}</b><small>{dt("dr_visitor", lang, { n: visitorNo[`${v.link_id}|${v.visitor}`] || 1 })}{v.agent ? `, ${v.agent}` : ""}</small></td>
                        <td>{what(v)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="pf-hint">{dt("dr_log_p", lang)}</p>
            </>
          )}
        </>
      )}
    </section>
  );
}
