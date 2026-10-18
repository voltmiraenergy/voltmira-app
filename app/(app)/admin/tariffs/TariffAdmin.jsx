"use client";
// app/(app)/admin/tariffs/TariffAdmin.jsx — per operator: the version in force
// today, every version, and a form for the next one, prefilled from the
// latest. The diff against the latest version is worked out with the same
// check and conversion the server uses (lib/adminValidate.js), so what is
// shown before publishing is exactly what will be stored.
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { at } from "../../../../lib/adminText.js";
import { pickRule, nextVersion, diffRules, fromMinorPerMwh, ruleExportMdl } from "../../../../lib/tariffRules.js";
import { validateTariffInput, TARIFF_OPERATORS } from "../../../../lib/adminValidate.js";

const OP_NAME = { premier: "Premier Energy", rednord: "RED Nord" };
const LOC = { en: "en-GB", ro: "ro-RO", ru: "ru-RU", uk: "uk-UA" };
const leiStr = (minor) => (minor == null ? "" : String(fromMinorPerMwh(minor)));
const RATE_FIELDS = ["retail_flat_minor_per_mwh", "retail_day_minor_per_mwh", "retail_night_minor_per_mwh", "export_flat_minor_per_mwh"];

function formFrom(rule, operator, today) {
  return {
    operator, effective_from: today, effective_to: "",
    retail_day: leiStr(rule?.retail_day_minor_per_mwh), retail_night: leiStr(rule?.retail_night_minor_per_mwh),
    retail_flat: leiStr(rule?.retail_flat_minor_per_mwh), export_flat: leiStr(rule?.export_flat_minor_per_mwh),
    export_monthly: Array.from({ length: 12 }, (_, m) => leiStr(rule?.export_monthly?.[m])),
    prosumer_max_kw: rule?.prosumer_max_kw != null ? String(rule.prosumer_max_kw) : "",
    source_title: "", source_url: "", note: "",
  };
}

