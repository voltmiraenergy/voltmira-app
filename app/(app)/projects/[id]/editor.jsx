"use client";
// app/(app)/projects/[id]/editor.jsx — the quote editor, powered by the shared
// engine. Autosaves to Supabase (debounced 600ms). PVGIS button pulls real yield
// for the address. Proposal button creates the tracked link. Visual language
// matches the live demo (editor grid, cards, bands, financing, modal).
import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { supabaseBrowser } from "../../../../lib/supabase-browser.js";
import { createProposal, saveQuoteTemplate } from "../../../../lib/actions.js";
import InstallChecklist from "./InstallChecklist.jsx";
import { quote, MARKETS, FX } from "@voltmira/engine";
import { t } from "../../../../lib/i18n.js";

// System-size slider range — raised to 50 kW for larger commercial projects.
const KW_MIN = 2, KW_MAX = 50;

// Short month labels in the app's language, via Intl — no extra i18n keys needed.
function monthLabels(lang) {
  const loc = { en: "en-GB", ro: "ro-RO", ru: "ru-RU" }[lang] || "en-GB";
  const fmt = new Intl.DateTimeFormat(loc, { month: "short" });
  return Array.from({ length: 12 }, (_, i) => fmt.format(new Date(2021, i, 1)));
}

/* ---------- small SVG helpers ---------- */
function Chart({ q, lang }) {
  const W = 560, H = 170, PAD = 8, years = q.e.horizon;
  const all = [...q.p.rows, ...q.e.rows, ...q.o.rows, 0, -q.e.cost];
  const min = Math.min(...all), max = Math.max(...all), span = (max - min) || 1;
  const X = i => PAD + (i / (years - 1)) * (W - 2 * PAD);
  const Y = v => PAD + (1 - (v - min) / span) * (H - 2 * PAD);
  const line = rows => rows.map((v, i) => (i ? "L" : "M") + X(i).toFixed(1) + " " + Y(v).toFixed(1)).join(" ");
  const zero = Y(0), be = q.e.payback;
  const bx = be !== null && be > 0 ? PAD + ((be - 1) / (years - 1)) * (W - 2 * PAD) : null;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: "auto" }} role="img" aria-label={t("aria_cashflow", lang)}>
      <line x1={PAD} y1={zero} x2={W - PAD} y2={zero} stroke="#B9B5A6" strokeWidth="1.5" strokeDasharray="2 4" />
      <path d={line(q.p.rows)} fill="none" stroke="#C4543B" strokeWidth="1.6" strokeDasharray="5 4" opacity=".55" />
      <path d={line(q.o.rows)} fill="none" stroke="#1E6B4E" strokeWidth="1.6" strokeDasharray="5 4" opacity=".55" />
      <path d={line(q.e.rows)} fill="none" stroke="#1E6B4E" strokeWidth="2.8" strokeLinecap="round" />
      {bx !== null && bx <= W - PAD && <>
        <line x1={bx} y1={PAD} x2={bx} y2={H - PAD} stroke="#E89B2D" strokeWidth="2" strokeDasharray="4 4" />
        <circle cx={bx} cy={zero} r="4.5" fill="#E89B2D" />
      </>}
    </svg>
  );
}

function Donut({ self, lang }) {
  const r = 42, c = 2 * Math.PI * r, sc = Math.max(0, Math.min(1, self));
  return (
    <svg viewBox="0 0 100 100" width="110" height="110" role="img"
      aria-label={`Self-consumed ${Math.round(sc * 100)}%`}>
      <circle cx="50" cy="50" r={r} fill="none" stroke="var(--line)" strokeWidth="12" />
      <circle cx="50" cy="50" r={r} fill="none" stroke="#E89B2D" strokeWidth="12" opacity=".65"
        strokeDasharray={`${c * (1 - sc)} ${c}`} transform="rotate(-90 50 50)" strokeLinecap="round" />
      <circle cx="50" cy="50" r={r} fill="none" stroke="#1E6B4E" strokeWidth="12"
        strokeDasharray={`${c * sc} ${c}`} strokeDashoffset={-(c * (1 - sc))}
        transform="rotate(-90 50 50)" strokeLinecap="round" />
      <text x="50" y="47" textAnchor="middle" fontFamily="Space Grotesk" fontSize="17" fontWeight="700" fill="var(--ink)">
        {Math.round(sc * 100)}%</text>
      <text x="50" y="60" textAnchor="middle" fontFamily="Inter" fontSize="7.5" fill="var(--muted)">{t("self_consumed", lang)}</text>
    </svg>
  );
}

