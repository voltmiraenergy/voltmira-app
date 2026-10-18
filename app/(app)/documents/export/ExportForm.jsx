"use client";
// app/(app)/documents/export/ExportForm.jsx — the period, the format and the
// column mapping for the 1C export. Download saves the mapping first, so the
// file always has the columns on screen.
import { useId, useState } from "react";
import { xt } from "../../../../lib/integrationText.js";

const ENTS = ["customers", "invoices", "payments"];

export default function ExportForm({ lang, initial, defaults, fields, from: from0, to: to0, needsDb }) {
  const id = useId();
  const T = (k, v) => xt(k, lang, v);
  const [from, setFrom] = useState(from0);
  const [to, setTo] = useState(to0);
  const [format, setFormat] = useState("csv");
  const [m, setM] = useState(initial);
  const [msg, setMsg] = useState(null);
  const [busy, setBusy] = useState(false);

  const rangeOk = from && to && from <= to && (Date.parse(to) - Date.parse(from)) / 864e5 <= 366;
  const setOpt = (k) => (e) => { setM((x) => ({ ...x, [k]: k === "bom" ? e.target.checked : e.target.value })); setMsg(null); };
  const setHead = (ent, f) => (e) => { setM((x) => ({ ...x, headers: { ...x.headers, [ent]: { ...x.headers[ent], [f]: e.target.value } } })); setMsg(null); };

  async function save() {
    if (needsDb) return true;
    const res = await fetch("/api/export-1c", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ mapping: m }) }).catch(() => null);
    const j = res ? await res.json().catch(() => ({})) : {};
    if (j.ok) { setM(j.mapping); return true; }
    setMsg({ ok: false, text: T("ex_save_failed") });
    return false;
  }

  async function onSave() {
    setBusy(true); setMsg(null);
    if (await save()) setMsg({ ok: true, text: T("ex_saved") });
    setBusy(false);
  }

  async function download() {
    if (!rangeOk) { setMsg({ ok: false, text: T("ex_bad_range") }); return; }
    setBusy(true); setMsg(null);
    const ok = await save();
    setBusy(false);
    if (!ok) return;
    // a file, not a page: a link the browser downloads
    const a = document.createElement("a");
    a.href = `/api/export-1c?from=${from}&to=${to}&format=${format}`;
    a.download = "";
    document.body.appendChild(a); a.click(); a.remove();
  }

  return (
    <>
      <section className="dx-card bl-card" aria-labelledby={`${id}-p`}>
        <header className="dx-card-head"><div><h2 id={`${id}-p`}>{T("ex_title")}</h2><p>{T("ex_help")}</p></div></header>
        <div className="bl-form ex-period">
          <label className="bl-field"><span>{T("ex_from")}</span><input className="input" type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></label>
          <label className="bl-field"><span>{T("ex_to")}</span><input className="input" type="date" value={to} onChange={(e) => setTo(e.target.value)} /></label>
          <label className="bl-field bl-wide2"><span>{T("ex_format")}</span>
            <select className="input" value={format} onChange={(e) => setFormat(e.target.value)}>
              <option value="csv">{T("ex_csv")}</option>
              <option value="xml">{T("ex_xml")}</option>
            </select>
          </label>
        </div>
        <div className="bl-acts">
          <button type="button" className="btn primary sm" disabled={busy} onClick={download}>{T("ex_download")}</button>
        </div>
        {msg && <p className={"bl-note " + (msg.ok ? "ok" : "bad")} role="status">{msg.text}</p>}
      </section>

      <section className="dx-card bl-card" aria-labelledby={`${id}-m`}>
        <header className="dx-card-head"><div><h2 id={`${id}-m`}>{T("ex_mapping_h")}</h2><p>{T("ex_mapping_sub")}</p></div></header>
        <div className="bl-form">
          <label className="bl-field"><span>{T("ex_delim")}</span>
            <select className="input" value={m.delimiter} onChange={setOpt("delimiter")}>
              <option value=";">{T("ex_delim_semi")}</option><option value=",">{T("ex_delim_comma")}</option><option value={"\t"}>{T("ex_delim_tab")}</option>
            </select>
          </label>
          <label className="bl-field"><span>{T("ex_decimal")}</span>
            <select className="input" value={m.decimal} onChange={setOpt("decimal")}>
              <option value=",">{T("ex_dec_comma")}</option><option value=".">{T("ex_dec_dot")}</option>
            </select>
          </label>
          <label className="bl-field"><span>{T("ex_date")}</span>
            <select className="input" value={m.dateFormat} onChange={setOpt("dateFormat")}>
              {["DD.MM.YYYY", "YYYY-MM-DD", "DD/MM/YYYY"].map((f) => <option key={f} value={f}>{f}</option>)}
            </select>
          </label>
          <label className="ex-check"><input type="checkbox" checked={m.bom} onChange={setOpt("bom")} /> <span>{T("ex_bom")}</span></label>
        </div>
        {ENTS.map((ent) => (
          <details key={ent} className="bl-hist ex-ent">
            <summary>{T("ex_ent_" + ent)}</summary>
            <div className="ex-heads">
              {fields[ent].map((f) => (
                <label key={f} className="bl-field"><span><code>{f}</code></span>
                  <input className="input" maxLength={60} value={m.headers[ent][f]} onChange={setHead(ent, f)} />
                </label>
              ))}
            </div>
          </details>
        ))}
        <div className="bl-acts">
          <button type="button" className="btn primary sm" disabled={busy || needsDb} onClick={onSave}>{T("ex_save")}</button>
          <button type="button" className="btn ghost sm" disabled={busy} onClick={() => { setM(defaults); setMsg(null); }}>{T("ex_defaults")}</button>
        </div>
      </section>
    </>
  );
}