export default function TariffAdmin({ rules, lang, canPublish, today }) {
  const router = useRouter();
  const [op, setOp] = useState("premier");
  const mine = useMemo(() => rules.filter((r) => r.operator === op).sort((a, b) => b.version - a.version), [rules, op]);
  const latest = mine[0] || null;
  const inForce = pickRule(rules, { market: "MD", operator: op, date: today });
  const [form, setForm] = useState(() => formFrom(latest, op, today));
  const [msg, setMsg] = useState(null);
  const [busy, setBusy] = useState(false);
  const months = useMemo(() => Array.from({ length: 12 }, (_, m) => new Intl.DateTimeFormat(LOC[lang] || "ro-RO", { month: "short" }).format(new Date(Date.UTC(2026, m, 15)))), [lang]);
  const day = (d) => (d ? new Intl.DateTimeFormat(LOC[lang] || "ro-RO", { day: "numeric", month: "short", year: "numeric" }).format(new Date(d + "T12:00:00Z")) : at("tr_open_ended", lang));

  const check = validateTariffInput(form);
  const bad = new Set(check.ok ? [] : check.errors);
  // the diff appears as soon as the prices are valid, before the source is typed
  const preview = check.ok ? check : validateTariffInput({ ...form, source_title: form.source_title || latest?.source_title || "-" });
  const diff = preview.ok && latest ? diffRules(latest, { ...preview.row, source_title: form.source_title || latest.source_title }) : [];
  const show = (field, v) => {
    if (v == null || v === "") return "";
    if (RATE_FIELDS.includes(field) || field.startsWith("export_monthly")) return `${fromMinorPerMwh(v)} lei/kWh`;
    return String(v);
  };
  const label = (field) => {
    if (field.startsWith("export_monthly.")) return `${at("tr_export", lang)}: ${months[Number(field.split(".")[1])]}`;
    const key = { effective_from: "tr_effective_from", effective_to: "tr_effective_to", retail_day_minor_per_mwh: "tr_retail_day", retail_night_minor_per_mwh: "tr_retail_night",
      retail_flat_minor_per_mwh: "tr_retail_flat", export_flat_minor_per_mwh: "tr_export_flat", prosumer_max_kw: "tr_max_kw", source_title: "tr_source", source_url: "tr_source_url", note: "tr_note" }[field];
    return key ? at(key, lang) : field;
  };
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const setMonth = (m) => (e) => setForm((f) => ({ ...f, export_monthly: f.export_monthly.map((v, i) => (i === m ? e.target.value : v)) }));
  const pick = (o) => { setOp(o); setMsg(null); setForm(formFrom(rules.filter((r) => r.operator === o).sort((a, b) => b.version - a.version)[0], o, today)); };

  async function publish() {
    if (!check.ok) { setMsg({ ok: false, text: at("ad_invalid", lang) }); return; }
    setBusy(true); setMsg(null);
    try {
      const res = await fetch("/api/admin/tariffs", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) setMsg({ ok: false, text: j.error === "invalid" ? at("ad_invalid", lang) : j.error === "needs_db" ? at("ad_needs_db", lang) : at("ad_failed", lang) });
      else { setMsg({ ok: true, text: j.unchanged ? at("ad_unchanged", lang) : at("tr_published", lang, { v: j.rule.version }) }); router.refresh(); }
    } catch { setMsg({ ok: false, text: at("ad_failed", lang) }); }
    finally { setBusy(false); }
  }
  // a render function, not a component: a component declared here would be a
  // new one on every keystroke, and its input would lose the cursor
  const field = (k, labelKey, type = "text", inputMode = "decimal") => (
    <label key={k} className={"adm-f" + (bad.has(k) ? " bad" : "")} htmlFor={`tr-${k}`}>{at(labelKey, lang)}
      <input id={`tr-${k}`} type={type} inputMode={type === "text" ? inputMode : undefined} value={form[k]} onChange={set(k)} />
    </label>
  );

  return (
    <>
      <div className="adm-seg" role="tablist">
        {TARIFF_OPERATORS.map((o) => (
          <button key={o} type="button" role="tab" aria-selected={o === op} className={"adm-tab" + (o === op ? " on" : "")} onClick={() => pick(o)}>{OP_NAME[o]}</button>
        ))}
      </div>

      <section className="adm-card">
        <h2>{OP_NAME[op]}</h2>
        <p>{inForce ? at("tr_in_force", lang, { v: inForce.version, d: day(inForce.effective_from) }) : at("tr_none", lang)}</p>
        <div className="adm-scroll">
          <table className="adm-table">
            <thead><tr><th>{at("tr_col_v", lang)}</th><th>{at("tr_col_from", lang)}</th><th>{at("tr_col_to", lang)}</th><th>{at("tr_col_export", lang)}</th><th>{at("tr_col_day", lang)}</th><th>{at("tr_col_night", lang)}</th><th>{at("tr_col_source", lang)}</th></tr></thead>
            <tbody>
              {mine.map((r) => {
                const ex = ruleExportMdl(r);
                return (
                  <tr key={r.id}>
                    <td className="num"><b>v{r.version}</b></td>
                    <td className="num">{day(r.effective_from)}</td>
                    <td className="num">{day(r.effective_to)}</td>
                    <td className="num">{ex != null ? `${ex.toFixed(4)} lei/kWh` : ""}</td>
                    <td className="num">{show("retail_day_minor_per_mwh", r.retail_day_minor_per_mwh)}</td>
                    <td className="num">{show("retail_night_minor_per_mwh", r.retail_night_minor_per_mwh)}</td>
                    <td>{r.source_url ? <a href={r.source_url} target="_blank" rel="noopener noreferrer">{r.source_title}</a> : r.source_title}{r.created_by && r.created_by !== "seed" ? <><br /><small>{at("ad_by", lang, { who: r.created_by })}</small></> : null}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section className="adm-card">
        <h2>{at("tr_new", lang)}: {OP_NAME[op]} v{nextVersion(rules, { market: "MD", operator: op })}</h2>
        <p>{at("tr_new_sub", lang)}</p>
        <div className="adm-grid">
          {field("effective_from", "tr_effective_from", "date")}
          {field("effective_to", "tr_effective_to", "date")}
          {field("retail_day", "tr_retail_day")}
          {field("retail_night", "tr_retail_night")}
          {field("retail_flat", "tr_retail_flat")}
          {field("export_flat", "tr_export_flat")}
          {field("prosumer_max_kw", "tr_max_kw")}
        </div>
        <h3 style={{ fontSize: 14, margin: "16px 0 8px" }}>{at("tr_export", lang)}</h3>
        <div className="adm-months">
          {months.map((name, m) => (
            <label key={m} className={"adm-f" + (bad.has(`export_monthly.${m}`) ? " bad" : "")} htmlFor={`tr-m${m}`}>{name}
              <input id={`tr-m${m}`} inputMode="decimal" value={form.export_monthly[m]} onChange={setMonth(m)} />
            </label>
          ))}
        </div>
        <div className="adm-grid" style={{ marginTop: 12 }}>
          {field("source_title", "tr_source")}
          {field("source_url", "tr_source_url", "text", "url")}
          {field("note", "tr_note")}
        </div>

        <h3 style={{ fontSize: 14, margin: "18px 0 8px" }}>{latest ? at("tr_diff", lang, { v: latest.version }) : at("tr_diff_first", lang)}</h3>
        {latest && (diff.length ? (
          <div className="adm-scroll">
            <table className="adm-table adm-diff">
              <thead><tr><th>{at("ad_field", lang)}</th><th>{at("ad_before", lang)}</th><th>{at("ad_after", lang)}</th></tr></thead>
              <tbody>{diff.map((d) => {
                // prices stay on one line; text (a source, a note) wraps
                const n = RATE_FIELDS.includes(d.field) || d.field.startsWith("export_monthly") || d.field.startsWith("effective") ? "num" : "";
                return <tr key={d.field}><td>{label(d.field)}</td><td className={n + " b"}>{show(d.field, d.before)}</td><td className={n}>{show(d.field, d.after)}</td></tr>;
              })}</tbody>
            </table>
          </div>
        ) : <p>{at("tr_nodiff", lang)}</p>)}

        <div className="adm-actions">
          <button type="button" className="btn primary" disabled={!canPublish || busy} onClick={publish}>
            {busy ? at("ad_publishing", lang) : at("tr_publish", lang, { v: nextVersion(rules, { market: "MD", operator: op }) })}
          </button>
          {msg && <span className={"adm-msg " + (msg.ok ? "ok" : "bad")} role="status">{msg.text}</span>}
          {!check.ok && !msg && <span className="adm-msg bad">{at("ad_invalid", lang)}</span>}
        </div>
      </section>
    </>
  );
}
