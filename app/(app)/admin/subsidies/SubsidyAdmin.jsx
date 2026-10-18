"use client";
// app/(app)/admin/subsidies/SubsidyAdmin.jsx — the programmes (latest version
// of each), and a form that publishes a new version of one, or a new one.
// Checked with the same function the server uses (lib/adminValidate.js).
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { at } from "../../../../lib/adminText.js";
import { latestPrograms } from "../../../../lib/eligibility.js";
import { validateSubsidyInput } from "../../../../lib/adminValidate.js";

const LANGS = ["en", "ro", "ru", "uk"];
const KINDS = ["tax", "duty", "grant", "guarantee", "loan"];
const WHO = ["household", "sme", "company"];
const NEEDS = [["requiresBattery", "n_battery"], ["vatPayer", "n_vat"], ["netMetering", "n_net"], ["loan", "n_loan"]];
const blankName = () => ({ en: "", ro: "", ru: "", uk: "" });
const lei = (minor) => (minor == null ? "" : String(minor / 100));

function formFrom(p) {
  const e = p?.eligibility || {}, est = p?.estimate || { type: "info" };
  return {
    code: p?.code || "", kind: p?.kind || "grant", name: { ...blankName(), ...(p?.name || {}) }, provider: p?.provider || "",
    clientKinds: e.clientKinds || [], requiresBattery: !!e.requiresBattery, vatPayer: !!e.vatPayer, netMetering: !!e.netMetering, loan: !!e.loan,
    minKw: e.minKw ?? "", maxKw: e.maxKw ?? "",
    estimateType: est.type || "info", base: est.base || "battery", pct: est.pct ?? "", upTo: !!est.upTo,
    capLei: lei(est.capMinor), amountLei: lei(est.amountMinor), fromPct: est.fromPct ?? "", toPct: est.toPct ?? "",
    documents: (p?.required_documents || []).map((d) => ({ id: d.id, name: { ...blankName(), ...d.name } })),
    valid_from: p?.valid_from || "", valid_to: p?.valid_to || "", active: p?.active !== false, source_url: p?.source_url || "",
  };
}

