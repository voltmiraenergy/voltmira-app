"use client";
// app/(app)/portfolios/[id]/PortfolioView.jsx — a portfolio, live. Everything
// on the page is computed from the rows and the assumptions by buildModel()
// (lib/portfolioModel.js), the same function the PDF report and the Excel
// workbook use, so what is on screen is what goes to the lender. Edits autosave
// to the portfolios table (debounced), like the quote editor.
import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "../../../../lib/supabase-browser.js";
import { deletePortfolio } from "../../../../lib/actions.js";
import { buildModel } from "../../../../lib/portfolioModel.js";
import { DOC_KEYS } from "../../../../lib/portfolio.js";
import { presetsFor, presetFinance, FINANCING_PRESETS } from "../../../../lib/financingPresets.js";
import { itemsFor, GRID_EMISSION_FACTOR } from "../../../../lib/esScreening.js";
import { caseLabel, riskRows } from "../../../../lib/portfolioExport.js";
import { pt } from "../../../../lib/portfolioText.js";
import { eur, eurCompact, pct, dscr, num as fnum, mwhUnit, kwpUnit, dscrTone } from "../../../../lib/portfolioFormat.js";
import CashflowChart from "../../../../components/CashflowChart.jsx";
import { FX } from "@voltmira/engine";

// a number field that lets the box be empty while typing
function Num({ id, value, onChange, step = "any", min, max, label, hint, wide }) {
  return (
    <div className={"field" + (wide ? " pf-wide" : "")}>
      <label htmlFor={id}>{label}</label>
      <input id={id} className="input" type="number" inputMode="decimal" step={step} min={min} max={max}
        value={value ?? ""} onChange={(e) => onChange(e.target.value === "" ? "" : +e.target.value)} />
      {hint && <small className="pf-hint">{hint}</small>}
    </div>
  );
}

const SAVE_DEBOUNCE_MS = 700;
const ES_STATUSES = ["open", "yes", "no", "na"];

