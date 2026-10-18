"use client";
// app/(app)/marketplace/ProfileForm.jsx — the installer's public profile and
// its verification: where they work and what size, the licence and the
// insurance with their dates and documents, then a check asked of VoltMira.
// Changing a checked field after verification asks for a new check.
import { useState } from "react";
import { useRouter } from "next/navigation";

const LOC = { en: "en-GB", ro: "ro-RO", ru: "ru-RU", uk: "uk-UA" };
const fill = (s, v) => Object.entries(v).reduce((a, [k, x]) => a.split(`{${k}}`).join(String(x)), s);

export default function ProfileForm({ lang, T, raions, profile, state, missing, needsDb }) {
  const router = useRouter();
  const p = profile || {};
  const [f, setF] = useState({
    published: !!p.published, accepting: p.accepting !== false, about: p.about || "", regions: p.regions || [],
    min_kw: p.min_kw ?? 1, max_kw: p.max_kw ?? 30, sla_hours: p.sla_hours ?? 24,
    licence_no: p.licence_no || "", licence_valid_to: p.licence_valid_to || "", insurer: p.insurer || "", insurance_valid_to: p.insurance_valid_to || "",
  });
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);
  const day = (d) => new Intl.DateTimeFormat(LOC[lang] || "ro-RO", { day: "numeric", month: "long", year: "numeric" }).format(new Date(`${d}T12:00:00Z`));
  const set = (k) => (e) => { const v = e.target.type === "checkbox" ? e.target.checked : e.target.value; setF((x) => ({ ...x, [k]: v })); setMsg(null); };
  const toggleRegion = (id) => setF((x) => ({ ...x, regions: x.regions.includes(id) ? x.regions.filter((r) => r !== id) : [...x.regions.filter((r) => r !== "all"), id] }));

  async function save(e) {
    e?.preventDefault();
    setBusy(true); setMsg(null);
    const res = await fetch("/api/marketplace/profile", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "save", ...f }) }).catch(() => null);
    const j = res ? await res.json().catch(() => ({})) : {};
    setBusy(false);
    if (j.ok) { setMsg({ ok: true, text: T.mp_saved }); router.refresh(); }
    else setMsg({ ok: false, text: j.error === "invalid" ? T.mp_e_invalid : j.error === "needs_db" ? T.mk_needs_db : T.mp_e_other });
  }

  async function upload(kind, file) {
    if (!file) return;
    setBusy(true); setMsg(null);
    const fd = new FormData(); fd.append("kind", kind); fd.append("file", file);
    const res = await fetch("/api/marketplace/doc", { method: "POST", body: fd }).catch(() => null);
    const j = res ? await res.json().catch(() => ({})) : {};
    setBusy(false);
    if (j.ok) { setMsg({ ok: true, text: T.mp_saved }); router.refresh(); }
    else setMsg({ ok: false, text: T["mp_e_" + j.error] || T.mp_e_other });
  }

  async function ask() {
    setBusy(true); setMsg(null);
    const res = await fetch("/api/marketplace/profile", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "verify" }) }).catch(() => null);
    const j = res ? await res.json().catch(() => ({})) : {};
    setBusy(false);
    if (j.ok) router.refresh();
    else setMsg({ ok: false, text: j.missing ? fill(T.mp_missing, { list: j.missing.map((k) => T["mp_f_" + k] || k).join(", ") }) : T.mp_e_other });
  }

  const status = state.state === "verified" ? fill(T.mp_ver_verified, { d: day(state.expiresOn) })
    : state.state === "rejected" ? fill(T.mp_ver_rejected, { note: p.verification_note || "" })
      : T["mp_ver_" + state.state] || T.mp_ver_none;

  return (
    <section className="dx-card bl-card" aria-labelledby="mp-prof-h">
      <header className="dx-card-head"><div><h2 id="mp-prof-h">{T.mp_prof_h}</h2><p>{T.mp_prof_sub}</p></div></header>
      <p className={"mp-ver s-" + state.state}>{status}</p>
      {state.soon && <p className="bl-note warn">{fill(T.mp_ver_soon, { d: day(state.expiresOn) })}</p>}
      {state.state === "verified" && p.published && p.slug && <a className="mp-public" href={`/i/${p.slug}`} target="_blank" rel="noopener noreferrer">{T.mp_public}: voltmira.com/i/{p.slug}</a>}

      <form className="mp-form" onSubmit={save}>
        <div className="mp-switches">
          <label className="ex-check"><input type="checkbox" checked={f.published} onChange={set("published")} /> <span>{T.mp_published}</span></label>
          <label className="ex-check"><input type="checkbox" checked={f.accepting} onChange={set("accepting")} /> <span>{T.mp_accepting}</span></label>
        </div>
        <label className="bl-field"><span>{T.mp_about}</span><textarea className="input" rows={3} maxLength={1200} value={f.about} onChange={set("about")} /></label>
        <fieldset className="mp-regions">
          <legend>{T.mp_regions}</legend>
          <label className="mp-rg all"><input type="checkbox" checked={f.regions.includes("all")} onChange={() => setF((x) => ({ ...x, regions: x.regions.includes("all") ? [] : ["all"] }))} /> {T.mp_all}</label>
          {raions.map((r) => (
            <label key={r.id} className="mp-rg"><input type="checkbox" checked={f.regions.includes(r.id)} disabled={f.regions.includes("all")} onChange={() => toggleRegion(r.id)} /> {r.name}</label>
          ))}
        </fieldset>
        <div className="bl-form">
          <label className="bl-field"><span>{T.mp_min_kw}</span><input className="input" inputMode="decimal" value={f.min_kw} onChange={set("min_kw")} /></label>
          <label className="bl-field"><span>{T.mp_max_kw}</span><input className="input" inputMode="decimal" value={f.max_kw} onChange={set("max_kw")} /></label>
          <label className="bl-field"><span>{T.mp_sla}</span><input className="input" inputMode="numeric" value={f.sla_hours} onChange={set("sla_hours")} /></label>
        </div>
        <div className="bl-form">
          <label className="bl-field"><span>{T.mp_licence}</span><input className="input" maxLength={80} value={f.licence_no} onChange={set("licence_no")} /></label>
          <label className="bl-field"><span>{T.mp_licence_to}</span><input className="input" type="date" value={f.licence_valid_to || ""} onChange={set("licence_valid_to")} /></label>
          <label className="bl-field"><span>{T.mp_insurer}</span><input className="input" maxLength={120} value={f.insurer} onChange={set("insurer")} /></label>
          <label className="bl-field"><span>{T.mp_insurance_to}</span><input className="input" type="date" value={f.insurance_valid_to || ""} onChange={set("insurance_valid_to")} /></label>
        </div>
        <div className="bl-acts"><button type="submit" className="btn primary sm" disabled={busy || needsDb}>{T.mp_save}</button></div>
      </form>

      <div className="mp-docs">
        {["licence", "insurance"].map((k) => (
          <label key={k} className="bl-field"><span>{T["mp_doc_" + k]}{p[k + "_doc"] ? ` (${T.mp_doc_have})` : ""}</span>
            <input type="file" accept="application/pdf,image/png,image/jpeg,image/webp" disabled={busy || needsDb || !profile} onChange={(e) => upload(k, e.target.files?.[0])} />
          </label>
        ))}
      </div>
      {state.state !== "verified" && state.state !== "pending" && (
        <div className="bl-acts">
          <button type="button" className="btn ghost sm" disabled={busy || needsDb || !profile} onClick={ask}>{T.mp_ask_check}</button>
          {profile && missing.length > 0 && <span className="bl-muted">{fill(T.mp_missing, { list: missing.map((k) => T["mp_f_" + k] || k).join(", ") })}</span>}
        </div>
      )}
      {msg && <p className={"bl-note " + (msg.ok ? "ok" : "bad")} role="status">{msg.text}</p>}
    </section>
  );
}
