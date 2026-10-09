"use client";
// components/portfolio/PlantsPanel.jsx — the utility plants of a portfolio,
// one editor each: the site, the wind, solar and storage on it, the revenue
// contract, the costs, what it all comes to for a lender (energy at P50 and
// P90, capex, cost per MWh, the lowest debt cover and how much room there is
// before it reaches the bank's target), and the permit checklist kept the way
// the EVO portal will track it, and the bank submission pack built from all
// of it (lib/bankPack.js): one ZIP with the credit summary in Romanian and
// English, the plant's Excel model, the checklist and the documents filed on
// it. Each checklist item holds its documents and the bank's questions
// (ItemFiles), and the deal room opens a read-only link for a bank (DealRoom).
//
// Plants are stored on the portfolio (assets.__plants) and saved through the
// portfolio page's own autosave: this component only edits the list it is
// given and hands the new list back. Public data (NASA POWER wind, PVGIS sun)
// is fetched through lib/plantActions.js on the user's request.
import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { normalizePlant, plantEnergy, plantCapex, plantHeadroom } from "../../lib/plantFinance.js";
import { STATUSES, GRID_STEPS, permitProgress } from "../../lib/plantPermits.js";
import { connectionGroups } from "../../lib/gridOptions.js";
import { screenWindAt, solarYieldAt } from "../../lib/plantActions.js";
import { blankPlant } from "../../lib/plantSample.js";
import { AUCTION_2 } from "../../lib/greenData.js";
import { plt } from "../../lib/plantText.js";
import { bt } from "../../lib/bankText.js";
import { stillMissing, PACK_LANGS } from "../../lib/bankPack.js";
import { namesList } from "../../lib/portfolioDisplay.js";
import StudyReader from "./StudyReader.jsx";
import { P90Basis, WeatherReplay, SeasonalCover, ExportLimit } from "./EnergyBasis.jsx";
import { monthlyCover } from "../../lib/monthlyCover.js";
import { weatherReplay } from "../../lib/weatherReplay.js";
import { preflight } from "../../lib/preflight.js";
import { checkText } from "../../lib/preflightText.js";
import { basisLine, replayLine, monthlyLine } from "../../lib/energyBasis.js";
import SitePicker from "./SitePicker.jsx";
import GridPanel from "./GridPanel.jsx";
import { siteDrift } from "../../lib/sitePick.js";
import { useDealRoom } from "./useDealRoom.js";
import ItemFiles from "./ItemFiles.jsx";
import DealRoom from "./DealRoom.jsx";
import { dt } from "../../lib/dealText.js";
import { docCounts, isAnswered } from "../../lib/dealRoom.js";
import { num as fnum, mwhUnit, dscr, dscrTone } from "../../lib/portfolioFormat.js";

function Field({ id, label, value, onChange, step = "any", min, max, type = "number", wide = false, placeholder, hint }) {
  return (
    <div className={"field" + (wide ? " pl-wide" : "")}>
      <label htmlFor={id}>{label}</label>
      {type === "number"
        ? <input id={id} className="input" type="number" inputMode="decimal" step={step} min={min} max={max} value={value ?? ""} onChange={(e) => onChange(e.target.value === "" ? "" : +e.target.value)} />
        : <input id={id} className="input" type={type} value={value ?? ""} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />}
      {hint && <small className="pf-hint">{hint}</small>}
    </div>
  );
}