export default function SubsidyAdmin({ programs, lang, canPublish }) {
  const router = useRouter();
  const latest = useMemo(() => latestPrograms(programs.map((p) => ({ ...p, active: true }))).sort((a, b) => a.code.localeCompare(b.code)), [programs]);
  const [editing, setEditing] = useState(latest[0]?.code || "");
  const [form, setForm] = useState(() => formFrom(latest[0]));
  const [msg, setMsg] = useState(null);
  const [busy, setBusy] = useState(false);
  const check = validateSubsidyInput(form);
  const bad = new Set(check.ok ? [] : check.errors);
  const isBad = (k) => [...bad].some((e) => e === k || e.startsWith(k + "."));

  const edit = (p) => { setEditing(p?.code || ""); setForm(formFrom(p)); setMsg(null); };
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.type === "checkbox" ? e.target.checked : e.target.value }));
  const setName = (l) => (e) => setForm((f) => ({ ...f, name: { ...f.name, [l]: e.target.value } }));
  const toggleWho = (k) => () => setForm((f) => ({ ...f, clientKinds: f.clientKinds.includes(k) ? f.clientKinds.filter((x) => x !== k) : [...f.clientKinds, k] }));
  const setDoc = (i, k, l) => (e) => setForm((f) => ({ ...f, documents: f.documents.map((d, j) => (j !== i ? d : l ? { ...d, name: { ...d.name, [l]: e.target.value } } : { ...d, [k]: e.target.value })) }));

  async function publish() {
    if (!check.ok) { setMsg({ ok: false, text: at("ad_invalid", lang) }); return; }
    setBusy(true); setMsg(null);
    try {
      const res = await fetch("/api/admin/subsidies", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) setMsg({ ok: false, text: j.error === "invalid" ? at("ad_invalid", lang) : j.error === "needs_db" ? at("ad_needs_db", lang) : at("ad_failed", lang) });
      else { setMsg({ ok: true, text: j.unchanged ? at("ad_unchanged", lang) : at("sb_published", lang, { v: j.program.version }) }); router.refresh(); }
    } catch { setMsg({ ok: false, text: at("ad_failed", lang) }); }
    finally { setBusy(false); }
  }

  return (
    <>
      <section className="adm-card">
        <h2>{at("sb_list", lang)}</h2>
        <div className="adm-scroll">
          <table className="adm-table">
            <thead><tr><th>{at("sb_code", lang)}</th><th>{at("tr_col_v", lang)}</th><th>{at("sb_kind", lang)}</th><th>{at("sb_name", lang, { l: lang })}</th><th /></tr></thead>
            <tbody>
              {latest.map((p) => (
                <tr key={p.code}>
                  <td><code>{p.code}</code></td>
                  <td className="num">v{p.version}{programs.find((x) => x.code === p.code && x.version === p.version)?.active === false ? ` (${at("sb_inactive", lang)})` : ""}</td>
                  <td>{at("k_" + p.kind, lang)}</td>
                  <td>{p.name?.[lang] || p.name?.en}</td>
                  <td><button type="button" className="btn ghost sm" onClick={() => edit(p)}>{at("sb_edit", lang)}</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="adm-actions"><button type="button" className="btn ghost" onClick={() => edit(null)}>{at("sb_add", lang)}</button></div>
      </section>

      <section className="adm-card">
        <h2>{editing ? `${editing}` : at("sb_add", lang)}</h2>
        <div className="adm-grid">
          <label className={"adm-f" + (isBad("code") ? " bad" : "")} htmlFor="sb-code">{at("sb_code", lang)}
            <input id="sb-code" value={form.code} onChange={set("code")} readOnly={!!editing} />
          </label>
          <label className={"adm-f" + (isBad("kind") ? " bad" : "")} htmlFor="sb-kind">{at("sb_kind", lang)}
            <select id="sb-kind" value={form.kind} onChange={set("kind")}>{KINDS.map((k) => <option key={k} value={k}>{at("k_" + k, lang)}</option>)}</select>
          </label>
          <label className="adm-f" htmlFor="sb-provider">{at("sb_provider", lang)}<input id="sb-provider" value={form.provider} onChange={set("provider")} /></label>
          {LANGS.map((l) => (
            <label key={l} className={"adm-f" + (isBad("name." + l) ? " bad" : "")} htmlFor={`sb-name-${l}`}>{at("sb_name", lang, { l: l.toUpperCase() })}
              <input id={`sb-name-${l}`} value={form.name[l]} onChange={setName(l)} />
            </label>
          ))}
        </div>

        <h3 style={{ fontSize: 14, margin: "16px 0 8px" }}>{at("sb_who", lang)}</h3>
        <div className={"adm-checks" + (isBad("clientKinds") ? " adm-msg bad" : "")}>
          {WHO.map((k) => <label key={k}><input type="checkbox" checked={form.clientKinds.includes(k)} onChange={toggleWho(k)} />{at("c_" + k, lang)}</label>)}
        </div>
        <h3 style={{ fontSize: 14, margin: "16px 0 8px" }}>{at("sb_needs", lang)}</h3>
        <div className="adm-checks">
          {NEEDS.map(([k, key]) => <label key={k}><input type="checkbox" checked={form[k]} onChange={set(k)} />{at(key, lang)}</label>)}
        </div>
        <div className="adm-grid" style={{ marginTop: 10 }}>
          <label className={"adm-f" + (isBad("minKw") ? " bad" : "")} htmlFor="sb-min">{at("sb_min_kw", lang)}<input id="sb-min" inputMode="decimal" value={form.minKw} onChange={set("minKw")} /></label>
          <label className={"adm-f" + (isBad("maxKw") ? " bad" : "")} htmlFor="sb-max">{at("sb_max_kw", lang)}<input id="sb-max" inputMode="decimal" value={form.maxKw} onChange={set("maxKw")} /></label>
        </div>

        <h3 style={{ fontSize: 14, margin: "16px 0 8px" }}>{at("sb_estimate", lang)}</h3>
        <div className="adm-grid">
          <label className={"adm-f" + (isBad("estimateType") ? " bad" : "")} htmlFor="sb-est">{at("sb_estimate", lang)}
            <select id="sb-est" value={form.estimateType} onChange={set("estimateType")}>
              <option value="info">{at("e_info", lang)}</option><option value="pct_of">{at("e_pct", lang)}</option>
              <option value="fixed">{at("e_fixed", lang)}</option><option value="vat_in_battery">{at("e_vat", lang)}</option>
            </select>
          </label>
          {form.estimateType === "pct_of" && <>
            <label className={"adm-f" + (isBad("base") ? " bad" : "")} htmlFor="sb-base">{at("e_pct", lang)}
              <select id="sb-base" value={form.base} onChange={set("base")}>{["battery", "system", "loan"].map((b) => <option key={b} value={b}>{at("b_" + b, lang)}</option>)}</select>
            </label>
            <label className={"adm-f" + (isBad("pct") ? " bad" : "")} htmlFor="sb-pct">{at("sb_pct", lang)}<input id="sb-pct" inputMode="decimal" value={form.pct} onChange={set("pct")} /></label>
            <label className={"adm-f" + (isBad("capLei") ? " bad" : "")} htmlFor="sb-cap">{at("sb_cap", lang)}<input id="sb-cap" inputMode="decimal" value={form.capLei} onChange={set("capLei")} /></label>
          </>}
          {form.estimateType === "fixed" && (
            <label className={"adm-f" + (isBad("amountLei") ? " bad" : "")} htmlFor="sb-amt">{at("sb_amount", lang)}<input id="sb-amt" inputMode="decimal" value={form.amountLei} onChange={set("amountLei")} /></label>
          )}
          {form.estimateType === "info" && <>
            <label className="adm-f" htmlFor="sb-from">{at("sb_from_pct", lang)}<input id="sb-from" inputMode="decimal" value={form.fromPct} onChange={set("fromPct")} /></label>
            <label className="adm-f" htmlFor="sb-to">{at("sb_to_pct", lang)}<input id="sb-to" inputMode="decimal" value={form.toPct} onChange={set("toPct")} /></label>
          </>}
        </div>
        {(form.estimateType === "pct_of" || form.estimateType === "fixed") && (
          <div className="adm-checks" style={{ marginTop: 8 }}><label><input type="checkbox" checked={form.upTo} onChange={set("upTo")} />{at("sb_up_to", lang)}</label></div>
        )}

        <h3 style={{ fontSize: 14, margin: "16px 0 8px" }}>{at("sb_docs", lang)}</h3>
        {form.documents.map((d, i) => (
          <div key={i} className="adm-doc">
            <label className={"adm-f" + (isBad("documents") ? " bad" : "")} htmlFor={`sb-doc-${i}`}>{at("sb_doc_id", lang)}<input id={`sb-doc-${i}`} value={d.id} onChange={setDoc(i, "id")} /></label>
            {LANGS.map((l) => (
              <label key={l} className={"adm-f" + (isBad(`documents.${d.id}.${l}`) ? " bad" : "")} htmlFor={`sb-doc-${i}-${l}`}>{l.toUpperCase()}<input id={`sb-doc-${i}-${l}`} value={d.name[l]} onChange={setDoc(i, null, l)} /></label>
            ))}
            <button type="button" className="btn ghost sm" onClick={() => setForm((f) => ({ ...f, documents: f.documents.filter((_, j) => j !== i) }))}>{at("sb_doc_remove", lang)}</button>
          </div>
        ))}
        <button type="button" className="btn ghost sm" onClick={() => setForm((f) => ({ ...f, documents: [...f.documents, { id: "", name: blankName() }] }))}>{at("sb_doc_add", lang)}</button>

        <div className="adm-grid" style={{ marginTop: 14 }}>
          <label className={"adm-f" + (isBad("valid_from") ? " bad" : "")} htmlFor="sb-vf">{at("sb_valid_from", lang)}<input id="sb-vf" type="date" value={form.valid_from} onChange={set("valid_from")} /></label>
          <label className={"adm-f" + (isBad("valid_to") ? " bad" : "")} htmlFor="sb-vt">{at("sb_valid_to", lang)}<input id="sb-vt" type="date" value={form.valid_to} onChange={set("valid_to")} /></label>
          <label className={"adm-f" + (isBad("source_url") ? " bad" : "")} htmlFor="sb-src">{at("tr_source_url", lang)}<input id="sb-src" inputMode="url" value={form.source_url} onChange={set("source_url")} /></label>
        </div>
        <div className="adm-checks" style={{ marginTop: 10 }}><label><input type="checkbox" checked={form.active} onChange={set("active")} />{at("sb_active", lang)}</label></div>

        <div className="adm-actions">
          <button type="button" className="btn primary" disabled={!canPublish || busy} onClick={publish}>{busy ? at("ad_publishing", lang) : at("sb_publish", lang)}</button>
          {msg && <span className={"adm-msg " + (msg.ok ? "ok" : "bad")} role="status">{msg.text}</span>}
          {!check.ok && !msg && <span className="adm-msg bad">{at("ad_invalid", lang)}</span>}
        </div>
      </section>
    </>
  );
}