/* ---------- editor ---------- */
export default function Editor({ initial, engineSettings: E, prosumerLimitKw, lang, team = [], proposalSentAt = null, companyName = "VoltMira" }) {
  const tr = (k, v) => t(k, lang, v);
  const [p, setP] = useState({
    title: initial.title, client: initial.client_name, address: initial.address,
    market: initial.market, status: initial.status,
    kw: +initial.kw, price: +initial.price, cons: +initial.cons,
    batt: initial.batt, battKwh: initial.batt_kwh != null ? +initial.batt_kwh : 10,
    afmSubsidy: initial.afm_subsidy, loan: +initial.loan_monthly,
    yieldOverride: initial.yield_per_kwp ? +initial.yield_per_kwp : undefined,
    monthlyYieldShape: initial.monthly_yield_shape || undefined,
    useMonthly: initial.use_monthly, consMonthly: initial.cons_monthly,
    ownerId: initial.owner_id || null,
    nextFollowUp: initial.next_follow_up || "",
    notes: initial.notes || "",
  });
  const [saved, setSaved] = useState("saved");     // saved | saving | error
  const [pvgisBusy, setPvgisBusy] = useState(false);
  const [propUrl, setPropUrl] = useState(null);
  const [copied, setCopied] = useState(false);
  const [tplSaved, setTplSaved] = useState(false);
  const [tplOpen, setTplOpen] = useState(false);
  const [tplName, setTplName] = useState("");
  const [tplBusy, setTplBusy] = useState(false);
  const timer = useRef(null);

  function openTemplate() { setTplName(p.title || "Template"); setTplOpen(true); }
  async function saveTemplate() {
    const name = tplName.trim();
    if (!name) return;
    setTplBusy(true);
    try {
      await saveQuoteTemplate({ name, kw: p.kw, market: p.market, batt: p.batt, price: p.price, cons: p.cons });
      setTplOpen(false); setTplSaved(true); setTimeout(() => setTplSaved(false), 2200);
    } catch { /* non-fatal */ } finally { setTplBusy(false); }
  }

  const q = useMemo(() => quote(p, E), [p, E]);
  const fmt = n => "€" + Math.round(n).toLocaleString("en-IE");
  const yrs = n => n === null ? "25+" : n === 0 ? tr("pp_immediate") : n.toFixed(1);

  /* debounced autosave — MUST surface failure: a false "Saved" while the write
     was rejected (expired session, offline, RLS) silently loses the edit. */
  async function persist(next) {
    try {
      const sb = supabaseBrowser();
      const { error } = await sb.from("projects").update({
        title: next.title, client_name: next.client, address: next.address,
        market: next.market, status: next.status,
        kw: next.kw, price: next.price, cons: next.cons,
        batt: next.batt,
        afm_subsidy: next.afmSubsidy, loan_monthly: next.loan,
        use_monthly: !!next.useMonthly,
        cons_monthly: (next.useMonthly && Array.isArray(next.consMonthly) && next.consMonthly.length === 12)
          ? next.consMonthly : null,
        yield_per_kwp: next.yieldOverride ?? null,
        monthly_yield_shape: next.monthlyYieldShape ?? null,
        owner_id: next.ownerId ?? null,
        next_follow_up: next.nextFollowUp || null,
        notes: next.notes ?? "",
      }).eq("id", initial.id);
      setSaved(error ? "error" : "saved");
      if (error) console.error("autosave failed:", error.message);
      // batt_kwh is written separately + best-effort so a workspace that hasn't
      // run add-battery-kwh.sql yet still autosaves everything else (the column
      // may not exist; swallow that error rather than fail the whole save).
      else sb.from("projects").update({ batt_kwh: next.battKwh }).eq("id", initial.id)
        .then(({ error: e2 }) => { if (e2) console.warn("batt_kwh not stored (run add-battery-kwh.sql?):", e2.message); });
    } catch (e) {
      setSaved("error");
      console.error("autosave threw:", e?.message || e);
    }
  }
  function update(patch) {
    const next = { ...p, ...patch };
    setP(next); setSaved("saving");
    clearTimeout(timer.current);
    timer.current = setTimeout(() => persist(next), 600);
  }
  useEffect(() => () => clearTimeout(timer.current), []);

  async function fetchPVGIS() {
    if (!p.address) return alert(tr("add_address"));
    setPvgisBusy(true);
    try {
      const r = await fetch(`/api/pvgis?address=${encodeURIComponent(p.address)}`);
      const j = await r.json();
      if (j.yieldPerKwp) update({ yieldOverride: j.yieldPerKwp, monthlyYieldShape: j.monthlyShape });
      else alert(j.error || "PVGIS lookup failed");
    } finally { setPvgisBusy(false); }
  }

  async function makeProposal() {
    const code = await createProposal(initial.id);
    setPropUrl(`${location.origin}/p/${code}`);
    if (p.status === "draft") update({ status: "sent" });
    return code;
  }

  async function downloadPdf() {
    const code = propUrl ? propUrl.split("/p/")[1] : await makeProposal();
    window.open(`/p/${code}?print=1`, "_blank", "noopener");
  }

  const mSave = q.e.year1 / 12, net = mSave - (p.loan || 0);
  const mkt = MARKETS[p.market] || MARKETS.RO;
  const prosumerWarn = mkt.prosumer && p.kw > prosumerLimitKw;
  const kwFill = ((p.kw - KW_MIN) / (KW_MAX - KW_MIN)) * 100;

  // Proposal validity: a sent quote is valid for `quoteValidityDays` from when the
  // link was created; older = stale (panel/inverter prices drift — flag it).
  const validityDays = E.quoteValidityDays || 30;
  const validUntilDate = proposalSentAt ? new Date(new Date(proposalSentAt).getTime() + validityDays * 86400000) : null;
  const quoteStale = validUntilDate ? validUntilDate.getTime() < Date.now() : false;
  const validUntilStr = validUntilDate ? validUntilDate.toLocaleDateString({ en: "en-GB", ro: "ro-RO", ru: "ru-RU" }[lang] || "en-GB") : null;

  // Local subsidy is market-aware: RO = AFM/Casa Verde (RON), MD = prosumer grant
  // (MDL). DE has none, so the toggle hides there. Amount converts to EUR for the
  // "−€X" hint, using the same FX the engine uses.
  const subKey = mkt.subsidyKey;                 // e.g. "subsidyAmountRon" | "subsidyAmountMdl" | null
  const subAmountEur = subKey ? (Number(E[subKey]) || 0) / (FX[mkt.subsidyFx] || 1) : 0;
  const subLabel = p.market === "MD" ? tr("md_subsidy_label") : tr("afm_label");

  // Switching market pre-fills the electricity price with the new market's
  // regional default — but only when the user hasn't typed a custom price yet
  // (i.e. it still equals the old market's default).
  function changeMarket(m) {
    const patch = { market: m };
    const oldDef = (MARKETS[p.market] || {}).defaultPrice;
    if (MARKETS[m] && Math.abs((p.price || 0) - (oldDef || 0)) < 0.0015) patch.price = MARKETS[m].defaultPrice;
    update(patch);
  }

  // A demo-style .check toggle row.
  const check = (on, l, sub, fn) => (
    <label className="check" style={{ marginTop: 10 }}>
      <input type="checkbox" checked={on} onChange={e => fn(e.target.checked)} />
      <span className="toggle-pill" />
      <span className="txt">{l}<small>{sub}</small></span>
    </label>
  );

  return (
    <div style={{ maxWidth: 1080, margin: "0 auto" }}>
      <div className="ed-head">
        <Link className="back-link" href="/projects">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M15 5 8 12l7 7" /></svg>
          {tr("back_projects").replace("← ", "")}
        </Link>
        <input className="proj-title" value={p.title} onChange={e => update({ title: e.target.value })} />
        <span style={{ fontSize: 12, color: saved === "error" ? "var(--red)" : "var(--muted)", fontWeight: saved === "error" ? 700 : 400 }}>
          {saved === "saving" ? tr("saving") : saved === "error" ? tr("save_failed") : tr("saved")}
          {saved === "error" && (
            <button className="btn sm danger" style={{ marginLeft: 8 }} onClick={() => { setSaved("saving"); persist(p); }}>{tr("retry")}</button>
          )}
        </span>
        <span className="spacer" />
        {tplOpen ? (
          <span style={{ display: "inline-flex", gap: 6, alignItems: "center" }}>
            <input autoFocus className="input" value={tplName} maxLength={40}
              onChange={e => setTplName(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter") saveTemplate(); if (e.key === "Escape") setTplOpen(false); }}
              placeholder={tr("tpl_name_ph")} style={{ width: 160, padding: "8px 11px" }} />
            <button className="btn primary" disabled={tplBusy || !tplName.trim()} onClick={saveTemplate}>{tr("tpl_save_confirm")}</button>
            <button className="btn ghost" onClick={() => setTplOpen(false)} aria-label={tr("tpl_cancel")}>✕</button>
          </span>
        ) : (
          <button className="btn ghost" onClick={openTemplate}>{tplSaved ? tr("tpl_saved") : tr("tpl_save")}</button>
        )}
        <button className="btn ghost" onClick={downloadPdf}>{tr("dl_pdf")}</button>
        <button className="btn primary" onClick={makeProposal}>{tr("gen_proposal")}</button>
      </div>

      {proposalSentAt && (
        <div style={{ margin: "-8px 0 16px", fontSize: 12.5, fontWeight: quoteStale ? 700 : 400,
          color: quoteStale ? "var(--red)" : "var(--muted)" }}>
          {quoteStale ? "⚠ " : ""}{tr("q_valid_until", { d: validUntilStr })}{quoteStale ? " · " + tr("q_stale") : ""}
        </div>
      )}

      <div className="editor">
        {/* left: inputs */}
        <div className="stack">
          <section className="card">
            <h3>{tr("client_site")}</h3>
            <div className="field"><label>{tr("client_name")}</label>
              <input className="input" value={p.client} onChange={e => update({ client: e.target.value })} /></div>
            <div className="field"><label>{tr("address")}</label>
              <input className="input" value={p.address} onChange={e => update({ address: e.target.value })} /></div>

            <button className={p.yieldOverride ? "btn amber" : "btn ghost"} style={{ width: "100%" }}
              onClick={fetchPVGIS} disabled={pvgisBusy}>
              {pvgisBusy ? tr("pvgis_fetching")
                : p.yieldOverride ? tr("pvgis_real", { n: Math.round(p.yieldOverride) })
                : tr("pvgis_use")}
            </button>
            {p.yieldOverride && (
              <div className="pvgis-data">
                <span className="pvg-k">{Math.round(p.yieldOverride)}</span> {tr("unit_kwp_yr")}
                {Array.isArray(p.monthlyYieldShape) && p.monthlyYieldShape.length === 12 && <> · {tr("pvgis_monthly")}</>}
              </div>
            )}

            {team.length >= 1 && (
              <div className="field" style={{ marginTop: 15 }}><label>{tr("proj_owner")}</label>
                <select className="input" value={p.ownerId || ""} onChange={e => update({ ownerId: e.target.value || null })}>
                  <option value="">—</option>
                  {team.map(m => <option key={m.id} value={m.id}>{m.name || m.email}</option>)}
                </select>
              </div>
            )}
            <div className="field"><label>{tr("market")}</label>
              <select className="input" value={p.market} onChange={e => changeMarket(e.target.value)}>
                <option value="MD">{tr("market_md")}</option>
                <option value="RO">{tr("market_ro")}</option>
              </select></div>
            <div className="field"><label>{tr("next_followup")}</label>
              <input className="input" type="date" value={p.nextFollowUp || ""}
                onChange={e => update({ nextFollowUp: e.target.value })} /></div>
            <div className="field"><label>{tr("notes_label")}</label>
              <textarea className="input" rows={3} value={p.notes} placeholder={tr("notes_ph")}
                onChange={e => update({ notes: e.target.value })} /></div>
            {initial.referral_source && (
              <div className="field" style={{ marginBottom: 0 }}><label>{tr("ref_source_label")}</label>
                <div style={{ fontSize: 13.5, color: "var(--ink)", background: "var(--green-tint)", borderRadius: 8, padding: "8px 11px", fontWeight: 600 }}>
                  {tr("ref_opt_" + initial.referral_source)}
                </div></div>
            )}
            {prosumerWarn && <div className="warn-card" style={{ marginTop: 15 }}>{tr("prosumer_warn", { n: prosumerLimitKw })}</div>}
          </section>

          <section className="card">
            <h3>{tr("system")}</h3>
            <div className="field">
              <label>{tr("system_size")}<output>{p.kw.toFixed(1)} kW</output></label>
              <input type="range" min={KW_MIN} max={KW_MAX} step="0.5" value={p.kw} style={{ "--fill": kwFill + "%" }}
                aria-valuemin={KW_MIN} aria-valuemax={KW_MAX} aria-valuenow={p.kw}
                onChange={e => update({ kw: +e.target.value })} />
            </div>
            <div className="field"><label>{tr("elec_price")}</label>
              <input className="input" type="number" step="0.01" value={p.price}
                onChange={e => update({ price: +e.target.value || 0.21 })} /></div>
            {!p.useMonthly && (
              <div className="field"><label>{tr("annual_cons")}</label>
                <input className="input" type="number" step="100" value={p.cons}
                  onChange={e => update({ cons: +e.target.value || 5000 })} /></div>
            )}
            {check(p.useMonthly, tr("use_monthly"), tr("use_monthly_sub"),
              v => update(v
                ? { useMonthly: true, consMonthly: (Array.isArray(p.consMonthly) && p.consMonthly.length === 12)
                    ? p.consMonthly : Array(12).fill(Math.round((p.cons || 5000) / 12)) }
                : { useMonthly: false }))}
            {p.useMonthly && (
              <div style={{ marginTop: 12 }}>
                <div className="mo-grid">
                  {monthLabels(lang).map((m, i) => (
                    <div className="mo-cell" key={i}>
                      <label>{m}</label>
                      <input className="input mo-in" type="number" min="0" step="10"
                        value={(p.consMonthly && p.consMonthly[i]) ?? 0}
                        onChange={e => {
                          const arr = (Array.isArray(p.consMonthly) && p.consMonthly.length === 12)
                            ? p.consMonthly.slice() : Array(12).fill(0);
                          arr[i] = +e.target.value || 0;
                          update({ consMonthly: arr });
                        }} />
                    </div>
                  ))}
                </div>
                <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 8, textAlign: "right" }}>
                  {tr("mo_total_yr", { v: (p.consMonthly || []).reduce((a, b) => a + (+b || 0), 0).toLocaleString() })}
                </div>
              </div>
            )}
            {check(p.batt, tr("battery_label"), tr("battery_sub"), v => update({ batt: v }))}
            {p.batt && (() => {
              const battCost = (Number(p.battKwh) || 0) * (Number(E.batteryCostPerKwh) || 500);
              return (
                <div className="field" style={{ margin: "2px 0 4px 30px" }}>
                  <label>{tr("battery_cap")}</label>
                  <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
                    <input className="input" type="number" min="0" step="0.5" style={{ width: 120 }}
                      value={p.battKwh} onChange={e => update({ battKwh: +e.target.value || 0 })} />
                    <span style={{ color: "var(--muted)", fontSize: 13 }}>kWh · {fmt(battCost)}</span>
                  </div>
                </div>
              );
            })()}
            {subKey &&
              check(p.afmSubsidy, subLabel,
                subAmountEur > 0 ? tr("afm_sub", { x: fmt(subAmountEur) }) : tr("afm_sub_unset"),
                v => update({ afmSubsidy: v }))}
          </section>
        </div>

        {/* right: results */}
        <div className="stack">
          <section className="card">
            <h3>{tr("sys_investment")}</h3>
            <div className="cost-line">
              <div className="k"><b>{fmt(q.e.cost)}</b>
                <span>{tr("total_invest")}{p.afmSubsidy && <span className="mini-badge">{tr("with_subsidy")}</span>}</span></div>
              <div className="k"><b>{Math.round(q.e.prod0).toLocaleString()} kWh</b>
                <span>{tr("prod_year")}{p.yieldOverride ? " " + tr("tag_pvgis") : " " + tr("tag_default")}</span></div>
              <div className="k"><b>{fmt(q.e.year1)}</b><span>{tr("savings_y1")}</span></div>
              <span className="spacer" />
              <Donut self={q.e.self} lang={lang} />
            </div>
          </section>

          <section className="card">
            <h3>{tr("payback_title")}</h3>
            <div className="bands">
              {[["pess", tr("pessimistic"), q.p], ["expc", tr("expected"), q.e], ["opti", tr("optimistic"), q.o]]
                .map(([cls, l, b]) => (
                <div key={cls} className={`band ${cls}`}>
                  <div className="tag">{l}</div>
                  <div className="yrs">{yrs(b.payback)} <small>{tr("yrs")}</small></div>
                  <div className="roi">{tr("roi_line", { h: E.horizon, n: Math.round(b.roi) })}</div>
                </div>
              ))}
            </div>
            <div style={{ marginTop: 14 }}><Chart q={q} lang={lang} /></div>
          </section>

          <section className="card">
            <h3>{tr("financing")}</h3>
            <div className="fin-split">
              <div className="fin-box">
                <div className="lbl">{tr("monthly_loan")}</div>
                <input type="number" value={p.loan} onChange={e => update({ loan: +e.target.value || 0 })} />
              </div>
              <div className="fin-box">
                <div className="lbl">{tr("est_savings")}</div>
                <div className="big">{fmt(mSave)}</div>
              </div>
            </div>
            <div className={`verdict ${net >= 0 ? "good" : "bad"}`}>
              {net >= 0 ? tr("save_pos", { x: fmt(net) }) : tr("save_neg")}
            </div>
          </section>

          {p.status === "won" && (
            <InstallChecklist projectId={initial.id} initial={initial.install_progress} lang={lang} />
          )}
        </div>
      </div>

      {/* proposal modal */}
      {propUrl && (
        <div className="overlay" onClick={() => setPropUrl(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h4>{tr("prop_title")}</h4>
            <p className="sub">{tr("prop_desc", { client: p.client || tr("your_client") })}</p>
            <div className="link-row">
              <code>{propUrl}</code>
              <button className="btn sm amber" onClick={() => {
                navigator.clipboard?.writeText(propUrl);
                setCopied(true); setTimeout(() => setCopied(false), 1800);
              }}>{copied ? tr("t_copied") : tr("copy")}</button>
            </div>
            {/* WhatsApp is how solar sells in RO/MD — pre-write the message + link */}
            <a className="btn wapp" style={{ width: "100%", marginBottom: 10 }}
              href={`https://wa.me/?text=${encodeURIComponent(tr("wa_message", { client: p.client || tr("your_client"), company: companyName, url: propUrl }))}`}
              target="_blank" rel="noopener noreferrer">
              <svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12.04 2c-5.46 0-9.9 4.44-9.9 9.9 0 1.75.46 3.45 1.32 4.95L2 22l5.3-1.38a9.9 9.9 0 0 0 4.73 1.2h.01c5.46 0 9.9-4.44 9.9-9.9 0-2.64-1.03-5.13-2.9-7A9.82 9.82 0 0 0 12.04 2Zm0 18.15h-.01a8.2 8.2 0 0 1-4.18-1.15l-.3-.18-3.1.81.83-3.02-.2-.31a8.22 8.22 0 0 1-1.26-4.4c0-4.54 3.7-8.23 8.24-8.23 2.2 0 4.27.86 5.82 2.42a8.18 8.18 0 0 1 2.41 5.82c0 4.54-3.69 8.24-8.22 8.24Zm4.52-6.16c-.25-.12-1.47-.72-1.69-.81-.23-.08-.39-.12-.56.13-.16.24-.64.8-.79.97-.14.16-.29.18-.54.06-.25-.12-1.05-.39-1.99-1.23-.74-.66-1.23-1.47-1.38-1.72-.14-.25-.02-.38.11-.5.11-.11.25-.29.37-.43.12-.14.16-.25.25-.41.08-.17.04-.31-.02-.43-.06-.12-.56-1.35-.77-1.85-.2-.48-.4-.42-.56-.43h-.48c-.16 0-.42.06-.64.31-.22.25-.84.83-.84 2.02 0 1.19.86 2.34.98 2.5.12.16 1.69 2.58 4.1 3.62.57.25 1.02.4 1.37.5.57.19 1.1.16 1.51.1.46-.07 1.47-.6 1.68-1.18.2-.58.2-1.07.14-1.18-.06-.1-.22-.16-.47-.28Z" /></svg>
              {tr("wa_share")}
            </a>
            <div className="modal-acts">
              <button className="btn ghost" onClick={() => setPropUrl(null)}>{tr("close")}</button>
              <a className="btn primary" href={propUrl} target="_blank" rel="noopener noreferrer">{tr("open_as_client")}</a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