function Plant({ raw, onChange, onRemove, lang, E, fin, scenario, money, target, todayKey, result, portfolioId, companyId, saving, sites = [], groups = null }) {
  const pl = normalizePlant(raw);
  const [busy, setBusy] = useState(null);
  // the deal room: documents and questions per checklist item, and the bank links
  const deal = useDealRoom({ portfolioId, plantId: pl.id, companyId });
  const [filesOpen, setFilesOpen] = useState(null);
  const counts = docCounts(deal.docs);
  const qOpen = {};
  for (const q of deal.questions) if (!isAnswered(q)) qOpen[q.item_id] = (qOpen[q.item_id] || 0) + 1;
  const showFiles = deal.on && deal.ready && !deal.needsDb;
  const filesBtn = (itemId) => (
    <button type="button" className={"if-btn" + (counts[itemId] ? " has" : "")} aria-expanded={filesOpen === itemId} onClick={() => setFilesOpen(filesOpen === itemId ? null : itemId)}>
      {counts[itemId] ? dt("if_docs_n", lang, { n: counts[itemId] }) : dt("if_docs", lang)}
      {qOpen[itemId] ? <em>{dt("if_q_open", lang, { n: qOpen[itemId] })}</em> : null}
    </button>
  );
  const [msg, setMsg] = useState(null);
  const [picking, setPicking] = useState(false);
  const [stepsOpen, setStepsOpen] = useState(false);
  const id = pl.id;
  // a lookup that answers after the user typed elsewhere writes onto the plant
  // as it is then, not as it was when the lookup started
  const live = useRef({ raw, onChange });
  useEffect(() => { live.current = { raw, onChange }; });
  const set = (patch) => onChange({ ...raw, ...patch });
  const setIn = (key, patch) => onChange({ ...raw, [key]: { ...(raw[key] || {}), ...patch } });
  const setLive = (key, patch) => { const { raw: r, onChange: ch } = live.current; ch({ ...r, [key]: { ...(r[key] || {}), ...patch } }); };
  const drift = siteDrift(pl);
  const en = plantEnergy(pl);
  const cap = plantCapex(pl);
  const hr = plantHeadroom(pl, E, fin, scenario, target);
  const mwh = (v) => `${fnum(v, lang, 0)} ${mwhUnit(lang)}`;
  const pc = (v) => `${fnum(v, lang, 1)}%`;
  const hasSite = pl.lat != null && pl.lon != null;
  const srcLabel = (s) => plt(s === "study" ? "src_study" : s === "screening" ? "src_screening" : s === "none" ? "src_none" : "src_pvgis", lang);

  async function screen() {
    setBusy("wind"); setMsg(null);
    const r = await screenWindAt(pl.lat, pl.lon).catch(() => null);
    setBusy(null);
    if (r && r.ok) setLive("wind", { screening: r.screening });
    else setMsg({ k: "wind", t: plt("w_failed", lang) });
  }
  async function pvgis(at = pl) {
    setBusy("solar"); setMsg(null);
    const r = await solarYieldAt(at.lat, at.lon).catch(() => null);
    setBusy(null);
    if (r && r.ok) setLive("solar", { yieldKwhKwp: r.yieldKwhKwp, yieldSource: "pvgis", yieldAt: { lat: at.lat, lon: at.lon }, ...r.site });
    else setMsg({ k: "solar", t: plt("sol_failed", lang) });
  }

  // a point chosen on the map: the site moves there, and the wind and the sun
  // are looked up again for it when the user asked
  async function onPick({ lat, lon, locality, rescreen }) {
    setPicking(false);
    onChange({ ...raw, lat, lon, ...(locality ? { locality } : {}) });
    if (!rescreen) return;
    if (raw.wind) {
      setBusy("wind"); setMsg(null);
      const r = await screenWindAt(lat, lon).catch(() => null);
      setBusy(null);
      if (r && r.ok) setLive("wind", { screening: r.screening });
      else setMsg({ k: "wind", t: plt("w_failed", lang) });
    }
    if (raw.solar) await pvgis({ lat, lon });
  }

  const p90Mwh = (en.wind ? en.wind.p50Mwh * Math.max(0, 1 - (1.2816 * en.wind.sigmaPct) / 100) : 0)
    + (en.solar ? en.solar.p50Mwh * Math.max(0, 1 - (1.2816 * en.solar.sigmaPct) / 100) : 0);
  const prog = permitProgress(pl.permits, todayKey);
  const permitName = (k) => plt("pm_" + k, lang);
  const t = dscr(target, lang);
  // the bank pack: what the bank still waits for, and the links (off while an edit is saving)
  const miss = stillMissing(pl, todayKey);
  const gapName = (g) => (g.id === "borrower" ? bt("f_borrower", lang) : g.id === "moved" ? bt("gap_moved_short", lang, { x: plt(g.part === "wind" ? "c_wind" : g.part === "grid" ? "grid_h" : "c_solar", lang) }) : permitName("yield"));
  const missNames = [...miss.gaps.map(gapName), ...miss.items.map((r) => permitName(r.id))];
  const packOff = !!saving || !portfolioId || !id;
  const offProps = packOff ? { "aria-disabled": true, tabIndex: -1 } : {};
  const packLang = PACK_LANGS.includes(lang) ? lang : "ro";
  // what a careful reader would catch before the bank does (lib/preflight.js)
  const checks = preflight({ plant: raw, docs: showFiles ? deal.docs : null, todayKey });
  // the loan's cover on each weather year on record (lib/weatherReplay.js)
  const replay = weatherReplay(raw, E, fin, scenario);
  // the cover month by month in the leanest loan year (lib/monthlyCover.js)
  const seasonal = monthlyCover(raw, E, fin, scenario);

  return (
    <article id={"plant-" + id} className="card pl" aria-labelledby={"pl-h-" + id}>
      <header className="pl-head">
        <h3 id={"pl-h-" + id}>{pl.name || plt("new_plant_ph", lang)}</h3>
        {pl.sample && <span className="pl-badge">{plt("sample_badge", lang)}</span>}
        <button type="button" className="btn ghost sm pl-rm" onClick={() => { if (window.confirm(plt("remove_confirm", lang, { name: pl.name || "" }))) onRemove(); }}>{plt("remove_plant", lang)}</button>
      </header>
      {pl.sample && <p className="pl-note">{plt("sample_note", lang)}</p>}

      <div className="pl-grid">
        <Field id={`pn-${id}`} type="text" wide label={plt("f_name", lang)} value={raw.name} onChange={(v) => set({ name: v })} />
        <Field id={`pc-${id}`} type="text" label={plt("f_locality", lang)} value={raw.locality} onChange={(v) => set({ locality: v })} />
        <Field id={`pla-${id}`} label={plt("f_lat", lang)} value={raw.lat} onChange={(v) => set({ lat: v })} step="0.0001" />
        <Field id={`plo-${id}`} label={plt("f_lon", lang)} value={raw.lon} onChange={(v) => set({ lon: v })} step="0.0001" />
        <Field id={`po-${id}`} type="text" label={plt("f_operator", lang)} value={raw.operator} onChange={(v) => set({ operator: v })} />
        <Field id={`pb-${id}`} type="text" label={bt("f_borrower", lang)} placeholder={bt("f_borrower_ph", lang)} value={raw.borrower} onChange={(v) => set({ borrower: v })} />
        <Field id={`psp-${id}`} type="text" label={bt("f_sponsor", lang)} value={raw.sponsor} onChange={(v) => set({ sponsor: v })} />
      </div>
      {!picking && (
        <div className="pl-row">
          <button type="button" className="btn sm" onClick={() => setPicking(true)}>{plt("pick_btn", lang)}</button>
          {busy && (raw.wind || raw.solar) && <small className="pf-hint" role="status">{plt("pick_looking_up", lang)}</small>}
        </div>
      )}
      {picking && (
        <SitePicker id={id} lang={lang} start={hasSite ? { lat: pl.lat, lon: pl.lon } : null} locality={pl.locality}
          others={sites.filter((s) => s.id !== id)} hasParts={!!(raw.wind || raw.solar)} onPick={onPick} onCancel={() => setPicking(false)} />
      )}

      {/* ---- wind, solar, storage */}
      <div className="pl-comps">
        <section className="pl-comp" aria-label={plt("c_wind", lang)}>
          <div className="pl-comp-h"><h4>{plt("c_wind", lang)}</h4>
            {raw.wind ? <button type="button" className="btn ghost sm" onClick={() => set({ wind: null })}>{plt("c_remove", lang)}</button>
              : <button type="button" className="btn sm" onClick={() => set({ wind: { mw: 20, turbines: 4, hubM: 150, shear: 0.2, lossesPct: 15, turbine: { cutIn: 3, rated: 10, cutOut: 25 } } })}>{plt("c_add", lang, { x: plt("c_wind", lang).toLowerCase() })}</button>}
          </div>
          {raw.wind && (
            <>
              <div className="pl-grid">
                <Field id={`wm-${id}`} label={plt("w_mw", lang)} value={raw.wind.mw} onChange={(v) => setIn("wind", { mw: v })} min="0" />
                <Field id={`wt-${id}`} label={plt("w_turbines", lang)} value={raw.wind.turbines} onChange={(v) => setIn("wind", { turbines: v })} step="1" min="1" />
                <Field id={`wh-${id}`} label={plt("w_hub", lang)} value={raw.wind.hubM} onChange={(v) => setIn("wind", { hubM: v })} min="30" max="250" />
                <Field id={`ws-${id}`} label={plt("w_shear", lang)} value={raw.wind.shear} onChange={(v) => setIn("wind", { shear: v })} step="0.01" min="0" max="0.6" />
                <Field id={`wl-${id}`} label={plt("w_losses", lang)} value={raw.wind.lossesPct} onChange={(v) => setIn("wind", { lossesPct: v })} min="0" max="60" />
                <Field id={`wr-${id}`} label={plt("w_rated", lang)} value={raw.wind.turbine?.rated} onChange={(v) => setIn("wind", { turbine: { ...(raw.wind.turbine || {}), rated: v } })} step="0.5" min="6" max="16" />
              </div>
              <div className="pl-row">
                <button type="button" className="btn sm" disabled={!hasSite || busy === "wind"} aria-busy={busy === "wind"} onClick={screen}>
                  {raw.wind.screening ? plt("w_screen_again", lang) : plt("w_screen", lang)}{busy === "wind" ? "..." : ""}
                </button>
                {!hasSite && <small className="pf-hint">{plt("f_need_site", lang)}</small>}
              </div>
              {msg?.k === "wind" && <p className="pf-warn" role="alert">{msg.t}</p>}
              {drift.wind != null && <p className="pf-warn">{plt("moved_wind", lang, { km: fnum(drift.wind, lang, 1) })}</p>}
              {en.wind && en.wind.source === "screening" ? (
                <p className="pl-line">{plt("w_screening", lang, {
                  mwh: mwh(en.wind.p50Mwh), cf: pc(en.wind.cfPct), ws: `${fnum(en.wind.meanHub, lang, 2)} m/s`,
                  src: pl.wind.screening.source.split(",")[0], year: pl.wind.screening.year, clim: pl.wind.screening.climMean ? plt("w_clim", lang) : "",
                })}</p>
              ) : en.wind && en.wind.source === "none" ? <p className="pf-hint">{plt("w_no_data", lang)}</p> : null}
              {en.wind && en.wind.source !== "study" && <p className="pf-hint">{plt("w_screen_note", lang)}</p>}
              <h5>{plt("study_h", lang)}</h5>
              <StudyReader kind="wind" id={id} lang={lang} plantMw={pl.wind.mw}
                onApply={({ study, extra }) => setIn("wind", { ...extra, study: { ...(raw.wind.study || {}), ...study } })} />
              <div className="pl-grid">
                <Field id={`wp5-${id}`} label={plt("s_p50", lang)} value={raw.wind.study?.p50Mwh} onChange={(v) => setIn("wind", { study: { ...(raw.wind.study || {}), p50Mwh: v } })} min="0" />
                <Field id={`wp9-${id}`} label={plt("s_p90", lang)} value={raw.wind.study?.p90Mwh} onChange={(v) => setIn("wind", { study: { ...(raw.wind.study || {}), p90Mwh: v } })} min="0" />
                <Field id={`wsb-${id}`} type="text" label={plt("s_by", lang)} value={raw.wind.study?.by} onChange={(v) => setIn("wind", { study: { ...(raw.wind.study || {}), by: v } })} />
                <Field id={`wsd-${id}`} type="date" label={plt("s_date", lang)} value={raw.wind.study?.date} onChange={(v) => setIn("wind", { study: { ...(raw.wind.study || {}), date: v } })} />
              </div>
              {en.wind && en.wind.source === "study" && <p className="pl-line ok">{plt("s_used", lang)}</p>}
            </>
          )}
        </section>

        <section className="pl-comp" aria-label={plt("c_solar", lang)}>
          <div className="pl-comp-h"><h4>{plt("c_solar", lang)}</h4>
            {raw.solar ? <button type="button" className="btn ghost sm" onClick={() => set({ solar: null })}>{plt("c_remove", lang)}</button>
              : <button type="button" className="btn sm" onClick={() => set({ solar: { mwp: 10, yieldKwhKwp: 0, degrPctYr: 0.5 } })}>{plt("c_add", lang, { x: plt("c_solar", lang).toLowerCase() })}</button>}
          </div>
          {raw.solar && (
            <>
              <div className="pl-grid">
                <Field id={`sm-${id}`} label={plt("sol_mwp", lang)} value={raw.solar.mwp} onChange={(v) => setIn("solar", { mwp: v })} min="0" />
                <Field id={`sy-${id}`} label={plt("sol_yield", lang)} value={raw.solar.yieldKwhKwp} onChange={(v) => setIn("solar", { yieldKwhKwp: v, yieldSource: "manual" })} min="0" max="2500" />
                <Field id={`sf-${id}`} label={plt("sol_degr_first", lang)} hint={plt("sol_degr_first_h", lang)} value={raw.solar.degrFirstPct ?? ""} onChange={(v) => setIn("solar", { degrFirstPct: v })} min="0" max="10" step="0.1" />
                <Field id={`sa-${id}`} label={plt("sol_avail", lang)} hint={plt("sol_avail_h", lang)} value={raw.solar.availabilityPct ?? ""} onChange={(v) => setIn("solar", { availabilityPct: v })} min="0" max="20" step="0.1" />
                <Field id={`sx-${id}`} label={plt("sol_ac", lang)} hint={plt("sol_ac_h", lang)} value={raw.solar.acMw ?? ""} onChange={(v) => setIn("solar", { acMw: v })} min="0" step="0.1" />
                <Field id={`se-${id}`} label={plt("exp_mw", lang)} hint={plt("exp_mw_h", lang)} value={raw.exportMw ?? ""} onChange={(v) => set({ exportMw: v })} min="0" step="0.1" />
              </div>
              <ExportLimit pl={pl} lang={lang} money={money} hint heading={false} lineClass="pl-line" noteClass="pf-hint" />
              {pl.solar.variabilityPct != null && <p className="pl-line ok">{plt("sol_pvgis_got", lang, { sd: fnum(pl.solar.variabilityPct, lang, 1), db: pl.solar.variabilityDb, years: pl.solar.variabilityYears })}</p>}
              <div className="pl-row">
                <button type="button" className="btn sm" disabled={!hasSite || busy === "solar"} aria-busy={busy === "solar"} onClick={() => pvgis()}>{plt("sol_lookup", lang)}{busy === "solar" ? "..." : ""}</button>
                {!hasSite && <small className="pf-hint">{plt("f_need_site", lang)}</small>}
              </div>
              {msg?.k === "solar" && <p className="pf-warn" role="alert">{msg.t}</p>}
              {drift.solar != null && <p className="pf-warn">{plt("moved_solar", lang, { km: fnum(drift.solar, lang, 1) })}</p>}
              <h5>{plt("study_h", lang)}</h5>
              <StudyReader kind="solar" id={id} lang={lang} plantMw={pl.solar.mwp}
                onApply={({ study, extra }) => setIn("solar", { ...extra, study: { ...(raw.solar.study || {}), ...study } })} />
              <div className="pl-grid">
                <Field id={`sp5-${id}`} label={plt("s_p50", lang)} value={raw.solar.study?.p50Mwh} onChange={(v) => setIn("solar", { study: { ...(raw.solar.study || {}), p50Mwh: v } })} min="0" />
                <Field id={`sp9-${id}`} label={plt("s_p90", lang)} value={raw.solar.study?.p90Mwh} onChange={(v) => setIn("solar", { study: { ...(raw.solar.study || {}), p90Mwh: v } })} min="0" />
              </div>
              {en.solar && en.solar.source === "study" && <p className="pl-line ok">{plt("s_used", lang)}</p>}
            </>
          )}
        </section>

        <section className="pl-comp" aria-label={plt("c_bess", lang)}>
          <div className="pl-comp-h"><h4>{plt("c_bess", lang)}</h4>
            {raw.bess ? <button type="button" className="btn ghost sm" onClick={() => set({ bess: null })}>{plt("c_remove", lang)}</button>
              : <button type="button" className="btn sm" onClick={() => set({ bess: { mw: 5, mwh: 10 } })}>{plt("c_add", lang, { x: plt("c_bess", lang).toLowerCase() })}</button>}
          </div>
          {raw.bess && (
            <>
              <div className="pl-grid">
                <Field id={`bm-${id}`} label={plt("b_mw", lang)} value={raw.bess.mw} onChange={(v) => setIn("bess", { mw: v })} min="0" />
                <Field id={`bh-${id}`} label={plt("b_mwh", lang)} value={raw.bess.mwh} onChange={(v) => setIn("bess", { mwh: v })} min="0" />
                <Field id={`br-${id}`} label={plt("b_rev", lang)} value={raw.revenue?.bessEurPerMwYr} onChange={(v) => setIn("revenue", { bessEurPerMwYr: v })} min="0" />
                <Field id={`by-${id}`} label={plt("b_years", lang)} value={raw.revenue?.bessYears ?? pl.revenue.bessYears} onChange={(v) => setIn("revenue", { bessYears: v })} step="1" min="0" max="30" />
              </div>
              <p className="pf-hint">{plt("b_note", lang)}</p>
            </>
          )}
        </section>
      </div>

      {/* ---- revenue and costs */}
      <div className="pl-two">
        <section aria-label={plt("rev_h", lang)}>
          <h4>{plt("rev_h", lang)}</h4>
          <div className="pl-grid">
            <div className="field">
              <label htmlFor={`rk-${id}`}>{plt("rev_kind", lang)}</label>
              <select id={`rk-${id}`} className="input" value={pl.revenue.kind} onChange={(e) => setIn("revenue", { kind: e.target.value })}>
                {["auction", "ppa", "merchant"].map((k) => <option key={k} value={k}>{plt("rk_" + k, lang)}</option>)}
              </select>
            </div>
            <Field id={`rp-${id}`} label={plt("rev_price", lang)} value={raw.revenue?.priceEurMwh} onChange={(v) => setIn("revenue", { priceEurMwh: v })} min="0" />
            {pl.revenue.kind !== "merchant" && <Field id={`ry-${id}`} label={plt("rev_years", lang)} value={raw.revenue?.years} onChange={(v) => setIn("revenue", { years: v })} step="1" min="0" max="30" />}
            {pl.revenue.kind !== "merchant" && <Field id={`ri-${id}`} label={plt("rev_index", lang)} value={raw.revenue?.indexPct} onChange={(v) => setIn("revenue", { indexPct: v })} step="0.1" />}
            {pl.revenue.kind !== "merchant" && <Field id={`ra-${id}`} label={plt("rev_after", lang)} value={raw.revenue?.afterEurMwh} onChange={(v) => setIn("revenue", { afterEurMwh: v })} min="0" />}
            {pl.revenue.kind !== "merchant" && (
              <div className="field">
                <label htmlFor={`rc-${id}`}>{plt("rev_cur", lang)}</label>
                <select id={`rc-${id}`} className="input" value={pl.revenue.currency} onChange={(e) => setIn("revenue", { currency: e.target.value })}>
                  <option value="EUR">EUR</option><option value="local">{plt("rev_local", lang)}</option>
                </select>
              </div>
            )}
          </div>
          {pl.revenue.kind === "auction" && <p className="pf-hint">{plt("rev_hint", lang, { p: `${fnum(AUCTION_2.priceEurMwh, lang, 2)} EUR/${mwhUnit(lang)}` })}</p>}
        </section>
        <section aria-label={plt("cost_h", lang)}>
          <h4>{plt("cost_h", lang)}</h4>
          <div className="pl-grid">
            {raw.wind && <Field id={`kw-${id}`} label={plt("k_wind", lang)} value={raw.costs?.windEurPerKw} onChange={(v) => setIn("costs", { windEurPerKw: v })} min="0" />}
            {raw.solar && <Field id={`ks-${id}`} label={plt("k_solar", lang)} value={raw.costs?.solarEurPerKw} onChange={(v) => setIn("costs", { solarEurPerKw: v })} min="0" />}
            {raw.bess && <Field id={`kb-${id}`} label={plt("k_bess", lang)} value={raw.costs?.bessEurPerKwh} onChange={(v) => setIn("costs", { bessEurPerKwh: v })} min="0" />}
            <Field id={`kg-${id}`} label={plt("k_grid", lang)} value={raw.costs?.gridEur} onChange={(v) => setIn("costs", { gridEur: v })} min="0" />
            <Field id={`kd-${id}`} label={plt("k_dev", lang)} value={raw.costs?.devPct} onChange={(v) => setIn("costs", { devPct: v })} min="0" max="30" />
            {raw.wind && <Field id={`kow-${id}`} label={plt("k_opw", lang)} value={raw.costs?.opexWindEurPerKwYr} onChange={(v) => setIn("costs", { opexWindEurPerKwYr: v })} min="0" />}
            {raw.solar && <Field id={`kos-${id}`} label={plt("k_ops", lang)} value={raw.costs?.opexSolarEurPerKwYr} onChange={(v) => setIn("costs", { opexSolarEurPerKwYr: v })} min="0" />}
            {raw.bess && <Field id={`kob-${id}`} label={plt("k_opb", lang)} value={raw.costs?.opexBessEurPerKwhYr} onChange={(v) => setIn("costs", { opexBessEurPerKwhYr: v })} min="0" />}
            <Field id={`kl-${id}`} label={plt("k_land", lang)} value={raw.costs?.landEurYr} onChange={(v) => setIn("costs", { landEurYr: v })} min="0" />
            <Field id={`ki-${id}`} label={plt("k_ins", lang)} value={raw.costs?.insurancePct} onChange={(v) => setIn("costs", { insurancePct: v })} step="0.05" min="0" max="5" />
          </div>
        </section>
      </div>

      {/* ---- what it comes to */}
      <section className="pl-res" aria-label={plt("res_h", lang)}>
        <h4>{plt("res_h", lang)}</h4>
        <dl className="pl-kv">
          <div><dt>{plt("r_energy", lang)}</dt><dd>{mwh(en.p50Mwh)} / {mwh(p90Mwh)}<small>
            {[en.wind && `${plt("c_wind", lang)}: ${srcLabel(en.wind.source)}`, en.solar && `${plt("c_solar", lang)}: ${srcLabel(en.solar.source)}`].filter(Boolean).join(", ")}
          </small></dd></div>
          <div><dt>{plt("r_capex", lang)}</dt><dd>{money.full(result ? result.capexEur : cap.total)} {money.cur}</dd></div>
          <div><dt>{plt("r_lcoe", lang)}</dt><dd>{result && result.lcoe != null ? `${fnum(result.lcoe * 1000 * money.rate, lang, 1)} ${money.cur}/${mwhUnit(lang)}` : "-"}</dd></div>
          <div><dt>{plt("r_dscr", lang)}</dt><dd className={"t-" + dscrTone(hr.dscrMin)}>{hr.dscrMin == null ? "-" : dscr(hr.dscrMin, lang)}</dd></div>
        </dl>
        {hr.dscrMin == null ? <p className="pf-hint">{plt("hr_none", lang)}</p> : (
          <ul className="pl-hr">
            {hr.energyHeadroomPct != null && <li>{plt(hr.energyHeadroomPct >= 0 ? "hr_energy_pos" : "hr_energy_neg", lang, { x: pc(Math.abs(hr.energyHeadroomPct)), t })}</li>}
            {hr.capexHeadroomPct != null && <li>{plt(hr.capexHeadroomPct >= 0 ? "hr_capex_pos" : "hr_capex_neg", lang, { x: pc(Math.abs(hr.capexHeadroomPct)), t })}</li>}
          </ul>
        )}
        {en.solar && en.solar.p50Mwh > 0 && (
          <details className="pl-p90">
            <summary>{plt("p90_h", lang)}: {basisLine(en, lang, pl.solar)}</summary>
            <P90Basis solar={en.solar} lang={lang} className="pf-t" heading={false} />
          </details>
        )}
        {seasonal && (
          <details className="pl-p90">
            <summary>{plt("mc_h", lang)}: {monthlyLine(seasonal, lang, (v) => `${money.full(v)} ${money.cur}`)}</summary>
            <SeasonalCover mc={seasonal} lang={lang} money={money} className="pf-t" heading={false} />
          </details>
        )}
        {replay && (
          <details className="pl-p90">
            <summary>{plt("wr_h", lang)}: {replayLine(replay, lang)}</summary>
            <WeatherReplay replay={replay} lang={lang} className="pf-t" heading={false} />
          </details>
        )}
      </section>

      {/* ---- the grid around the site, and the connection */}
      <GridPanel id={id} lang={lang} raw={raw} hasSite={hasSite} money={money} E={E} fin={fin} scenario={scenario} groups={groups}
        onRaw={(fn) => { const { raw: r, onChange: ch } = live.current; ch(fn(r)); }} />

      {/* ---- permits, EVO-ready */}
      <section className="pl-permits" aria-label={plt("permits_h", lang)}>
        <div className="pl-comp-h"><h4>{plt("permits_h", lang)}</h4><span className="dx-count">{plt("p_progress", lang, { done: prog.done, total: prog.total })}</span></div>
        <p className="pf-hint">{plt("permits_p", lang)}</p>
        {prog.ready.length > 0 && <p className="pl-line">{plt("p_ready", lang, { x: prog.ready.map(permitName).join(", ") })}</p>}
        <div className="pf-scroll">
          <table className="pf-t pl-pt">
            <thead><tr><th /><th>{plt("p_status", lang)}</th><th>{plt("pf_by", lang)}</th><th>{plt("pf_ref", lang)}</th><th>{plt("pf_submitted", lang)}</th><th>{plt("pf_due", lang)}</th></tr></thead>
            <tbody>
              {prog.rows.map((r) => (
                <Fragment key={r.id}>
                <tr className={"st-" + r.state + (r.overdue ? " late" : "")}>
                  <td><b>{permitName(r.id)}</b><small>{r.state === "waiting" ? plt("p_waits", lang, { x: r.blockedBy.map(permitName).join(", ") }) : r.state === "ready" ? plt("p_ready_one", lang) : ""}{r.overdue ? ` ${plt("p_overdue", lang)}` : ""}</small>
                    {r.id === "grid" && (
                      <button type="button" className="pl-steps-btn" aria-expanded={stepsOpen || !!r.steps} onClick={() => setStepsOpen(!stepsOpen)}>
                        {plt("p_steps", lang)}{r.steps ? ` (${r.steps.filter((s) => s.status === "done").length}/${r.steps.length})` : ""}
                      </button>
                    )}
                    {showFiles && filesBtn(r.id)}</td>
                  <td>
                    <select className="input" aria-label={permitName(r.id)} value={r.status} disabled={!!r.steps && r.status !== "na"} title={r.steps ? plt("p_steps_h", lang) : undefined}
                      onChange={(e) => set({ permits: { ...(raw.permits || {}), [r.id]: { ...((raw.permits || {})[r.id] || {}), status: e.target.value } } })}>
                      {STATUSES.map((s) => <option key={s} value={s}>{plt("ps_" + s, lang)}</option>)}
                    </select>
                  </td>
                  {["by", "ref"].map((k) => (
                    <td key={k}><input className="input" aria-label={`${permitName(r.id)}: ${plt("pf_" + k, lang)}`} value={r[k]}
                      onChange={(e) => set({ permits: { ...(raw.permits || {}), [r.id]: { ...((raw.permits || {})[r.id] || {}), [k]: e.target.value } } })} /></td>
                  ))}
                  {["submitted", "due"].map((k) => (
                    <td key={k}><input className="input" type="date" aria-label={`${permitName(r.id)}: ${plt("pf_" + k, lang)}`} value={r[k]}
                      onChange={(e) => set({ permits: { ...(raw.permits || {}), [r.id]: { ...((raw.permits || {})[r.id] || {}), [k]: e.target.value } } })} /></td>
                  ))}
                </tr>
                {r.id === "grid" && (stepsOpen || r.steps) && GRID_STEPS.map((sid, i) => {
                  const st = (r.steps || [])[i] || { status: "todo", by: "", ref: "", submitted: "", due: "", overdue: false };
                  const put = (k, v) => { const { raw: cur, onChange: ch } = live.current; const p0 = cur.permits || {}; const g0 = p0.grid || {};
                    ch({ ...cur, permits: { ...p0, grid: { ...g0, steps: { ...(g0.steps || {}), [sid]: { ...((g0.steps || {})[sid] || {}), [k]: v } } } } }); };
                  const label = plt("gs_" + sid, lang);
                  return (
                    <tr key={sid} className={"pl-step st-" + st.status + (st.overdue ? " late" : "")}>
                      <td><span className="pl-step-n">{i + 1}</span>{label}{st.overdue ? <small>{plt("p_overdue", lang)}</small> : null}</td>
                      <td><select className="input" aria-label={label} value={st.status} onChange={(e) => put("status", e.target.value)}>
                        {STATUSES.map((s) => <option key={s} value={s}>{plt("ps_" + s, lang)}</option>)}
                      </select></td>
                      {["by", "ref"].map((k) => <td key={k}><input className="input" aria-label={`${label}: ${plt("pf_" + k, lang)}`} value={st[k]} onChange={(e) => put(k, e.target.value)} /></td>)}
                      {["submitted", "due"].map((k) => <td key={k}><input className="input" type="date" aria-label={`${label}: ${plt("pf_" + k, lang)}`} value={st[k]} onChange={(e) => put(k, e.target.value)} /></td>)}
                    </tr>
                  );
                })}
                {showFiles && filesOpen === r.id && (
                  <tr className="if-row"><td colSpan={6}><ItemFiles itemId={r.id} deal={deal} lang={lang} /></td></tr>
                )}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
        {showFiles && (
          <div className="if-other">
            <span>{plt("pm_other", lang)}</span>{filesBtn("other")}
            {filesOpen === "other" && <ItemFiles itemId="other" deal={deal} lang={lang} />}
          </div>
        )}
      </section>

      {/* ---- the bank submission pack */}
      <section className="pl-pack" aria-label={bt("pack_h", lang)}>
        <h4>{bt("pack_h", lang)}</h4>
        <p className="pf-hint">{bt("pack_p", lang)}</p>
        <div className="pl-checks">
          <h5>{bt("pf_h", lang)}</h5>
          {checks.length === 0 ? <p className="pl-line ok">{bt("pf_none", lang)}</p> : (
            <ul>
              {checks.map((c, i) => (
                <li key={c.id + i} className={"lv-" + c.level}><b>{bt(c.level === "stop" ? "pf_stop" : "pf_check", lang)}</b> {checkText(c, lang)}</li>
              ))}
            </ul>
          )}
        </div>
        <p className="pl-line">{miss.count === 0 ? bt("pack_missing_0", lang) : bt("pack_missing", lang, { n: missNames.length, x: namesList(missNames, lang, 4) })}</p>
        <div className="pl-row">
          <a className={"btn primary sm" + (packOff ? " off" : "")} {...offProps} href={`/api/portfolios/${portfolioId}/bankpack?plant=${encodeURIComponent(id)}&lang=${packLang}`}>{bt("pack_dl", lang)}</a>
          {PACK_LANGS.map((l) => (
            <a key={l} className={"btn ghost sm" + (packOff ? " off" : "")} {...offProps} href={`/portfolios/${portfolioId}/bank?plant=${encodeURIComponent(id)}&lang=${l}`} target="_blank" rel="noopener noreferrer">
              {bt("pack_view", lang, { l: bt("lang_" + l, lang) })}
            </a>
          ))}
        </div>
        <small className="pf-hint" role="status">{saving ? bt("pack_saving", lang) : bt("pack_wait", lang)}</small>
      </section>

      {/* ---- the deal room: read-only links for the banks, and who opened what */}
      {deal.on && <DealRoom deal={deal} lang={lang} disabled={packOff} />}
    </article>
  );
}

export default function PlantsPanel({ plants = [], onChange, lang = "en", E, fin, scenario, money, target = 1.3, todayKey, results = {}, portfolioId = "", companyId = "", saving = false, sites = [] }) {
  const list = Array.isArray(plants) ? plants : [];
  const put = (i, next) => onChange(list.map((x, j) => (j === i ? next : x)));
  // plants of this portfolio that connect at the same point (lib/gridOptions.js)
  const groups = useMemo(() => connectionGroups(Array.isArray(plants) ? plants : []), [plants]);
  const [adding, setAdding] = useState(false);
  const added = useRef(null);
  // a plant added on the map: bring its editor into view, its name field ready
  useEffect(() => {
    const id = added.current;
    if (!id || !document.getElementById("plant-" + id)) return;
    added.current = null;
    document.getElementById("plant-" + id).scrollIntoView({ behavior: "smooth", block: "start" });
    document.getElementById("pn-" + id)?.focus({ preventScroll: true });
  }, [list.length]);
  function addAt({ lat, lon, locality }) {
    const p = { ...blankPlant(""), lat, lon, locality: locality || "" };
    setAdding(false);
    onChange([...list, p]);
    added.current = p.id;
  }
  return (
    <div className="pl-list">
      {list.map((raw, i) => (
        <Plant key={raw.id || i} raw={raw} lang={lang} E={E} fin={fin} scenario={scenario} money={money} target={target} todayKey={todayKey}
          result={results[raw.id] || null} portfolioId={portfolioId} companyId={companyId} saving={saving} sites={sites} groups={groups}
          onChange={(next) => put(i, next)} onRemove={() => onChange(list.filter((_, j) => j !== i))} />
      ))}
      {adding ? (
        <SitePicker id="new" mode="add" lang={lang} others={sites} onPick={addAt} onCancel={() => setAdding(false)} />
      ) : (
        <div className="pl-row pl-adds">
          <button type="button" className="btn pl-add" onClick={() => onChange([...list, blankPlant("")])}>{plt("add_plant", lang)}</button>
          <button type="button" className="btn ghost pl-add" onClick={() => setAdding(true)}>{plt("pick_add", lang)}</button>
        </div>
      )}
    </div>
  );
}

