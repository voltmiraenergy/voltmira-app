"use client";
// app/(app)/portfolios/[id]/PortfolioView.jsx — a portfolio, live. Everything
// on the page is computed from the rows and the assumptions by buildModel()
// (lib/portfolioModel.js), the same function the PDF report, the teaser and
// the Excel workbook use, so what is on screen is what goes to the lender.
// Edits autosave to the portfolios table (debounced), like the quote editor;
// the heavy recompute runs on a deferred copy so typing never stutters.
//
// Everything new lives inside the existing jsonb columns (finance.sizing,
// finance.compare, finance.feePct, finance.termSheet, finance.displayCurrency),
// so the row shape other writers use (project_ids, assets) is unchanged.
import { Fragment, useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "../../../../lib/supabase-browser.js";
import { deletePortfolio } from "../../../../lib/actions.js";
import { duplicatePortfolio } from "../../../../lib/portfolioActions.js";
import { buildModel, MAX_STRUCTURES } from "../../../../lib/portfolioModel.js";
import { DOC_KEYS } from "../../../../lib/portfolio.js";
import { presetsFor, presetFinance, FINANCING_PRESETS } from "../../../../lib/financingPresets.js";
import { itemsFor, GRID_EMISSION_FACTOR } from "../../../../lib/esScreening.js";
import { caseLabel, riskRows } from "../../../../lib/portfolioExport.js";
import { sortTornado } from "../../../../lib/portfolioSensitivity.js";
import { DEFAULT_SIZING } from "../../../../lib/debtSizing.js";
import { pt } from "../../../../lib/portfolioText.js";
import { pct, dscr, num as fnum, mwhUnit, kwpUnit, dscrTone, moneyFmt, capacity, DISPLAY_CURRENCIES } from "../../../../lib/portfolioFormat.js";
import { fxNote, structureName, termsLine } from "../../../../lib/portfolioDisplay.js";
import CashflowChart from "../../../../components/CashflowChart.jsx";
import DscrChart from "../../../../components/portfolio/DscrChart.jsx";
import PackPay from "../../../../components/portfolio/PackPay.jsx";
import TornadoChart from "../../../../components/portfolio/TornadoChart.jsx";
import SourcesUses from "../../../../components/portfolio/SourcesUses.jsx";
import ReadinessPanel from "../../../../components/portfolio/ReadinessPanel.jsx";
import { FX } from "@voltmira/engine";
import { geocodeProjects } from "../../../../lib/geoActions.js";
import { placeQueries } from "../../../../lib/geoPlace.js";
import { PLANTS_KEY } from "../../../../lib/portfolioModel.js";
import { blankPlant } from "../../../../lib/plantSample.js";
import { plt } from "../../../../lib/plantText.js";
import { mdDayKey } from "../../../../lib/tz.js";
import { glideTo } from "../../../../lib/smoothJump.js";
import PlantsPanel from "../../../../components/portfolio/PlantsPanel.jsx";

/** kWh in the reader's language, for the map labels. */
const kwhUnit = (lang) => ({ ru: "кВт·ч", uk: "кВт·год" }[lang] || "kWh");

// Leaflet touches window: load the map on the client only
const AssetMap = dynamic(() => import("../../../../components/portfolio/AssetMap.jsx"), { ssr: false, loading: () => <div className="pf-map" style={{ height: 340 }} /> });

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

function Toggle({ checked, onChange, children, hint }) {
  return (
    <label className="check pf-check">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span className="txt">{children}{hint && <small>{hint}</small>}</span>
      <span className="toggle-pill" aria-hidden="true" />
    </label>
  );
}

const SAVE_DEBOUNCE_MS = 700;
const ES_STATUSES = ["open", "yes", "no", "na"];
// finance keys that belong to the page, not to a set of loan terms: a preset or
// another structure replaces the terms and keeps these
// a preset sets the lender's terms; the repayment profile, the construction
// period, the grace and the reserve are kept as the user set them
// the tax is the company's, not the lender's: a preset keeps it too
const KEEP_KEYS = ["compare", "sizing", "displayCurrency", "repayment", "constructionMonths", "graceYears", "dsraMonths", "taxPct", "taxLifeYears", "taxLossYears"];
const METRICS = ["dscrMin", "equityIrr", "irr", "npv"];
// an id for a saved structure (event handlers only)
const newId = () => "s" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
const NAV = [["overview", "nav_overview"], ["assets", "s_assets"], ["financing", "s_finance"], ["debt", "nav_debt"], ["cashflow", "nav_cashflow"],
  ["sensitivity", "nav_sensitivity"], ["risks", "s_risks"], ["papers", "nav_papers"], ["es", "nav_es"], ["export", "nav_export"]];

export default function PortfolioView({ portfolio, quotes, E, lang, schemeLimitKw, company, fx }) {
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
  const [metric, setMetric] = useState("dscrMin");
  const [flash, setFlash] = useState("");
  const [dup, setDup] = useState("idle");                  // idle | busy | error
  const timer = useRef(null);
  const latest = useRef(null);

  // the inputs follow `p` at once; the model follows a deferred copy
  const deferred = useDeferredValue(p);
  const model = useMemo(
    () => buildModel({ portfolio: { ...portfolio, ...deferred }, projects: quotes, E, schemeLimitKw }),
    [deferred, portfolio, quotes, E, schemeLimitKw],
  );
  const { agg, fin, scenario, suite, risks, sizing } = model;

  // ---- quotes without a pin go on the map from their address or town
  // (lib/geoActions.js). The answers are kept on the portfolio, in
  // assets[id].pos, through the page's own autosave; never on the quote.
  const [placing, setPlacing] = useState(() => {                      // { done, n } while looking up
    const n = model.assets.filter((a) => a.lat == null && placeQueries({ address: a.address, title: a.name, market: a.market }).length > 0).length;
    return n ? { done: 0, n } : null;
  });
  const [mapMiss, setMapMiss] = useState({ notFound: 0, failed: false });
  const pNow = useRef(p);
  const updateNow = useRef(null);
  const mounted = useRef(true);
  const triedGeo = useRef(new Set());
  useEffect(() => { pNow.current = p; updateNow.current = update; });
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  // the on-page tabs: glide to the section, and light the tab of the section in view
  const [here, setHere] = useState("overview");
  useEffect(() => {
    const onClick = (e) => {
      const a = e.target.closest?.('a[href^="#"]');
      if (!a || e.defaultPrevented || e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
      const el = document.getElementById(decodeURIComponent(a.getAttribute("href").slice(1)));
      if (!el) return;
      e.preventDefault();
      glideTo(el, { offset: el.classList.contains("pl") ? 70 : 56 });
      history.replaceState(null, "", a.getAttribute("href"));
      if (NAV.some(([id]) => id === el.id)) setHere(el.id);
    };
    let tick = 0;
    const onScroll = () => {
      cancelAnimationFrame(tick);
      tick = requestAnimationFrame(() => {
        let cur = null;
        for (const [id] of NAV) { const el = document.getElementById(id); if (el && el.getBoundingClientRect().top <= 120) cur = id; }
        if (cur) setHere(cur);
      });
    };
    document.addEventListener("click", onClick);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => { document.removeEventListener("click", onClick); window.removeEventListener("scroll", onScroll); cancelAnimationFrame(tick); };
  }, []);
  const unplacedKey = model.assets.filter((a) => a.lat == null).map((a) => a.id).join(",");
  const missN = mapMiss.notFound + model.assets.filter((a) => a.lat == null && placeQueries({ address: a.address, title: a.name, market: a.market }).length === 0).length;
  useEffect(() => {
    const todo = model.assets.filter((a) => a.lat == null && !triedGeo.current.has(a.id)
      && placeQueries({ address: a.address, title: a.name, market: a.market }).length > 0);
    if (!todo.length) return;
    todo.forEach((a) => triedGeo.current.add(a.id));
    (async () => {
      let rest = todo.map((a) => ({ id: a.id, address: a.address, title: a.name, market: a.market }));
      const n = rest.length;
      let done = 0, notFound = 0, failed = false;
      setPlacing({ done, n });
      while (rest.length && mounted.current) {
        const r = await geocodeProjects(rest.slice(0, 4)).catch(() => null);
        if (!r) { failed = true; break; }
        if (r.placed.length && updateNow.current) {
          const assets = { ...(pNow.current.assets || {}) };
          for (const f of r.placed) assets[f.id] = { ...(assets[f.id] || {}), pos: { lat: f.lat, lon: f.lon, precision: f.precision, q: f.q, place: f.place || "" } };
          updateNow.current({ assets });
        }
        const tried = new Set([...r.placed.map((x) => x.id), ...r.notFound]);
        notFound += r.notFound.length;
        done += tried.size;
        if (mounted.current) setPlacing({ done, n });
        if (!r.ok || r.error || !tried.size) { failed = true; break; }
        rest = rest.filter((x) => !tried.has(x.id));
      }
      if (mounted.current) { setPlacing(null); setMapMiss({ notFound, failed }); }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [unplacedKey]);
  const market = portfolio.market === "UA" ? "UA" : "MD";
  const uahPerEur = Number(fx?.rates?.UAH) || Number(E?.fx?.UAH) || FX.UAH;
  const mdlPerEur = Number(fx?.rates?.MDL) || Number(E?.fx?.MDL) || FX.MDL;
  const cur = DISPLAY_CURRENCIES.includes(p.finance.displayCurrency) ? p.finance.displayCurrency : "EUR";
  const money = moneyFmt(lang, { cur, rate: cur === "MDL" ? mdlPerEur : cur === "UAH" ? uahPerEur : 1 });
  const na = pt("na", lang);
  const fd = (v) => (v == null ? na : dscr(v, lang));
  const fp = (v) => (v == null ? na : pct(v, lang));

  // ---- saving
  async function persist(next) {
    latest.current = next;
    try {
      const { error } = await supabaseBrowser().from("portfolios").update({
        name: next.name, project_ids: next.project_ids, finance: next.finance, scenario: next.scenario,
        assets: next.assets, es: next.es, updated_at: new Date().toISOString(),
      }).eq("id", portfolio.id);
      if (latest.current !== next) return;                 // a newer save is on its way
      setSaved(error ? "error" : "saved");
      if (error) console.error("portfolio save failed:", error.message);
    } catch (e) {
      setSaved("error");
      console.error("portfolio save threw:", e?.message || e);
    }
  }
  function update(patch) {
    const next = { ...p, ...patch };
    latest.current = next;
    setP(next); setSaved("saving");
    clearTimeout(timer.current);
    timer.current = setTimeout(() => persist(next), SAVE_DEBOUNCE_MS);
  }
  const retry = () => { if (latest.current) { setSaved("saving"); persist(latest.current); } };
  useEffect(() => () => clearTimeout(timer.current), []);
  useEffect(() => { if (!flash) return; const t = setTimeout(() => setFlash(""), 4000); return () => clearTimeout(t); }, [flash]);

  const setFin = (k, v) => update({ finance: { ...p.finance, [k]: v } });
  const setSizing = (k, v) => update({ finance: { ...p.finance, sizing: { ...(p.finance.sizing || {}), [k]: v } } });
  const setSc = (k, v) => update({ scenario: { ...p.scenario, [k]: v } });
  const setPpa = (k, v) => update({ scenario: { ...p.scenario, ppa: { ...(p.scenario.ppa || {}), [k]: v } } });
  const setAsset = (id, patch) => update({ assets: { ...p.assets, [id]: { ...(p.assets[id] || {}), ...patch } } });
  // utility plants live on the portfolio's assets record (lib/portfolioModel.js PLANTS_KEY)
  const plants = Array.isArray(p.assets[PLANTS_KEY]) ? p.assets[PLANTS_KEY] : [];
  const setPlants = (next) => update({ assets: { ...p.assets, [PLANTS_KEY]: next } });
  const addPlant = () => {
    setPlants([...plants, blankPlant("")]);
    setTimeout(() => document.getElementById("plants")?.scrollIntoView({ behavior: "smooth", block: "start" }), 120);
  };
  const setDoc = (id, key, v) => setAsset(id, { docs: { ...((p.assets[id] || {}).docs || {}), [key]: v } });
  const setEsAnswer = (id, patch) => update({ es: { ...p.es, answers: { ...(p.es.answers || {}), [id]: { ...((p.es.answers || {})[id] || {}), ...patch } } } });
  const setImpact = (k, v) => update({ es: { ...p.es, impact: { ...(p.es.impact || {}), [k]: v } } });
  const keep = () => Object.fromEntries(KEEP_KEYS.filter((k) => p.finance[k] !== undefined).map((k) => [k, p.finance[k]]));
  const setTerms = (f) => {
    setStepsText(Array.isArray(f.rateSteps) ? f.rateSteps.join(", ") : "");
    update({ finance: { ...f, ...keep() } });
  };

  // ---- quotes in and out
  const inPortfolio = new Set(p.project_ids);
  const candidates = quotes.filter((q) => !inPortfolio.has(q.id));
  const wonHere = candidates.filter((q) => q.market === market && (q.status === "won" || q.signed));
  const addQuote = (id) => { if (id) update({ project_ids: [...p.project_ids, id] }); };
  const addWon = () => {
    if (!wonHere.length) return;
    update({ project_ids: [...p.project_ids, ...wonHere.map((q) => q.id)] });
    setFlash(pt("added_n", lang, { n: wonHere.length }));
  };
  const removeQuote = (id) => { update({ project_ids: p.project_ids.filter((x) => x !== id) }); if (open === id) setOpen(null); };

  // ---- financing terms
  const applyPreset = (id) => {
    const pre = FINANCING_PRESETS.find((x) => x.id === id);
    if (!pre) return;
    setTerms({ ...presetFinance(pre, uahPerEur, mdlPerEur), preset: id });
  };
  const preset = FINANCING_PRESETS.find((x) => x.id === p.finance.preset);
  const parseSteps = (txt) => {
    setStepsText(txt);
    const arr = txt.split(/[,;\s]+/).filter(Boolean).map(Number).filter((n) => Number.isFinite(n) && n >= 0);
    setFin("rateSteps", arr.length ? arr : null);
  };

  // ---- structures to compare (kept in finance.compare)
  const alts = Array.isArray(p.finance.compare) ? p.finance.compare : [];
  const termsOnly = (f) => Object.fromEntries(Object.entries(f || {}).filter(([k]) => !KEEP_KEYS.includes(k) && k !== "termSheet"));
  const addAlt = (presetId) => {
    const pre = FINANCING_PRESETS.find((x) => x.id === presetId);
    if (!pre || alts.length >= MAX_STRUCTURES - 1) return;
    update({ finance: { ...p.finance, compare: [...alts, { id: newId(), preset: presetId, fin: presetFinance(pre, uahPerEur, mdlPerEur) }] } });
  };
  const snapshot = () => {
    if (alts.length >= MAX_STRUCTURES - 1) return;
    update({ finance: { ...p.finance, compare: [...alts, { id: newId(), label: pt("cmp_variant", lang, { n: alts.length + 1 }), preset: p.finance.preset || null, fin: termsOnly(p.finance) }] } });
  };
  const removeAlt = (id) => update({ finance: { ...p.finance, compare: alts.filter((a) => a.id !== id) } });
  const applyAlt = (id) => {
    const a = alts.find((x) => x.id === id);
    if (a) setTerms({ ...termsOnly(a.fin), preset: a.preset || null });
  };

  // ---- duplicate
  async function onDuplicate() {
    setDup("busy");
    clearTimeout(timer.current);
    if (latest.current) await persist(latest.current);
    const r = await duplicatePortfolio(portfolio.id, pt("duplicate_name", lang, { name: p.name || "Portfolio" })).catch(() => ({ error: "failed" }));
    if (r?.id) router.push(`/portfolios/${r.id}`);
    else setDup("error");
  }

  const ppaOn = !!p.scenario.ppa;
  const weakest = agg.weakest;
  const esItems = itemsFor(model.markets.length ? model.markets[0] : market).concat(
    ...model.markets.slice(1).map((m) => itemsFor(m).filter((i) => !itemsFor(model.markets[0]).some((x) => x.id === i.id))));
  const answers = p.es.answers || {};
  const impact = p.es.impact || {};
  const exportQs = `?lang=${docLang}${cur !== "EUR" ? `&cur=${cur}` : ""}`;
  // the stress table's shortfall column, when a reserve is set or a case runs short
  const showShort = fin.dsraMonths > 0 || suite.some((s) => s.agg.shortfallEur > 0.5);
  const exportsOff = saved === "saving" || !agg.count;
  const empty = model.assets.length === 0;
  const sz = p.finance.sizing || {};
  const located = model.assets.filter((a) => a.lat != null);
  const marketName = pt(market === "UA" ? "market_ua" : "market_md", lang);
  const statusText = (q) => (q.kind === "plant" ? plt("plant_tag", lang)
    : pt(q.signed && q.status !== "won" ? "st_signed" : "st_" + (["won", "sent", "draft", "lost"].includes(q.status) ? q.status : "draft"), lang));
  const mixText = (a) => {
    const pl = a.plant;
    if (!pl) return "";
    return [pl.wind && `${plt("c_wind", lang)} ${fnum(pl.wind.mw, lang, 1)} MW`, pl.solar && `${plt("c_solar", lang)} ${fnum(pl.solar.mwp, lang, 1)} MWp`,
      pl.bess && `${plt("c_bess", lang)} ${fnum(pl.bess.mwh, lang, 1)} ${mwhUnit(lang)}`].filter(Boolean).join(", ");
  };
  const plantResults = Object.fromEntries(model.assets.filter((a) => a.kind === "plant").map((a) => [a.id, a.result]));
  const metrics = METRICS.filter((m) => model.sensitivity.base && model.sensitivity.base[m] != null);
  const metricNow = metrics.includes(metric) ? metric : metrics[0];
  const torRows = metricNow ? sortTornado(model.sensitivity, metricNow) : [];
  const meterMax = Math.max(sizing.capacityEur, sizing.currentLoanEur, 1) * 1.08;

  const saveState = saved === "error" ? (
    <span className="pf-save-err" role="alert"><span className="pf-saved s-error">{pt("save_failed", lang)}</span>
      <button type="button" className="btn ghost sm" onClick={retry}>{pt("retry", lang)}</button></span>
  ) : <span className={"pf-saved s-" + saved} role="status">{saved === "saving" ? pt("saving", lang) : pt("saved", lang)}</span>;

  const addControls = (
    <div className="pf-add-row">
      {candidates.length === 0 ? <small className="pf-hint">{pt("no_quotes_left", lang)}</small> : (
        <div className="pf-add">
          <label htmlFor="pfAdd" className="pf-lbl">{pt("add_quote", lang)}</label>
          <select id="pfAdd" className="input" value="" onChange={(e) => addQuote(e.target.value)}>
            <option value="">{pt("add_ph", lang)}</option>
            {candidates.map((q) => <option key={q.id} value={q.id}>{(q.title || q.client_name || "-")} ({q.market}, {fnum(q.kw, lang, 1)} {kwpUnit(lang)}, {statusText(q)})</option>)}
          </select>
        </div>
      )}
      {wonHere.length > 0 && <button type="button" className="btn ghost sm pf-addwon" onClick={addWon}>{pt("add_won", lang, { m: marketName, n: wonHere.length })}</button>}
    </div>
  );

  return (
    <div className="dx pf">
      <Link href="/portfolios" className="pf-back">{pt("back", lang)}</Link>

      <header className="pf-head">
        <div className="pf-head-row">
          <div className="pf-title">
            <input className="pf-name" value={p.name} aria-label={pt("title", lang)} maxLength={160} onChange={(e) => update({ name: e.target.value })} />
            <span className="pf-badge">{marketName}</span>
            {saveState}
          </div>
          <div className="pf-tools">
            <div className="field">
              <label htmlFor="pfCur">{pt("show_in", lang)}</label>
              <select id="pfCur" className="input" value={cur} onChange={(e) => setFin("displayCurrency", e.target.value)}>
                {DISPLAY_CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <button type="button" className="btn ghost sm" onClick={onDuplicate} disabled={dup === "busy"} title={pt("duplicate_h", lang)}>
              {dup === "busy" ? pt("duplicating", lang) : pt("duplicate", lang)}
            </button>
          </div>
        </div>
        <p className="pf-sub">{fxNote(lang, cur, fx)}{cur !== "EUR" && <small>{pt("inputs_eur", lang)}</small>}</p>
        {dup === "error" && <p className="pf-warn" role="alert">{pt("duplicate_failed", lang)}</p>}
        {flash && <p className="pf-flash" role="status">{flash}</p>}
      </header>

      {model.unsupported.length > 0 && <p className="pf-note" role="status">{pt("unsupported", lang, { n: model.unsupported.length })}</p>}
      {model.missing.length > 0 && <p className="pf-note" role="status">{pt("missing", lang, { n: model.missing.length })}</p>}

      {empty ? (
        <section className="card pf-empty">
          <div>
            <h2>{pt("empty_title", lang)}</h2>
            <p>{pt("empty_body", lang)}</p>
            <p className="pf-hint pf-ts">{pt("list_steps", lang)}</p>
          </div>
          <div className="pf-empty-act">
            <button type="button" className="btn" onClick={addPlant}>{plt("add_plant", lang)}</button>
            {quotes.length === 0 ? (
              <>
                <p className="pf-hint">{pt("no_quotes_market", lang)}</p>
                <Link href="/projects" className="btn primary">{pt("new_quote", lang)}</Link>
              </>
            ) : (
              <>
                {wonHere.length > 0
                  ? <button type="button" className="btn primary" onClick={addWon}>{pt("add_won", lang, { m: marketName, n: wonHere.length })}</button>
                  : <p className="pf-hint">{pt("add_won_none", lang, { m: marketName })}</p>}
                <div className="field">
                  <label htmlFor="pfAddEmpty">{pt("or_pick", lang)}</label>
                  <select id="pfAddEmpty" className="input" value="" onChange={(e) => addQuote(e.target.value)}>
                    <option value="">{pt("add_ph", lang)}</option>
                    {candidates.map((q) => <option key={q.id} value={q.id}>{(q.title || q.client_name || "-")} ({q.market}, {fnum(q.kw, lang, 1)} {kwpUnit(lang)}, {statusText(q)})</option>)}
                  </select>
                </div>
              </>
            )}
          </div>
        </section>
      ) : (
        <>
          <nav className="pf-nav" aria-label={pt("on_page", lang)}>
            {NAV.map(([id, k]) => (
              <Fragment key={id}>
                <a href={"#" + id} className={here === id ? "on" : ""} aria-current={here === id ? "location" : undefined}>{pt(k, lang)}</a>
                {id === "assets" && plants.length > 0 && <a href="#plants">{plt("sec_h", lang)}</a>}
              </Fragment>
            ))}
          </nav>

          {/* ---- overview: the headline numbers and how ready the portfolio is */}
          <section id="overview" className="pf-sec" aria-label={pt("nav_overview", lang)}>
            <div className="pf-kpis">
              <div className="pf-kpi"><span>{pt("k_assets", lang)}</span><b>{agg.count}</b><small>{capacity(agg.kwp, lang)}, {fnum(agg.year1Mwh, lang, 0)} {mwhUnit(lang)}</small></div>
              <div className="pf-kpi"><span>{pt("k_capex", lang)}</span><b>{money.compact(agg.capexEur)}</b><small>{pt("k_debt", lang)} {money.compact(agg.loanEur)}, {pt("k_equity", lang)} {money.compact(agg.equityEur + agg.feeEur)}{agg.grantEur > 0 ? `, ${pt("k_grant", lang)} ${money.compact(agg.grantEur)}` : ""}</small></div>
              <div className={"pf-kpi" + (fin.gearingPct > 0 && !sizing.withinCapacity ? " t-bad" : "")}><span>{pt("k_capacity_debt", lang)}</span><b>{money.compact(sizing.capacityEur)}</b>
                <small>{pt("k_capacity_sub", lang, { pct: sizing.capacityPct == null ? na : fnum(sizing.capacityPct, lang, 0), cur: money.compact(sizing.currentLoanEur) })}</small></div>
              <div className={"pf-kpi t-" + dscrTone(agg.dscrMin)}><span>{pt("k_dscr_p50", lang)}</span><b>{agg.dscrMin == null ? na : dscr(agg.dscrMin, lang)}</b>
                <small>{agg.dscrMin == null ? pt("no_debt", lang) : `P90 ${fd(model.p90.dscrMin)}${weakest ? `, ${pt("k_weakest", lang).toLowerCase()}: ${weakest.name} ${dscr(weakest.dscrMin, lang)}` : ""}`}</small></div>
              <div className="pf-kpi"><span>{pt("k_irr", lang)}</span><b>{fp(agg.irr)}</b><small>{pt("k_eirr", lang)} {fp(agg.equityIrr)}</small></div>
              <div className="pf-kpi"><span>{pt("k_npv", lang)}</span><b>{money.compact(agg.npv)}</b><small>{fnum(fin.discPct, lang, 1)}%, {pt("k_payback", lang)} {agg.paybackYears == null ? "25+" : fnum(agg.paybackYears, lang, 1)} {pt("years_w", lang)}</small></div>
            </div>
            <section className="card">
              <div className="dx-card-head"><div><h2>{pt("s_ready", lang)}</h2><p>{pt("rd_h", lang)}</p></div></div>
              <ReadinessPanel readiness={model.readiness} lang={lang} />
            </section>
          </section>

          {/* ---- assets and where they are */}
          <section id="assets" className="pf-sec" aria-label={pt("s_assets", lang)}>
            <section className="card">
              <div className="dx-card-head"><div><h2>{pt("s_assets", lang)}</h2></div><span className="dx-count">{model.assets.length}</span></div>
              <div className="pf-scroll">
                <table className="pf-t">
                  <thead><tr>
                    <th>{pt("col_asset", lang)}</th><th>{pt("col_area", lang)}</th><th className="r">{kwpUnit(lang)}</th><th className="r">{pt("col_capex", lang)}</th>
                    <th className="r">{pt("k_capacity_debt", lang)}</th><th className="r">{pt("col_irr", lang)}</th><th className="r">{pt("col_npv", lang)}</th><th className="r">{pt("col_dscr", lang)}</th><th />
                  </tr></thead>
                  <tbody>
                    {model.assets.map((a) => (
                      <Fragment key={a.id}>
                        <tr className={open === a.id ? "on" : ""}>
                          <td><b>{a.name}</b><small>{a.kind === "plant" ? `${statusText(a)}: ${mixText(a)}` : <>{pt(a.market === "UA" ? "market_ua" : "market_md", lang)}{a.client ? `, ${a.client}` : ""}, {statusText(a)}</>}</small></td>
                          <td>{a.regionName || <span className="pf-dim">{pt("unknown_area", lang)}</span>}</td>
                          <td className="r">{fnum(a.kw, lang, 1)}</td>
                          <td className="r">{money.full(a.result.capexEur)}{a.capexOverrideEur ? " *" : ""}</td>
                          <td className="r">{a.capacityEur == null ? "" : money.full(a.capacityEur)}</td>
                          <td className="r">{fp(a.result.irr)}</td>
                          <td className="r">{money.full(a.result.npv)}</td>
                          <td className={"r t-" + dscrTone(a.result.dscrMin)}>{a.result.dscrMin == null ? "" : dscr(a.result.dscrMin, lang)}<small>{a.dscrMinP90 == null ? "" : `P90 ${dscr(a.dscrMinP90, lang)}`}</small></td>
                          <td className="r">{a.kind === "plant"
                            ? <a className="btn ghost sm" href={"#plant-" + a.id} aria-label={`${a.name}: ${plt("sec_h", lang)}`}>+</a>
                            : <button type="button" className="btn ghost sm" aria-expanded={open === a.id} aria-label={`${a.name}: ${pt("col_capex_override", lang)}`} onClick={() => setOpen(open === a.id ? null : a.id)}>{open === a.id ? "−" : "+"}</button>}</td>
                        </tr>
                        {open === a.id && (
                          <tr className="pf-edit"><td colSpan={9}>
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
                    <td className="r">{fnum(agg.kwp, lang, 1)}</td><td className="r">{money.full(agg.capexEur)}</td>
                    <td className="r">{money.full(sizing.capacityEur)}</td>
                    <td className="r">{fp(agg.irr)}</td><td className="r">{money.full(agg.npv)}</td>
                    <td className={"r t-" + dscrTone(agg.dscrMin)}>{agg.dscrMin == null ? "" : dscr(agg.dscrMin, lang)}</td><td />
                  </tr></tfoot>
                </table>
              </div>
              {addControls}
              <div className="pl-addrow"><button type="button" className="btn ghost sm" onClick={addPlant}>{plt("add_plant", lang)}</button></div>
            </section>

            <section className="card">
              <div className="dx-card-head"><div><h2>{pt("s_map", lang)}</h2><p>{pt("map_h", lang)}</p></div></div>
              {located.length === 0 ? (placing ? null : <p className="dx-muted-note">{pt("map_none", lang)}</p>) : (
                <AssetMap label={pt("map_label", lang)} points={located.map((a) => {
                  const kwh = a.result.year1Kwh || 0;
                  const energy = pt("map_per_year", lang, { x: kwh >= 100000 ? `${fnum(kwh / 1000, lang, 1)} ${mwhUnit(lang)}` : `${fnum(kwh, lang, 0)} ${kwhUnit(lang)}` });
                  return {
                    id: a.id, name: a.name, lat: a.lat, lon: a.lon, kw: a.kw, approx: a.loc === "locality",
                    label: `${fnum(a.kw, lang, 1)} ${kwpUnit(lang)}, ${energy}`,
                    rows: [
                      [pt("col_capex", lang), `${money.full(a.result.capexEur)} ${money.cur}`],
                      ...(a.result.loanEur > 0 ? [[pt("k_debt", lang), `${money.full(a.result.loanEur)} ${money.cur}`]] : []),
                      ...(a.result.dscrMin != null ? [["DSCR P50", dscr(a.result.dscrMin, lang)]] : []),
                      ...(a.regionName ? [[pt("col_area", lang), a.regionName]] : []),
                      [pt("map_place", lang), pt(a.loc === "exact" ? "map_loc_exact" : a.loc === "address" ? "map_loc_address" : "map_loc_locality", lang)],
                    ],
                  };
                })} />
              )}
              {placing && <p className="pf-hint" role="status">{pt("map_placing", lang, { done: placing.done, n: placing.n })}</p>}
              {!placing && mapMiss.failed && located.length < model.assets.length && <p className="pf-hint">{pt("map_geofail", lang)}</p>}
              {/* only what the lookup could not find, plus quotes with no address and no town to look up */}
              {!placing && !mapMiss.failed && missN > 0 && <p className="pf-hint">{pt("map_notfound", lang, { n: missN })}</p>}
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
          </section>

          {/* ---- financing terms and the base case */}
          {plants.length > 0 && (
            <section id="plants" className="pf-sec" aria-label={plt("sec_h", lang)}>
              <div className="pl-sec-h"><h2>{plt("sec_h", lang)}</h2><p>{plt("sec_p", lang)}</p></div>
              <PlantsPanel plants={plants} onChange={setPlants} lang={lang} E={E} fin={fin} scenario={p.scenario} money={money}
                target={sizing.p50Dscr} todayKey={mdDayKey(Date.now())} results={plantResults} portfolioId={portfolio.id} companyId={portfolio.company_id} saving={saved === "saving"}
                sites={located.map((a) => ({ id: a.id, name: a.name, lat: a.lat, lon: a.lon }))} />
            </section>
          )}

          <section id="financing" className="pf-sec" aria-label={pt("s_finance", lang)}>
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
                  {preset.alsoSee && <a href={preset.alsoSee.url} target="_blank" rel="noopener noreferrer">{pt("f_also", lang)}: {preset.alsoSee.label}</a>}
                </div>
              )}
              <div className="pf-grid">
                <Num id="fGear" label={pt("f_gearing", lang)} value={p.finance.gearingPct ?? fin.gearingPct} onChange={(v) => setFin("gearingPct", v)} min="0" max="95" />
                <Num id="fRate" label={pt("f_rate", lang)} value={p.finance.ratePct ?? fin.ratePct} onChange={(v) => setFin("ratePct", v)} min="0" max="40" step="0.1" />
                <div className="field"><label htmlFor="fSteps">{pt("f_steps", lang)}</label>
                  <input id="fSteps" className="input" value={stepsText} onChange={(e) => parseSteps(e.target.value)} placeholder="0, 5, 7" />
                  <small className="pf-hint">{pt("f_steps_h", lang)}</small></div>
                <Num id="fTenor" label={pt("f_tenor", lang)} value={p.finance.tenorYears ?? fin.tenorYears} onChange={(v) => setFin("tenorYears", v)} min="1" max="25" step="1" />
                <div className="field">
                  <label htmlFor="fRepay">{pt("f_repay", lang)}</label>
                  <select id="fRepay" className="input" value={fin.repayment} onChange={(e) => setFin("repayment", e.target.value)}>
                    <option value="annuity">{pt("f_repay_annuity", lang)}</option>
                    <option value="sculpted">{pt("f_repay_sculpted", lang)}</option>
                  </select>
                  <small className="pf-hint">{pt("f_repay_h", lang)}</small>
                </div>
                <Num id="fBuild" label={pt("f_build", lang)} hint={pt("f_build_h", lang)} value={p.finance.constructionMonths ?? fin.constructionMonths} onChange={(v) => setFin("constructionMonths", v)} min="0" max="48" step="1" />
                <Num id="fGrace" label={pt("f_grace", lang)} hint={pt("f_grace_h", lang)} value={p.finance.graceYears ?? fin.graceYears} onChange={(v) => setFin("graceYears", v)} min="0" max="5" step="1" />
                <Num id="fDsra" label={pt("f_dsra", lang)} hint={pt("f_dsra_h", lang)} value={p.finance.dsraMonths ?? fin.dsraMonths} onChange={(v) => setFin("dsraMonths", v)} min="0" max="12" step="1" />
                <Num id="fDisc" label={pt("f_disc", lang)} value={p.finance.discPct ?? fin.discPct} onChange={(v) => setFin("discPct", v)} min="0" max="40" step="0.5" />
                <Num id="fTax" label={pt("f_tax", lang)} hint={pt("f_tax_h", lang)} value={p.finance.taxPct ?? fin.taxPct} onChange={(v) => setFin("taxPct", v)} min="0" max="40" step="0.5" />
                <Num id="fTaxLife" label={pt("f_tax_life", lang)} hint={pt("f_tax_life_h", lang)} value={p.finance.taxLifeYears ?? fin.taxLifeYears} onChange={(v) => setFin("taxLifeYears", v)} min="1" max="40" step="1" />
                <Num id="fTaxLoss" label={pt("f_tax_loss", lang)} hint={pt("f_tax_loss_h", lang)} value={p.finance.taxLossYears ?? fin.taxLossYears} onChange={(v) => setFin("taxLossYears", v)} min="0" max="40" step="1" />
                <div className="field"><label htmlFor="fCur">{pt("f_currency", lang)}</label>
                  <select id="fCur" className="input" value={fin.debtCurrency} onChange={(e) => setFin("debtCurrency", e.target.value)}>
                    <option value="EUR">{pt("f_cur_eur", lang)}</option><option value="local">{pt("f_cur_local", lang)}</option>
                  </select></div>
                <Num id="fGrant" label={pt("f_grant", lang)} value={p.finance.grantPct ?? ""} onChange={(v) => setFin("grantPct", v)} min="0" max="100" />
                <Num id="fCap" label={pt("f_grant_cap", lang)} value={p.finance.grantCapEur ?? ""} onChange={(v) => setFin("grantCapEur", v)} min="0" />
                <Num id="fComp" label={pt("f_comp", lang)} hint={pt("f_comp_h", lang)} value={p.finance.principalCompensationPct ?? ""} onChange={(v) => setFin("principalCompensationPct", v)} min="0" max="100" />
                <Num id="fFee" label={pt("f_fee", lang)} hint={pt("f_fee_h", lang)} value={p.finance.feePct ?? ""} onChange={(v) => setFin("feePct", v)} min="0" max="10" step="0.1" />
              </div>
              <div className="pf-ts">
                <Toggle checked={p.finance.termSheet === true} onChange={(v) => setFin("termSheet", v)} hint={pt("f_termsheet_h", lang)}>{pt("f_termsheet", lang)}</Toggle>
              </div>
            </section>

            <section className="card">
              <div className="dx-card-head"><div><h2>{pt("s_scenario", lang)}</h2><p>{pt("sc_h", lang)}</p></div></div>
              <div className="pf-grid">
                <Num id="sTariff" label={pt("sc_tariff", lang)} value={p.scenario.tariffMultiplier == null || p.scenario.tariffMultiplier === "" ? 100 : Math.round(p.scenario.tariffMultiplier * 1000) / 10} onChange={(v) => setSc("tariffMultiplier", v === "" ? "" : v / 100)} min="0" max="300" step="1" />
                <Num id="sEsc" label={pt("sc_esc", lang)} hint={pt("sc_esc_h", lang)} value={p.scenario.tariffEscalationPct ?? ""} onChange={(v) => setSc("tariffEscalationPct", v)} step="0.5" />
                <Num id="sCurt" label={pt("sc_curt", lang)} value={p.scenario.curtailmentPct ?? ""} onChange={(v) => setSc("curtailmentPct", v)} min="0" max="100" />
                <Num id="sDelay" label={pt("sc_delay", lang)} value={p.scenario.delayMonths ?? ""} onChange={(v) => setSc("delayMonths", v)} min="0" max="60" step="1" />
                <Num id="sDep" label={pt("sc_dep", lang)} hint={pt("sc_dep_h", lang)} value={p.scenario.localDepreciationPctYr ?? ""} onChange={(v) => setSc("localDepreciationPctYr", v)} step="0.5" />
                <Num id="sWar" label={pt("sc_war", lang)} hint={pt("sc_war_h", lang)} value={p.scenario.warRiskPremiumPct ?? ""} onChange={(v) => setSc("warRiskPremiumPct", v)} min="0" max="20" step="0.1" />
                <Num id="sCapex" label={pt("sc_capex", lang)} value={p.scenario.capexMultiplier == null || p.scenario.capexMultiplier === "" ? 100 : Math.round(p.scenario.capexMultiplier * 1000) / 10} onChange={(v) => setSc("capexMultiplier", v === "" ? "" : v / 100)} min="30" max="300" step="1" />
              </div>
              <div className="pf-ppa">
                <Toggle checked={ppaOn} onChange={(on) => update({ scenario: { ...p.scenario, ppa: on ? { sharePct: 50, priceEurMwh: "", years: 10, escalationPct: 0, currency: "EUR" } : null } })}>{pt("ppa_h", lang)}</Toggle>
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
          </section>

          {/* ---- debt: how much the cash flow supports, what pays for what, and other structures */}
          <section id="debt" className="pf-sec" aria-label={pt("nav_debt", lang)}>
            <section className="card">
              <div className="dx-card-head"><div><h2>{pt("s_debt", lang)}</h2><p>{pt("ds_h", lang)}</p></div></div>
              <div className="pf-ds">
                <div>
                  <div className="pf-ds-fig">
                    <span>{pt("ds_capacity", lang)}</span>
                    <b>{money.full(sizing.capacityEur)} <small className="pf-dim">{money.cur}</small></b>
                    <small>{sizing.binding === "gearing" ? pt("ds_bind_gearing", lang, { n: fnum(sizing.maxGearingPct, lang, 1) })
                      : pt((sizing.binding === "p50" ? "ds_bind_p50" : "ds_bind_p90") + (sizing.repayment === "sculpted" ? "_s" : ""), lang, { y: (sizing.binding === "p50" ? sizing.p50 : sizing.p90).bindingYear })}</small>
                  </div>
                  <div className="pf-ds-meter" role="img" aria-label={`${pt("ds_meter", lang)}: ${money.full(sizing.currentLoanEur)} / ${money.full(sizing.capacityEur)} ${money.cur}`}>
                    <i className={sizing.withinCapacity ? "" : "is-over"} style={{ width: (sizing.currentLoanEur / meterMax) * 100 + "%" }} />
                    <u style={{ left: (sizing.capacityEur / meterMax) * 100 + "%" }} />
                  </div>
                  <div className="pf-ds-cmp">
                    <div><span>{pt("ds_current", lang)}</span><b>{money.full(sizing.currentLoanEur)}</b></div>
                    <div className={sizing.withinCapacity ? "" : "is-over"}><span>{pt(sizing.withinCapacity ? "ds_headroom" : "ds_over", lang)}</span><b>{money.full(Math.abs(sizing.headroomEur))}</b></div>
                  </div>
                  {sizing.recommendedGearingPct != null && (
                    <div className="pf-ds-reco">
                      <b>{pt("ds_reco", lang, { g: fnum(sizing.recommendedGearingPct, lang, 1) })}</b>
                      {Math.abs(fin.gearingPct - sizing.recommendedGearingPct) < 1e-9
                        ? <span className="pf-dim">{pt("ds_in_use", lang)}</span>
                        : <button type="button" className="btn primary sm" onClick={() => setFin("gearingPct", sizing.recommendedGearingPct)}>{pt("ds_apply", lang, { g: fnum(sizing.recommendedGearingPct, lang, 1) })}</button>}
                      <small>{pt("ds_reco_h", lang)}</small>
                    </div>
                  )}
                </div>
                <div>
                  <div className="pf-ds-inputs">
                    <Num id="dsP50" label={pt("ds_p50", lang)} value={sz.p50Dscr ?? DEFAULT_SIZING.p50Dscr} onChange={(v) => setSizing("p50Dscr", v)} min="1" max="3" step="0.05" />
                    <Num id="dsP90" label={pt("ds_p90", lang)} value={sz.p90Dscr ?? DEFAULT_SIZING.p90Dscr} onChange={(v) => setSizing("p90Dscr", v)} min="1" max="3" step="0.05" />
                    <Num id="dsCap" label={pt("ds_cap", lang)} value={sz.maxGearingPct ?? DEFAULT_SIZING.maxGearingPct} onChange={(v) => setSizing("maxGearingPct", v)} min="0" max="95" step="1" />
                  </div>
                  <p className="pf-hint">{pt("ds_targets_h", lang)}</p>
                  <h3 className="pf-sh2">{pt("ds_tenor", lang)}</h3>
                  <table className="pf-mini">
                    <thead><tr><th>{pt("f_tenor", lang)}</th><th className="r">{pt("ds_capacity", lang)}, {money.cur}</th><th className="r">{pt("ds_share", lang)}</th></tr></thead>
                    <tbody>
                      {sizing.byTenor.map((t) => (
                        <tr key={t.tenorYears} className={t.tenorYears === fin.tenorYears ? "on" : ""}>
                          <td>{t.tenorYears}</td><td className="r">{money.full(t.capacityEur)}</td><td className="r">{t.pct == null ? "" : `${fnum(t.pct, lang, 1)}%`}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <p className="pf-hint">{sizing.repayment === "sculpted"
                    ? pt("ds_level", lang, { x: `${money.full(sizing.levelEur)} ${money.cur}` })
                    : pt("ds_sculpted", lang, { x: `${money.full(sizing.sculptedEur)} ${money.cur}` })}</p>
                  {agg.idcEur > 0.5 && <p className="pf-hint">{pt("ds_idc", lang, { x: `${money.full(agg.idcEur)} ${money.cur}` })}</p>}
                  {agg.dsraEur > 0.5 && <p className="pf-hint">{pt("ds_dsra", lang, { x: `${money.full(agg.dsraEur)} ${money.cur}`, m: fnum(fin.dsraMonths, lang, 1) })}</p>}
                  <details className="pf-rule-d"><summary>{pt("ds_rule_t", lang)}</summary><p>{pt(sizing.repayment === "sculpted" ? "ds_rule_s" : "ds_rule", lang)}</p></details>
                </div>
              </div>
            </section>

            <section className="card">
              <div className="dx-card-head"><div><h2>{pt("s_su", lang)}</h2></div></div>
              <SourcesUses su={model.sourcesUses} money={money} lang={lang} />
            </section>

            <section className="card">
              <div className="dx-card-head"><div><h2>{pt("s_compare", lang)}</h2><p>{pt("cmp_h", lang)}</p></div></div>
              <div className="pf-scroll">
                <table className="pf-t pf-cmp">
                  <thead><tr><th />{model.structures.map((s) => {
                    const pre = FINANCING_PRESETS.find((x) => x.id === s.preset);
                    return <th key={s.id} scope="col">{structureName(s, lang)}{pre && <small>{pt(pre.status === "published" ? "f_published" : "f_placeholder", lang)}</small>}</th>;
                  })}</tr></thead>
                  <tbody>
                    <tr><th scope="row">{pt("cmp_terms", lang)}</th>{model.structures.map((s) => <td key={s.id}>{termsLine(s.fin, lang)}</td>)}</tr>
                    <tr><th scope="row">{pt("k_grant", lang)}</th>{model.structures.map((s) => <td key={s.id} className="r">{money.full(s.grantEur)}</td>)}</tr>
                    <tr><th scope="row">{pt("k_debt", lang)}</th>{model.structures.map((s) => <td key={s.id} className="r">{money.full(s.loanEur)}</td>)}</tr>
                    <tr><th scope="row">{pt("su_equity", lang)}</th>{model.structures.map((s) => <td key={s.id} className="r">{money.full(s.equityEur)}</td>)}</tr>
                    <tr><th scope="row">{pt("k_dscr_p50", lang)}</th>{model.structures.map((s) => <td key={s.id} className={"r t-" + dscrTone(s.dscrMin)}>{s.loanEur > 0 ? fd(s.dscrMin) : na}</td>)}</tr>
                    <tr><th scope="row">{pt("k_dscr_p50", lang).replace("P50", "P90")}</th>{model.structures.map((s) => <td key={s.id} className="r">{s.loanEur > 0 ? fd(s.dscrMinP90) : na}</td>)}</tr>
                    <tr><th scope="row">{pt("m_irr", lang)}</th>{model.structures.map((s) => <td key={s.id} className="r">{fp(s.irr)}</td>)}</tr>
                    <tr><th scope="row">{pt("m_equityIrr", lang)}</th>{model.structures.map((s) => <td key={s.id} className="r">{fp(s.equityIrr)}</td>)}</tr>
                    <tr><th scope="row">{pt("k_npv", lang)}</th>{model.structures.map((s) => <td key={s.id} className="r">{money.full(s.npv)}</td>)}</tr>
                    <tr><th scope="row">{pt("ds_capacity", lang)}</th>{model.structures.map((s) => <td key={s.id} className="r">{money.full(s.capacityEur)}</td>)}</tr>
                    <tr><th scope="row">{pt("cmp_within", lang)}</th>{model.structures.map((s) => <td key={s.id}>{s.loanEur > 0 ? pt(s.withinCapacity ? "yes" : "no", lang) : ""}</td>)}</tr>
                    <tr><th scope="row" />{model.structures.map((s) => (
                      <td key={s.id}>{s.id !== "current" && (
                        <div className="pf-cmp-act">
                          <button type="button" className="btn ghost sm" onClick={() => applyAlt(s.id)}>{pt("cmp_use", lang)}</button>
                          <button type="button" className="btn danger sm" onClick={() => removeAlt(s.id)} aria-label={`${pt("cmp_remove", lang)}: ${structureName(s, lang)}`}>{pt("cmp_remove", lang)}</button>
                        </div>
                      )}</td>
                    ))}</tr>
                  </tbody>
                </table>
              </div>
              {alts.length >= MAX_STRUCTURES - 1 ? <p className="pf-hint">{pt("cmp_full", lang)}</p> : (
                <div className="pf-cmp-add">
                  <div className="field">
                    <label htmlFor="cmpAdd">{pt("cmp_add", lang)}</label>
                    <select id="cmpAdd" className="input" value="" onChange={(e) => addAlt(e.target.value)}>
                      <option value="">{pt("cmp_add_ph", lang)}</option>
                      {presetsFor(market).map((x) => <option key={x.id} value={x.id}>{x.name[lang] || x.name.en}</option>)}
                    </select>
                  </div>
                  <button type="button" className="btn ghost sm" onClick={snapshot}>{pt("cmp_snapshot", lang)}</button>
                </div>
              )}
            </section>
          </section>

          {/* ---- cash flow and debt cover */}
          <section id="cashflow" className="pf-sec" aria-label={pt("nav_cashflow", lang)}>
            <section className="card">
              <div className="dx-card-head"><div><h2>{pt("r_cashflow", lang)}</h2><p>{pt("r_cfads", lang)} / {pt("r_ds", lang)}, {money.cur}</p></div></div>
              <CashflowChart cfads={agg.cfads} debtService={agg.debtService} lang={lang} years={agg.cfads.length} rate={money.rate} />
            </section>
            <section className="card">
              <div className="dx-card-head"><div><h2>{pt("ch_dscr", lang)}</h2><p>{pt("ch_dscr_h", lang)}</p></div></div>
              <DscrChart p50={agg.dscrByYear} p90={model.p90.dscrByYear} targets={{ p50: sizing.p50Dscr, p90: sizing.p90Dscr }} lang={lang} />
            </section>
          </section>

          {/* ---- sensitivity and stress */}
          <section id="sensitivity" className="pf-sec" aria-label={pt("nav_sensitivity", lang)}>
            <section className="card">
              <div className="dx-card-head"><div><h2>{pt("tor_title", lang)}</h2><p>{pt("tor_h", lang)}</p></div></div>
              {metrics.length > 0 && (
                <div className="pf-segm" role="group" aria-label={pt("tor_metric", lang)}>
                  {metrics.map((m) => <button key={m} type="button" aria-pressed={metricNow === m} onClick={() => setMetric(m)}>{pt("m_" + m, lang)}</button>)}
                </div>
              )}
              <TornadoChart rows={torRows} base={metricNow ? model.sensitivity.base[metricNow] : null} metric={metricNow} rate={money.rate} lang={lang} />
            </section>

            {suite.length > 0 && (
              <section className="card">
                <div className="dx-card-head"><div><h2>{pt("s_stress", lang)}</h2><p>{pt("st_h", lang)}</p></div></div>
                {showShort && <p className="pf-hint">{pt(fin.dsraMonths > 0 ? "st_short_dsra_h" : "st_short_h", lang)}</p>}
                <div className="pf-scroll">
                  <table className="pf-t">
                    <thead><tr><th>{pt("st_case", lang)}</th><th className="r">{pt("col_dscr", lang)}</th><th className="r">{pt("col_irr", lang)}</th><th className="r">{pt("col_npv", lang)}</th><th className="r">{pt("st_dnpv", lang)}</th>
                      {showShort && <th className="r" title={pt(fin.dsraMonths > 0 ? "st_short_dsra_h" : "st_short_h", lang)}>{pt(fin.dsraMonths > 0 ? "st_short_dsra" : "st_short", lang)}</th>}</tr></thead>
                    <tbody>
                      {suite.map((s) => {
                        const d = s.agg.npv - suite[0].agg.npv;
                        const span = Math.max(1, ...suite.map((x) => Math.abs(x.agg.npv - suite[0].agg.npv)));
                        return (
                          <tr key={s.id}>
                            <td>{caseLabel(s.id, lang, market)}</td>
                            <td className={"r t-" + dscrTone(s.agg.dscrMin)}>{fd(s.agg.dscrMin)}</td>
                            <td className="r">{fp(s.agg.irr)}</td>
                            <td className="r">{money.full(s.agg.npv)}</td>
                            <td className="r pf-delta">{s.id === "base" ? "" : <span className="pf-dwrap"><span className="pf-dtrack" aria-hidden="true"><span className="pf-dbar" style={{ width: Math.min(100, (Math.abs(d) / span) * 100) + "%" }} /></span><b>{d >= 0 ? "+" : "−"}{money.full(Math.abs(d))}</b></span>}</td>
                            {showShort && <td className={"r" + (s.agg.shortfallEur > 0.5 ? " t-bad" : "")}>{money.full(s.agg.shortfallEur || 0)}</td>}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </section>
            )}
          </section>

          {/* ---- risk matrix */}
          <section id="risks" className="pf-sec" aria-label={pt("s_risks", lang)}>
            {risks.length > 0 && (
              <section className="card">
                <div className="dx-card-head"><div><h2>{pt("s_risks", lang)}</h2><p>{pt("rk_h", lang)}</p></div></div>
                <div className="pf-scroll">
                  <table className="pf-t pf-risk">
                    <tbody>
                      {risks.map((r) => {
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
          </section>

          {/* ---- document register */}
          <section id="papers" className="pf-sec" aria-label={pt("s_docs", lang)}>
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
                            {a.kind === "plant" ? (
                              // read from the plant's permit checklist, edited there
                              <a className={"pf-doc-ro ds-" + (a.docs[k] || "missing")} href={"#plant-" + a.id}>{pt("ds_" + (a.docs[k] || "missing"), lang)}</a>
                            ) : (
                              <select className={"input pf-doc ds-" + (a.docs[k] || "missing")} aria-label={`${a.name}: ${pt("dk_" + k, lang)}`}
                                value={a.docs[k] || "missing"} onChange={(e) => setDoc(a.id, k, e.target.value)}>
                                {["missing", "draft", "done"].map((s) => <option key={s} value={s}>{pt("ds_" + s, lang)}</option>)}
                              </select>
                            )}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </section>

          {/* ---- environmental and social screening */}
          <section id="es" className="pf-sec" aria-label={pt("s_es", lang)}>
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
          </section>
        </>
      )}

      {/* ---- documents for the lender */}
      <section id="export" className="card pf-sec-card">
        <div className="dx-card-head"><div><h2>{pt("s_export", lang)}</h2><p>{pt("ex_h", lang)}</p></div></div>
        <div className="pf-export">
          <div className="field"><label htmlFor="exLang">{pt("ex_lang", lang)}</label>
            <select id="exLang" className="input" value={docLang} onChange={(e) => setDocLang(e.target.value)}>
              <option value="en">English</option><option value="uk">Українська</option><option value="ro">Română</option><option value="ru">Русский</option>
            </select></div>
          <a className={"btn primary" + (exportsOff ? " off" : "")} aria-disabled={exportsOff} tabIndex={exportsOff ? -1 : undefined} href={`/api/portfolios/${portfolio.id}/report${exportQs}`} target="_blank" rel="noopener noreferrer">{pt("ex_report", lang)}</a>
          <a className={"btn ghost" + (exportsOff ? " off" : "")} aria-disabled={exportsOff} tabIndex={exportsOff ? -1 : undefined} href={`/api/portfolios/${portfolio.id}/teaser${exportQs}`} target="_blank" rel="noopener noreferrer" title={pt("ex_teaser_h", lang)}>{pt("ex_teaser", lang)}</a>
          <a className={"btn ghost" + (exportsOff ? " off" : "")} aria-disabled={exportsOff} tabIndex={exportsOff ? -1 : undefined} href={`/api/portfolios/${portfolio.id}/model${exportQs}`}>{pt("ex_model", lang)}</a>
          <PackPay portfolioId={portfolio.id} companyId={portfolio.company_id} lang={lang} disabled={exportsOff}>{(locked) => (locked
            ? <span className="btn ghost off" aria-disabled="true">{pt("ex_room", lang)}</span>
            : <a className={"btn ghost" + (exportsOff ? " off" : "")} aria-disabled={exportsOff} tabIndex={exportsOff ? -1 : undefined} href={`/api/portfolios/${portfolio.id}/dataroom${exportQs}`}>{pt("ex_room", lang)}</a>)}</PackPay>
        </div>
        <p className="pf-hint">{pt("ex_teaser_h", lang)}</p>
        <div className="pf-foot">
          <button type="button" className="btn danger sm" onClick={async () => {
            if (!window.confirm(pt("delete_ask", lang))) return;
            clearTimeout(timer.current);
            await deletePortfolio(portfolio.id);
            router.push("/portfolios");
          }}>{pt("delete", lang)}</button>
          <small className="pf-hint">{company}</small>
        </div>
      </section>
    </div>
  );
}