export default function PortfolioView({ portfolio, quotes, E, lang, schemeLimitKw, company }) {
  const router = useRouter();
  const [p, setP] = useState({
    name: portfolio.name || "",
    project_ids: Array.isArray(portfolio.project_ids) ? portfolio.project_ids : [],
    finance: portfolio.finance || {},
    scenario: portfolio.scenario || {},
    assets: portfolio.assets || {},
    es: portfolio.es || {},
  });
  const [saved, setSaved] = useState("saved");            // saved | saving | error
  const [open, setOpen] = useState(null);                  // the asset row being edited
  const [stepsText, setStepsText] = useState(Array.isArray(portfolio.finance?.rateSteps) ? portfolio.finance.rateSteps.join(", ") : "");
  const [docLang, setDocLang] = useState("en");
  const timer = useRef(null);

  const model = useMemo(
    () => buildModel({ portfolio: { ...portfolio, ...p }, projects: quotes, E, schemeLimitKw }),
    [p, portfolio, quotes, E, schemeLimitKw],
  );
  const { agg, fin, scenario, suite, risks } = model;
  const market = portfolio.market;
  const uahPerEur = Number(E?.fx?.UAH) || FX.UAH;

  async function persist(next) {
    try {
      const { error } = await supabaseBrowser().from("portfolios").update({
        name: next.name, project_ids: next.project_ids, finance: next.finance, scenario: next.scenario,
        assets: next.assets, es: next.es, updated_at: new Date().toISOString(),
      }).eq("id", portfolio.id);
      setSaved(error ? "error" : "saved");
      if (error) console.error("portfolio save failed:", error.message);
    } catch (e) {
      setSaved("error");
      console.error("portfolio save threw:", e?.message || e);
    }
  }
  function update(patch) {
    const next = { ...p, ...patch };
    setP(next); setSaved("saving");
    clearTimeout(timer.current);
    timer.current = setTimeout(() => persist(next), SAVE_DEBOUNCE_MS);
  }
  useEffect(() => () => clearTimeout(timer.current), []);

  const setFin = (k, v) => update({ finance: { ...p.finance, [k]: v } });
  const setSc = (k, v) => update({ scenario: { ...p.scenario, [k]: v } });
  const setPpa = (k, v) => update({ scenario: { ...p.scenario, ppa: { ...(p.scenario.ppa || {}), [k]: v } } });
  const setAsset = (id, patch) => update({ assets: { ...p.assets, [id]: { ...(p.assets[id] || {}), ...patch } } });
  const setDoc = (id, key, v) => setAsset(id, { docs: { ...((p.assets[id] || {}).docs || {}), [key]: v } });
  const setEsAnswer = (id, patch) => update({ es: { ...p.es, answers: { ...(p.es.answers || {}), [id]: { ...((p.es.answers || {})[id] || {}), ...patch } } } });
  const setImpact = (k, v) => update({ es: { ...p.es, impact: { ...(p.es.impact || {}), [k]: v } } });

  const inPortfolio = new Set(p.project_ids);
  const candidates = quotes.filter((q) => !inPortfolio.has(q.id));
  const addQuote = (id) => { if (id) update({ project_ids: [...p.project_ids, id] }); };
  const removeQuote = (id) => { update({ project_ids: p.project_ids.filter((x) => x !== id) }); if (open === id) setOpen(null); };

  const applyPreset = (id) => {
    const pre = FINANCING_PRESETS.find((x) => x.id === id);
    if (!pre) return;
    const f = { ...presetFinance(pre, uahPerEur), preset: id };
    setStepsText(f.rateSteps ? f.rateSteps.join(", ") : "");
    update({ finance: f });
  };
  const preset = FINANCING_PRESETS.find((x) => x.id === p.finance.preset);

  const parseSteps = (txt) => {
    setStepsText(txt);
    const arr = txt.split(/[,;\s]+/).filter(Boolean).map(Number).filter((n) => Number.isFinite(n) && n >= 0);
    setFin("rateSteps", arr.length ? arr : null);
  };

  const ppaOn = !!p.scenario.ppa;
  const mw = agg.kwp >= 1000 ? `${fnum(agg.kwp / 1000, lang, 2)} MW` : `${fnum(agg.kwp, lang, 0)} ${kwpUnit(lang)}`;
  const weakest = agg.weakest;
  const esItems = itemsFor(model.markets.length ? model.markets[0] : market).concat(
    ...model.markets.slice(1).map((m) => itemsFor(m).filter((i) => !itemsFor(model.markets[0]).some((x) => x.id === i.id))));
  const answers = p.es.answers || {};
  const impact = p.es.impact || {};
  const exportQs = `?lang=${docLang}`;
  const exportsBusy = saved === "saving";
  const money = (v) => eur(v, lang);

  return (
    <div className="dx pf">
      <Link href="/portfolios" className="pf-back">{pt("back", lang)}</Link>

      <header className="pf-head">
        <div className="pf-title">
          <input className="pf-name" value={p.name} aria-label={pt("title", lang)} maxLength={160} onChange={(e) => update({ name: e.target.value })} />
          <span className="pf-badge">{pt(market === "UA" ? "market_ua" : "market_md", lang)}</span>
          <span className={"pf-saved s-" + saved} role="status">{saved === "saving" ? pt("saving", lang) : saved === "error" ? pt("save_failed", lang) : pt("saved", lang)}</span>
        </div>
        <p className="pf-sub">{pt("all_eur", lang)}</p>
      </header>

      {model.unsupported.length > 0 && <p className="pf-note" role="status">{pt("unsupported", lang, { n: model.unsupported.length })}</p>}
      {model.missing.length > 0 && <p className="pf-note" role="status">{pt("missing", lang, { n: model.missing.length })}</p>}

      {/* ---- the headline numbers */}
      <section className="pf-kpis" aria-label={pt("k_irr", lang)}>
        <div className="pf-kpi"><span>{pt("k_assets", lang)}</span><b>{agg.count}</b><small>{mw}</small></div>
        <div className="pf-kpi"><span>{pt("k_capex", lang)}</span><b>{eurCompact(agg.capexEur, lang)}</b><small>{pt("k_debt", lang)} {eurCompact(agg.loanEur, lang)}, {pt("k_equity", lang)} {eurCompact(agg.equityEur, lang)}{agg.grantEur > 0 ? `, ${pt("k_grant", lang)} ${eurCompact(agg.grantEur, lang)}` : ""}</small></div>
        <div className="pf-kpi"><span>{pt("k_irr", lang)}</span><b>{agg.irr == null ? pt("na", lang) : pct(agg.irr, lang)}</b><small>{pt("k_eirr", lang)} {agg.equityIrr == null ? pt("na", lang) : pct(agg.equityIrr, lang)}</small></div>
        <div className="pf-kpi"><span>{pt("k_npv", lang)}</span><b>{eurCompact(agg.npv, lang)}</b><small>{fin.discPct}%, {pt("k_payback", lang)} {agg.paybackYears == null ? "25+" : fnum(agg.paybackYears, lang, 1)} {pt("years_w", lang)}</small></div>
        <div className={"pf-kpi t-" + dscrTone(agg.dscrMin)}><span>{pt("k_dscr", lang)}</span><b>{agg.dscrMin == null ? pt("na", lang) : dscr(agg.dscrMin, lang)}</b>
          <small>{agg.dscrMin == null ? pt("no_debt", lang) : weakest ? `${pt("k_weakest", lang)}: ${weakest.name} ${dscr(weakest.dscrMin, lang)}` : ""}</small></div>
        <div className="pf-kpi"><span>{pt("k_energy", lang)}</span><b>{fnum(agg.year1Mwh, lang, 0)}</b><small>{mwhUnit(lang)}, {pt("k_co2", lang)} {fnum(model.co2.tPerYear, lang, 0)} t</small></div>
      </section>

      {/* ---- cash flow against debt service */}
      {agg.count > 0 && (
        <section className="card">
          <div className="dx-card-head"><div><h2>{pt("r_cashflow", lang)}</h2><p>{pt("r_cfads", lang)} / {pt("r_ds", lang)}</p></div></div>
          <CashflowChart cfads={agg.cfads} debtService={agg.debtService} lang={lang} years={agg.cfads.length} />
        </section>
      )}

      {/* ---- assets */}
      <section className="card">
        <div className="dx-card-head"><div><h2>{pt("s_assets", lang)}</h2></div><span className="dx-count">{model.assets.length}</span></div>
        {model.assets.length === 0 ? <p className="dx-muted-note">{pt("assets_empty", lang)}</p> : (
          <div className="pf-scroll">
            <table className="pf-t">
              <thead><tr>
                <th>{pt("col_asset", lang)}</th><th>{pt("col_area", lang)}</th><th className="r">{kwpUnit(lang)}</th><th className="r">{pt("col_capex", lang)}</th>
                <th className="r">{pt("col_irr", lang)}</th><th className="r">{pt("col_npv", lang)}</th><th className="r">{pt("col_dscr", lang)}</th><th />
              </tr></thead>
              <tbody>
                {model.assets.map((a) => (
                  <Fragment key={a.id}>
                    <tr className={open === a.id ? "on" : ""}>
                      <td><b>{a.name}</b><small>{pt(a.market === "UA" ? "market_ua" : "market_md", lang)}{a.client ? `, ${a.client}` : ""}</small></td>
                      <td>{a.regionName || <span className="pf-dim">{pt("unknown_area", lang)}</span>}</td>
                      <td className="r">{fnum(a.kw, lang, 1)}</td>
                      <td className="r">{money(a.result.capexEur)}{a.capexOverrideEur ? " *" : ""}</td>
                      <td className="r">{a.result.irr == null ? pt("na", lang) : pct(a.result.irr, lang)}</td>
                      <td className="r">{money(a.result.npv)}</td>
                      <td className={"r t-" + dscrTone(a.result.dscrMin)}>{a.result.dscrMin == null ? "" : dscr(a.result.dscrMin, lang)}</td>
                      <td className="r"><button type="button" className="btn ghost sm" aria-expanded={open === a.id} onClick={() => setOpen(open === a.id ? null : a.id)}>{open === a.id ? "−" : "+"}</button></td>
                    </tr>
                    {open === a.id && (
                      <tr className="pf-edit"><td colSpan={8}>
                        <div className="pf-grid">
                          <Num id={`cx-${a.id}`} label={pt("col_capex_override", lang)} value={(p.assets[a.id] || {}).capexEur} onChange={(v) => setAsset(a.id, { capexEur: v })} min="0" />
                          <Num id={`co-${a.id}`} label={pt("col_cons", lang)} hint={pt("col_cons_h", lang)} value={(p.assets[a.id] || {}).consKwh} onChange={(v) => setAsset(a.id, { consKwh: v })} min="0" />
                          <button type="button" className="btn danger sm pf-rm" onClick={() => removeQuote(a.id)}>{pt("remove", lang)}</button>
                        </div>
                      </td></tr>
                    )}
                  </Fragment>
                ))}
              </tbody>
              <tfoot><tr>
                <td><b>{pt("k_assets", lang)}: {agg.count}</b></td><td />
                <td className="r">{fnum(agg.kwp, lang, 1)}</td><td className="r">{money(agg.capexEur)}</td>
                <td className="r">{agg.irr == null ? pt("na", lang) : pct(agg.irr, lang)}</td><td className="r">{money(agg.npv)}</td>
                <td className={"r t-" + dscrTone(agg.dscrMin)}>{agg.dscrMin == null ? "" : dscr(agg.dscrMin, lang)}</td><td />
              </tr></tfoot>
            </table>
          </div>
        )}
        <div className="pf-add">
          {candidates.length === 0 ? <small className="pf-hint">{pt("no_quotes_left", lang)}</small> : (
            <>
              <label htmlFor="pfAdd" className="pf-lbl">{pt("add_quote", lang)}</label>
              <select id="pfAdd" className="input" value="" onChange={(e) => addQuote(e.target.value)}>
                <option value="">{pt("add_ph", lang)}</option>
                {candidates.map((q) => <option key={q.id} value={q.id}>{(q.title || q.client_name || "-")} ({q.market}, {fnum(q.kw, lang, 1)} {kwpUnit(lang)})</option>)}
              </select>
            </>
          )}
        </div>
        {agg.byRegion.filter((r) => r.key).length > 0 && (
          <div className="pf-areas">
            <h3>{pt("by_area", lang)}</h3>
            {agg.byRegion.map((r) => {
              const a = model.assets.find((x) => x.region === r.key);
              return (
                <div key={r.key || "none"} className="pf-bar"><span>{r.key ? a?.regionName || r.key : pt("unknown_area", lang)}</span>
                  <i style={{ width: Math.max(2, r.sharePct) + "%" }} /><b>{Math.round(r.sharePct)}%</b></div>
              );
            })}
          </div>
        )}
      </section>

      {/* ---- financing */}
      <section className="card">
        <div className="dx-card-head"><div><h2>{pt("s_finance", lang)}</h2><p>{pt("f_note", lang)}</p></div></div>
        <div className="field pf-wide">
          <label htmlFor="pfPreset">{pt("f_preset", lang)}</label>
          <select id="pfPreset" className="input" value={p.finance.preset || ""} onChange={(e) => applyPreset(e.target.value)}>
            <option value="">{pt("f_preset_ph", lang)}</option>
            {presetsFor(market).map((x) => <option key={x.id} value={x.id}>{x.name[lang] || x.name.en}</option>)}
          </select>
        </div>
        {preset && (
          <div className={"pf-preset " + preset.status}>
            <b>{pt(preset.status === "published" ? "f_published" : "f_placeholder", lang)}</b>
            <span>{preset.note[lang] || preset.note.en}</span>
            {preset.source && <a href={preset.source.url} target="_blank" rel="noopener noreferrer">{pt("f_source", lang)}: {preset.source.label}</a>}
          </div>
        )}
        <div className="pf-grid">
          <Num id="fGear" label={pt("f_gearing", lang)} value={p.finance.gearingPct ?? fin.gearingPct} onChange={(v) => setFin("gearingPct", v)} min="0" max="95" />
          <Num id="fRate" label={pt("f_rate", lang)} value={p.finance.ratePct ?? fin.ratePct} onChange={(v) => setFin("ratePct", v)} min="0" max="40" step="0.1" />
          <div className="field"><label htmlFor="fSteps">{pt("f_steps", lang)}</label>
            <input id="fSteps" className="input" value={stepsText} onChange={(e) => parseSteps(e.target.value)} placeholder="0, 5, 7" />
            <small className="pf-hint">{pt("f_steps_h", lang)}</small></div>
          <Num id="fTenor" label={pt("f_tenor", lang)} value={p.finance.tenorYears ?? fin.tenorYears} onChange={(v) => setFin("tenorYears", v)} min="1" max="25" step="1" />
          <Num id="fDisc" label={pt("f_disc", lang)} value={p.finance.discPct ?? fin.discPct} onChange={(v) => setFin("discPct", v)} min="0" max="40" step="0.5" />
          <div className="field"><label htmlFor="fCur">{pt("f_currency", lang)}</label>
            <select id="fCur" className="input" value={fin.debtCurrency} onChange={(e) => setFin("debtCurrency", e.target.value)}>
              <option value="EUR">{pt("f_cur_eur", lang)}</option><option value="local">{pt("f_cur_local", lang)}</option>
            </select></div>
          <Num id="fGrant" label={pt("f_grant", lang)} value={p.finance.grantPct ?? ""} onChange={(v) => setFin("grantPct", v)} min="0" max="100" />
          <Num id="fCap" label={pt("f_grant_cap", lang)} value={p.finance.grantCapEur ?? ""} onChange={(v) => setFin("grantCapEur", v)} min="0" />
          <Num id="fComp" label={pt("f_comp", lang)} hint={pt("f_comp_h", lang)} value={p.finance.principalCompensationPct ?? ""} onChange={(v) => setFin("principalCompensationPct", v)} min="0" max="100" />
        </div>
      </section>

      {/* ---- the base case */}
      <section className="card">
        <div className="dx-card-head"><div><h2>{pt("s_scenario", lang)}</h2><p>{pt("sc_h", lang)}</p></div></div>
        <div className="pf-grid">
          <Num id="sTariff" label={pt("sc_tariff", lang)} value={p.scenario.tariffMultiplier == null ? 100 : Math.round(p.scenario.tariffMultiplier * 1000) / 10} onChange={(v) => setSc("tariffMultiplier", v === "" ? "" : v / 100)} min="0" max="300" step="1" />
          <Num id="sEsc" label={pt("sc_esc", lang)} hint={pt("sc_esc_h", lang)} value={p.scenario.tariffEscalationPct ?? ""} onChange={(v) => setSc("tariffEscalationPct", v)} step="0.5" />
          <Num id="sCurt" label={pt("sc_curt", lang)} value={p.scenario.curtailmentPct ?? ""} onChange={(v) => setSc("curtailmentPct", v)} min="0" max="100" />
          <Num id="sDelay" label={pt("sc_delay", lang)} value={p.scenario.delayMonths ?? ""} onChange={(v) => setSc("delayMonths", v)} min="0" max="60" step="1" />
          <Num id="sDep" label={pt("sc_dep", lang)} hint={pt("sc_dep_h", lang)} value={p.scenario.localDepreciationPctYr ?? ""} onChange={(v) => setSc("localDepreciationPctYr", v)} step="0.5" />
          <Num id="sWar" label={pt("sc_war", lang)} hint={pt("sc_war_h", lang)} value={p.scenario.warRiskPremiumPct ?? ""} onChange={(v) => setSc("warRiskPremiumPct", v)} min="0" max="20" step="0.1" />
          <Num id="sCapex" label={pt("sc_capex", lang)} value={p.scenario.capexMultiplier == null ? 100 : Math.round(p.scenario.capexMultiplier * 1000) / 10} onChange={(v) => setSc("capexMultiplier", v === "" ? "" : v / 100)} min="30" max="300" step="1" />
        </div>
        <div className="pf-ppa">
          <label className="check pf-check"><input type="checkbox" checked={ppaOn} onChange={(e) => update({ scenario: { ...p.scenario, ppa: e.target.checked ? { sharePct: 50, priceEurMwh: "", years: 10, escalationPct: 0, currency: "EUR" } : null } })} />
            <span className="txt">{pt("ppa_h", lang)}</span></label>
          {ppaOn ? (
            <div className="pf-grid">
              <Num id="pShare" label={pt("ppa_share", lang)} value={p.scenario.ppa.sharePct} onChange={(v) => setPpa("sharePct", v)} min="0" max="100" />
              <Num id="pPrice" label={pt("ppa_price", lang)} value={p.scenario.ppa.priceEurMwh} onChange={(v) => setPpa("priceEurMwh", v)} min="0" />
              <Num id="pYears" label={pt("ppa_years", lang)} value={p.scenario.ppa.years} onChange={(v) => setPpa("years", v)} min="1" max="25" step="1" />
              <Num id="pEsc" label={pt("ppa_esc", lang)} value={p.scenario.ppa.escalationPct} onChange={(v) => setPpa("escalationPct", v)} step="0.5" />
              <div className="field"><label htmlFor="pCur">{pt("ppa_cur", lang)}</label>
                <select id="pCur" className="input" value={p.scenario.ppa.currency || "EUR"} onChange={(e) => setPpa("currency", e.target.value)}>
                  <option value="EUR">{pt("f_cur_eur", lang)}</option><option value="local">{pt("f_cur_local", lang)}</option>
                </select></div>
            </div>
          ) : <small className="pf-hint">{pt("ppa_none", lang)}</small>}
        </div>
      </section>

      {/* ---- stress */}
      {suite.length > 0 && (
        <section className="card">
          <div className="dx-card-head"><div><h2>{pt("s_stress", lang)}</h2><p>{pt("st_h", lang)}</p></div></div>
          <div className="pf-scroll">
            <table className="pf-t">
              <thead><tr><th>{pt("st_case", lang)}</th><th className="r">{pt("col_dscr", lang)}</th><th className="r">{pt("col_irr", lang)}</th><th className="r">{pt("col_npv", lang)}</th><th className="r">{pt("st_dnpv", lang)}</th></tr></thead>
              <tbody>
                {suite.map((s) => {
                  const d = s.agg.npv - suite[0].agg.npv;
                  const span = Math.max(1, ...suite.map((x) => Math.abs(x.agg.npv - suite[0].agg.npv)));
                  return (
                    <tr key={s.id}>
                      <td>{caseLabel(s.id, lang, market)}</td>
                      <td className={"r t-" + dscrTone(s.agg.dscrMin)}>{s.agg.dscrMin == null ? pt("na", lang) : dscr(s.agg.dscrMin, lang)}</td>
                      <td className="r">{s.agg.irr == null ? pt("na", lang) : pct(s.agg.irr, lang)}</td>
                      <td className="r">{money(s.agg.npv)}</td>
                      <td className="r pf-delta">{s.id === "base" ? "" : <span className="pf-dwrap"><span className="pf-dtrack" aria-hidden="true"><span className="pf-dbar" style={{ width: Math.min(100, (Math.abs(d) / span) * 100) + "%" }} /></span><b>{d >= 0 ? "+" : "−"}{money(Math.abs(d))}</b></span>}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* ---- risk matrix */}
      {risks.length > 0 && (
        <section className="card">
          <div className="dx-card-head"><div><h2>{pt("s_risks", lang)}</h2><p>{pt("rk_h", lang)}</p></div></div>
          <div className="pf-scroll">
            <table className="pf-t pf-risk">
              <tbody>
                {risks.map((r, i) => {
                  const rows = riskRows({ risks: [r] }, lang)[0];
                  return (
                    <tr key={r.id}>
                      <td><b>{rows[0]}</b></td>
                      <td><span className={"pf-lv lv-" + r.level}>{rows[1]}</span></td>
                      <td className="r">{rows[2]}</td>
                      <td className="pf-rule">{rows[3]}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* ---- document register */}
      {model.assets.length > 0 && (
        <section className="card">
          <div className="dx-card-head"><div><h2>{pt("s_docs", lang)}</h2><p>{pt("docs_h", lang)}</p></div>
            <span className="dx-count">{Math.round(model.readiness.docsPct)}%</span></div>
          <div className="pf-scroll">
            <table className="pf-t pf-docs">
              <thead><tr><th>{pt("col_asset", lang)}</th>{DOC_KEYS.map((k) => <th key={k}>{pt("dk_" + k, lang)}</th>)}</tr></thead>
              <tbody>
                {model.assets.map((a) => (
                  <tr key={a.id}>
                    <td><b>{a.name}</b></td>
                    {DOC_KEYS.map((k) => (
                      <td key={k}>
                        <select className={"input pf-doc ds-" + (a.docs[k] || "missing")} aria-label={`${a.name}: ${pt("dk_" + k, lang)}`}
                          value={a.docs[k] || "missing"} onChange={(e) => setDoc(a.id, k, e.target.value)}>
                          {["missing", "draft", "done"].map((s) => <option key={s} value={s}>{pt("ds_" + s, lang)}</option>)}
                        </select>
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* ---- environmental and social screening */}
      <section className="card">
        <div className="dx-card-head"><div><h2>{pt("s_es", lang)}</h2><p>{pt("es_h", lang)}</p></div>
          <span className="dx-count">{model.esProgress.answered}/{model.esProgress.total}</span></div>
        <ol className="pf-es">
          {esItems.map((i) => {
            const a = answers[i.id] || {};
            return (
              <li key={i.id}>
                <div className="pf-es-q"><small>{i.std}</small><span id={`q-${i.id}`}>{i.q[lang] || i.q.en}</span></div>
                <div className="pf-seg" role="group" aria-labelledby={`q-${i.id}`}>
                  {ES_STATUSES.map((s) => (
                    <button key={s} type="button" aria-pressed={(a.status || "open") === s} className={"s-" + s + ((a.status || "open") === s ? " on" : "")} onClick={() => setEsAnswer(i.id, { status: s })}>{pt("es_" + s, lang)}</button>
                  ))}
                </div>
                <input className="input pf-es-note" value={a.note || ""} maxLength={400} placeholder={pt("es_note", lang)} aria-label={`${pt("es_note", lang)}: ${i.std}`} onChange={(e) => setEsAnswer(i.id, { note: e.target.value })} />
              </li>
            );
          })}
        </ol>
        <h3 className="pf-sh">{pt("es_impact", lang)}</h3>
        <p className="pf-hint">{pt("es_impact_h", lang)}</p>
        <div className="pf-grid">
          <Num id="iJc" label={pt("es_jobs_c", lang)} value={impact.jobsConstruction} onChange={(v) => setImpact("jobsConstruction", v)} min="0" step="1" />
          <Num id="iJp" label={pt("es_jobs_p", lang)} value={impact.jobsPermanent} onChange={(v) => setImpact("jobsPermanent", v)} min="0" step="1" />
          <Num id="iW" label={pt("es_women", lang)} value={impact.womenPct} onChange={(v) => setImpact("womenPct", v)} min="0" max="100" step="1" />
        </div>
        <div className="pf-co2">
          <div><span>{pt("k_co2", lang)}</span><b>{fnum(model.co2.tPerYear, lang, 0)}</b><small>{pt("es_co2_t", lang)}</small></div>
          <div><span>{pt("es_co2_l", lang)}</span><b>{fnum(model.co2.tLifetime, lang, 0)}</b><small>t</small></div>
          <div><span>{pt("es_factor", lang)}</span><b>{model.markets.map((m) => `${m} ${GRID_EMISSION_FACTOR[m]?.tPerMwh}`).join(", ")}</b><small>t/MWh</small></div>
        </div>
        <p className="pf-hint">{pt("es_cbam", lang)}</p>
      </section>

      {/* ---- exports */}
      <section className="card">
        <div className="dx-card-head"><div><h2>{pt("s_export", lang)}</h2><p>{pt("ex_h", lang)}</p></div></div>
        <div className="pf-export">
          <div className="field"><label htmlFor="exLang">{pt("ex_lang", lang)}</label>
            <select id="exLang" className="input" value={docLang} onChange={(e) => setDocLang(e.target.value)}>
              <option value="en">English</option><option value="uk">Українська</option><option value="ro">Română</option><option value="ru">Русский</option>
            </select></div>
          <a className={"btn primary" + (exportsBusy || !agg.count ? " off" : "")} aria-disabled={exportsBusy || !agg.count} href={`/api/portfolios/${portfolio.id}/report${exportQs}`} target="_blank" rel="noopener noreferrer">{pt("ex_report", lang)}</a>
          <a className={"btn ghost" + (exportsBusy || !agg.count ? " off" : "")} aria-disabled={exportsBusy || !agg.count} href={`/api/portfolios/${portfolio.id}/model${exportQs}`}>{pt("ex_model", lang)}</a>
          <a className={"btn ghost" + (exportsBusy || !agg.count ? " off" : "")} aria-disabled={exportsBusy || !agg.count} href={`/api/portfolios/${portfolio.id}/dataroom${exportQs}`}>{pt("ex_room", lang)}</a>
        </div>
        <div className="pf-foot">
          <button type="button" className="btn danger sm" onClick={async () => {
            if (!window.confirm(pt("delete_ask", lang))) return;
            await deletePortfolio(portfolio.id);
            router.push("/portfolios");
          }}>{pt("delete", lang)}</button>
          <small className="pf-hint">{company}</small>
        </div>
      </section>
    </div>
  );
}
