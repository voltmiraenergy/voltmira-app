"use client";
// app/(app)/admin/grid/GridRulesAdmin.jsx — the platform admin's form for one grid operator's rules: the documents
// per applicant kind, an operator's own extra documents, how recent a document must be, and the usual days per
// step. Publishing sends the whole form to /api/admin/grid-rules, which stores it as the next version.
import { useState } from "react";
import { useRouter } from "next/navigation";
import { GRID_OPERATORS, KNOWN_DOCS, AUTO_DOCS, WAIT_STATUSES } from "../../../../lib/gridRules.js";
import { docName } from "../../../../lib/gridSubmission.js";
import { OPERATORS } from "../../../../lib/mdGrid.js";
import { gt } from "../../../../lib/gridText.js";
import { xt } from "../../../../lib/integrationText.js";
import { at } from "../../../../lib/adminText.js";

const LANGS = ["ro", "ru", "en", "uk"];
const fresh = (r) => ({
  docs: { person: [...r.docs.person], company: [...r.docs.company] },
  custom: structuredClone(r.custom || {}),
  maxAgeDays: { ...(r.maxAgeDays || {}) },
  expectedDays: { ...r.expectedDays },
  note: "",
});

export default function GridRulesAdmin({ current, history = [], lang, canPublish }) {
  const router = useRouter();
  const G = (k, v) => gt(k, lang, v);
  const [op, setOp] = useState(GRID_OPERATORS[0]);
  const [f, setF] = useState(() => fresh(current[GRID_OPERATORS[0]]));
  const [nc, setNc] = useState({ id: "", name: { ro: "", ru: "", en: "", uk: "" }, optional: false });
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);
  const [bad, setBad] = useState([]);

  const rules = current[op];
  const pick = (o) => { setOp(o); setF(fresh(current[o])); setMsg(null); setBad([]); };
  const all = [...KNOWN_DOCS, ...Object.keys(f.custom)];
  const listed = [...new Set([...f.docs.person, ...f.docs.company])];
  const nameOf = (id) => docName(id, lang, { custom: f.custom });
  const toggle = (kind, id) => setF((s) => ({ ...s, docs: { ...s.docs, [kind]: s.docs[kind].includes(id) ? s.docs[kind].filter((x) => x !== id) : [...s.docs[kind], id] } }));

  function addCustom() {
    const id = nc.id.trim().toLowerCase();
    if (!/^[a-z][a-z0-9_]{1,29}$/.test(id) || all.includes(id) || LANGS.some((l) => !nc.name[l].trim())) { setBad(["custom_new"]); return; }
    setF((s) => ({ ...s, custom: { ...s.custom, [id]: { name: { ...nc.name }, optional: nc.optional } } }));
    setNc({ id: "", name: { ro: "", ru: "", en: "", uk: "" }, optional: false });
    setBad([]);
  }
  function removeCustom(id) {
    setF((s) => {
      const custom = { ...s.custom }; delete custom[id];
      const maxAgeDays = { ...s.maxAgeDays }; delete maxAgeDays[id];
      return { ...s, custom, maxAgeDays, docs: { person: s.docs.person.filter((x) => x !== id), company: s.docs.company.filter((x) => x !== id) } };
    });
  }

  async function publish() {
    setBusy(true); setMsg(null); setBad([]);
    try {
      const res = await fetch("/api/admin/grid-rules", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ operator: op, ...f }) });
      const j = await res.json().catch(() => ({}));
      if (j.ok && j.unchanged) setMsg({ ok: true, text: at("ad_unchanged", lang) });
      else if (j.ok) { setMsg({ ok: true, text: G("gr_published", { v: j.rule.version }) }); router.refresh(); }
      else if (j.error === "invalid") { setBad(j.fields || []); setMsg({ ok: false, text: at("ad_invalid", lang) }); }
      else setMsg({ ok: false, text: j.error === "needs_db" ? G("gr_needs_db") : at("ad_failed", lang) });
    } catch { setMsg({ ok: false, text: at("ad_failed", lang) }); }
    finally { setBusy(false); }
  }

  return (
    <>
      <div className="adm-seg" role="tablist">
        {GRID_OPERATORS.map((o) => (
          <button key={o} type="button" role="tab" aria-selected={o === op} className={"adm-tab" + (o === op ? " on" : "")} onClick={() => pick(o)}>{OPERATORS[o].short}</button>
        ))}
      </div>

      <section className="adm-card">
        <h2>{OPERATORS[op].name}</h2>
        <p>{G("gr_in_force", { v: rules.version || 1 })}</p>
        <div className="adm-grid" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(280px,1fr))" }}>
          {["person", "company"].map((kind) => (
            <fieldset key={kind} className={"gra-docs" + (bad.includes("docs_" + kind) ? " bad" : "")}>
              <legend>{G(kind === "person" ? "gr_docs_person" : "gr_docs_company")}</legend>
              {all.map((id) => (
                <label key={id}>
                  <input type="checkbox" checked={AUTO_DOCS.includes(id) || f.docs[kind].includes(id)} disabled={AUTO_DOCS.includes(id) || !canPublish} onChange={() => toggle(kind, id)} />
                  <span>{nameOf(id)}{AUTO_DOCS.includes(id) && <small>{G("gr_auto")}</small>}</span>
                </label>
              ))}
            </fieldset>
          ))}
        </div>
      </section>

      <section className="adm-card">
        <h2>{G("gr_age_h")}</h2>
        <p>{G("gr_age_p")}</p>
        <div className="adm-grid">
          {listed.filter((id) => !AUTO_DOCS.includes(id)).map((id) => (
            <label key={id} className={"adm-f" + (bad.includes("max_age") ? " bad" : "")}>
              <span>{nameOf(id)}</span>
              <input type="number" min="1" max="3650" inputMode="numeric" disabled={!canPublish} value={f.maxAgeDays[id] ?? ""}
                onChange={(e) => setF((s) => ({ ...s, maxAgeDays: { ...s.maxAgeDays, [id]: e.target.value === "" ? "" : Number(e.target.value) } }))} />
            </label>
          ))}
        </div>
      </section>

      <section className="adm-card">
        <h2>{G("gr_exp_h")}</h2>
        <p>{G("gr_exp_p")}</p>
        <div className="adm-grid">
          {WAIT_STATUSES.map((s) => (
            <label key={s} className={"adm-f" + (bad.includes("expected_" + s) ? " bad" : "")}>
              <span>{xt("gs_st_" + s, lang)}</span>
              <input type="number" min="1" max="365" inputMode="numeric" disabled={!canPublish} value={f.expectedDays[s] ?? ""}
                onChange={(e) => setF((x) => ({ ...x, expectedDays: { ...x.expectedDays, [s]: e.target.value === "" ? "" : Number(e.target.value) } }))} />
            </label>
          ))}
        </div>
      </section>

      <section className="adm-card">
        <h2>{G("gr_custom_h")}</h2>
        <p>{G("gr_custom_p")}</p>
        {Object.keys(f.custom).map((id) => (
          <div key={id} className="gra-custom">
            <code>{id}</code><span>{nameOf(id)}{f.custom[id].optional && <small> ({G("gr_optional").toLowerCase()})</small>}</span>
            <button type="button" className="btn ghost sm" disabled={!canPublish} onClick={() => removeCustom(id)}>{G("gr_custom_remove")}</button>
          </div>
        ))}
        <div className={"adm-doc" + (bad.includes("custom_new") ? " gra-bad" : "")}>
          <label className="adm-f"><span>{G("gr_custom_id")}</span><input value={nc.id} disabled={!canPublish} onChange={(e) => setNc({ ...nc, id: e.target.value })} placeholder="tax_cert" /></label>
          {LANGS.map((l) => (
            <label key={l} className="adm-f"><span>{l.toUpperCase()}</span><input value={nc.name[l]} disabled={!canPublish} onChange={(e) => setNc({ ...nc, name: { ...nc.name, [l]: e.target.value } })} /></label>
          ))}
          <label className="adm-checks"><input type="checkbox" checked={nc.optional} disabled={!canPublish} onChange={(e) => setNc({ ...nc, optional: e.target.checked })} />{G("gr_optional")}</label>
        </div>
        <button type="button" className="btn ghost sm" disabled={!canPublish} onClick={addCustom}>{G("gr_custom_add")}</button>
      </section>

      <section className="adm-card">
        <label className="adm-f"><span>{G("gr_note")}</span>
          <textarea rows={2} maxLength={1000} disabled={!canPublish} value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} />
        </label>
        <div className="adm-actions">
          <button type="button" className="btn primary" disabled={busy || !canPublish} onClick={publish}>{G("gr_publish", { v: (rules.version || 1) + 1 })}</button>
          {msg && <span className={"adm-msg " + (msg.ok ? "ok" : "bad")} role="status">{msg.text}</span>}
        </div>
      </section>

      {history.length > 0 && (
        <section className="adm-card">
          <h2>{G("gr_versions")}</h2>
          <div className="adm-scroll">
            <table className="adm-table">
              <tbody>
                {history.filter((h) => h.operator === op).map((h) => (
                  <tr key={h.version}>
                    <td className="num">{G("gr_by", { v: h.version, d: h.at ? new Date(h.at).toLocaleDateString({ en: "en-GB", ro: "ro-RO", ru: "ru-RU", uk: "uk-UA" }[lang] || "ro-RO", { timeZone: "Europe/Chisinau" }) : "", who: h.by })}</td>
                    <td>{h.note}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
      <style>{`
        .gra-docs{border:1px solid var(--line);border-radius:12px;padding:12px 14px;margin:0;display:grid;gap:8px;min-width:0}
        .gra-docs legend{font-weight:700;font-size:13.5px;padding:0 4px}
        .gra-docs label{display:flex;gap:9px;align-items:flex-start;font-size:13.5px;line-height:1.4}
        .gra-docs label input{margin-top:2px;flex:none;accent-color:var(--green)}
        .gra-docs small{display:block;font-size:12px;color:var(--muted)}
        .gra-docs.bad{border-color:#C4543B}
        .gra-custom{display:flex;gap:12px;align-items:center;padding:8px 0;border-bottom:1px solid var(--line);font-size:13.5px}
        .gra-custom span{flex:1;min-width:0}
        .gra-bad input{border-color:#C4543B}
      `}</style>
    </>
  );
}
